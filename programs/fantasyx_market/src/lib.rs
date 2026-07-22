use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("BKzkJqjSWh5GBofAQRR5cUsNr2GsF5j9FwJT1L3FvhcW");

const BPS_DENOMINATOR: u64 = 10_000;

#[program]
pub mod fantasyx_market {
    use super::*;

    pub fn initialize_protocol(ctx: Context<InitializeProtocol>, args: InitializeProtocolArgs) -> Result<()> {
        require!(args.fee_bps <= 1_000, FantasyXError::InvalidFee);
        require!(args.max_position_shares > 0, FantasyXError::InvalidAmount);

        let config = &mut ctx.accounts.config;
        config.authority = ctx.accounts.authority.key();
        config.quote_authority = args.quote_authority;
        config.settlement_authority = args.settlement_authority;
        config.collateral_mint = ctx.accounts.collateral_mint.key();
        config.fee_bps = args.fee_bps;
        config.max_position_shares = args.max_position_shares;
        config.paused = false;
        config.bump = ctx.bumps.config;

        emit!(ProtocolInitialized {
            authority: config.authority,
            quote_authority: config.quote_authority,
            settlement_authority: config.settlement_authority,
            collateral_mint: config.collateral_mint,
        });
        Ok(())
    }

    pub fn set_pause(ctx: Context<SetPause>, paused: bool) -> Result<()> {
        let config = &mut ctx.accounts.config;
        require_keys_eq!(config.authority, ctx.accounts.authority.key(), FantasyXError::Unauthorized);
        config.paused = paused;
        emit!(PauseUpdated { paused });
        Ok(())
    }

    pub fn register_market(ctx: Context<RegisterMarket>, args: RegisterMarketArgs) -> Result<()> {
        require!(!ctx.accounts.config.paused, FantasyXError::ProtocolPaused);
        require!(args.lock_ts > Clock::get()?.unix_timestamp, FantasyXError::InvalidLockTime);
        require!(args.market_id.as_bytes().len() <= 64, FantasyXError::MarketIdTooLong);

        let market = &mut ctx.accounts.market;
        market.config = ctx.accounts.config.key();
        market.creator = ctx.accounts.creator.key();
        market.liquidity_provider = ctx.accounts.liquidity_provider.key();
        market.collateral_mint = ctx.accounts.collateral_mint.key();
        market.escrow = ctx.accounts.escrow.key();
        market.market_id = args.market_id;
        market.lock_ts = args.lock_ts;
        market.status = MarketStatus::Registered;
        market.result = MarketResult::Unresolved;
        market.pending_result = MarketResult::Unresolved;
        market.yes_liability = 0;
        market.no_liability = 0;
        market.collateral_escrowed = 0;
        market.fees_accrued = 0;
        market.bump = ctx.bumps.market;
        market.escrow_bump = ctx.bumps.escrow;

        emit!(MarketRegistered {
            market: market.key(),
            market_id: market.market_id.clone(),
            lock_ts: market.lock_ts,
            liquidity_provider: market.liquidity_provider,
        });
        Ok(())
    }

    pub fn collateralize_market(ctx: Context<CollateralizeMarket>, amount: u64) -> Result<()> {
        require!(!ctx.accounts.config.paused, FantasyXError::ProtocolPaused);
        require!(amount > 0, FantasyXError::InvalidAmount);

        require!(
            ctx.accounts.market.status == MarketStatus::Registered || ctx.accounts.market.status == MarketStatus::Collateralized,
            FantasyXError::InvalidMarketState
        );
        require_keys_eq!(
            ctx.accounts.market.liquidity_provider,
            ctx.accounts.liquidity_provider.key(),
            FantasyXError::Unauthorized
        );

        token::transfer(ctx.accounts.lp_to_escrow_context(), amount)?;
        let market = &mut ctx.accounts.market;
        market.collateral_escrowed = checked_add(market.collateral_escrowed, amount)?;
        market.status = MarketStatus::Collateralized;
        assert_market_solvent(market)?;

        emit!(MarketCollateralized {
            market: market.key(),
            amount,
            collateral_escrowed: market.collateral_escrowed,
        });
        Ok(())
    }

    pub fn buy_position(ctx: Context<ExecuteQuote>, args: ExecuteQuoteArgs) -> Result<()> {
        require!(args.action == QuoteAction::Buy, FantasyXError::InvalidQuoteAction);
        require!(!ctx.accounts.config.paused, FantasyXError::ProtocolPaused);
        require_quote(&ctx, &args)?;
        require!(args.cost_or_proceeds <= args.max_cost_or_min_proceeds, FantasyXError::SlippageExceeded);

        require!(
            ctx.accounts.market.status == MarketStatus::Collateralized || ctx.accounts.market.status == MarketStatus::Trading,
            FantasyXError::InvalidMarketState
        );
        require!(Clock::get()?.unix_timestamp < ctx.accounts.market.lock_ts, FantasyXError::MarketLocked);
        require!(args.shares > 0 && args.cost_or_proceeds > 0, FantasyXError::InvalidAmount);

        token::transfer(ctx.accounts.user_to_escrow_context(), args.cost_or_proceeds)?;
        let market = &mut ctx.accounts.market;
        market.collateral_escrowed = checked_add(market.collateral_escrowed, args.cost_or_proceeds)?;
        market.fees_accrued = checked_add(market.fees_accrued, fee_amount(args.cost_or_proceeds, ctx.accounts.config.fee_bps)?)?;

        let position = &mut ctx.accounts.position;
        initialize_position_if_needed(position, ctx.accounts.user.key(), market.key(), ctx.bumps.position);

        match args.side {
            PositionSide::Yes => {
                position.yes_shares = checked_add(position.yes_shares, args.shares)?;
                market.yes_liability = checked_add(market.yes_liability, args.shares)?;
            }
            PositionSide::No => {
                position.no_shares = checked_add(position.no_shares, args.shares)?;
                market.no_liability = checked_add(market.no_liability, args.shares)?;
            }
        }
        require!(position.total_shares()? <= ctx.accounts.config.max_position_shares, FantasyXError::PositionLimitExceeded);
        market.status = MarketStatus::Trading;

        mark_quote_used(&mut ctx.accounts.used_quote, &args, market.key(), ctx.accounts.user.key(), ctx.bumps.used_quote);
        assert_market_solvent(market)?;

        emit!(PositionBought {
            market: market.key(),
            owner: ctx.accounts.user.key(),
            side: args.side,
            shares: args.shares,
            cost: args.cost_or_proceeds,
            quote_id: args.quote_id,
        });
        Ok(())
    }

    pub fn sell_position(ctx: Context<ExecuteQuote>, args: ExecuteQuoteArgs) -> Result<()> {
        require!(args.action == QuoteAction::Sell, FantasyXError::InvalidQuoteAction);
        require!(!ctx.accounts.config.paused, FantasyXError::ProtocolPaused);
        require_quote(&ctx, &args)?;
        require!(args.cost_or_proceeds >= args.max_cost_or_min_proceeds, FantasyXError::SlippageExceeded);

        require!(ctx.accounts.market.status == MarketStatus::Trading, FantasyXError::InvalidMarketState);
        require!(Clock::get()?.unix_timestamp < ctx.accounts.market.lock_ts, FantasyXError::MarketLocked);
        require!(args.shares > 0 && args.cost_or_proceeds > 0, FantasyXError::InvalidAmount);
        require!(ctx.accounts.market.collateral_escrowed >= args.cost_or_proceeds, FantasyXError::InsufficientCollateral);

        let market_key = ctx.accounts.market.key();
        let market_id = ctx.accounts.market.market_id.clone();
        let market_bump = ctx.accounts.market.bump;
        {
            let market = &mut ctx.accounts.market;
            let position = &mut ctx.accounts.position;
            match args.side {
                PositionSide::Yes => {
                    require!(position.yes_shares >= args.shares, FantasyXError::InsufficientShares);
                    position.yes_shares = checked_sub(position.yes_shares, args.shares)?;
                    market.yes_liability = checked_sub(market.yes_liability, args.shares)?;
                }
                PositionSide::No => {
                    require!(position.no_shares >= args.shares, FantasyXError::InsufficientShares);
                    position.no_shares = checked_sub(position.no_shares, args.shares)?;
                    market.no_liability = checked_sub(market.no_liability, args.shares)?;
                }
            }
            market.collateral_escrowed = checked_sub(market.collateral_escrowed, args.cost_or_proceeds)?;
            assert_market_solvent(market)?;
        }

        let bump = [market_bump];
        let signer_seeds: &[&[u8]] = &[b"market", market_id.as_bytes(), &bump];
        token::transfer(ctx.accounts.escrow_to_user_context().with_signer(&[signer_seeds]), args.cost_or_proceeds)?;

        mark_quote_used(&mut ctx.accounts.used_quote, &args, market_key, ctx.accounts.user.key(), ctx.bumps.used_quote);

        emit!(PositionSold {
            market: market_key,
            owner: ctx.accounts.user.key(),
            side: args.side,
            shares: args.shares,
            proceeds: args.cost_or_proceeds,
            quote_id: args.quote_id,
        });
        Ok(())
    }

    pub fn lock_market(ctx: Context<MarketAuthorityAction>) -> Result<()> {
        let market = &mut ctx.accounts.market;
        require!(
            market.status == MarketStatus::Collateralized || market.status == MarketStatus::Trading,
            FantasyXError::InvalidMarketState
        );
        let now = Clock::get()?.unix_timestamp;
        let actor = ctx.accounts.authority.key();
        require!(now >= market.lock_ts || actor == ctx.accounts.config.authority, FantasyXError::MarketNotLockable);
        market.status = MarketStatus::Locked;
        emit!(MarketLocked { market: market.key(), locked_at: now });
        Ok(())
    }

    pub fn propose_result(ctx: Context<SettlementAction>, result: MarketResult) -> Result<()> {
        require!(result == MarketResult::Yes || result == MarketResult::No, FantasyXError::InvalidResult);
        let market = &mut ctx.accounts.market;
        require!(market.status == MarketStatus::Locked, FantasyXError::InvalidMarketState);
        market.pending_result = result;
        market.status = MarketStatus::ResultProposed;
        assert_market_solvent(market)?;
        emit!(ResultProposed { market: market.key(), result });
        Ok(())
    }

    pub fn finalize_result(ctx: Context<SettlementAction>, result: MarketResult) -> Result<()> {
        require!(result == MarketResult::Yes || result == MarketResult::No, FantasyXError::InvalidResult);
        let market = &mut ctx.accounts.market;
        require!(market.status == MarketStatus::ResultProposed, FantasyXError::InvalidMarketState);
        require!(market.pending_result == result, FantasyXError::ResultMismatch);
        market.result = result;
        market.status = MarketStatus::Resolved;
        assert_market_solvent(market)?;
        emit!(ResultFinalized { market: market.key(), result });
        Ok(())
    }

    pub fn cancel_market(ctx: Context<SettlementAction>) -> Result<()> {
        let market = &mut ctx.accounts.market;
        require!(
            market.status != MarketStatus::Resolved && market.status != MarketStatus::Cancelled,
            FantasyXError::InvalidMarketState
        );
        market.status = MarketStatus::Cancelled;
        market.result = MarketResult::Cancelled;
        assert_market_solvent(market)?;
        emit!(MarketCancelled { market: market.key() });
        Ok(())
    }

    pub fn claim_winnings(ctx: Context<ClaimPosition>) -> Result<()> {
        let market_key = ctx.accounts.market.key();
        let market_id = ctx.accounts.market.market_id.clone();
        let market_bump = ctx.accounts.market.bump;
        let payout;
        {
            let market = &mut ctx.accounts.market;
            let position = &mut ctx.accounts.position;
            require!(market.status == MarketStatus::Resolved, FantasyXError::InvalidMarketState);
            require!(!position.claimed, FantasyXError::AlreadyClaimed);
            require_keys_eq!(position.owner, ctx.accounts.owner.key(), FantasyXError::Unauthorized);

            payout = match market.result {
                MarketResult::Yes => {
                    let shares = position.yes_shares;
                    market.yes_liability = checked_sub(market.yes_liability, shares)?;
                    shares
                }
                MarketResult::No => {
                    let shares = position.no_shares;
                    market.no_liability = checked_sub(market.no_liability, shares)?;
                    shares
                }
                _ => return err!(FantasyXError::InvalidResult),
            };
            require!(payout > 0, FantasyXError::NothingToClaim);
            require!(market.collateral_escrowed >= payout, FantasyXError::InsufficientCollateral);

            position.claimed = true;
            position.yes_shares = 0;
            position.no_shares = 0;
            market.collateral_escrowed = checked_sub(market.collateral_escrowed, payout)?;
            assert_market_solvent(market)?;
        }

        let bump = [market_bump];
        let signer_seeds: &[&[u8]] = &[b"market", market_id.as_bytes(), &bump];
        token::transfer(ctx.accounts.escrow_to_owner_context().with_signer(&[signer_seeds]), payout)?;

        emit!(WinningsClaimed { market: market_key, owner: ctx.accounts.owner.key(), payout });
        Ok(())
    }

    pub fn claim_refund(ctx: Context<ClaimPosition>) -> Result<()> {
        let market_key = ctx.accounts.market.key();
        let market_id = ctx.accounts.market.market_id.clone();
        let market_bump = ctx.accounts.market.bump;
        let payout;
        {
            let market = &mut ctx.accounts.market;
            let position = &mut ctx.accounts.position;
            require!(market.status == MarketStatus::Cancelled, FantasyXError::InvalidMarketState);
            require!(!position.claimed, FantasyXError::AlreadyClaimed);
            require_keys_eq!(position.owner, ctx.accounts.owner.key(), FantasyXError::Unauthorized);

            payout = checked_add(position.yes_shares, position.no_shares)?;
            require!(payout > 0, FantasyXError::NothingToClaim);
            require!(market.collateral_escrowed >= payout, FantasyXError::InsufficientCollateral);
            market.yes_liability = checked_sub(market.yes_liability, position.yes_shares)?;
            market.no_liability = checked_sub(market.no_liability, position.no_shares)?;
            position.claimed = true;
            position.yes_shares = 0;
            position.no_shares = 0;
            market.collateral_escrowed = checked_sub(market.collateral_escrowed, payout)?;
            assert_market_solvent(market)?;
        }

        let bump = [market_bump];
        let signer_seeds: &[&[u8]] = &[b"market", market_id.as_bytes(), &bump];
        token::transfer(ctx.accounts.escrow_to_owner_context().with_signer(&[signer_seeds]), payout)?;

        emit!(RefundClaimed { market: market_key, owner: ctx.accounts.owner.key(), payout });
        Ok(())
    }
}

#[macro_export]
macro_rules! market_signer_seeds {
    ($market:expr) => {
        [
            b"market",
            $market.market_id.as_bytes(),
            &[$market.bump],
        ]
    };
}

#[derive(Accounts)]
pub struct InitializeProtocol<'info> {
    #[account(init, payer = authority, space = 8 + ProtocolConfig::INIT_SPACE, seeds = [b"protocol"], bump)]
    pub config: Box<Account<'info, ProtocolConfig>>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub collateral_mint: Box<Account<'info, Mint>>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetPause<'info> {
    #[account(mut, seeds = [b"protocol"], bump = config.bump)]
    pub config: Box<Account<'info, ProtocolConfig>>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(args: RegisterMarketArgs)]
pub struct RegisterMarket<'info> {
    #[account(seeds = [b"protocol"], bump = config.bump, has_one = collateral_mint)]
    pub config: Box<Account<'info, ProtocolConfig>>,
    #[account(
        init,
        payer = creator,
        space = 8 + MarketAccount::INIT_SPACE,
        seeds = [b"market", args.market_id.as_bytes()],
        bump
    )]
    pub market: Box<Account<'info, MarketAccount>>,
    #[account(
        init,
        payer = creator,
        token::mint = collateral_mint,
        token::authority = market,
        seeds = [b"escrow", market.key().as_ref()],
        bump
    )]
    pub escrow: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub creator: Signer<'info>,
    /// CHECK: Development liquidity provider identity is stored and later required as signer.
    pub liquidity_provider: UncheckedAccount<'info>,
    pub collateral_mint: Box<Account<'info, Mint>>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct CollateralizeMarket<'info> {
    #[account(seeds = [b"protocol"], bump = config.bump, has_one = collateral_mint)]
    pub config: Box<Account<'info, ProtocolConfig>>,
    #[account(mut, has_one = collateral_mint, has_one = escrow)]
    pub market: Box<Account<'info, MarketAccount>>,
    #[account(mut, address = market.escrow, token::mint = collateral_mint)]
    pub escrow: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub liquidity_provider: Signer<'info>,
    #[account(mut, token::mint = collateral_mint, token::authority = liquidity_provider)]
    pub lp_collateral: Box<Account<'info, TokenAccount>>,
    pub collateral_mint: Box<Account<'info, Mint>>,
    pub token_program: Program<'info, Token>,
}

impl<'info> CollateralizeMarket<'info> {
    fn lp_to_escrow_context(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        CpiContext::new(
            self.token_program.to_account_info(),
            Transfer {
                from: self.lp_collateral.to_account_info(),
                to: self.escrow.to_account_info(),
                authority: self.liquidity_provider.to_account_info(),
            },
        )
    }
}

#[derive(Accounts)]
#[instruction(args: ExecuteQuoteArgs)]
pub struct ExecuteQuote<'info> {
    #[account(seeds = [b"protocol"], bump = config.bump, has_one = collateral_mint)]
    pub config: Box<Account<'info, ProtocolConfig>>,
    #[account(mut, has_one = collateral_mint, has_one = escrow)]
    pub market: Box<Account<'info, MarketAccount>>,
    #[account(
        init_if_needed,
        payer = user,
        space = 8 + PositionAccount::INIT_SPACE,
        seeds = [b"position", market.key().as_ref(), user.key().as_ref()],
        bump
    )]
    pub position: Box<Account<'info, PositionAccount>>,
    #[account(
        init,
        payer = user,
        space = 8 + UsedQuote::INIT_SPACE,
        seeds = [b"quote", market.key().as_ref(), user.key().as_ref(), args.quote_id.as_bytes()],
        bump
    )]
    pub used_quote: Box<Account<'info, UsedQuote>>,
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(address = config.quote_authority)]
    pub quote_authority: Signer<'info>,
    #[account(mut, token::mint = collateral_mint, token::authority = user)]
    pub user_collateral: Box<Account<'info, TokenAccount>>,
    #[account(mut, address = market.escrow, token::mint = collateral_mint)]
    pub escrow: Box<Account<'info, TokenAccount>>,
    pub collateral_mint: Box<Account<'info, Mint>>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

impl<'info> ExecuteQuote<'info> {
    fn user_to_escrow_context(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        CpiContext::new(
            self.token_program.to_account_info(),
            Transfer {
                from: self.user_collateral.to_account_info(),
                to: self.escrow.to_account_info(),
                authority: self.user.to_account_info(),
            },
        )
    }

    fn escrow_to_user_context(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        CpiContext::new(
            self.token_program.to_account_info(),
            Transfer {
                from: self.escrow.to_account_info(),
                to: self.user_collateral.to_account_info(),
                authority: self.market.to_account_info(),
            },
        )
    }
}

#[derive(Accounts)]
pub struct MarketAuthorityAction<'info> {
    #[account(seeds = [b"protocol"], bump = config.bump)]
    pub config: Box<Account<'info, ProtocolConfig>>,
    #[account(mut, has_one = config)]
    pub market: Box<Account<'info, MarketAccount>>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct SettlementAction<'info> {
    #[account(seeds = [b"protocol"], bump = config.bump)]
    pub config: Box<Account<'info, ProtocolConfig>>,
    #[account(mut, has_one = config)]
    pub market: Box<Account<'info, MarketAccount>>,
    #[account(address = config.settlement_authority)]
    pub settlement_authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct ClaimPosition<'info> {
    #[account(seeds = [b"protocol"], bump = config.bump, has_one = collateral_mint)]
    pub config: Box<Account<'info, ProtocolConfig>>,
    #[account(mut, has_one = collateral_mint, has_one = escrow)]
    pub market: Box<Account<'info, MarketAccount>>,
    #[account(mut, seeds = [b"position", market.key().as_ref(), owner.key().as_ref()], bump = position.bump)]
    pub position: Box<Account<'info, PositionAccount>>,
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(mut, token::mint = collateral_mint, token::authority = owner)]
    pub owner_collateral: Box<Account<'info, TokenAccount>>,
    #[account(mut, address = market.escrow, token::mint = collateral_mint)]
    pub escrow: Box<Account<'info, TokenAccount>>,
    pub collateral_mint: Box<Account<'info, Mint>>,
    pub token_program: Program<'info, Token>,
}

impl<'info> ClaimPosition<'info> {
    fn escrow_to_owner_context(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        CpiContext::new(
            self.token_program.to_account_info(),
            Transfer {
                from: self.escrow.to_account_info(),
                to: self.owner_collateral.to_account_info(),
                authority: self.market.to_account_info(),
            },
        )
    }
}

#[account]
#[derive(InitSpace)]
pub struct ProtocolConfig {
    pub authority: Pubkey,
    pub quote_authority: Pubkey,
    pub settlement_authority: Pubkey,
    pub collateral_mint: Pubkey,
    pub fee_bps: u64,
    pub max_position_shares: u64,
    pub paused: bool,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct MarketAccount {
    pub config: Pubkey,
    pub creator: Pubkey,
    pub liquidity_provider: Pubkey,
    pub collateral_mint: Pubkey,
    pub escrow: Pubkey,
    #[max_len(64)]
    pub market_id: String,
    pub lock_ts: i64,
    pub status: MarketStatus,
    pub result: MarketResult,
    pub pending_result: MarketResult,
    pub yes_liability: u64,
    pub no_liability: u64,
    pub collateral_escrowed: u64,
    pub fees_accrued: u64,
    pub bump: u8,
    pub escrow_bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct PositionAccount {
    pub owner: Pubkey,
    pub market: Pubkey,
    pub yes_shares: u64,
    pub no_shares: u64,
    pub claimed: bool,
    pub bump: u8,
}

impl PositionAccount {
    pub fn total_shares(&self) -> Result<u64> {
        checked_add(self.yes_shares, self.no_shares)
    }
}

#[account]
#[derive(InitSpace)]
pub struct UsedQuote {
    pub market: Pubkey,
    pub user: Pubkey,
    #[max_len(64)]
    pub quote_id: String,
    pub action: QuoteAction,
    pub used_at: i64,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct InitializeProtocolArgs {
    pub quote_authority: Pubkey,
    pub settlement_authority: Pubkey,
    pub fee_bps: u64,
    pub max_position_shares: u64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct RegisterMarketArgs {
    pub market_id: String,
    pub lock_ts: i64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ExecuteQuoteArgs {
    pub quote_id: String,
    pub action: QuoteAction,
    pub side: PositionSide,
    pub shares: u64,
    pub cost_or_proceeds: u64,
    pub max_cost_or_min_proceeds: u64,
    pub expires_at: i64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, InitSpace, PartialEq, Eq)]
pub enum MarketStatus {
    Registered,
    Collateralized,
    Trading,
    Locked,
    ResultProposed,
    Resolved,
    Cancelled,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, InitSpace, PartialEq, Eq)]
pub enum MarketResult {
    Unresolved,
    Yes,
    No,
    Cancelled,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, InitSpace, PartialEq, Eq)]
pub enum PositionSide {
    Yes,
    No,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, InitSpace, PartialEq, Eq)]
pub enum QuoteAction {
    Buy,
    Sell,
}

#[event]
pub struct ProtocolInitialized {
    pub authority: Pubkey,
    pub quote_authority: Pubkey,
    pub settlement_authority: Pubkey,
    pub collateral_mint: Pubkey,
}

#[event]
pub struct PauseUpdated {
    pub paused: bool,
}

#[event]
pub struct MarketRegistered {
    pub market: Pubkey,
    pub market_id: String,
    pub lock_ts: i64,
    pub liquidity_provider: Pubkey,
}

#[event]
pub struct MarketCollateralized {
    pub market: Pubkey,
    pub amount: u64,
    pub collateral_escrowed: u64,
}

#[event]
pub struct PositionBought {
    pub market: Pubkey,
    pub owner: Pubkey,
    pub side: PositionSide,
    pub shares: u64,
    pub cost: u64,
    pub quote_id: String,
}

#[event]
pub struct PositionSold {
    pub market: Pubkey,
    pub owner: Pubkey,
    pub side: PositionSide,
    pub shares: u64,
    pub proceeds: u64,
    pub quote_id: String,
}

#[event]
pub struct MarketLocked {
    pub market: Pubkey,
    pub locked_at: i64,
}

#[event]
pub struct ResultProposed {
    pub market: Pubkey,
    pub result: MarketResult,
}

#[event]
pub struct ResultFinalized {
    pub market: Pubkey,
    pub result: MarketResult,
}

#[event]
pub struct MarketCancelled {
    pub market: Pubkey,
}

#[event]
pub struct WinningsClaimed {
    pub market: Pubkey,
    pub owner: Pubkey,
    pub payout: u64,
}

#[event]
pub struct RefundClaimed {
    pub market: Pubkey,
    pub owner: Pubkey,
    pub payout: u64,
}

#[error_code]
pub enum FantasyXError {
    #[msg("The signer is not authorized for this action.")]
    Unauthorized,
    #[msg("The protocol is paused.")]
    ProtocolPaused,
    #[msg("The requested market transition is invalid.")]
    InvalidMarketState,
    #[msg("Invalid amount.")]
    InvalidAmount,
    #[msg("Invalid fee basis points.")]
    InvalidFee,
    #[msg("Market id is too long.")]
    MarketIdTooLong,
    #[msg("Lock time must be in the future.")]
    InvalidLockTime,
    #[msg("The market is locked.")]
    MarketLocked,
    #[msg("The market is not yet lockable.")]
    MarketNotLockable,
    #[msg("Quote expired.")]
    QuoteExpired,
    #[msg("Quote action does not match instruction.")]
    InvalidQuoteAction,
    #[msg("Slippage constraints were not satisfied.")]
    SlippageExceeded,
    #[msg("Position limit exceeded.")]
    PositionLimitExceeded,
    #[msg("Insufficient shares.")]
    InsufficientShares,
    #[msg("Insufficient collateral.")]
    InsufficientCollateral,
    #[msg("Arithmetic overflow or underflow.")]
    ArithmeticError,
    #[msg("Invalid result.")]
    InvalidResult,
    #[msg("Pending result does not match final result.")]
    ResultMismatch,
    #[msg("Position already claimed.")]
    AlreadyClaimed,
    #[msg("Nothing to claim.")]
    NothingToClaim,
}

fn initialize_position_if_needed(position: &mut Account<PositionAccount>, owner: Pubkey, market: Pubkey, bump: u8) {
    if position.owner == Pubkey::default() {
        position.owner = owner;
        position.market = market;
        position.yes_shares = 0;
        position.no_shares = 0;
        position.claimed = false;
        position.bump = bump;
    }
}

fn mark_quote_used(used_quote: &mut Account<UsedQuote>, args: &ExecuteQuoteArgs, market: Pubkey, user: Pubkey, bump: u8) {
    used_quote.market = market;
    used_quote.user = user;
    used_quote.quote_id = args.quote_id.clone();
    used_quote.action = args.action;
    used_quote.used_at = Clock::get().map(|clock| clock.unix_timestamp).unwrap_or_default();
    used_quote.bump = bump;
}

fn require_quote(ctx: &Context<ExecuteQuote>, args: &ExecuteQuoteArgs) -> Result<()> {
    require!(args.quote_id.as_bytes().len() <= 64, FantasyXError::MarketIdTooLong);
    require!(Clock::get()?.unix_timestamp <= args.expires_at, FantasyXError::QuoteExpired);
    require_keys_eq!(ctx.accounts.quote_authority.key(), ctx.accounts.config.quote_authority, FantasyXError::Unauthorized);
    Ok(())
}

fn assert_market_solvent(market: &MarketAccount) -> Result<()> {
    let required = required_backing(market)?;
    require!(market.collateral_escrowed >= required, FantasyXError::InsufficientCollateral);
    Ok(())
}

fn required_backing(market: &MarketAccount) -> Result<u64> {
    let liabilities = match market.status {
        MarketStatus::Cancelled => checked_add(market.yes_liability, market.no_liability)?,
        MarketStatus::Resolved => match market.result {
            MarketResult::Yes => market.yes_liability,
            MarketResult::No => market.no_liability,
            _ => checked_add(market.yes_liability, market.no_liability)?,
        },
        _ => market.yes_liability.max(market.no_liability),
    };
    checked_add(liabilities, market.fees_accrued)
}

fn fee_amount(amount: u64, fee_bps: u64) -> Result<u64> {
    let product = amount.checked_mul(fee_bps).ok_or(FantasyXError::ArithmeticError)?;
    Ok(product / BPS_DENOMINATOR)
}

fn checked_add(left: u64, right: u64) -> Result<u64> {
    left.checked_add(right).ok_or(error!(FantasyXError::ArithmeticError))
}

fn checked_sub(left: u64, right: u64) -> Result<u64> {
    left.checked_sub(right).ok_or(error!(FantasyXError::ArithmeticError))
}

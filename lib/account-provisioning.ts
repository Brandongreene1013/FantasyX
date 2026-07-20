import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { reserveReferralCode, findReferrerId } from "@/lib/referrals";
import { trackBetaEventTx } from "@/lib/beta-events";

const startingCredits = new Prisma.Decimal(10000);

export async function provisionAccount(input: {
  firstName: string; lastName: string; email: string; passwordHash?: string;
  referralCode?: string; emailVerified?: boolean;
}) {
  const displayName = `${input.firstName} ${input.lastName}`.trim() || input.email.split("@")[0];
  return prisma.$transaction(async (tx) => {
    const [referralCode, referredByUserId] = await Promise.all([
      reserveReferralCode(tx), findReferrerId(tx, input.referralCode)
    ]);
    const user = await tx.user.create({
      data: {
        name: displayName, firstName: input.firstName, lastName: input.lastName, displayName,
        email: input.email, passwordHash: input.passwordHash ?? "", role: "TRADER", isAdmin: false,
        mockBalance: startingCredits, startingBalance: startingCredits, referralCode, referredByUserId,
        emailVerifiedAt: input.emailVerified ? new Date() : null
      }
    });
    await tx.accountLedgerEntry.create({
      data: { userId: user.id, type: "SEED_GRANT", amount: startingCredits, balanceAfter: startingCredits,
        reason: "Initial signup mock-credit grant", idempotencyKey: `signup_seed_grant:${user.id}`, metadata: { source: "signup" } }
    });
    await trackBetaEventTx(tx, { type: "SIGNUP", userId: user.id, referrerId: referredByUserId, metadata: { source: "signup" } });
    if (referredByUserId) {
      await trackBetaEventTx(tx, { type: "REFERRAL_SIGNUP", userId: user.id, referrerId: referredByUserId, metadata: { referralCode: input.referralCode } });
    }
    return user;
  });
}

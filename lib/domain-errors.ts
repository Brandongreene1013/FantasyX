export type DomainErrorCode =
  | "AUTH_REQUIRED"
  | "ADMIN_REQUIRED"
  | "MARKET_NOT_OPEN"
  | "MARKET_LOCKED"
  | "INSUFFICIENT_BALANCE"
  | "INSUFFICIENT_SHARES"
  | "MARKET_ALREADY_SETTLED"
  | "MARKET_ALREADY_VOID"
  | "DUPLICATE_LEDGER_ENTRY"
  | "INVALID_MARKET_TRANSITION"
  | "IDEMPOTENCY_CONFLICT"
  | "NOT_FOUND"
  | "VALIDATION_ERROR";

export class DomainError extends Error {
  readonly code: DomainErrorCode;
  readonly status: number;

  constructor(code: DomainErrorCode, message: string, status = 400) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.status = status;
  }
}

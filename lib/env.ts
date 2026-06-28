const REQUIRED_ENV_VARS = ["DATABASE_URL"] as const;
const IDENTITY_ENV_VARS = [
  "SESSION_SECRET",
  "ADMIN_EMAIL",
  "ADMIN_PASSWORD",
  "ADMIN_FIRST_NAME",
  "ADMIN_LAST_NAME"
] as const;

export class EnvConfigError extends Error {
  constructor(message: string, readonly missing: string[]) {
    super(message);
    this.name = "EnvConfigError";
  }
}

export function validateServerEnv(env: Partial<NodeJS.ProcessEnv> = process.env) {
  const missing = REQUIRED_ENV_VARS.filter((name) => !env[name] || env[name]?.trim() === "");

  if (missing.length > 0) {
    throw new EnvConfigError(
      `Missing required environment variable${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}`,
      missing
    );
  }
}

export function validateIdentityEnv(env: Partial<NodeJS.ProcessEnv> = process.env) {
  const missing = IDENTITY_ENV_VARS.filter((name) => !env[name] || env[name]?.trim() === "");

  if (missing.length > 0) {
    throw new EnvConfigError(
      `Missing required environment variable${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}`,
      missing
    );
  }
}

export function getRequiredEnv(name: (typeof REQUIRED_ENV_VARS)[number] | (typeof IDENTITY_ENV_VARS)[number]) {
  validateServerEnv();
  return process.env[name] as string;
}

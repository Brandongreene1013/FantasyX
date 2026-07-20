import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { EnvConfigError } from "@/lib/env";

export const twoFactorChallengeCookieName = "fantasyx_2fa_challenge";
export const trustedDeviceCookieName = "fantasyx_trusted_device";

export function createOpaqueToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

export function hashAuthToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function encryptAuthSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", authEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptAuthSecret(value: string) {
  const [version, iv, tag, encrypted] = value.split(".");
  if (version !== "v1" || !iv || !tag || !encrypted) throw new Error("Invalid encrypted auth secret");
  const decipher = createDecipheriv("aes-256-gcm", authEncryptionKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64url")), decipher.final()]).toString("utf8");
}

export function generateRecoveryCodes(count = 10) {
  return Array.from({ length: count }, () => {
    const value = randomBytes(5).toString("hex").toUpperCase();
    return `${value.slice(0, 5)}-${value.slice(5)}`;
  });
}

export function normalizeRecoveryCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function hashRecoveryCode(value: string) {
  return hashAuthToken(normalizeRecoveryCode(value));
}

export function secureCookieOptions(maxAge: number) {
  return { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge };
}

export function readCookieValue(request: Request, name: string) {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0 || part.slice(0, separator).trim() !== name) continue;
    try { return decodeURIComponent(part.slice(separator + 1)); } catch { return null; }
  }
  return null;
}

function authEncryptionKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.trim().length < 32) {
    if (process.env.NODE_ENV === "production") {
      throw new EnvConfigError("Missing required environment variable: SESSION_SECRET", ["SESSION_SECRET"]);
    }
  }
  return createHash("sha256").update(`fantasyx-auth:${secret || "development-session-secret-change-before-production"}`).digest();
}

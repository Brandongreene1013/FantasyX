import { randomBytes } from "crypto";
import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";

type TxClient = Prisma.TransactionClient | PrismaClient;

const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function normalizeReferralCode(value: string | null | undefined) {
  const code = value?.trim().toUpperCase().replace(/[^A-Z0-9]/g, "") ?? "";
  return code.length > 0 ? code.slice(0, 24) : null;
}

export function generateReferralCode(prefix = "FX") {
  const bytes = randomBytes(8);
  let suffix = "";
  for (const byte of bytes) {
    suffix += alphabet[byte % alphabet.length];
  }
  return `${prefix}${suffix}`;
}

export async function reserveReferralCode(client: TxClient) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = generateReferralCode();
    const existing = await client.user.findUnique({
      where: { referralCode: code },
      select: { id: true }
    });
    if (!existing) return code;
  }
  throw new Error("Could not allocate referral code");
}

export async function findReferrerId(client: TxClient, rawCode: string | null | undefined) {
  const referralCode = normalizeReferralCode(rawCode);
  if (!referralCode) return null;

  const referrer = await client.user.findUnique({
    where: { referralCode },
    select: { id: true }
  });
  return referrer?.id ?? null;
}

export async function ensureUserReferralCode(client: TxClient, userId: string, currentCode?: string | null) {
  if (currentCode) return currentCode;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const referralCode = generateReferralCode();
    try {
      await client.user.update({
        where: { id: userId },
        data: { referralCode }
      });
      return referralCode;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        continue;
      }
      throw error;
    }
  }

  throw new Error("Could not allocate referral code");
}

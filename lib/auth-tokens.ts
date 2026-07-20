import type { AuthTokenType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createOpaqueToken, hashAuthToken } from "@/lib/auth-security";

export async function issueAuthToken(userId: string, type: AuthTokenType, ttlMs: number) {
  const token = createOpaqueToken();
  await prisma.$transaction(async (tx) => {
    await tx.authToken.deleteMany({ where: { userId, type } });
    await tx.authToken.create({ data: { userId, type, tokenHash: hashAuthToken(token), expiresAt: new Date(Date.now() + ttlMs) } });
  });
  return token;
}

export async function consumeAuthToken(token: string, type: AuthTokenType) {
  const record = await prisma.authToken.findUnique({ where: { tokenHash: hashAuthToken(token) } });
  if (!record || record.type !== type || record.consumedAt || record.expiresAt.getTime() <= Date.now()) return null;
  const consumed = await prisma.authToken.updateMany({
    where: { id: record.id, consumedAt: null }, data: { consumedAt: new Date() }
  });
  return consumed.count === 1 ? record : null;
}

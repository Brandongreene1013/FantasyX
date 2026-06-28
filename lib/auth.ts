import type { User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUserIdFromToken, readSessionCookie } from "@/lib/session-store";

export type SessionUser = Pick<User, "id" | "name" | "firstName" | "lastName" | "displayName" | "email" | "role" | "isAdmin" | "mockBalance" | "startingBalance">;

export async function getSessionUserId(request: Request) {
  return getSessionUserIdFromToken(readSessionCookie(request));
}

export async function getSessionUser(request: Request): Promise<SessionUser | null> {
  const userId = await getSessionUserId(request);
  if (!userId) {
    return null;
  }

  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      firstName: true,
      lastName: true,
      displayName: true,
      email: true,
      role: true,
      isAdmin: true,
      mockBalance: true,
      startingBalance: true
    }
  });
}

export async function requireSessionUser(request: Request) {
  const user = await getSessionUser(request);
  if (!user) {
    throw new AuthError("Authentication required", 401);
  }
  return user;
}

export async function requireAdminUser(request: Request) {
  const user = await requireSessionUser(request);
  if (user.role !== "ADMIN" && !user.isAdmin) {
    throw new AuthError("Admin access required", 403);
  }
  return user;
}

export class AuthError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

import type { User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sessionCookieName } from "@/lib/session";

export type SessionUser = Pick<User, "id" | "name" | "isAdmin" | "mockBalance" | "startingBalance">;

export function getSessionUserId(request: Request) {
  return parseCookieHeader(request.headers.get("cookie"))[sessionCookieName] ?? null;
}

export async function getSessionUser(request: Request): Promise<SessionUser | null> {
  const userId = getSessionUserId(request);
  if (!userId) {
    return null;
  }

  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
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
  if (!user.isAdmin) {
    throw new AuthError("Admin access required", 403);
  }
  return user;
}

export class AuthError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

function parseCookieHeader(header: string | null) {
  const cookies: Record<string, string> = {};
  if (!header) {
    return cookies;
  }

  for (const part of header.split(";")) {
    const [name, ...valueParts] = part.trim().split("=");
    if (!name) {
      continue;
    }
    cookies[name] = decodeURIComponent(valueParts.join("="));
  }
  return cookies;
}

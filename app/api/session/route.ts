import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { csrfTokenForRequest } from "@/lib/csrf";
import { toNumber } from "@/lib/db-serialization";

export async function GET(request: Request) {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.displayName || user.name,
      firstName: user.firstName,
      lastName: user.lastName,
      displayName: user.displayName || user.name,
      email: user.email,
      role: user.role,
      isAdmin: user.role === "ADMIN" || user.isAdmin,
      mockBalance: toNumber(user.mockBalance),
      startingBalance: toNumber(user.startingBalance),
      referralCode: user.referralCode
    },
    csrfToken: csrfTokenForRequest(request)
  });
}

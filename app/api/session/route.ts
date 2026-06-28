import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { toNumber } from "@/lib/db-serialization";

export async function GET(request: Request) {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      isAdmin: user.isAdmin,
      mockBalance: toNumber(user.mockBalance),
      startingBalance: toNumber(user.startingBalance)
    }
  });
}

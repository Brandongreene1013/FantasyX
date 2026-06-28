import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/db-serialization";

export async function GET() {
  const users = await prisma.user.findMany({
    orderBy: [{ isAdmin: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      isAdmin: true,
      mockBalance: true
    }
  });

  return NextResponse.json({
    users: users.map((user) => ({
      ...user,
      mockBalance: toNumber(user.mockBalance)
    }))
  });
}

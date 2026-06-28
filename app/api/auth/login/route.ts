import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { loginSchema } from "@/lib/api-validation";
import { sessionCookieName } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = loginSchema.parse(await request.json());
    const user = await prisma.user.findUnique({
      where: { id: body.userId },
      select: { id: true, name: true, isAdmin: true }
    });

    if (!user) {
      return NextResponse.json({ error: "Demo account not found" }, { status: 404 });
    }

    const response = NextResponse.json({ user });
    response.cookies.set(sessionCookieName, user.id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7
    });
    return response;
  } catch (error) {
    return apiError(error, "Login failed");
  }
}

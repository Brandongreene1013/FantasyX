import { NextResponse } from "next/server";
import { sessionCookieName } from "@/lib/session";
import { destroySession, readSessionCookie } from "@/lib/session-store";

export async function POST(request: Request) {
  await destroySession(readSessionCookie(request));
  const response = NextResponse.json({ ok: true });
  response.cookies.set(sessionCookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
  return response;
}

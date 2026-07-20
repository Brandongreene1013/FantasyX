import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { requireSessionUser } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { prisma } from "@/lib/prisma";
import { secureCookieOptions, trustedDeviceCookieName } from "@/lib/auth-security";

export async function GET(request: Request) {
  try {
    const user = await requireSessionUser(request);
    const devices = await prisma.trustedDevice.findMany({ where: { userId: user.id, expiresAt: { gt: new Date() } }, orderBy: { lastUsedAt: "desc" } });
    return NextResponse.json({ devices: devices.map((d) => ({ id: d.id, label: d.label, lastUsedAt: d.lastUsedAt, expiresAt: d.expiresAt })) });
  } catch (error) { return apiError(error, "Could not load trusted devices", undefined, request); }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireSessionUser(request);
    await requireCsrf(request);
    await prisma.trustedDevice.deleteMany({ where: { userId: user.id } });
    const response = NextResponse.json({ revoked: true });
    response.cookies.set(trustedDeviceCookieName, "", { ...secureCookieOptions(0), maxAge: 0 });
    return response;
  } catch (error) { return apiError(error, "Could not revoke trusted devices", undefined, request); }
}

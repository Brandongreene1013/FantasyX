import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { settingsSchema } from "@/lib/api-validation";
import { requireSessionUser } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request) {
  try {
    const sessionUser = await requireSessionUser(request);
    await requireCsrf(request);
    const body = settingsSchema.parse(await request.json());
    const user = await prisma.user.update({
      where: { id: sessionUser.id },
      data: {
        firstName: body.firstName,
        lastName: body.lastName,
        displayName: body.displayName,
        name: body.displayName
      },
      select: {
        id: true,
        name: true,
        firstName: true,
        lastName: true,
        displayName: true,
        email: true,
        role: true,
        isAdmin: true
      }
    });

    return NextResponse.json({
      user: {
        ...user,
        name: user.displayName || user.name,
        isAdmin: user.role === "ADMIN" || user.isAdmin
      }
    });
  } catch (error) {
    return apiError(error, "Could not update settings", undefined, request);
  }
}

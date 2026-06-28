import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth";
import { apiError } from "@/lib/api-response";
import { getRecentOperations } from "@/lib/operation-log.service";

export async function GET(request: Request) {
  try {
    await requireAdminUser(request);
    const logs = await getRecentOperations(30);
    return NextResponse.json({ logs });
  } catch (error) {
    return apiError(error, "Failed to load operation history", undefined, request);
  }
}

import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth";
import { apiError } from "@/lib/api-response";
import { generateSettlementPreview } from "@/lib/settlement-preview.service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ weekId: string }> }
) {
  try {
    await requireAdminUser(request);
    const { weekId } = await params;
    const preview = await generateSettlementPreview(weekId);
    return NextResponse.json({ preview });
  } catch (error) {
    return apiError(error, "Failed to generate settlement preview", undefined, request);
  }
}

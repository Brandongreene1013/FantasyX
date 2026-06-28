import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth";
import { apiError } from "@/lib/api-response";
import { requireCsrf } from "@/lib/csrf";
import { importScoresFromCsv } from "@/lib/score-import.service";
import { z } from "zod";

const QuerySchema = z.object({
  weekId: z.string().min(1, "weekId is required")
});

export async function POST(request: Request) {
  try {
    const admin = await requireAdminUser(request);
    await requireCsrf(request);

    const url = new URL(request.url);
    const query = QuerySchema.safeParse({ weekId: url.searchParams.get("weekId") });
    if (!query.success) {
      return apiError(query.error, "Validation failed", 422, request);
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "No file uploaded. Send a multipart form with a 'file' field." }, { status: 400 });
    }

    const csvText = await (file as File).text();
    const filename = (file as File).name || "upload.csv";

    const result = await importScoresFromCsv({
      weekId: query.data.weekId,
      adminId: admin.id,
      filename,
      csvText
    });

    const status = result.importedCount === 0 ? 422 : 200;
    return NextResponse.json({ result }, { status });
  } catch (error) {
    return apiError(error, "Score import failed", undefined, request);
  }
}

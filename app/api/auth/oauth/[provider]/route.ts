import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { beginOAuth, isOAuthProvider } from "@/lib/oauth";
import { DomainError } from "@/lib/domain-errors";

export async function GET(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  try {
    const { provider } = await params;
    if (!isOAuthProvider(provider)) throw new DomainError("NOT_FOUND", "Sign-in provider not found", 404);
    const query = new URL(request.url).searchParams;
    return NextResponse.redirect(await beginOAuth(provider, request, query.get("next"), query.get("ref"), query.get("desktop") === "1"));
  } catch (error) {
    return apiError(error, "Could not start provider sign-in", undefined, request);
  }
}

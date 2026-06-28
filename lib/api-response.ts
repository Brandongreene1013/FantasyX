import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthError } from "@/lib/auth";
import { DomainError } from "@/lib/domain-errors";
import { EnvConfigError } from "@/lib/env";
import { getRequestId, logServerError } from "@/lib/server-logging";

export function apiError(error: unknown, fallback = "Request failed", status = 500, request?: Request) {
  const requestId = getRequestId(request);

  if (error instanceof AuthError) {
    return withRequestId(NextResponse.json({ error: error.message, requestId }, { status: error.status }), requestId);
  }

  if (error instanceof DomainError) {
    return withRequestId(NextResponse.json({ error: error.message, code: error.code, requestId }, { status: error.status }), requestId);
  }

  if (error instanceof ZodError) {
    return withRequestId(NextResponse.json(
      {
        error: "Validation failed",
        requestId,
        issues: error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message
        }))
      },
      { status: 422 }
    ), requestId);
  }

  if (error instanceof EnvConfigError) {
    logServerError("Server environment configuration error", error, { requestId, missing: error.missing.join(",") });
    return withRequestId(NextResponse.json({ error: error.message, requestId }, { status: 500 }), requestId);
  }

  logServerError(fallback, error, { requestId });
  return withRequestId(NextResponse.json({ error: fallback, requestId }, { status }), requestId);
}

function withRequestId(response: NextResponse, requestId: string) {
  response.headers.set("x-request-id", requestId);
  return response;
}

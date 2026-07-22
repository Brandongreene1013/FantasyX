import { NextResponse } from "next/server";
import { finishOAuth, isOAuthProvider } from "@/lib/oauth";
import { completeRedirectLogin } from "@/lib/login-flow";
import { issueAuthToken } from "@/lib/auth-tokens";
import { DomainError } from "@/lib/domain-errors";

export async function GET(request: Request, context: { params: Promise<{ provider: string }> }) {
  return handleCallback(request, context, new URL(request.url).searchParams);
}

export async function POST(request: Request, context: { params: Promise<{ provider: string }> }) {
  return handleCallback(request, context, new URLSearchParams(await request.text()));
}

async function handleCallback(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
  form: URLSearchParams
) {
  try {
    const { provider } = await params;
    if (!isOAuthProvider(provider)) throw new Error("Unknown provider");
    const { user, next, desktop } = await finishOAuth(provider, request, form);
    if (desktop) {
      const token = await issueAuthToken(user.id, "DESKTOP_LOGIN", 5 * 60 * 1000);
      const deepLink = new URL("fantasyx://auth");
      deepLink.searchParams.set("token", token);
      deepLink.searchParams.set("next", next);
      return NextResponse.redirect(deepLink);
    }
    return completeRedirectLogin(user, request, next);
  } catch (error) {
    console.error("OAuth callback failed", error instanceof Error ? error.message : "Unknown error");
    const url = new URL("/login", request.url);
    url.searchParams.set("error", oauthErrorCode(error));
    return NextResponse.redirect(url);
  }
}

function oauthErrorCode(error: unknown) {
  if (error instanceof DomainError) {
    if (error.message.toLowerCase().includes("cancelled") || error.message.toLowerCase().includes("denied")) return "oauth_cancelled";
    if (error.message.toLowerCase().includes("verified email")) return "oauth_unverified_email";
    if (error.message.toLowerCase().includes("expired")) return "oauth_expired";
    if (error.status === 404) return "oauth_not_configured";
  }
  return "oauth_failed";
}

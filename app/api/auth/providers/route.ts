import { NextResponse } from "next/server";
import { configuredOAuthProviders } from "@/lib/oauth";

export async function GET() {
  return NextResponse.json({ providers: configuredOAuthProviders() });
}

import { createRemoteJWKSet, jwtVerify } from "jose";
import { Apple, Google, MicrosoftEntraId, generateCodeVerifier, generateState } from "arctic";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashAuthToken } from "@/lib/auth-security";
import { provisionAccount } from "@/lib/account-provisioning";
import { DomainError } from "@/lib/domain-errors";
import { safeInternalPath } from "@/lib/redirects";

export type OAuthProvider = "google" | "apple" | "microsoft";

type OAuthProfile = {
  providerAccountId: string; email: string; firstName: string; lastName: string; emailVerified: boolean;
};

export function isOAuthProvider(value: string): value is OAuthProvider {
  return value === "google" || value === "apple" || value === "microsoft";
}

export function configuredOAuthProviders() {
  return {
    google: hasEnv("GOOGLE_CLIENT_ID") && hasEnv("GOOGLE_CLIENT_SECRET"),
    apple: hasEnv("APPLE_CLIENT_ID") && hasEnv("APPLE_TEAM_ID") && hasEnv("APPLE_KEY_ID") && hasEnv("APPLE_PRIVATE_KEY"),
    microsoft: hasEnv("MICROSOFT_CLIENT_ID") && hasEnv("MICROSOFT_CLIENT_SECRET")
  } satisfies Record<OAuthProvider, boolean>;
}

export async function beginOAuth(provider: OAuthProvider, request: Request, nextValue: string | null, referralCode?: string | null, desktop = false) {
  ensureConfigured(provider);
  const state = generateState();
  const codeVerifier = provider === "apple" ? null : generateCodeVerifier();
  await prisma.oAuthAttempt.create({
    data: {
      stateHash: hashAuthToken(state), provider, codeVerifier, nextPath: safeInternalPath(nextValue),
      referralCode: referralCode?.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 24) || null,
      desktop,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000)
    }
  });

  const client = providerClient(provider, request);
  let url: URL;
  if (provider === "apple") {
    url = (client as Apple).createAuthorizationURL(state, ["name", "email"]);
    url.searchParams.set("response_mode", "form_post");
  } else if (provider === "google") {
    url = (client as Google).createAuthorizationURL(state, codeVerifier!, ["openid", "email", "profile"]);
    url.searchParams.set("prompt", "select_account");
  } else {
    url = (client as MicrosoftEntraId).createAuthorizationURL(state, codeVerifier!, ["openid", "email", "profile"]);
    url.searchParams.set("prompt", "select_account");
  }
  return url;
}

export async function finishOAuth(provider: OAuthProvider, request: Request, form: URLSearchParams) {
  ensureConfigured(provider);
  const providerError = form.get("error");
  if (providerError) {
    throw new DomainError("VALIDATION_ERROR", "Provider sign-in was cancelled or denied", 400);
  }
  const state = form.get("state");
  const code = form.get("code");
  if (!state || !code) throw new DomainError("VALIDATION_ERROR", "Identity provider response was incomplete", 400);
  const attempt = await prisma.oAuthAttempt.findUnique({ where: { stateHash: hashAuthToken(state) } });
  if (!attempt || attempt.provider !== provider || attempt.expiresAt.getTime() <= Date.now()) {
    throw new DomainError("VALIDATION_ERROR", "Sign-in request expired. Please try again.", 400);
  }
  await prisma.oAuthAttempt.delete({ where: { id: attempt.id } });

  const client = providerClient(provider, request);
  const tokens = provider === "apple"
    ? await (client as Apple).validateAuthorizationCode(code)
    : provider === "google"
      ? await (client as Google).validateAuthorizationCode(code, attempt.codeVerifier!)
      : await (client as MicrosoftEntraId).validateAuthorizationCode(code, attempt.codeVerifier!);
  const profile = await providerProfile(provider, tokens.accessToken(), provider === "apple" ? tokens.idToken() : null, form);
  const user = await findOrCreateOAuthUser(provider, profile, attempt.referralCode);
  return { user, next: attempt.nextPath, desktop: attempt.desktop };
}

async function findOrCreateOAuthUser(provider: OAuthProvider, profile: OAuthProfile, referralCode: string | null) {
  const providerAccountId = profile.providerAccountId.trim();
  const email = profile.email.trim().toLowerCase();
  if (!providerAccountId) throw new DomainError("VALIDATION_ERROR", "The provider did not return an account identifier", 400);
  const linked = await prisma.authProviderAccount.findUnique({
    where: { provider_providerAccountId: { provider, providerAccountId } }, include: { user: true }
  });
  if (linked) return linked.user;
  if (!email || !profile.emailVerified) throw new DomainError("VALIDATION_ERROR", "The provider did not return a verified email address", 400);

  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    try {
      user = await provisionAccount({
        firstName: profile.firstName, lastName: profile.lastName, email,
        emailVerified: true, referralCode: referralCode ?? undefined
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
      user = await prisma.user.findUnique({ where: { email } });
      if (!user) throw error;
    }
  }
  try {
    await prisma.authProviderAccount.create({
      data: { userId: user.id, provider, providerAccountId, providerEmail: email }
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;
    const racedLink = await prisma.authProviderAccount.findUnique({
      where: { provider_providerAccountId: { provider, providerAccountId } }, include: { user: true }
    });
    if (racedLink) return racedLink.user;
    throw error;
  }
  if (!user.emailVerifiedAt) {
    user = await prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });
  }
  return user;
}

async function providerProfile(provider: OAuthProvider, accessToken: string, idToken: string | null, form: URLSearchParams): Promise<OAuthProfile> {
  if (provider === "google") {
    const data = await fetchJson("https://openidconnect.googleapis.com/v1/userinfo", accessToken) as Record<string, unknown>;
    return profileFromClaims(data, data.email_verified === true);
  }
  if (provider === "microsoft") {
    const data = await fetchJson("https://graph.microsoft.com/oidc/userinfo", accessToken) as Record<string, unknown>;
    return profileFromClaims(data, true);
  }
  if (!idToken) throw new DomainError("VALIDATION_ERROR", "Apple did not return an identity token", 400);
  const { payload } = await jwtVerify(idToken, createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys")), {
    issuer: "https://appleid.apple.com", audience: process.env.APPLE_CLIENT_ID!
  });
  const initial = parseAppleUser(form.get("user"));
  return {
    providerAccountId: String(payload.sub), email: String(payload.email || "").toLowerCase(),
    firstName: initial.firstName, lastName: initial.lastName,
    emailVerified: payload.email_verified === true || payload.email_verified === "true"
  };
}

function profileFromClaims(data: Record<string, unknown>, emailVerified: boolean): OAuthProfile {
  const fullName = String(data.name || "").trim().split(/\s+/);
  return {
    providerAccountId: String(data.sub || "").trim(), email: String(data.email || data.preferred_username || "").trim().toLowerCase(),
    firstName: String(data.given_name || fullName[0] || ""), lastName: String(data.family_name || fullName.slice(1).join(" ") || ""),
    emailVerified
  };
}

async function fetchJson(url: string, accessToken: string) {
  const response = await fetch(url, { headers: { authorization: `Bearer ${accessToken}` }, cache: "no-store" });
  if (!response.ok) throw new Error(`Identity provider profile request failed (${response.status})`);
  return response.json();
}

function providerClient(provider: OAuthProvider, request: Request) {
  const callback = `${authBaseUrl(request)}/api/auth/callback/${provider}`;
  if (provider === "google") return new Google(process.env.GOOGLE_CLIENT_ID!, process.env.GOOGLE_CLIENT_SECRET!, callback);
  if (provider === "microsoft") return new MicrosoftEntraId("common", process.env.MICROSOFT_CLIENT_ID!, process.env.MICROSOFT_CLIENT_SECRET!, callback);
  return new Apple(
    process.env.APPLE_CLIENT_ID!, process.env.APPLE_TEAM_ID!, process.env.APPLE_KEY_ID!,
    decodePrivateKey(process.env.APPLE_PRIVATE_KEY!), callback
  );
}

function ensureConfigured(provider: OAuthProvider) {
  if (!configuredOAuthProviders()[provider]) throw new DomainError("NOT_FOUND", `${provider} sign-in is not configured`, 404);
}

function hasEnv(name: string) {
  return Boolean(process.env[name]?.trim());
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function authBaseUrl(request: Request) {
  return (process.env.AUTH_BASE_URL?.trim() || new URL(request.url).origin).replace(/\/$/, "");
}

function decodePrivateKey(value: string) {
  const normalized = value.replace(/\\n/g, "\n");
  return new Uint8Array(Buffer.from(normalized.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, ""), "base64"));
}

function parseAppleUser(value: string | null) {
  try {
    const parsed = JSON.parse(value || "{}") as { name?: { firstName?: string; lastName?: string } };
    return { firstName: parsed.name?.firstName || "", lastName: parsed.name?.lastName || "" };
  } catch { return { firstName: "", lastName: "" }; }
}

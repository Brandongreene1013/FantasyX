import type { INflDataProvider } from "@/lib/nfl-data/provider";
import { DemoNflDataProvider } from "@/lib/nfl-data/demo-provider";
import { SleeperNflDataProvider } from "@/lib/nfl-data/providers/sleeper-provider";
import { SportsDataIoProvider } from "@/lib/nfl-data/providers/sportsdata-provider";

export type ProviderMode = "demo" | "live" | "disabled";

export interface ProviderStatus {
  name: string;
  mode: ProviderMode;
  isConfigured: boolean;
  requiresApiKey: boolean;
  hasApiKey: boolean;
  warning?: string;
}

const PROVIDERS_REQUIRING_API_KEY = new Set(["sportsdataio", "sportsdata", "mysportsfeeds"]);
const FREE_PROVIDERS = new Set(["sleeper"]);

export function getProviderStatus(): ProviderStatus {
  const providerEnv = (process.env.NFL_DATA_PROVIDER ?? "demo").trim().toLowerCase();
  const hasApiKey = Boolean(process.env.NFL_DATA_API_KEY?.trim());
  const requiresApiKey = PROVIDERS_REQUIRING_API_KEY.has(providerEnv);
  const isFree = FREE_PROVIDERS.has(providerEnv);

  if (providerEnv === "disabled") {
    return { name: "disabled", mode: "disabled", isConfigured: false, requiresApiKey: false, hasApiKey: false };
  }

  if (providerEnv === "demo") {
    return { name: "Demo", mode: "demo", isConfigured: true, requiresApiKey: false, hasApiKey: false };
  }

  if (requiresApiKey && !hasApiKey) {
    return {
      name: providerEnv,
      mode: "demo",
      isConfigured: false,
      requiresApiKey: true,
      hasApiKey: false,
      warning: `NFL_DATA_API_KEY is required for provider '${providerEnv}' but is not set. Falling back to demo provider.`
    };
  }

  return {
    name: isFree ? "Sleeper" : providerEnv,
    mode: "live",
    isConfigured: true,
    requiresApiKey,
    hasApiKey: requiresApiKey ? hasApiKey : false
  };
}

export function getConfiguredProvider(): INflDataProvider {
  const status = getProviderStatus();

  if (status.mode !== "live" || !status.isConfigured) {
    if (status.warning) {
      console.warn("[FantasyX NFL Provider]", status.warning);
    }
    return new DemoNflDataProvider();
  }

  const providerEnv = (process.env.NFL_DATA_PROVIDER ?? "demo").trim().toLowerCase();

  switch (providerEnv) {
    case "sleeper":
      return new SleeperNflDataProvider();
    case "sportsdataio":
    case "sportsdata": {
      const key = process.env.NFL_DATA_API_KEY!;
      return new SportsDataIoProvider(key);
    }
    default:
      console.warn(`[FantasyX NFL Provider] Unknown provider '${providerEnv}', falling back to demo`);
      return new DemoNflDataProvider();
  }
}

export function requireConfiguredLiveProvider(): INflDataProvider {
  const status = getProviderStatus();
  if (status.mode !== "live" || !status.isConfigured) {
    throw new Error(status.warning ?? "A licensed live NFL data provider is not configured.");
  }
  return getConfiguredProvider();
}

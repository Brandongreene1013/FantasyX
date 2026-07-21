import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth";
import { apiError } from "@/lib/api-response";
import { getProviderStatus } from "@/lib/nfl-data/provider-config";
import { getLastSuccessfulOperation, getLastOperation } from "@/lib/operation-log.service";

export async function GET(request: Request) {
  try {
    await requireAdminUser(request);

    const status = getProviderStatus();

    const [lastSync, lastSyncFailed, lastLiveSync, lastLiveSyncFailed, lastLock] = await Promise.all([
      getLastSuccessfulOperation("SYNC_EVERYTHING").catch(() => null) ??
        getLastSuccessfulOperation("SYNC_PLAYERS").catch(() => null),
      getLastOperation("CRON_SYNC_NFL").then((r) => (r?.status === "FAILED" ? r : null)).catch(() => null),
      getLastSuccessfulOperation("CRON_SYNC_LIVE").catch(() => null),
      getLastOperation("CRON_SYNC_LIVE").then((r) => (r?.status === "FAILED" ? r : null)).catch(() => null),
      getLastSuccessfulOperation("CRON_LOCK_MARKETS").catch(() => null) ??
        getLastSuccessfulOperation("KICKOFF_LOCK").catch(() => null)
    ]);

    return NextResponse.json({
      provider: {
        name: status.name,
        mode: status.mode,
        isConfigured: status.isConfigured,
        requiresApiKey: status.requiresApiKey,
        hasApiKey: status.hasApiKey,
        warning: status.warning
      },
      cron: {
        cronSecretSet: Boolean(process.env.CRON_SECRET?.trim()),
        lastSync: lastSync ? { at: lastSync.finishedAt, durationMs: lastSync.durationMs } : null,
        lastSyncFailed: lastSyncFailed ? { at: lastSyncFailed.finishedAt, error: lastSyncFailed.error } : null,
        lastLiveSync: lastLiveSync ? { at: lastLiveSync.finishedAt, durationMs: lastLiveSync.durationMs } : null,
        lastLiveSyncFailed: lastLiveSyncFailed ? { at: lastLiveSyncFailed.finishedAt, error: lastLiveSyncFailed.error } : null,
        lastKickoffLock: lastLock ? { at: lastLock.finishedAt } : null
      }
    });
  } catch (error) {
    return apiError(error, "Failed to load provider status", undefined, request);
  }
}

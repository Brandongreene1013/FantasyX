import { randomUUID } from "crypto";

type LogLevel = "info" | "warn" | "error";

type LogFields = Record<string, string | number | boolean | null | undefined>;

export function getRequestId(request?: Request) {
  return request?.headers.get("x-request-id") ?? randomUUID();
}

export function logServerEvent(level: LogLevel, message: string, fields: LogFields = {}) {
  const payload = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...fields
  };

  const line = JSON.stringify(payload);
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.info(line);
  }
}

export function logServerError(message: string, error: unknown, fields: LogFields = {}) {
  const isProd = process.env.NODE_ENV === "production";
  logServerEvent("error", message, {
    ...fields,
    errorName: error instanceof Error ? error.name : "UnknownError",
    errorMessage: error instanceof Error ? error.message : String(error),
    stack: isProd ? undefined : error instanceof Error ? error.stack : undefined
  });
}

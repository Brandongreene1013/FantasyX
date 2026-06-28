import { z } from "zod";

export const weekQuerySchema = z.object({
  weekId: z.string().min(1).default("nfl_2026_w1")
});

export const tradeSchema = z.object({
  marketId: z.string().min(1),
  side: z.enum(["YES", "NO"]),
  spend: z.number().positive()
});

export const loginSchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  password: z.string().min(1)
});

export const signupSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(80),
  lastName: z.string().trim().min(1, "Last name is required").max(80),
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
  confirmPassword: z.string().min(1, "Confirm your password")
}).refine((value) => value.password === value.confirmPassword, {
  path: ["confirmPassword"],
  message: "Passwords do not match"
});

export const settingsSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(80),
  lastName: z.string().trim().min(1, "Last name is required").max(80),
  displayName: z.string().trim().min(2, "Display name is required").max(80)
});

export const settlementSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("SETTLE_PLAYER"),
    playerId: z.string().min(1),
    weekId: z.string().min(1).default("nfl_2026_w1"),
    rank: z.number().int().positive(),
    settledById: z.string().min(1).optional(),
    fantasyPoints: z.number().nonnegative().optional(),
    reason: z.string().max(500).optional()
  }),
  z.object({
    action: z.literal("SETTLE_MARKET"),
    marketId: z.string().min(1),
    result: z.enum(["YES", "NO"]),
    settledById: z.string().min(1).optional(),
    fantasyPoints: z.number().nonnegative().optional(),
    positionalRank: z.number().int().positive().optional(),
    reason: z.string().max(500).optional()
  }),
  z.object({
    action: z.literal("LOCK_MARKET"),
    marketId: z.string().min(1),
    reason: z.string().max(500).optional()
  }),
  z.object({
    action: z.literal("OPEN_MARKET"),
    marketId: z.string().min(1),
    reason: z.string().max(500).optional()
  }),
  z.object({
    action: z.literal("VOID_MARKET"),
    marketId: z.string().min(1),
    reason: z.string().max(500).optional()
  })
]);

export const adminAdjustmentSchema = z.object({
  userId: z.string().min(1),
  amount: z.number().refine((v) => v !== 0, { message: "Amount must not be zero" }),
  reason: z.string().min(1).max(500),
});

export const adminNoteSchema = z.object({
  marketId: z.string().min(1),
  note: z.string().min(1).max(500),
});

export function parseSearchParams<T>(schema: z.ZodType<T>, request: Request) {
  const params = Object.fromEntries(new URL(request.url).searchParams.entries());
  return schema.parse(params);
}

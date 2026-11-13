import { z } from "zod";

export const voiceRequestSchema = z.object({
  text: z.string().trim().min(1).max(1_000),
  source: z.literal("iphone_shortcut").default("iphone_shortcut"),
  client_request_id: z.string().min(8).max(128).regex(/^[\w.-]+$/),
});

export const transactionPatchSchema = z.object({
  description: z.string().trim().min(1).max(200).optional(),
  amount_jpy: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).optional(),
  category: z.string().trim().min(1).max(100).optional(),
  subcategory: z.string().trim().max(100).optional(),
  review_status: z.enum(["confirmed", "needs_review"]).optional(),
  notes: z.string().trim().max(500).optional(),
}).refine((value) => Object.keys(value).length > 0, "No changes supplied");

export const manualTransactionSchema = z.object({
  date: z.string().date(),
  description: z.string().trim().min(1).max(200),
  type: z.enum(["expense", "income"]),
  category: z.string().trim().min(1).max(100),
  subcategory: z.string().trim().max(100).default(""),
  original_amount: z.coerce.number().positive(),
  original_currency: z.string().trim().toUpperCase().length(3).default("JPY"),
  amount_jpy: z.coerce.number().int().nonnegative().optional(),
  notes: z.string().trim().max(500).default(""),
});

export const budgetSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  category_id: z.string().trim().min(1).max(100),
  budget_jpy: z.coerce.number().int().positive(),
  rollover_enabled: z.boolean().default(false),
  notes: z.string().trim().max(300).default(""),
});

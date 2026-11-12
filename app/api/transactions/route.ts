import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getRepository } from "@/lib/repositories";
import { manualTransactionSchema } from "@/lib/schema";
import { requireOwner } from "@/lib/security";
import { convertToJpy } from "@/lib/services/fx";
import { nowIso } from "@/lib/time";
import type { TransactionRecord } from "@/lib/types";

export async function GET(request: Request) {
  if (!await requireOwner()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const data = await (await getRepository()).listTransactions({ month: url.searchParams.get("month") || undefined, query: url.searchParams.get("q") || undefined, category: url.searchParams.get("category") || undefined });
  return NextResponse.json({ transactions: data });
}

export async function POST(request: Request) {
  if (!await requireOwner()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const input = manualTransactionSchema.parse(await request.json());
    const repository = await getRepository();
    const fx = input.amount_jpy !== undefined
      ? { amountJpy: input.amount_jpy, rate: "", rateDate: "", provider: "actual_settlement" }
      : await convertToJpy(String(input.original_amount), input.original_currency, input.date, repository);
    const now = nowIso();
    const record: TransactionRecord = {
      transaction_id: randomUUID(), date: input.date, created_at: now, description: input.description,
      original_text: input.description, type: input.type, category: input.category, subcategory: input.subcategory,
      original_amount: String(input.original_amount), original_currency: input.original_currency, fx_rate: fx.rate,
      fx_rate_date: fx.rateDate, fx_provider: fx.provider, amount_jpy: fx.amountJpy, payment_method: "",
      source: "manual", source_reference: randomUUID(), confidence: 1, review_status: "confirmed", notes: input.notes, updated_at: now,
    };
    await repository.createTransactions([record]);
    return NextResponse.json({ transaction: record }, { status: 201 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid request" }, { status: 400 }); }
}

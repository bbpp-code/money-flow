import { randomUUID } from "node:crypto";
import { parseVoiceText } from "@/lib/parser";
import type { FinanceRepository } from "@/lib/repositories/repository";
import type { TransactionRecord } from "@/lib/types";
import { convertToJpy } from "@/lib/services/fx";
import { suggestGroqCategories } from "@/lib/services/groq-category";
import { nowIso } from "@/lib/time";

let writeQueue = Promise.resolve();
async function serialized<T>(work: () => Promise<T>) {
  const previous = writeQueue;
  let release!: () => void;
  writeQueue = new Promise<void>((resolve) => { release = resolve; });
  await previous;
  try { return await work(); } finally { release(); }
}

export async function ingestVoice(payload: { text: string; source: string; client_request_id: string }, repository: FinanceRepository, now = new Date()) {
  return serialized(async () => {
    const existing = await repository.findBySourceReference(payload.client_request_id);
    if (existing.length) return { transactions: existing, duplicate: true };
    const rules = await repository.listCategoryRules();
    const parsed = parseVoiceText(payload.text, { rules, now });
    const suggestions = payload.source === "iphone_shortcut" ? await suggestGroqCategories(parsed) : undefined;
    const records: TransactionRecord[] = [];
    for (let index = 0; index < parsed.length; index++) {
      const item = parsed[index];
      const suggestedCategory = suggestions?.get(item);
      let fx = { amountJpy: null as number | null, rate: "", rateDate: "", provider: "" };
      let reviewStatus = item.reviewStatus;
      const notes = [...item.warnings];
      if (suggestedCategory) notes.push("category_suggested_by_groq");
      try { fx = await convertToJpy(item.amount, item.currency, item.date, repository); }
      catch { reviewStatus = "needs_review"; notes.push("fx_rate_unavailable"); }
      const timestamp = nowIso();
      records.push({
        transaction_id: randomUUID(), date: item.date, created_at: timestamp, description: item.description,
        original_text: item.originalText, type: item.type, category: suggestedCategory ?? item.category, subcategory: item.subcategory,
        original_amount: item.amount, original_currency: item.currency, fx_rate: fx.rate, fx_rate_date: fx.rateDate,
        fx_provider: fx.provider, amount_jpy: fx.amountJpy, payment_method: "", source: payload.source,
        source_reference: parsed.length > 1 ? `${payload.client_request_id}:${index + 1}` : payload.client_request_id,
        confidence: item.confidence, review_status: reviewStatus, notes: notes.join(","), updated_at: timestamp,
      });
    }
    const persisted = await repository.createTransactions(records);
    return { transactions: persisted, duplicate: persisted.some((record, index) => record.transaction_id !== records[index].transaction_id) };
  });
}

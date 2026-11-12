import Decimal from "decimal.js";
import type { FinanceRepository } from "@/lib/repositories/repository";
import { nowIso } from "@/lib/time";

export interface FxResult { amountJpy: number; rate: string; rateDate: string; provider: string }

export async function convertToJpy(amount: string, currency: string, date: string, repository: FinanceRepository): Promise<FxResult> {
  if (currency === "JPY") return { amountJpy: new Decimal(amount).round().toNumber(), rate: "1", rateDate: date, provider: "identity" };
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("Unsupported currency code");
  const cached = await repository.findExchangeRate(date, currency, "JPY");
  if (cached) return { amountJpy: new Decimal(amount).mul(cached.rate).round().toNumber(), rate: cached.rate, rateDate: cached.date, provider: cached.provider };

  const baseUrl = process.env.FX_API_BASE_URL || "https://api.frankfurter.app";
  const response = await fetch(`${baseUrl}/${date}?from=${encodeURIComponent(currency)}&to=JPY`, { signal: AbortSignal.timeout(8_000), cache: "no-store" });
  if (!response.ok) throw new Error(`FX provider failed (${response.status})`);
  const body = await response.json() as { date?: string; rates?: Record<string, number> };
  const rate = body.rates?.JPY;
  if (!rate || !body.date || body.date > date) throw new Error("No valid historical FX rate available");
  const record = { date: body.date, from: currency, to: "JPY", rate: String(rate), provider: "Frankfurter/ECB", fetchedAt: nowIso() };
  await repository.saveExchangeRate(record);
  return { amountJpy: new Decimal(amount).mul(rate).round().toNumber(), rate: String(rate), rateDate: body.date, provider: record.provider };
}

import type { FinanceRepository } from "@/lib/repositories/repository";
import type { BudgetRecord, CategoryRule, TransactionRecord } from "@/lib/types";

type Rate = { date: string; from_currency: string; to_currency: string; rate: string; provider: string; fetched_at: string };
type Snapshot = { report_id: string; date: string; generated_at: string; summary_json: string };

export class SupabaseRepository implements FinanceRepository {
  private readonly url: string;
  private readonly key: string;
  constructor() {
    this.url = process.env.SUPABASE_URL?.replace(/\/$/, "") || "";
    this.key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    if (!/^https:\/\/.+\.supabase\.co$/.test(this.url) || !this.key) throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY are required");
  }

  private async request<T>(table: string, query = "", init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.url}/rest/v1/${table}${query}`, {
      ...init,
      headers: {
        apikey: this.key,
        "content-type": "application/json", Prefer: "return=representation",
        ...init.headers,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Supabase ${table} request failed (${response.status}): ${detail.slice(0, 300)}`);
    }
    return response.status === 204 ? [] as T : await response.json() as T;
  }

  async listTransactions(filters: { month?: string; query?: string; category?: string } = {}) {
    const params = new URLSearchParams({ select: "*", order: "date.desc,created_at.desc" });
    if (filters.month) { params.set("date", `gte.${filters.month}-01`); params.append("date", `lt.${nextMonth(filters.month)}-01`); }
    if (filters.category) params.set("category", `eq.${filters.category}`);
    if (filters.query) params.set("description", `ilike.*${filters.query.replace(/[%*]/g, "")}*`);
    return this.request<TransactionRecord[]>("transactions", `?${params}`);
  }
  async findBySourceReference(reference: string) {
    const safe = reference.replace(/[%,()*]/g, "");
    const params = new URLSearchParams({ select: "*", or: `(source_reference.eq.${safe},source_reference.like.${safe}:*)` });
    return this.request<TransactionRecord[]>("transactions", `?${params}`);
  }
  async createTransactions(records: TransactionRecord[]) {
    const values = records.map((record) => ({
      ...record,
      fx_rate: record.fx_rate || null,
      fx_rate_date: record.fx_rate_date || null,
    }));
    const created = await this.request<TransactionRecord[]>("transactions", "?on_conflict=source_reference", {
      method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=representation" }, body: JSON.stringify(values),
    });
    if (created.length === records.length) return created;
    const references = records.map((r) => r.source_reference);
    const all = await Promise.all(references.map((reference) => this.request<TransactionRecord[]>("transactions", `?select=*&source_reference=eq.${encodeURIComponent(reference)}`)));
    if (all.some((rows) => rows.length !== 1)) throw new Error("Could not verify every persisted transaction");
    return all.map((rows) => rows[0]);
  }
  async updateTransaction(id: string, patch: Partial<TransactionRecord>) {
    const rows = await this.request<TransactionRecord[]>("transactions", `?transaction_id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH", body: JSON.stringify({ ...patch, transaction_id: undefined, updated_at: new Date().toISOString() }),
    });
    if (rows.length !== 1) throw new Error("Transaction not found");
    return rows[0];
  }
  async listCategoryRules(): Promise<CategoryRule[]> {
    const rows = await this.request<Array<CategoryRule & { categories: { name_th: string } | null }>>("category_rules", "?select=*,categories(name_th)&enabled=eq.true&order=priority.desc");
    return rows.map((row) => ({ ...row, category_name: row.categories?.name_th || row.category_id }));
  }
  async listBudgets(month?: string) {
    const params = new URLSearchParams({ select: "*" });
    if (month) params.set("month", `eq.${month}`);
    return this.request<BudgetRecord[]>("budgets", `?${params}`);
  }
  async upsertBudget(budget: BudgetRecord) {
    const rows = await this.request<BudgetRecord[]>("budgets", "?on_conflict=month,category_id", {
      method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=representation" }, body: JSON.stringify(budget),
    });
    return rows[0];
  }
  async findExchangeRate(date: string, from: string, to: string) {
    const params = new URLSearchParams({ select: "date,rate,provider", date: `eq.${date}`, from_currency: `eq.${from}`, to_currency: `eq.${to}` });
    return (await this.request<Array<{ date: string; rate: string; provider: string }>>("exchange_rates", `?${params}`))[0] ?? null;
  }
  async saveExchangeRate(rate: { date: string; from: string; to: string; rate: string; provider: string; fetchedAt: string }) {
    const row: Rate = { date: rate.date, from_currency: rate.from, to_currency: rate.to, rate: rate.rate, provider: rate.provider, fetched_at: rate.fetchedAt };
    await this.request<Rate[]>("exchange_rates", "?on_conflict=date,from_currency,to_currency", {
      method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=representation" }, body: JSON.stringify(row),
    });
  }
  async saveReportSnapshot(snapshot: { reportId: string; date: string; generatedAt: string; summaryJson: string }) {
    const row: Snapshot = { report_id: snapshot.reportId, date: snapshot.date, generated_at: snapshot.generatedAt, summary_json: snapshot.summaryJson };
    await this.request<Snapshot[]>("report_snapshots", "?on_conflict=date", {
      method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=representation" }, body: JSON.stringify(row),
    });
  }
  async listReportSnapshots() {
    const rows = await this.request<Snapshot[]>("report_snapshots", "?select=*&order=date.desc");
    return rows.map((row) => ({ reportId: row.report_id, date: row.date, generatedAt: row.generated_at, summaryJson: row.summary_json }));
  }
}

function nextMonth(month: string) {
  const [year, number] = month.split("-").map(Number);
  return `${year + (number === 12 ? 1 : 0)}-${String(number === 12 ? 1 : number + 1).padStart(2, "0")}`;
}

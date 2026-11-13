import type { BudgetRecord, CategoryRule, TransactionRecord } from "@/lib/types";
import type { FinanceRepository } from "@/lib/repositories/repository";
import { formatInTimeZone, nowIso } from "@/lib/time";

const today = formatInTimeZone(new Date());
const month = today.slice(0, 7);
const atDay = (day: number) => `${month}-${String(day).padStart(2, "0")}`;
const make = (id: string, day: number, description: string, type: "expense" | "income", category: string, subcategory: string, amount: number, review_status: "confirmed" | "needs_review" = "confirmed"): TransactionRecord => ({
  transaction_id: id, date: atDay(Math.min(day, Number(today.slice(8)))), created_at: nowIso(), description,
  original_text: description, type, category, subcategory, original_amount: String(amount), original_currency: "JPY",
  fx_rate: "1", fx_rate_date: atDay(Math.min(day, Number(today.slice(8)))), fx_provider: "identity", amount_jpy: amount,
  payment_method: "", source: "demo", source_reference: id, confidence: review_status === "confirmed" ? 0.95 : 0.45,
  review_status, notes: "ข้อมูลสาธิต", updated_at: nowIso(),
});

function seed() {
  return [
    make("demo-001", 1, "เงินเดือน", "income", "รายรับ", "เงินเดือน", 280000),
    make("demo-002", 2, "กาแฟ", "expense", "อาหารและเครื่องดื่ม", "กาแฟ", 450),
    make("demo-003", 3, "ชาบู", "expense", "อาหารและเครื่องดื่ม", "ร้านอาหาร", 4100),
    make("demo-004", 4, "ค่าทางด่วน", "expense", "รถยนต์และการเดินทาง", "ทางด่วน", 1200),
    make("demo-005", 5, "แว่นสโนว์บอร์ด", "expense", "งานอดิเรก", "สโนว์บอร์ด", 33000),
    make("demo-006", 7, "ค่าที่พักแคมปิง", "expense", "ท่องเที่ยวและพักผ่อน", "ที่พัก", 19000),
    make("demo-007", 8, "ซื้อของเซเว่น", "expense", "อื่นๆ", "", 1200, "needs_review"),
    make("demo-008", 9, "ราเมง", "expense", "อาหารและเครื่องดื่ม", "ร้านอาหาร", 980),
  ];
}

type Store = { transactions: TransactionRecord[]; budgets: BudgetRecord[]; rates: Array<{ date: string; from: string; to: string; rate: string; provider: string }>; reports: Array<{ reportId: string; date: string; generatedAt: string; summaryJson: string }> };
const globalStore = globalThis as typeof globalThis & { __moneyflowDemo?: Store };
const store = globalStore.__moneyflowDemo ??= {
  transactions: seed(),
  budgets: [
    { month, category_id: "อาหารและเครื่องดื่ม", budget_jpy: 45000, rollover_enabled: false, notes: "" },
    { month, category_id: "รถยนต์และการเดินทาง", budget_jpy: 20000, rollover_enabled: false, notes: "" },
    { month, category_id: "งานอดิเรก", budget_jpy: 40000, rollover_enabled: false, notes: "" },
  ],
  rates: [],
  reports: [],
};

export class DemoRepository implements FinanceRepository {
  async listTransactions(filters: Parameters<FinanceRepository["listTransactions"]>[0] = {}) {
    return store.transactions.filter((t) => (!filters.month || t.date.startsWith(filters.month))
      && (!filters.query || `${t.description} ${t.original_text}`.toLowerCase().includes(filters.query.toLowerCase()))
      && (!filters.category || t.category === filters.category)
      && (!filters.id || t.transaction_id === filters.id)).sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at));
  }
  async findBySourceReference(reference: string) { return store.transactions.filter((t) => t.source_reference === reference || t.source_reference.startsWith(`${reference}:`)); }
  async deleteTransaction(id: string) {
    store.transactions = store.transactions.filter((transaction) => transaction.transaction_id !== id);
  }
  async createTransactions(records: TransactionRecord[]) { store.transactions.push(...records); return records; }
  async updateTransaction(id: string, patch: Partial<TransactionRecord>) {
    const index = store.transactions.findIndex((t) => t.transaction_id === id);
    if (index < 0) throw new Error("Transaction not found");
    store.transactions[index] = { ...store.transactions[index], ...patch, transaction_id: id, updated_at: nowIso() };
    return store.transactions[index];
  }
  async listCategoryRules(): Promise<CategoryRule[]> { return []; }
  async listBudgets(requestedMonth?: string) { return store.budgets.filter((b) => !requestedMonth || b.month === requestedMonth); }
  async upsertBudget(budget: BudgetRecord) {
    const index = store.budgets.findIndex((b) => b.month === budget.month && b.category_id === budget.category_id);
    if (index >= 0) store.budgets[index] = budget; else store.budgets.push(budget);
    return budget;
  }
  async findExchangeRate(date: string, from: string, to: string) { return store.rates.find((r) => r.date === date && r.from === from && r.to === to) ?? null; }
  async saveExchangeRate(rate: { date: string; from: string; to: string; rate: string; provider: string }) { store.rates.push(rate); }
  async saveReportSnapshot(snapshot: { reportId: string; date: string; generatedAt: string; summaryJson: string }) { store.reports = store.reports.filter((r) => r.date !== snapshot.date); store.reports.push(snapshot); }
  async listReportSnapshots() { return [...store.reports].sort((a, b) => b.date.localeCompare(a.date)); }
}

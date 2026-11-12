import { getSheetsClient } from "@/lib/google";
import { TRANSACTION_HEADERS, type BudgetRecord, type CategoryRule, type TransactionRecord } from "@/lib/types";
import type { FinanceRepository } from "@/lib/repositories/repository";
import { nowIso } from "@/lib/time";

const TX_RANGE = "Transactions!A:U";
const asString = (value: unknown) => value == null ? "" : String(value);

function rowToTransaction(row: unknown[]): TransactionRecord {
  const values = Object.fromEntries(TRANSACTION_HEADERS.map((header, index) => [header, row[index] ?? ""])) as Record<string, string>;
  return {
    ...values,
    amount_jpy: values.amount_jpy === "" ? null : Number(values.amount_jpy),
    confidence: Number(values.confidence || 0),
  } as TransactionRecord;
}

function transactionToRow(record: TransactionRecord) {
  return TRANSACTION_HEADERS.map((header) => asString(record[header]));
}

export class SheetsRepository implements FinanceRepository {
  private spreadsheetId: string;
  constructor() {
    if (!process.env.GOOGLE_SPREADSHEET_ID) throw new Error("GOOGLE_SPREADSHEET_ID is not configured");
    this.spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
  }

  private async values(range: string) {
    const response = await getSheetsClient().spreadsheets.values.get({ spreadsheetId: this.spreadsheetId, range });
    return response.data.values ?? [];
  }

  async listTransactions(filters: { month?: string; query?: string; category?: string } = {}) {
    const rows = await this.values(TX_RANGE);
    return rows.slice(1).map(rowToTransaction).filter((t) => (!filters.month || t.date.startsWith(filters.month))
      && (!filters.query || `${t.description} ${t.original_text}`.toLowerCase().includes(filters.query.toLowerCase()))
      && (!filters.category || t.category === filters.category)).sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at));
  }

  async findBySourceReference(reference: string) {
    const transactions = await this.listTransactions();
    return transactions.filter((t) => t.source_reference === reference || t.source_reference.startsWith(`${reference}:`));
  }

  async createTransactions(records: TransactionRecord[]) {
    await getSheetsClient().spreadsheets.values.append({
      spreadsheetId: this.spreadsheetId, range: TX_RANGE, valueInputOption: "RAW", insertDataOption: "INSERT_ROWS",
      requestBody: { values: records.map(transactionToRow) },
    });
    return records;
  }

  async updateTransaction(id: string, patch: Partial<TransactionRecord>) {
    const rows = await this.values(TX_RANGE);
    const rowIndex = rows.findIndex((row, index) => index > 0 && row[0] === id);
    if (rowIndex < 0) throw new Error("Transaction not found");
    const current = rowToTransaction(rows[rowIndex]);
    const updated = { ...current, ...patch, transaction_id: id, updated_at: nowIso() };
    await getSheetsClient().spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId, range: `Transactions!A${rowIndex + 1}:U${rowIndex + 1}`, valueInputOption: "RAW",
      requestBody: { values: [transactionToRow(updated)] },
    });
    return updated;
  }

  async listCategoryRules(): Promise<CategoryRule[]> {
    const [rules, categories] = await Promise.all([this.values("CategoryRules!A:F"), this.values("Categories!A:G")]);
    const names = new Map(categories.slice(1).map((r) => [asString(r[0]), asString(r[1]) || asString(r[2])]));
    return rules.slice(1).map((r) => ({
      rule_id: asString(r[0]), keyword_or_pattern: asString(r[1]), category_id: asString(r[2]),
      category_name: names.get(asString(r[2])) ?? asString(r[2]), subcategory: asString(r[3]),
      priority: Number(r[4] || 0), enabled: String(r[5]).toLowerCase() !== "false",
    }));
  }

  async listBudgets(month?: string): Promise<BudgetRecord[]> {
    const rows = await this.values("Budgets!A:E");
    return rows.slice(1).map((r) => ({ month: asString(r[0]), category_id: asString(r[1]), budget_jpy: Number(r[2]), rollover_enabled: String(r[3]).toLowerCase() === "true", notes: asString(r[4]) }))
      .filter((budget) => !month || budget.month === month);
  }

  async upsertBudget(budget: BudgetRecord) {
    const rows = await this.values("Budgets!A:E");
    const index = rows.findIndex((r, i) => i > 0 && r[0] === budget.month && r[1] === budget.category_id);
    const values = [[budget.month, budget.category_id, budget.budget_jpy, budget.rollover_enabled, budget.notes]];
    if (index >= 0) {
      await getSheetsClient().spreadsheets.values.update({ spreadsheetId: this.spreadsheetId, range: `Budgets!A${index + 1}:E${index + 1}`, valueInputOption: "RAW", requestBody: { values } });
    } else {
      await getSheetsClient().spreadsheets.values.append({ spreadsheetId: this.spreadsheetId, range: "Budgets!A:E", valueInputOption: "RAW", insertDataOption: "INSERT_ROWS", requestBody: { values } });
    }
    return budget;
  }

  async findExchangeRate(date: string, from: string, to: string) {
    const rows = await this.values("ExchangeRates!A:F");
    const row = rows.slice(1).find((r) => r[0] === date && r[1] === from && r[2] === to);
    return row ? { date: asString(row[0]), rate: asString(row[3]), provider: asString(row[4]) } : null;
  }

  async saveExchangeRate(rate: { date: string; from: string; to: string; rate: string; provider: string; fetchedAt: string }) {
    await getSheetsClient().spreadsheets.values.append({
      spreadsheetId: this.spreadsheetId, range: "ExchangeRates!A:F", valueInputOption: "RAW", insertDataOption: "INSERT_ROWS",
      requestBody: { values: [[rate.date, rate.from, rate.to, rate.rate, rate.provider, rate.fetchedAt]] },
    });
  }
  async saveReportSnapshot(snapshot: { reportId: string; date: string; generatedAt: string; summaryJson: string }) {
    const rows = await this.values("ReportSnapshots!A:D");
    const index = rows.findIndex((r, i) => i > 0 && r[1] === snapshot.date);
    const values = [[snapshot.reportId, snapshot.date, snapshot.generatedAt, snapshot.summaryJson]];
    if (index >= 0) await getSheetsClient().spreadsheets.values.update({ spreadsheetId: this.spreadsheetId, range: `ReportSnapshots!A${index + 1}:D${index + 1}`, valueInputOption: "RAW", requestBody: { values } });
    else await getSheetsClient().spreadsheets.values.append({ spreadsheetId: this.spreadsheetId, range: "ReportSnapshots!A:D", valueInputOption: "RAW", insertDataOption: "INSERT_ROWS", requestBody: { values } });
  }
  async listReportSnapshots() {
    const rows = await this.values("ReportSnapshots!A:D");
    return rows.slice(1).map((r) => ({ reportId: asString(r[0]), date: asString(r[1]), generatedAt: asString(r[2]), summaryJson: asString(r[3]) })).sort((a, b) => b.date.localeCompare(a.date));
  }
}

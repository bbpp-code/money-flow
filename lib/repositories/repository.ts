import type { BudgetRecord, CategoryRule, TransactionRecord } from "@/lib/types";

export interface FinanceRepository {
  listTransactions(filters?: { month?: string; query?: string; category?: string; id?: string }): Promise<TransactionRecord[]>;
  findBySourceReference(reference: string): Promise<TransactionRecord[]>;
  createTransactions(records: TransactionRecord[]): Promise<TransactionRecord[]>;
  updateTransaction(id: string, patch: Partial<TransactionRecord>): Promise<TransactionRecord>;
  deleteTransaction(id: string): Promise<void>;
  listCategoryRules(): Promise<CategoryRule[]>;
  listBudgets(month?: string): Promise<BudgetRecord[]>;
  upsertBudget(budget: BudgetRecord): Promise<BudgetRecord>;
  findExchangeRate(date: string, from: string, to: string): Promise<{ date: string; rate: string; provider: string } | null>;
  saveExchangeRate(rate: { date: string; from: string; to: string; rate: string; provider: string; fetchedAt: string }): Promise<void>;
  saveReportSnapshot(snapshot: { reportId: string; date: string; generatedAt: string; summaryJson: string }): Promise<void>;
  listReportSnapshots(): Promise<Array<{ reportId: string; date: string; generatedAt: string; summaryJson: string }>>;
}

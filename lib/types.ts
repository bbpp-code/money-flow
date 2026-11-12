export const TRANSACTION_HEADERS = [
  "transaction_id", "date", "created_at", "description", "original_text", "type",
  "category", "subcategory", "original_amount", "original_currency", "fx_rate",
  "fx_rate_date", "fx_provider", "amount_jpy", "payment_method", "source",
  "source_reference", "confidence", "review_status", "notes", "updated_at",
] as const;

export type TransactionType = "expense" | "income";
export type ReviewStatus = "confirmed" | "needs_review";

export interface TransactionRecord {
  transaction_id: string;
  date: string;
  created_at: string;
  description: string;
  original_text: string;
  type: TransactionType;
  category: string;
  subcategory: string;
  original_amount: string;
  original_currency: string;
  fx_rate: string;
  fx_rate_date: string;
  fx_provider: string;
  amount_jpy: number | null;
  payment_method: string;
  source: string;
  source_reference: string;
  confidence: number;
  review_status: ReviewStatus;
  notes: string;
  updated_at: string;
}

export interface CategoryRule {
  rule_id: string;
  keyword_or_pattern: string;
  category_id: string;
  category_name: string;
  subcategory: string;
  priority: number;
  enabled: boolean;
}

export interface BudgetRecord {
  month: string;
  category_id: string;
  budget_jpy: number;
  rollover_enabled: boolean;
  notes: string;
}

export interface ParsedTransaction {
  description: string;
  originalText: string;
  amount: string;
  currency: string;
  currencyInferred: boolean;
  date: string;
  dateInferred: boolean;
  type: TransactionType;
  category: string;
  subcategory: string;
  confidence: number;
  reviewStatus: ReviewStatus;
  warnings: string[];
}

export interface DashboardData {
  month: string;
  lastSync: string;
  transactions: TransactionRecord[];
  budgets: BudgetRecord[];
}

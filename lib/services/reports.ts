import type { BudgetRecord, TransactionRecord } from "@/lib/types";

export function calculateReport(transactions: TransactionRecord[], budgets: BudgetRecord[] = []) {
  const valid = transactions.filter((t) => t.amount_jpy !== null);
  const income = valid.filter((t) => t.type === "income").reduce((sum, t) => sum + (t.amount_jpy ?? 0), 0);
  const expenses = valid.filter((t) => t.type === "expense").reduce((sum, t) => sum + (t.amount_jpy ?? 0), 0);
  const byCategory = new Map<string, number>();
  valid.filter((t) => t.type === "expense").forEach((t) => byCategory.set(t.category, (byCategory.get(t.category) ?? 0) + (t.amount_jpy ?? 0)));
  const categorySpending = [...byCategory.entries()].map(([category, amount]) => ({ category, amount, percentage: expenses ? Math.round(amount / expenses * 1000) / 10 : 0 })).sort((a, b) => b.amount - a.amount);
  const expenseValues = valid.filter((t) => t.type === "expense").map((t) => t.amount_jpy ?? 0);
  const average = expenseValues.length ? expenses / expenseValues.length : 0;
  const variance = expenseValues.length ? expenseValues.reduce((sum, n) => sum + (n - average) ** 2, 0) / expenseValues.length : 0;
  const threshold = average + 2 * Math.sqrt(variance);
  return {
    income, expenses, netCashFlow: income - expenses, transactionCount: transactions.length,
    incompleteJpyCount: transactions.length - valid.length, categorySpending,
    unusualSpending: valid.filter((t) => t.type === "expense" && (t.amount_jpy ?? 0) > threshold && expenseValues.length >= 3),
    ambiguousEntries: transactions.filter((t) => t.review_status === "needs_review"),
    budgetUsage: budgets.map((budget) => {
      const spent = byCategory.get(budget.category_id) ?? 0;
      return { ...budget, spent, remaining: budget.budget_jpy - spent, percentage: Math.round(spent / budget.budget_jpy * 1000) / 10 };
    }),
  };
}

import { describe, expect, it } from "vitest";
import type { FinanceRepository } from "@/lib/repositories/repository";
import type { BudgetRecord, CategoryRule, TransactionRecord } from "@/lib/types";
import { ingestVoice } from "@/lib/services/transactions";

class MemoryRepository implements FinanceRepository {
  transactions: TransactionRecord[] = []; failWrites = false;
  async listTransactions() { return this.transactions; }
  async findBySourceReference(reference: string) { return this.transactions.filter((t) => t.source_reference === reference || t.source_reference.startsWith(`${reference}:`)); }
  async createTransactions(records: TransactionRecord[]) { if (this.failWrites) throw new Error("Sheets unavailable"); this.transactions.push(...records); return records; }
  async updateTransaction(id: string, patch: Partial<TransactionRecord>) { const index=this.transactions.findIndex((t)=>t.transaction_id===id); if(index<0) throw new Error("Not found"); return this.transactions[index]={...this.transactions[index],...patch}; }
  async listCategoryRules(): Promise<CategoryRule[]> { return []; }
  async listBudgets(): Promise<BudgetRecord[]> { return []; }
  async upsertBudget(budget: BudgetRecord) { return budget; }
  async findExchangeRate() { return null; }
  async saveExchangeRate() {}
  async saveReportSnapshot() {}
  async listReportSnapshots() { return []; }
}

describe("voice ingestion", () => {
  it("returns the persisted record and makes retries idempotent", async () => {
    const repository = new MemoryRepository();
    const payload = { text: "กาแฟ 250 เยน", source: "iphone_shortcut", client_request_id: "request-001" };
    const first = await ingestVoice(payload, repository, new Date("2026-11-12T03:00:00Z"));
    const retry = await ingestVoice(payload, repository, new Date("2026-11-12T03:00:01Z"));
    expect(first.duplicate).toBe(false); expect(retry.duplicate).toBe(true); expect(repository.transactions).toHaveLength(1);
  });
  it("serializes concurrent duplicate submissions", async () => {
    const repository = new MemoryRepository();
    const payload = { text: "ชาบู 4100", source: "iphone_shortcut", client_request_id: "request-concurrent" };
    await Promise.all([ingestVoice(payload, repository), ingestVoice(payload, repository)]);
    expect(repository.transactions).toHaveLength(1);
  });
  it("does not claim persistence when the Sheets write fails", async () => {
    const repository = new MemoryRepository(); repository.failWrites = true;
    await expect(ingestVoice({ text: "กาแฟ 250", source: "iphone_shortcut", client_request_id: "request-fail" }, repository)).rejects.toThrow("Sheets unavailable");
  });
  it("allows correction of an imported transaction without changing its stable id", async () => {
    const repository = new MemoryRepository();
    const saved = await ingestVoice({ text: "ซื้อของเซเว่น 1200 เยน", source: "google_docs_import", client_request_id: "gdoc:one" }, repository);
    const id = saved.transactions[0].transaction_id;
    const updated = await repository.updateTransaction(id, { category: "อาหารและเครื่องดื่ม", review_status: "confirmed" });
    expect(updated.transaction_id).toBe(id); expect(updated.category).toBe("อาหารและเครื่องดื่ม");
  });
  it("syncing an unchanged source adds nothing", async () => {
    const repository = new MemoryRepository();
    expect(await repository.listTransactions()).toEqual([]);
    expect(await repository.listTransactions()).toEqual([]);
  });
});

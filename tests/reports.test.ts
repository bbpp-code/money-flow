import { describe, expect, it } from "vitest";
import { calculateReport } from "@/lib/services/reports";
import type { TransactionRecord } from "@/lib/types";

const base = { transaction_id:"x",date:"2026-11-01",created_at:"",description:"",original_text:"",category:"อาหาร",subcategory:"",original_amount:"100",original_currency:"JPY",fx_rate:"1",fx_rate_date:"2026-11-01",fx_provider:"identity",payment_method:"",source:"test",source_reference:"x",confidence:1,review_status:"confirmed" as const,notes:"",updated_at:"" };
describe("financial calculations", () => {
  it("uses integer JPY records and does not call net cash flow a balance", () => {
    const rows: TransactionRecord[] = [{...base,type:"income",amount_jpy:1000},{...base,transaction_id:"y",type:"expense",amount_jpy:350}];
    expect(calculateReport(rows)).toMatchObject({ income:1000,expenses:350,netCashFlow:650,transactionCount:2 });
  });
  it("reports incomplete FX rows separately", () => {
    const rows: TransactionRecord[] = [{...base,type:"expense",amount_jpy:null}];
    expect(calculateReport(rows).incompleteJpyCount).toBe(1);
  });
});

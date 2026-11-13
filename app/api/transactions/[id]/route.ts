import { NextResponse } from "next/server";
import { getRepository } from "@/lib/repositories";
import { transactionPatchSchema } from "@/lib/schema";
import { requireOwner } from "@/lib/security";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!await requireOwner()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await context.params;
    const patch = transactionPatchSchema.parse(await request.json());
    const repository = await getRepository();
    const { amount_jpy, ...details } = patch;
    let amountPatch = {};
    if (amount_jpy !== undefined) {
      const [current] = await repository.listTransactions({ id });
      if (!current) return NextResponse.json({ error: "ไม่พบรายการ" }, { status: 404 });
      if (amount_jpy !== current.amount_jpy) {
        amountPatch = current.original_currency === "JPY"
          ? { amount_jpy, original_amount: String(amount_jpy), fx_rate: "1", fx_rate_date: current.date, fx_provider: "identity" }
          : { amount_jpy, fx_rate: "", fx_rate_date: "", fx_provider: "actual_settlement" };
      }
    }
    const transaction = await repository.updateTransaction(id, { ...details, ...amountPatch });
    return NextResponse.json({ transaction, rule_suggestion: patch.category ? { keyword: transaction.description, category: patch.category, subcategory: patch.subcategory ?? transaction.subcategory } : null });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid request" }, { status: 400 }); }
}

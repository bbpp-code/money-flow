import { NextResponse } from "next/server";
import { getRepository } from "@/lib/repositories";
import { transactionPatchSchema } from "@/lib/schema";
import { requireOwner } from "@/lib/security";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!await requireOwner()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await context.params;
    const patch = transactionPatchSchema.parse(await request.json());
    const transaction = await (await getRepository()).updateTransaction(id, patch);
    return NextResponse.json({ transaction, rule_suggestion: patch.category ? { keyword: transaction.description, category: patch.category, subcategory: patch.subcategory ?? transaction.subcategory } : null });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid request" }, { status: 400 }); }
}

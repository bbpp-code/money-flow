import { NextResponse } from "next/server";
import { getRepository } from "@/lib/repositories";
import { budgetSchema } from "@/lib/schema";
import { requireOwner } from "@/lib/security";

export async function GET(request: Request) {
  if (!await requireOwner()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ budgets: await (await getRepository()).listBudgets(new URL(request.url).searchParams.get("month") || undefined) });
}
export async function PUT(request: Request) {
  if (!await requireOwner()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { return NextResponse.json({ budget: await (await getRepository()).upsertBudget(budgetSchema.parse(await request.json())) }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid request" }, { status: 400 }); }
}

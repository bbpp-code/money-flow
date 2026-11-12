import { NextResponse } from "next/server";
import { getRepository, isDemoMode } from "@/lib/repositories";
import { requireOwner } from "@/lib/security";
import { calculateReport } from "@/lib/services/reports";
import { formatInTimeZone } from "@/lib/time";

export async function GET(request: Request) {
  if (!await requireOwner()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const month = new URL(request.url).searchParams.get("month") || formatInTimeZone(new Date()).slice(0, 7);
  const repository = await getRepository();
  const [transactions, budgets] = await Promise.all([repository.listTransactions({ month }), repository.listBudgets(month)]);
  return NextResponse.json({ month, lastSync: new Date().toISOString(), demoMode: isDemoMode(), transactions, budgets, report: calculateReport(transactions, budgets) });
}

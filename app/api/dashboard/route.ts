import { NextResponse } from "next/server";
import { getRepository, isDemoMode } from "@/lib/repositories";
import { requireOwner } from "@/lib/security";
import { calculateReport } from "@/lib/services/reports";
import { formatInTimeZone } from "@/lib/time";

export async function GET(request: Request) {
  if (!await requireOwner()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const month = params.get("month") || formatInTimeZone(new Date()).slice(0, 7);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return NextResponse.json({ error: "Invalid month" }, { status: 400 });
  const scope = params.get("scope") === "all" ? "all" : "month";
  const repository = await getRepository();
  const [transactions, budgets] = await Promise.all([
    repository.listTransactions(scope === "all" ? {} : { month }),
    scope === "all" ? Promise.resolve([]) : repository.listBudgets(month),
  ]);
  return NextResponse.json({ month, scope, lastSync: new Date().toISOString(), demoMode: isDemoMode(), transactions, budgets, report: calculateReport(transactions, budgets) });
}

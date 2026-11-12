import { NextResponse } from "next/server";
import { getRepository } from "@/lib/repositories";
import { requireOwner } from "@/lib/security";
import { calculateReport } from "@/lib/services/reports";
import { formatInTimeZone } from "@/lib/time";

export async function GET(request: Request) {
  if (!await requireOwner()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const date = new URL(request.url).searchParams.get("date") || formatInTimeZone(new Date());
  const repository = await getRepository();
  const monthly = await repository.listTransactions({ month: date.slice(0, 7) });
  const transactions = monthly.filter((t) => t.date === date);
  return NextResponse.json({ date, transactions, report: calculateReport(transactions, await repository.listBudgets(date.slice(0, 7))) });
}

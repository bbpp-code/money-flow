import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getRepository } from "@/lib/repositories";
import { verifyCron } from "@/lib/security";
import { calculateReport } from "@/lib/services/reports";
import { formatInTimeZone } from "@/lib/time";

export async function GET(request: Request) {
  if (!verifyCron(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const date = formatInTimeZone(new Date());
  const repository = await getRepository();
  const monthRows = await repository.listTransactions({ month: date.slice(0, 7) });
  const transactions = monthRows.filter((t) => t.date === date);
  const snapshot = { generated_at: new Date().toISOString(), date, transactions, report: calculateReport(transactions, await repository.listBudgets(date.slice(0, 7))) };
  await repository.saveReportSnapshot({ reportId: randomUUID(), date, generatedAt: snapshot.generated_at, summaryJson: JSON.stringify(snapshot.report) });
  return NextResponse.json({ success: true, snapshot, note: "Configure the hosting scheduler for 18:00 Asia/Tokyo (09:00 UTC). This route does not modify existing ChatGPT tasks." });
}

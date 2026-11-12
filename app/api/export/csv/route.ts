import { NextResponse } from "next/server";
import { getRepository } from "@/lib/repositories";
import { requireOwner } from "@/lib/security";
import { TRANSACTION_HEADERS } from "@/lib/types";

const escape = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
export async function GET(request: Request) {
  if (!await requireOwner()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const month = new URL(request.url).searchParams.get("month") || undefined;
  const rows = await (await getRepository()).listTransactions({ month });
  const csv = `\uFEFF${TRANSACTION_HEADERS.join(",")}\n${rows.map((row) => TRANSACTION_HEADERS.map((header) => escape(row[header])).join(",")).join("\n")}`;
  return new NextResponse(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="moneyflow-${month ?? "all"}.csv"` } });
}

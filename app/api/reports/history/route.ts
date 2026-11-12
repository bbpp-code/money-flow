import { NextResponse } from "next/server";
import { getRepository } from "@/lib/repositories";
import { requireOwner } from "@/lib/security";

export async function GET() {
  if (!await requireOwner()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const snapshots = await (await getRepository()).listReportSnapshots();
  return NextResponse.json({ snapshots: snapshots.map((item) => ({ ...item, summary: JSON.parse(item.summaryJson || "{}"), summaryJson: undefined })) });
}

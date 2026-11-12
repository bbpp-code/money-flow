import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/security";
import { buildMigrationPreview } from "@/lib/services/migration";

export async function POST() {
  if (!await requireOwner()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (process.env.DEMO_MODE !== "false") return NextResponse.json({ error: "Google Docs preview is unavailable in demo mode. Configure service-account access first." }, { status: 409 });
  try { return NextResponse.json(await buildMigrationPreview(process.env.GOOGLE_DOC_ID || "1-_wsfIz2I99zozOqsv6CaqPNir2eZ1a6eTVerGsq8_I")); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Preview failed" }, { status: 503 }); }
}

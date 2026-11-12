import { NextResponse } from "next/server";
import { isDemoMode } from "@/lib/repositories";
export async function GET() { return NextResponse.json({ ok: true, mode: isDemoMode() ? "demo" : "google_sheets", timezone: "Asia/Tokyo" }); }

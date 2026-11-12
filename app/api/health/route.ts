import { NextResponse } from "next/server";
import { isDemoMode } from "@/lib/repositories";
export async function GET() { return NextResponse.json({ ok: true, mode: isDemoMode() ? "demo" : process.env.DATA_BACKEND === "supabase" ? "supabase" : "google_sheets", timezone: "Asia/Tokyo" }); }

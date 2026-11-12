import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ParseError } from "@/lib/parser";
import { getRepository } from "@/lib/repositories";
import { voiceRequestSchema } from "@/lib/schema";
import { checkRateLimit, verifyDeviceToken } from "@/lib/security";
import { ingestVoice } from "@/lib/services/transactions";

export async function POST(request: Request) {
  if (!verifyDeviceToken(request)) return NextResponse.json({ success: false, error: { code: "unauthorized", message_th: "ไม่ได้รับอนุญาต" } }, { status: 401 });
  const rateKey = request.headers.get("x-forwarded-for") || "device";
  if (!checkRateLimit(rateKey)) return NextResponse.json({ success: false, error: { code: "rate_limited", message_th: "ส่งรายการเร็วเกินไป กรุณาลองใหม่" } }, { status: 429 });
  try {
    const payload = voiceRequestSchema.parse(await request.json());
    const result = await ingestVoice(payload, await getRepository());
    const transactions = result.transactions.map((t) => ({
      transaction_id: t.transaction_id, description: t.description, amount_jpy: t.amount_jpy,
      original_amount: t.original_amount, original_currency: t.original_currency, type: t.type,
      category: t.category, subcategory: t.subcategory, review_status: t.review_status,
    }));
    const first = transactions[0];
    const confirmation = transactions.length === 1
      ? `บันทึก${first.description} ${first.amount_jpy ?? first.original_amount} ${first.amount_jpy !== null ? "เยน" : first.original_currency}แล้ว${first.review_status === "needs_review" ? " กรุณาตรวจสอบหมวดหมู่" : ""}`
      : `บันทึก ${transactions.length} รายการแล้ว${transactions.some((t) => t.review_status === "needs_review") ? " มีรายการที่ต้องตรวจสอบ" : ""}`;
    return NextResponse.json({ success: true, duplicate: result.duplicate, status: transactions.some((t) => t.review_status === "needs_review") ? "needs_review" : "saved", transactions, transaction: transactions.length === 1 ? first : undefined, confirmation_th: confirmation });
  } catch (error) {
    if (error instanceof ParseError) return NextResponse.json({ success: false, status: "needs_input", error: { code: error.code, message_th: error.message } }, { status: 422 });
    if (error instanceof ZodError) return NextResponse.json({ success: false, error: { code: "invalid_request", message_th: "ข้อมูลไม่ถูกต้อง", details: error.issues } }, { status: 400 });
    console.error("Voice ingestion failed", error);
    return NextResponse.json({ success: false, error: { code: "persistence_failed", message_th: "ยังไม่ได้บันทึก กรุณาลองใหม่" } }, { status: 503 });
  }
}

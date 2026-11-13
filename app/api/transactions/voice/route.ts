import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ParseError, parseVoiceText } from "@/lib/parser";
import { getRepository } from "@/lib/repositories";
import { voiceRequestSchema } from "@/lib/schema";
import { checkRateLimit, verifyDeviceToken } from "@/lib/security";
import { ingestVoice } from "@/lib/services/transactions";

function checkAccess(request: Request) {
  if (!verifyDeviceToken(request)) return NextResponse.json({ success: false, error: { code: "unauthorized", message_th: "ไม่ได้รับอนุญาต" } }, { status: 401 });
  const rateKey = `${request.method}:${request.headers.get("x-forwarded-for") || "device"}`;
  if (!checkRateLimit(rateKey)) return NextResponse.json({ success: false, error: { code: "rate_limited", message_th: "ส่งรายการเร็วเกินไป กรุณาลองใหม่" } }, { status: 429 });
}

export async function GET(request: Request) {
  const denied = checkAccess(request);
  if (denied) return denied;

  return NextResponse.json({ client_request_id: randomUUID() }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const denied = checkAccess(request);
  if (denied) return denied;
  try {
    const payload = voiceRequestSchema.parse(await request.json());
    const repository = await getRepository();
    if (new URL(request.url).searchParams.get("preview") === "1") {
      const parsed = parseVoiceText(payload.text, { rules: await repository.listCategoryRules() });
      return NextResponse.json({ success: true, status: "preview", preview_th: `แอปอ่านได้: ${parsed.map((item) => `${item.description} ${item.amount} ${item.currency}`).join(" / ")} (ยังไม่ได้บันทึก)` });
    }
    const result = await ingestVoice(payload, repository);
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
    if (error instanceof ZodError) {
      const field = error.issues[0]?.path[0];
      const message = field === "text" && (error.issues[0]?.code === "too_small" || error.issues[0]?.code === "invalid_type")
        ? "แอปไม่ได้รับข้อความจากคำพูด ให้เลือกผลลัพธ์ของ Dictate Text ในช่อง text แล้วลองอีกครั้ง"
        : field === "client_request_id"
          ? "ตรวจสอบช่อง client_request_id ให้ใช้รหัสจากขั้นตอน GET ของ MoneyFlow"
          : "ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบข้อความและการตั้งค่า Shortcut";
      return NextResponse.json({ success: false, error: { code: "invalid_request", message_th: message, details: error.issues } }, { status: 400 });
    }
    console.error("Voice ingestion failed", error);
    return NextResponse.json({ success: false, error: { code: "persistence_failed", message_th: "ยังไม่ได้บันทึก กรุณาลองใหม่" } }, { status: 503 });
  }
}

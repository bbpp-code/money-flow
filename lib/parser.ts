import { formatInTimeZone } from "@/lib/time";
import { classify, normalizeText } from "@/lib/categories";
import type { CategoryRule, ParsedTransaction } from "@/lib/types";

const THAI_MONTHS: Record<string, number> = {
  มกราคม: 1, มกรา: 1, กุมภาพันธ์: 2, กุมภา: 2, มีนาคม: 3, มีนา: 3,
  เมษายน: 4, เมษา: 4, พฤษภาคม: 5, พฤษภา: 5, มิถุนายน: 6, มิถุนา: 6,
  กรกฎาคม: 7, กรกฎา: 7, สิงหาคม: 8, สิงหา: 8, กันยายน: 9, กันยา: 9,
  ตุลาคม: 10, ตุลา: 10, พฤศจิกายน: 11, พฤศจิกา: 11, ธันวาคม: 12, ธันวา: 12,
};

const CURRENCIES: Array<[RegExp, string]> = [
  [/(?:บาท(?:\s|$)|\bthb\b)/iu, "THB"], [/(?:เยน(?:\s|$)|\bjpy\b|円)/iu, "JPY"],
  [/(?:ดอลลาร์(?:สหรัฐ)?(?:\s|$)|\busd\b|\$)/iu, "USD"], [/(?:ยูโร(?:\s|$)|\beur\b|€)/iu, "EUR"],
];

const UNSUPPORTED_CURRENCY = /(?:วอน(?:\s|$)|\bkrw\b|หยวน(?:\s|$)|\bcny\b|ปอนด์(?:\s|$)|\bgbp\b|ดอลลาร์สิงคโปร์(?:\s|$)|\bsgd\b)/iu;

export class ParseError extends Error {
  constructor(message: string, public code: string) { super(message); }
}

function dateAtTokyo(text: string, now: Date) {
  const today = formatInTimeZone(now, "Asia/Tokyo");
  if (/เมื่อวาน|yesterday|昨日/iu.test(text)) {
    const d = new Date(`${today}T00:00:00+09:00`); d.setUTCDate(d.getUTCDate() - 1);
    return { date: formatInTimeZone(d, "Asia/Tokyo"), inferred: false };
  }
  const iso = text.match(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/);
  const jp = text.match(/\b(20\d{2})年\s*(\d{1,2})月\s*(\d{1,2})日/);
  const numeric = text.match(/(?:วันที่\s*)?(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/u);
  const thai = text.match(new RegExp(`(?:วันที่\\s*)?(\\d{1,2})\\s*(${Object.keys(THAI_MONTHS).join("|")})(?:\\s*(\\d{4}))?`, "iu"));
  if (iso) return { date: `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`, inferred: false };
  if (jp) return { date: `${jp[1]}-${jp[2].padStart(2, "0")}-${jp[3].padStart(2, "0")}`, inferred: false };
  if (numeric) {
    let year = Number(numeric[3]); if (year < 100) year += 2000; if (year > 2400) year -= 543;
    return { date: `${year}-${numeric[2].padStart(2, "0")}-${numeric[1].padStart(2, "0")}`, inferred: false };
  }
  if (thai) {
    let year = thai[3] ? Number(thai[3]) : Number(today.slice(0, 4)); if (year > 2400) year -= 543;
    return { date: `${year}-${String(THAI_MONTHS[thai[2].toLowerCase()]).padStart(2, "0")}-${thai[1].padStart(2, "0")}`, inferred: false };
  }
  return { date: today, inferred: true };
}

function splitPhrases(text: string) {
  const normalized = text.replace(/\r/g, "\n").trim();
  const chunks = normalized.split(/\n+|\s+(?:และ|แล้วก็|จากนั้น|and then)\s+|[;；]/iu).map((part) => part.trim()).filter(Boolean);
  return chunks.length > 1 && chunks.every((part) => /\d/.test(normalizeText(part))) ? chunks : [normalized];
}

export function parsePhrase(input: string, options: { now?: Date; rules?: CategoryRule[] } = {}): ParsedTransaction {
  const originalText = input.trim();
  const text = normalizeText(originalText);
  if (UNSUPPORTED_CURRENCY.test(text)) throw new ParseError("ไม่รองรับสกุลเงินที่ระบุ", "unsupported_currency");
  const numberMatches = [...text.matchAll(/(?:^|\s)(\d[\d,]*(?:\.\d+)?)(?=\s*(?:บาท|thb|เยน|jpy|円|ดอลลาร์(?:สหรัฐ)?|usd|\$|ยูโร|eur|€)?(?:\s|$))/giu)];
  if (!numberMatches.length) throw new ParseError("ไม่พบจำนวนเงิน กรุณาพูดจำนวนเงินด้วย", "missing_amount");
  const amountMatch = numberMatches[numberMatches.length - 1];
  const amount = amountMatch[1].replace(/,/g, "");
  if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) throw new ParseError("จำนวนเงินไม่ถูกต้อง", "invalid_amount");

  let currency = "JPY";
  let currencyInferred = true;
  for (const [pattern, code] of CURRENCIES) if (pattern.test(text)) { currency = code; currencyInferred = false; break; }

  const date = dateAtTokyo(text, options.now ?? new Date());
  const type = /เงินเดือนเข้า|รายรับ|รับเงิน|salary|income|給与/iu.test(text) ? "income" : "expense";
  let description = originalText;
  description = description.replace(new RegExp(`${amountMatch[1].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*(?:บาท|thb|เยน|jpy|円|ดอลลาร์(?:สหรัฐ)?|usd|\\$|ยูโร|eur|€)?`, "iu"), "");
  description = description.replace(/(?:วันนี้|เมื่อวาน|today|yesterday|昨日)/giu, "")
    .replace(/\b20\d{2}[-/]\d{1,2}[-/]\d{1,2}\b/gu, "")
    .replace(/\b20\d{2}年\s*\d{1,2}月\s*\d{1,2}日/gu, "")
    .replace(/(?:วันที่\s*)?\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/gu, "")
    .replace(new RegExp(`(?:วันที่\\s*)?\\d{1,2}\\s*(?:${Object.keys(THAI_MONTHS).join("|")})(?:\\s*\\d{4})?`, "giu"), "")
    .replace(/\s+/g, " ").trim();
  if (!description) description = type === "income" ? "รายรับ" : "รายการใช้จ่าย";

  const category = classify(description, options.rules);
  const warnings: string[] = [];
  if (currencyInferred) warnings.push("currency_defaulted_to_jpy");
  if (date.inferred) warnings.push("date_defaulted_to_today_tokyo");
  if (category.confidence < 0.7) warnings.push("category_needs_review");
  return {
    description, originalText, amount, currency, currencyInferred, date: date.date,
    dateInferred: date.inferred, type, category: category.category, subcategory: category.subcategory,
    confidence: category.confidence, reviewStatus: category.confidence >= 0.7 ? "confirmed" : "needs_review", warnings,
  };
}

export function parseVoiceText(text: string, options: { now?: Date; rules?: CategoryRule[] } = {}) {
  return splitPhrases(text).map((phrase) => parsePhrase(phrase, options));
}

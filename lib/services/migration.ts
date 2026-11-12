import { createHash } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { getDocsClient } from "@/lib/google";
import { ParseError, parsePhrase } from "@/lib/parser";
import { getRepository } from "@/lib/repositories";

function secret() { return new TextEncoder().encode(process.env.NEXTAUTH_SECRET || "demo-only-secret-change-me"); }

export async function readGoogleDoc(docId: string) {
  const response = await getDocsClient().documents.get({ documentId: docId });
  const text = (response.data.body?.content ?? []).map((item) => item.paragraph?.elements?.map((element) => element.textRun?.content ?? "").join("") ?? "").join("");
  return { title: response.data.title ?? "", text };
}

const HEADING = /^(?:วันที่\s*)?(\d{1,2})\s*(มกราคม|มกรา|กุมภาพันธ์|กุมภา|มีนาคม|มีนา|เมษายน|เมษา|พฤษภาคม|พฤษภา|มิถุนายน|มิถุนา|กรกฎาคม|กรกฎา|สิงหาคม|สิงหา|กันยายน|กันยา|ตุลาคม|ตุลา|พฤศจิกายน|พฤศจิกา|ธันวาคม|ธันวา)(?:\s*(\d{4}))?$/iu;
const MONTH_HEADING = /^(มกราคม|มกรา|กุมภาพันธ์|กุมภา|มีนาคม|มีนา|เมษายน|เมษา|พฤษภาคม|พฤษภา|มิถุนายน|มิถุนา|กรกฎาคม|กรกฎา|สิงหาคม|สิงหา|กันยายน|กันยา|ตุลาคม|ตุลา|พฤศจิกายน|พฤศจิกา|ธันวาคม|ธันวา)(?:\s*(\d{4}))?$/iu;
const DAY_HEADING = /^(?:วันที่|วัน)\s*(\d{1,2})$/iu;
const NUMBERED_HEADING = /^(?:วันที่|วัน)\s*(\d{1,2})\s*\/\s*(\d{1,2})(?:\s*\/\s*(\d{4}))?$/iu;
const SUMMARY_LINE = /^(?:รวม|ยอดรวม|สรุป|total|subtotal|คงเหลือ)/iu;

export async function buildMigrationPreview(docId: string) {
  const document = await readGoogleDoc(docId);
  const repository = await getRepository();
  const lines = document.text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  let heading = "";
  let monthHeading = "";
  let currentMonth = /เดือน\s*10|ตุลาคม/u.test(document.title) ? 10 : Number(new Date().toLocaleDateString("en-US", { timeZone: "Asia/Tokyo", month: "numeric" }));
  let currentYear = Number(new Date().toLocaleDateString("en-US", { timeZone: "Asia/Tokyo", year: "numeric" }));
  const occurrences = new Map<string, number>();
  const items: Array<Record<string, unknown>> = [];
  for (const [index, line] of lines.entries()) {
    if (HEADING.test(line)) { heading = line; continue; }
    if (MONTH_HEADING.test(line)) { monthHeading = line; heading = line; continue; }
    const numbered = line.match(NUMBERED_HEADING);
    if (numbered) {
      currentMonth = Number(numbered[2]);
      currentYear = numbered[3] ? Number(numbered[3]) : currentYear;
      monthHeading = "";
      heading = `${currentYear}-${String(currentMonth).padStart(2, "0")}-${numbered[1].padStart(2, "0")}`;
      continue;
    }
    if (/^วันที่สอง$/u.test(line)) { heading = `${currentYear}-${String(currentMonth).padStart(2, "0")}-02`; continue; }
    const dayMatch = line.match(DAY_HEADING);
    if (dayMatch) { heading = monthHeading ? `${dayMatch[1]} ${monthHeading}` : `${currentYear}-${String(currentMonth).padStart(2, "0")}-${dayMatch[1].padStart(2, "0")}`; continue; }
    if (SUMMARY_LINE.test(line)) continue;
    if (!/\d/.test(line)) continue;
    const original = line;
    const identity = `${heading}|${original}`;
    const occurrence = (occurrences.get(identity) ?? 0) + 1;
    occurrences.set(identity, occurrence);
    const fingerprint = createHash("sha256").update(`${docId}|${identity}|${occurrence}`).digest("hex");
    const reference = `gdoc:${docId}:${fingerprint}`;
    const duplicate = (await repository.findBySourceReference(reference)).length > 0;
    try {
      const parsed = parsePhrase(`${heading} ${line}`.trim());
      items.push({ ...parsed, originalText: original, fingerprint, reference, duplicate, line: index + 1 });
    } catch (error) {
      items.push({ originalText: original, fingerprint, reference, duplicate, line: index + 1, reviewStatus: "needs_review", error: error instanceof ParseError ? error.code : "parse_failed" });
    }
  }
  const digest = createHash("sha256").update(document.text).digest("hex");
  const token = await new SignJWT({ docId, digest }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("30m").sign(secret());
  const readyItems = items.filter((i) => !i.error && !i.duplicate);
  const totalsByCurrency = readyItems.reduce<Record<string, { income: number; expense: number }>>((totals, item) => {
    const currency = String(item.currency); totals[currency] ??= { income: 0, expense: 0 };
    totals[currency][item.type === "income" ? "income" : "expense"] += Number(item.amount);
    return totals;
  }, {});
  return { title: document.title, docId, digest, token, items, summary: { total: items.length, ready: readyItems.length, duplicates: items.filter((i) => i.duplicate).length, needsReview: items.filter((i) => i.reviewStatus === "needs_review").length, totalsByCurrency } };
}

export async function verifyMigrationToken(token: string) {
  const result = await jwtVerify(token, secret());
  return result.payload as { docId: string; digest: string };
}

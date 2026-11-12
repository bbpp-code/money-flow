import { describe, expect, it } from "vitest";
import { ParseError, parsePhrase, parseVoiceText } from "@/lib/parser";

const now = new Date("2026-11-12T03:00:00.000Z");

describe("Thai transaction parser", () => {
  const fixtures = [
    ["กาแฟ 250 เยน", "กาแฟ", "JPY", "อาหารและเครื่องดื่ม", "กาแฟ", "expense"],
    ["ชาบู 4100", "ชาบู", "JPY", "อาหารและเครื่องดื่ม", "ร้านอาหาร", "expense"],
    ["ค่าทางด่วน 1200 เยน", "ค่าทางด่วน", "JPY", "รถยนต์และการเดินทาง", "ทางด่วน", "expense"],
    ["เงินเดือนเข้า 280000 เยน", "เงินเดือนเข้า", "JPY", "รายรับ", "เงินเดือน", "income"],
    ["แว่นสโนว์บอร์ด 33000 เยน", "แว่นสโนว์บอร์ด", "JPY", "งานอดิเรก", "สโนว์บอร์ด", "expense"],
    ["Apple Watch 13000 บาท", "Apple Watch", "THB", "เทคโนโลยี", "อุปกรณ์", "expense"],
    ["ค่าที่พักแคมปิง 19000", "ค่าที่พักแคมปิง", "JPY", "ท่องเที่ยวและพักผ่อน", "ที่พัก", "expense"],
    ["ซื้อของเซเว่น 1200 เยน", "ซื้อของเซเว่น", "JPY", "อื่นๆ", "", "expense"],
  ];
  it.each(fixtures)("parses %s", (text, description, currency, category, subcategory, type) => {
    const result = parsePhrase(text, { now });
    expect(result).toMatchObject({ description, currency, category, subcategory, type, date: "2026-11-12" });
  });
  it("flags ambiguous convenience-store purchases", () => expect(parsePhrase("ซื้อของเซเว่น 1200 เยน", { now }).reviewStatus).toBe("needs_review"));
  it("marks an omitted currency as inferred JPY", () => expect(parsePhrase("ชาบู 4100", { now })).toMatchObject({ currency: "JPY", currencyInferred: true }));
  it("splits two transactions in one sentence", () => expect(parseVoiceText("กาแฟ 250 เยน และ ค่าทางด่วน 1200 เยน", { now })).toHaveLength(2));
  it("never invents a missing amount", () => expect(() => parsePhrase("ซื้อกาแฟ", { now })).toThrowError(ParseError));
  it("rejects an unsupported explicit currency", () => expect(() => parsePhrase("อาหาร 1200 วอน", { now })).toThrowError(/ไม่รองรับ/));
  it("parses Thai Buddhist and Japanese dates", () => {
    expect(parsePhrase("กาแฟ 250 เยน วันที่ 31 ตุลาคม 2569", { now }).date).toBe("2026-10-31");
    expect(parsePhrase("2027年1月1日 コーヒー 500円", { now }).date).toBe("2027-01-01");
  });
  it("handles yesterday across a year boundary", () => expect(parsePhrase("เมื่อวาน กาแฟ 250", { now: new Date("2027-01-01T03:00:00Z") }).date).toBe("2026-12-31"));
});

import { describe, expect, it } from "vitest";
import { extractDocumentEntries } from "@/lib/services/migration";

describe("Google Docs migration references", () => {
  it("keeps stable Google Docs paragraph offsets for idempotent imports", () => {
    expect(extractDocumentEntries([
      { startIndex: 11, text: "วันที่สอง\n" },
      { startIndex: 22, text: "กาแฟ 250 เยน\n" },
      { startIndex: 38, text: "ชาบู 4100\nค่าทางด่วน 400 เยน\n" },
    ])).toEqual([
      { text: "วันที่สอง", startIndex: 11 },
      { text: "กาแฟ 250 เยน", startIndex: 22 },
      { text: "ชาบู 4100", startIndex: 38 },
      { text: "ค่าทางด่วน 400 เยน", startIndex: 48 },
    ]);
  });
});

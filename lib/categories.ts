import type { CategoryRule } from "@/lib/types";

type BuiltinRule = { keywords: string[]; category: string; subcategory: string; score: number };

const BUILTIN_RULES: BuiltinRule[] = [
  { keywords: ["เงินเดือนเข้า", "salary", "給与"], category: "รายรับ", subcategory: "เงินเดือน", score: 0.99 },
  { keywords: ["กาแฟ", "coffee", "コーヒー", "starbucks", "สตาร์บัค"], category: "อาหารและเครื่องดื่ม", subcategory: "กาแฟ", score: 0.97 },
  { keywords: ["ชาบู", "ร้านอาหาร", "restaurant", "レストラン", "ราเมง", "ラーメン"], category: "อาหารและเครื่องดื่ม", subcategory: "ร้านอาหาร", score: 0.94 },
  { keywords: ["ค่าทางด่วน", "ทางด่วน", "高速", "toll"], category: "รถยนต์และการเดินทาง", subcategory: "ทางด่วน", score: 0.97 },
  { keywords: ["ค่าน้ำมัน", "น้ำมันรถ", "gasoline", "ガソリン"], category: "รถยนต์และการเดินทาง", subcategory: "น้ำมัน", score: 0.96 },
  { keywords: ["apple watch", "iphone", "ipad", "macbook", "อุปกรณ์ไอที"], category: "เทคโนโลยี", subcategory: "อุปกรณ์", score: 0.94 },
  { keywords: ["สโนว์บอร์ด", "snowboard", "スノーボード"], category: "งานอดิเรก", subcategory: "สโนว์บอร์ด", score: 0.96 },
  { keywords: ["ออนเซ็น", "onsen", "温泉"], category: "ท่องเที่ยวและพักผ่อน", subcategory: "ออนเซ็น", score: 0.94 },
  { keywords: ["ดำน้ำ", "diving", "ダイビング"], category: "ท่องเที่ยวและกิจกรรม", subcategory: "ดำน้ำ", score: 0.95 },
  { keywords: ["ค่าที่พัก", "โรงแรม", "แคมปิง", "camping", "hotel", "ホテル"], category: "ท่องเที่ยวและพักผ่อน", subcategory: "ที่พัก", score: 0.93 },
  { keywords: ["ทำฟัน", "หมอฟัน", "dentist", "歯医者"], category: "สุขภาพ", subcategory: "ทันตกรรม", score: 0.97 },
  { keywords: ["หมอ", "โรงพยาบาล", "hospital", "病院", "ยา", "薬"], category: "สุขภาพ", subcategory: "การรักษา", score: 0.91 },
];

const AMBIGUOUS_MERCHANTS = ["เซเว่น", "7-eleven", "7 eleven", "convenience store", "コンビニ"];

export function normalizeText(input: string) {
  const thaiDigits: Record<string, string> = { "๐": "0", "๑": "1", "๒": "2", "๓": "3", "๔": "4", "๕": "5", "๖": "6", "๗": "7", "๘": "8", "๙": "9" };
  return input.normalize("NFKC").toLowerCase().replace(/[๐-๙]/g, (d) => thaiDigits[d]).replace(/\s+/g, " ").trim();
}

export function classify(description: string, userRules: CategoryRule[] = []) {
  const normalized = normalizeText(description);
  const enabledRules = userRules.filter((rule) => rule.enabled).sort((a, b) => b.priority - a.priority);

  for (const rule of enabledRules) {
    try {
      const expression = rule.keyword_or_pattern.startsWith("regex:")
        ? new RegExp(rule.keyword_or_pattern.slice(6), "iu")
        : null;
      if (expression?.test(description) || (!expression && normalized.includes(normalizeText(rule.keyword_or_pattern)))) {
        return { category: rule.category_name || rule.category_id, subcategory: rule.subcategory, confidence: 0.995, source: "user_rule" as const };
      }
    } catch {
      // Invalid user regexes are ignored and remain visible for correction in the sheet.
    }
  }

  if (AMBIGUOUS_MERCHANTS.some((keyword) => normalized.includes(keyword))) {
    return { category: "อื่นๆ", subcategory: "", confidence: 0.48, source: "ambiguous" as const };
  }

  const candidates = BUILTIN_RULES.filter((rule) => rule.keywords.some((keyword) => normalized.includes(normalizeText(keyword))));
  if (candidates.length) {
    const best = candidates.sort((a, b) => b.score - a.score)[0];
    return { category: best.category, subcategory: best.subcategory, confidence: best.score, source: "builtin" as const };
  }
  return { category: "อื่นๆ", subcategory: "", confidence: 0.35, source: "unclassified" as const };
}

import { google, sheets_v4 } from "googleapis";

const definitions: Record<string, string[]> = {
  Transactions: ["transaction_id", "date", "created_at", "description", "original_text", "type", "category", "subcategory", "original_amount", "original_currency", "fx_rate", "fx_rate_date", "fx_provider", "amount_jpy", "payment_method", "source", "source_reference", "confidence", "review_status", "notes", "updated_at"],
  Categories: ["category_id", "name_th", "name_en", "parent_category", "keywords", "category_type", "active"],
  Budgets: ["month", "category_id", "budget_jpy", "rollover_enabled", "notes"],
  ExchangeRates: ["date", "from_currency", "to_currency", "rate", "provider", "fetched_at"],
  ImportHistory: ["import_id", "source", "source_reference", "fingerprint", "imported_at", "status", "error"],
  CategoryRules: ["rule_id", "keyword_or_pattern", "category_id", "subcategory", "priority", "enabled"],
  ReportSnapshots: ["report_id", "date", "generated_at", "summary_json"],
};

const categories = [
  ["income", "รายรับ", "Income", "", "เงินเดือน,salary,給与", "income", true],
  ["food", "อาหารและเครื่องดื่ม", "Food & Drinks", "", "กาแฟ,ชาบู,restaurant,コーヒー", "expense", true],
  ["transport", "รถยนต์และการเดินทาง", "Transportation", "", "ค่าทางด่วน,ค่าน้ำมัน,高速,ガソリン", "expense", true],
  ["travel", "ท่องเที่ยวและพักผ่อน", "Travel & Leisure", "", "ออนเซ็น,ที่พัก,hotel,温泉", "expense", true],
  ["hobby", "งานอดิเรก", "Hobbies", "", "สโนว์บอร์ด,snowboard", "expense", true],
  ["technology", "เทคโนโลยี", "Technology", "", "Apple Watch,iPhone,MacBook", "expense", true],
  ["health", "สุขภาพ", "Healthcare", "", "หมอ,ทำฟัน,hospital,病院", "expense", true],
  ["household", "ของใช้ในบ้าน", "Household", "", "", "expense", true],
  ["personal", "ดูแลส่วนตัว", "Personal Care", "", "", "expense", true],
  ["other", "อื่นๆ", "Other", "", "", "expense", true],
];

const rules = [
  ["rule-coffee", "กาแฟ", "food", "กาแฟ", 100, true], ["rule-shabu", "ชาบู", "food", "ร้านอาหาร", 100, true],
  ["rule-toll", "ค่าทางด่วน", "transport", "ทางด่วน", 100, true], ["rule-fuel", "ค่าน้ำมัน", "transport", "น้ำมัน", 100, true],
  ["rule-onsen", "ออนเซ็น", "travel", "ออนเซ็น", 100, true], ["rule-snow", "สโนว์บอร์ด", "hobby", "สโนว์บอร์ด", 100, true],
  ["rule-diving", "ดำน้ำ", "travel", "กิจกรรม", 100, true], ["rule-doctor", "หมอ", "health", "การรักษา", 100, true],
  ["rule-dentist", "ทำฟัน", "health", "ทันตกรรม", 100, true], ["rule-salary", "เงินเดือนเข้า", "income", "เงินเดือน", 100, true],
];

async function main() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is required");
  const auth = new google.auth.GoogleAuth({ credentials: JSON.parse(raw), scopes: ["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive.file"] });
  const sheets = google.sheets({ version: "v4", auth });
  let spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
  if (!spreadsheetId) {
    const created = await sheets.spreadsheets.create({ requestBody: { properties: { title: "MoneyFlow Database", timeZone: "Asia/Tokyo", locale: "th_TH" }, sheets: Object.keys(definitions).map((title) => ({ properties: { title, frozenRowCount: 1 } })) } });
    spreadsheetId = created.data.spreadsheetId ?? undefined;
    console.log(`Created MoneyFlow Database: ${spreadsheetId}`);
    if (spreadsheetId && process.env.OWNER_EMAIL) {
      const drive = google.drive({ version: "v3", auth });
      await drive.permissions.create({ fileId: spreadsheetId, sendNotificationEmail: true, requestBody: { type: "user", role: "writer", emailAddress: process.env.OWNER_EMAIL } });
    }
  } else {
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const existing = new Set(meta.data.sheets?.map((sheet) => sheet.properties?.title));
    const requests: sheets_v4.Schema$Request[] = Object.keys(definitions).filter((title) => !existing.has(title)).map((title) => ({ addSheet: { properties: { title, frozenRowCount: 1 } } }));
    if (requests.length) await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
  }
  if (!spreadsheetId) throw new Error("Spreadsheet creation returned no ID");
  for (const [title, headers] of Object.entries(definitions)) {
    const current = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${title}!1:1` });
    if (!current.data.values?.length) await sheets.spreadsheets.values.update({ spreadsheetId, range: `${title}!A1`, valueInputOption: "RAW", requestBody: { values: [headers] } });
  }
  for (const [title, values] of [["Categories", categories], ["CategoryRules", rules]] as const) {
    const current = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${title}!A2:A` });
    if (!current.data.values?.length) await sheets.spreadsheets.values.append({ spreadsheetId, range: `${title}!A2`, valueInputOption: "RAW", insertDataOption: "INSERT_ROWS", requestBody: { values } });
  }
  console.log(`Setup complete. Set GOOGLE_SPREADSHEET_ID=${spreadsheetId}`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });

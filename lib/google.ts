import { google } from "googleapis";

const SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/documents.readonly",
];

export function getGoogleAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not configured");
  let credentials: Record<string, unknown>;
  try { credentials = JSON.parse(raw); } catch { throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON"); }
  return new google.auth.GoogleAuth({ credentials, scopes: SCOPES });
}

export function getSheetsClient() { return google.sheets({ version: "v4", auth: getGoogleAuth() }); }
export function getDocsClient() { return google.docs({ version: "v1", auth: getGoogleAuth() }); }

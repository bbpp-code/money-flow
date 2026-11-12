import { createHash, timingSafeEqual } from "node:crypto";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isDemoMode } from "@/lib/repositories";

const rateStore = new Map<string, { count: number; reset: number }>();

export function checkRateLimit(key: string, limit = 30, windowMs = 60_000) {
  const now = Date.now();
  const current = rateStore.get(key);
  if (!current || current.reset < now) { rateStore.set(key, { count: 1, reset: now + windowMs }); return true; }
  if (current.count >= limit) return false;
  current.count += 1;
  return true;
}

export function verifyDeviceToken(request: Request) {
  if (isDemoMode() && process.env.DEVICE_API_KEY_HASHES === undefined) return true;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || request.headers.get("x-device-key") || "";
  if (!token) return false;
  const actual = Buffer.from(createHash("sha256").update(token).digest("hex"));
  return (process.env.DEVICE_API_KEY_HASHES || "").split(",").map((v) => v.trim()).filter(Boolean).some((hash) => {
    const expected = Buffer.from(hash);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  });
}

export async function requireOwner() {
  if (isDemoMode()) return { user: { email: "demo@moneyflow.local" } };
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || session.user.email.toLowerCase() !== process.env.OWNER_EMAIL?.toLowerCase()) return null;
  return session;
}

export function verifyCron(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return Boolean(process.env.CRON_SECRET && token === process.env.CRON_SECRET);
}

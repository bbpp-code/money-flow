import { createHash } from "node:crypto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/transactions/voice/route";
import { getRepository } from "@/lib/repositories";

const token = "local-test-device";
const send = (text: string, authorized = true, requestId = "test-preview-001", preview = true) => POST(new Request(`https://example.test/api/transactions/voice${preview ? "?preview=1" : ""}`, {
  method: "POST",
  headers: authorized ? { authorization: `Bearer ${token}` } : {},
  body: JSON.stringify({ text, client_request_id: requestId }),
}));

beforeEach(() => {
  vi.stubEnv("DEMO_MODE", "true");
  vi.stubEnv("DEVICE_API_KEY_HASHES", createHash("sha256").update(token).digest("hex"));
});
afterEach(() => vi.unstubAllEnvs());

it("previews valid Thai text without adding a transaction or returning a saved confirmation", async () => {
  const repository = await getRepository();
  const before = await repository.listTransactions();
  const response = await send("กาแฟ 250 เยน");
  expect(response.status).toBe(200);
  const result = await response.json();
  expect(result).toMatchObject({ status: "preview", preview_th: expect.stringContaining("กาแฟ 250 JPY") });
  expect(result).not.toHaveProperty("confirmation_th");
  expect(await repository.listTransactions()).toEqual(before);
});

it("rejects unauthenticated requests and identifies blank dictation", async () => {
  expect((await send("กาแฟ 250 เยน", false)).status).toBe(401);
  const response = await send("  ");
  expect(response.status).toBe(400);
  expect(await response.json()).toMatchObject({ error: { message_th: expect.stringContaining("ไม่ได้รับข้อความจากคำพูด") } });
});

it("issues a fresh authenticated request ID and saves only once when the POST is retried", async () => {
  const url = "https://example.test/api/transactions/voice";
  expect((await GET(new Request(url))).status).toBe(401);
  const requestId = async () => {
    const response = await GET(new Request(url, { headers: { authorization: `Bearer ${token}` } }));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    return (await response.json()).client_request_id;
  };
  const id = await requestId();
  expect(await requestId()).not.toBe(id);
  const first = await send("กาแฟ 250 เยน", true, id, false);
  const retry = await send("กาแฟ 250 เยน", true, id, false);
  expect(await first.json()).toMatchObject({ success: true, duplicate: false });
  expect(await retry.json()).toMatchObject({ success: true, duplicate: true });
});

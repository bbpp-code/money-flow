import { createHash } from "node:crypto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { POST } from "@/app/api/transactions/voice/route";
import { getRepository } from "@/lib/repositories";

const token = "local-test-device";
const send = (text: string, authorized = true) => POST(new Request("https://example.test/api/transactions/voice?preview=1", {
  method: "POST",
  headers: authorized ? { authorization: `Bearer ${token}` } : {},
  body: JSON.stringify({ text, client_request_id: "test-preview-001" }),
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

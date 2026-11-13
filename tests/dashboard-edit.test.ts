import { afterEach, expect, it, vi } from "vitest";
import { GET } from "@/app/api/dashboard/route";
import { PATCH } from "@/app/api/transactions/[id]/route";
import { getRepository } from "@/lib/repositories";

afterEach(() => vi.unstubAllEnvs());

it("includes earlier months in all-time totals and uses an edited yen amount without changing the original foreign amount", async () => {
  vi.stubEnv("DEMO_MODE", "true");
  const repository = await getRepository();
  const [sample] = await repository.listTransactions();
  const id = "demo-previous-month";
  await repository.createTransactions([{
    ...sample, transaction_id: id, source_reference: id, date: "2025-12-08", type: "expense",
    original_currency: "USD", original_amount: "10", amount_jpy: 1500,
  }]);
  const edit = await PATCH(new Request("https://example.test/api/transactions/demo-previous-month", {
    method: "PATCH",
    body: JSON.stringify({ description: "Updated expense", amount_jpy: 1600 }),
  }), { params: Promise.resolve({ id }) });
  expect(edit.status).toBe(200);
  const getDashboard = async (scope: string) => {
    const response = await GET(new Request(`https://example.test/api/dashboard?month=${sample.date.slice(0, 7)}&scope=${scope}`));
    expect(response.status).toBe(200);
    return response.json();
  };
  const monthly = await getDashboard("month");
  const all = await getDashboard("all");
  expect(all.report.expenses - monthly.report.expenses).toBe(1600);
  expect(all.transactions).toContainEqual(expect.objectContaining({
    transaction_id: id, description: "Updated expense", amount_jpy: 1600,
    original_currency: "USD", original_amount: "10", fx_provider: "actual_settlement",
  }));
});

import { afterEach, expect, it, vi } from "vitest";
import { GET } from "@/app/api/dashboard/route";
import { DELETE, PATCH } from "@/app/api/transactions/[id]/route";
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

it("removes a deleted expense from the dashboard totals and allows a repeated delete", async () => {
  vi.stubEnv("DEMO_MODE", "true");
  const repository = await getRepository();
  const [sample] = await repository.listTransactions();
  const id = "demo-delete-expense";
  await repository.createTransactions([{
    ...sample, transaction_id: id, source_reference: id, type: "expense",
    original_currency: "JPY", original_amount: "321", amount_jpy: 321,
  }]);
  const dashboardUrl = `https://example.test/api/dashboard?month=${sample.date.slice(0, 7)}`;
  const before = await (await GET(new Request(dashboardUrl))).json();
  const deleteExpense = () => DELETE(new Request(`https://example.test/api/transactions/${id}`, { method: "DELETE" }), { params: Promise.resolve({ id }) });
  expect((await deleteExpense()).status).toBe(204);
  expect((await deleteExpense()).status).toBe(204);
  const after = await (await GET(new Request(dashboardUrl))).json();
  expect(after.report.expenses).toBe(before.report.expenses - 321);
  expect(after.transactions).not.toContainEqual(expect.objectContaining({ transaction_id: id }));
});

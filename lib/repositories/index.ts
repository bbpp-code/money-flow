import type { FinanceRepository } from "@/lib/repositories/repository";
import { DemoRepository } from "@/lib/repositories/demo";

let repository: FinanceRepository | undefined;

export async function getRepository(): Promise<FinanceRepository> {
  if (repository) return repository;
  if (process.env.DEMO_MODE !== "false") repository = new DemoRepository();
  else if (process.env.DATA_BACKEND === "supabase") {
    const { SupabaseRepository } = await import("@/lib/repositories/supabase");
    repository = new SupabaseRepository();
  } else {
    const { SheetsRepository } = await import("@/lib/repositories/sheets");
    repository = new SheetsRepository();
  }
  return repository;
}

export function isDemoMode() { return process.env.DEMO_MODE !== "false"; }

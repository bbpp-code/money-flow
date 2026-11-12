# Architecture

```text
iPhone Dictation
  → POST /api/transactions/voice (revocable device token + rate limit)
  → Zod validation → Thai/Japanese/English parser
  → user CategoryRules → deterministic classifier → Needs Review
  → historical FX service/cache → serialized idempotent write
  → Google Sheets (system of record)
  → owner-only dashboard / reports / exports
```

The Google Sheet is the sole live transaction database. `ReportSnapshots` is operational report metadata, not a second ledger. Demo mode is deliberately ephemeral and synthetic. Google OAuth controls the human dashboard; a service account performs server-side Sheets and read-only Docs calls; per-device tokens authenticate Siri/Shortcuts without exposing Google credentials.

## Reliability boundaries

- `transaction_id` is a UUID and never a row number.
- `source_reference` is the idempotency key. Multi-item voice requests append `:1`, `:2`, etc.
- Writes are serialized inside one application instance and checked before append. For deployments that run many concurrent server instances, route writes through one region/instance or the included Apps Script adapter with `LockService`; Google Sheets has no cross-instance unique constraint.
- FX rates are stored with effective date/provider and historical rows are never revalued automatically.
- Unknown categories and unavailable FX are saved as `needs_review`; missing amounts are rejected and never invented.
- Confirmed categories are changed only through an explicit edit.

## Sheets

Required ledger sheets are `Transactions`, `Categories`, `Budgets`, `ExchangeRates`, `ImportHistory`, and `CategoryRules`. `ReportSnapshots` stores generated daily summaries. Header order is created by `scripts/setup-sheets.ts`.

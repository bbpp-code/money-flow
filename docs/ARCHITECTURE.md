# Architecture

```text
iPhone Dictation
  → POST /api/transactions/voice (revocable device token + rate limit)
  → Zod validation → Thai/Japanese/English parser
  → user CategoryRules → deterministic classifier → Needs Review
  → historical FX service/cache → serialized idempotent write
  → Supabase Postgres (system of record)
  → owner-only dashboard / reports / exports
```

Supabase Postgres is the sole live transaction database. `report_snapshots` is operational report metadata. Demo mode is deliberately ephemeral and synthetic. Google OAuth controls the human dashboard; a service account performs optional read-only Docs calls; per-device tokens authenticate Siri/Shortcuts without exposing database credentials.

## Reliability boundaries

- `transaction_id` is a UUID and never a row number.
- `source_reference` is the idempotency key. Multi-item voice requests append `:1`, `:2`, etc.
- Writes are serialized inside one application instance. Postgres also enforces unique `source_reference` values across all instances, including concurrent retries.
- FX rates are stored with effective date/provider and historical rows are never revalued automatically.
- Unknown categories and unavailable FX are saved as `needs_review`; missing amounts are rejected and never invented.
- Confirmed categories are changed only through an explicit edit.

## Database

`supabase/schema.sql` creates `transactions`, `categories`, `budgets`, `exchange_rates`, `import_history`, `category_rules`, and `report_snapshots`. Existing Google Sheets code remains as a legacy import path; `DATA_BACKEND=supabase` selects Postgres for every live read and write.

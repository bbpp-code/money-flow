# MONEYFLOW JAPAN

A private, Thai-first personal-finance app for life in Japan: Siri/Apple Shortcuts → secure voice API → deterministic parsing/categorization → Supabase Postgres → mobile dashboard. JPY is the reporting currency and Asia/Tokyo is the accounting timezone.

## What works

- Thai/Japanese/English transaction parsing, explicit dates, multi-phrase input, JPY default metadata, stable UUIDs
- user rules before deterministic category scoring; ambiguous entries go to review
- Optional Groq category suggestions for unmatched iPhone expenses. To opt in, set `GROQ_API_KEY` as a server secret and `GROQ_CATEGORY_ENABLED=true`, then redeploy. Groq receives shortened descriptions with numbers, emails, and URLs removed. Suggestions remain marked for review. The app keeps the rule-based result if Groq is unavailable.
- revocable device authentication, validation, rate limiting, duplicate retry protection, serialized writes
- Supabase Postgres schema and server-only access; owner-only Google OAuth dashboard
- transaction search/edit/manual entry, category budgets, charts, CSV, accurate browser-rendered Thai PNG
- historical FX lookup/cache with original money preserved and missing-rate flags
- Google Docs read-only preview/confirmed idempotent import
- daily 18:00 Tokyo report snapshot endpoint/history and Vercel schedule
- explicit synthetic demo mode; no fake Google connection

## Quick start (demo mode)

```bash
cp .env.example .env.local
# set NEXTAUTH_SECRET; leave DEMO_MODE=true
npm install
npm run dev
```

Open `http://localhost:3000`. Demo voice test:

```bash
curl -X POST http://localhost:3000/api/transactions/voice \
  -H 'Content-Type: application/json' \
  -d '{"text":"กาแฟ 250 เยน","source":"iphone_shortcut","client_request_id":"demo-request-001"}'
```

Demo data is synthetic and memory-only. It resets when the server restarts.

## Live setup

1. Follow [Supabase setup](docs/SUPABASE_SETUP.md) and run `supabase/schema.sql` in its SQL editor.
2. Configure owner-only OAuth in [Google configuration](docs/GOOGLE_SETUP.md). Google access is only for login and the optional historical Doc importer.
3. Configure the [Apple Shortcut](docs/APPLE_SHORTCUT.md).
4. Set `DEMO_MODE=false`, `DATA_BACKEND=supabase`, and the Supabase server credentials. Submit a ¥1 test.
5. Verify the row in Supabase, then preview the historical Doc migration. Keep the Doc unchanged as an archive.

See [architecture and reliability notes](docs/ARCHITECTURE.md).

## Verification

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

The automated suite covers the eight requested Thai phrases, ambiguous Seven purchase, multi-transaction speech, duplicate/concurrent retry, missing amount/currency, unsupported currency, Thai/Japanese dates, year boundary, write failure, category correction, no-op sync, incomplete FX totals, and report math. Live Google API/OAuth/Docs calls require real credentials and are not claimed tested by the local suite.

## Deployment (Vercel)

1. Import this `moneyflow-japan` directory as the project root.
2. Add every production environment variable from `.env.example`; use the deployed URL for `NEXTAUTH_URL`.
3. Set a strong `CRON_SECRET`. `vercel.json` invokes `/api/cron/daily` at `09:00 UTC`, which is `18:00 Asia/Tokyo` year-round.
4. Deploy, add the production OAuth redirect URI, then test `/api/health`, login, a device-token POST, CSV, and PNG download on iPhone.

The scheduler upserts one `ReportSnapshots` row per date. It does not touch ChatGPT scheduled tasks. For another host, schedule an authenticated GET with `Authorization: Bearer $CRON_SECRET` at the same time.

## Backups and recovery

Download CSV from the Reports tab and use Supabase database backups for full recovery. Because transactions retain stable IDs and source references, restored rows remain auditable.

## Security notes

- `.env*`, credentials, and logs are ignored. Only hashes of device tokens belong in environment configuration.
- The Supabase secret key stays on the server. RLS is enabled with no client policies.
- The optional Google service account needs historical Doc viewer access only.
- `NEXTAUTH_SECRET` signs sessions and import preview tokens.
- The in-memory limiter is appropriate for a private single-instance deployment. For horizontally scaled public ingress, add a shared rate-limit store and single-writer queue; Sheets itself cannot enforce unique keys atomically across instances.
- Current production dependency audit: run `npm audit --omit=dev` during each deployment.

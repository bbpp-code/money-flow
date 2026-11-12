# MONEYFLOW JAPAN

A private, Thai-first personal-finance app for life in Japan: Siri/Apple Shortcuts → secure voice API → deterministic parsing/categorization → Google Sheets → mobile dashboard. JPY is the reporting currency and Asia/Tokyo is the accounting timezone.

## What works

- Thai/Japanese/English transaction parsing, explicit dates, multi-phrase input, JPY default metadata, stable UUIDs
- user rules before deterministic category scoring; ambiguous entries go to review
- revocable device authentication, validation, rate limiting, duplicate retry protection, serialized writes
- Google Sheets schema/setup and server-only access; owner-only Google OAuth dashboard
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

1. Follow [Google configuration](docs/GOOGLE_SETUP.md).
2. Run `npm run sheets:setup`; save the printed spreadsheet ID.
3. Configure the [Apple Shortcut](docs/APPLE_SHORTCUT.md).
4. Set `DEMO_MODE=false`, start the app, sign in as `OWNER_EMAIL`, and submit a ¥1 test.
5. Verify `Transactions`, then preview the Doc migration. Keep the Doc unchanged as an archive.

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

Download CSV from the Reports tab and use Google Sheets version history/Drive export for full backups. Because transactions retain stable IDs and source references, restored rows remain auditable. Never sort/edit headers or use row positions as IDs.

## Security notes

- `.env*`, credentials, and logs are ignored. Only hashes of device tokens belong in environment configuration.
- The service account gets Sheet editor and historical Doc viewer access only.
- `NEXTAUTH_SECRET` signs sessions and import preview tokens.
- The in-memory limiter is appropriate for a private single-instance deployment. For horizontally scaled public ingress, add a shared rate-limit store and single-writer queue; Sheets itself cannot enforce unique keys atomically across instances.
- Current production dependency audit: run `npm audit --omit=dev` during each deployment.

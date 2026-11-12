# Supabase setup and data migration

1. Create a Supabase project in a region appropriate for your use. In **SQL Editor**, run [`supabase/schema.sql`](../supabase/schema.sql). This creates the ledger, category rules, budgets, FX cache, report history, unique source references, and row-level security.
2. In **Project Settings → Data API**, copy the Project URL to `SUPABASE_URL`. In **Project Settings → API Keys**, copy the server-side `service_role` key to `SUPABASE_SERVICE_ROLE_KEY`. Store both in Netlify environment variables and `.env.local` for local work. Never use the service role key in a Shortcut, browser variable, or Git.
3. Set `DEMO_MODE=false` and `DATA_BACKEND=supabase`. The existing owner-only Google OAuth values remain necessary for the dashboard login. The Google service account is only needed if importing the historical Google Doc.
4. Deploy, sign in, then submit one ¥1 test through the Shortcut or manual form. Confirm the row in `public.transactions`; check that retrying the same `client_request_id` does not create another row.
5. To import the historical Doc, share it with the service account as Viewer, call `/api/migration/docs/preview`, inspect dates, ambiguous lines and totals, then explicitly commit the preview. The original Doc is never changed. The importer writes to Supabase when `DATA_BACKEND=supabase`.

Do not import the synthetic demo transactions as personal records. If you previously used a live Google Sheet, export it as CSV and compare IDs, dates, and monthly totals before inserting; `source_reference` uniqueness protects against retries. Keep the old source as an archive until reconciled.

The database key is deliberately server-only. With RLS enabled and no policies, browser clients cannot query these tables directly. The application API checks the owner session for dashboard actions and a revocable device token for voice input.

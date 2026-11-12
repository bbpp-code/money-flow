# Google configuration

## 1. Cloud project and APIs

Create a Google Cloud project and enable **Google Sheets API**, **Google Drive API**, and **Google Docs API**. Configure an OAuth consent screen for a private/external app in testing and add only the owner email as a test user.

Create two credentials:

1. **OAuth 2.0 Client ID → Web application** for dashboard login. Add `http://localhost:3000/api/auth/callback/google` locally and `https://YOUR_DOMAIN/api/auth/callback/google` for production.
2. **Service account** for server-side data. Download its JSON once. Store the complete JSON as the `GOOGLE_SERVICE_ACCOUNT_JSON` environment value; do not commit the file.

## 2. Spreadsheet

Copy `.env.example` to `.env.local`, fill the service-account JSON and `OWNER_EMAIL`, then run:

```bash
npm run sheets:setup
```

With no `GOOGLE_SPREADSHEET_ID`, this creates **MoneyFlow Database**, all sheets/headers/default categories, and shares it with `OWNER_EMAIL`. Copy the printed ID into `.env.local`. With an existing ID, share that spreadsheet with the service-account email as Editor before running setup.

## 3. Historical Doc

Share document `1-_wsfIz2I99zozOqsv6CaqPNir2eZ1a6eTVerGsq8_I` with the service-account email as Viewer. The migration preview is read-only, hashes every source line, separates transactions by parsed date/month, and requires an explicit confirmed commit. It never edits the original Doc. First preview in the app/API, compare October and November totals, then commit. Re-running skips the same fingerprints.

## 4. OAuth and owner lock

Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, and exact `OWNER_EMAIL`. Set `DEMO_MODE=false` only when all live values work. Every dashboard/data API verifies the signed session email against `OWNER_EMAIL`.

## 5. Device token

Generate a random token and its hash:

```bash
openssl rand -base64 32
printf %s 'PASTE_TOKEN_WITHOUT_NEWLINE' | shasum -a 256
```

Put only the comma-separated SHA-256 hash(es) in `DEVICE_API_KEY_HASHES`. Put the raw token in the iPhone Shortcut. Revoke a device by removing its hash and redeploying.

## FX

The default endpoint is Frankfurter, whose rates are based on published ECB reference data. The returned effective date is stored and must not be later than the transaction date, so weekends use the prior published business day. Confirm that the provider covers each requested currency; unavailable rates leave `amount_jpy` empty and flag review. The Apple Watch 13,000 THB × 4.6829 = 60,878 JPY example is a fixture only—do not import it as verified until the source/effective date is confirmed.

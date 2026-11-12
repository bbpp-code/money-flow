# Apple Shortcut setup (minimal migration)

The API accepts Thai UTF-8 and keeps the existing “dictate then POST” shape. If the current Shortcut already sends `text`, change only its URL, Authorization header, and add `client_request_id`. No Google credential belongs on the phone.

## Direct secure API — exact actions

1. Add **Dictate Text**. Language: **Thai (Thailand)**. Stop Listening: **After Pause**.
2. Add **Generate UUID**. Rename its magic variable to `Client Request ID`.
3. Add **Dictionary** with:
   - `text` → the **Dictated Text** magic variable
   - `source` → Text value `iphone_shortcut`
   - `client_request_id` → the **Client Request ID** magic variable
4. Add **Get Contents of URL**.
   - URL: `https://YOUR_DOMAIN/api/transactions/voice`
   - Method: `POST`
   - Headers: `Authorization` = `Bearer YOUR_DEVICE_TOKEN`
   - Request Body: `JSON`
   - JSON: the **Dictionary** from step 3
5. Add **Get Dictionary Value**. Key: `success`, Dictionary: **Contents of URL**.
6. Add **If** where the value **is 1** (true).
7. Inside If: add **Get Dictionary Value**, key `confirmation_th`, then **Speak Text** and optionally **Show Notification** using that value.
8. Inside Otherwise: add **Get Dictionary Value**, key `error`; then another **Get Dictionary Value**, key `message_th`; use **Show Alert**. This prevents a failed request from sounding saved.

Do not reuse the UUID after the Shortcut has confirmed success. If iOS retries the same network action, reuse the same UUID: the API returns the prior saved record with `duplicate: true`.

## Request and response

```json
{"text":"กาแฟ 250 เยน","source":"iphone_shortcut","client_request_id":"5D6B..."}
```

Success is returned only after the sheet write succeeds:

```json
{
  "success": true,
  "duplicate": false,
  "status": "saved",
  "transaction": {"description":"กาแฟ","amount_jpy":250,"type":"expense","category":"อาหารและเครื่องดื่ม","subcategory":"กาแฟ","review_status":"confirmed"},
  "confirmation_th": "บันทึกกาแฟ 250 เยนแล้ว"
}
```

`status` can be `needs_review`; missing amounts return HTTP 422 with `status: needs_input`. Multiple phrases return `transactions` and a combined confirmation.

## Existing Apps Script endpoint

No Apps Script URL/source was supplied, so its exact legacy request format could not be inspected. Before replacing it, duplicate the existing Shortcut and test the direct endpoint. If keeping the old URL is important, paste `integrations/apps-script-adapter.gs` into the existing project and retain its incoming `text` field. Store `ADAPTER_SECRET`, `MONEYFLOW_DEVICE_TOKEN`, and `MONEYFLOW_API_URL` in **Project Settings → Script properties**, never in source.

Deploy as **Web app**, execute as the owner, and choose access appropriate to the Shortcut. The adapter still rejects requests without `adapter_secret`. Apps Script `ContentService` responds through a `script.googleusercontent.com` redirect; **Get Contents of URL** follows it, and the adapter also enables redirects when forwarding. Test with a harmless ¥1 entry and verify the sheet before switching the production Shortcut.

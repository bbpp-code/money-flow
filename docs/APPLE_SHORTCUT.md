# Apple Shortcut setup (minimal migration)

The API accepts Thai UTF-8 and keeps the existing “dictate then POST” shape. If the current Shortcut already sends `text`, change only its URL, Authorization header, and add `client_request_id`. No Google credential belongs on the phone.

## Direct secure API — exact actions

1. Add **Dictate Text**. Language: **Thai (Thailand)**. Stop Listening: **After Pause**.
2. Add **Current Date**, then **Format Date**. In Format Date, choose **Custom** and enter `yyyyMMddHHmmssSSS` as the format string. This produces a request ID such as `20261113142307158` using built-in actions. Keep these actions before the network request so a retry of the same request reuses the same ID.
3. Add **Dictionary** with:
   - `text` → the **Dictated Text** magic variable
   - `source` → Text value `iphone_shortcut`
   - `client_request_id` → the **Formatted Date** magic variable (select the variable; do not type its name)
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

Do not reuse the request ID after the Shortcut has confirmed success. If iOS retries the same network action, reuse the same formatted date value: the API returns the prior saved record with `duplicate: true`.

## Request and response

```json
{"text":"กาแฟ 250 เยน","source":"iphone_shortcut","client_request_id":"20261113142307158"}
```

Success is returned only after the Supabase write succeeds:

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

The legacy Apps Script endpoint is visible in the user's Shortcut, but its source and actual request format have not been inspected. Before replacing it, duplicate the existing Shortcut and test the direct endpoint. Do not concatenate the old Apps Script URL and the new MoneyFlow URL in one URL action. If keeping the old URL is important, inspect its current script first, then adapt `integrations/apps-script-adapter.gs` to the existing request format. Store `ADAPTER_SECRET`, `MONEYFLOW_DEVICE_TOKEN`, and `MONEYFLOW_API_URL` in **Project Settings → Script properties**, never in source.

Deploy as **Web app**, execute as the owner, and choose access appropriate to the Shortcut. The adapter still rejects requests without `adapter_secret`. Apps Script `ContentService` responds through a `script.googleusercontent.com` redirect; **Get Contents of URL** follows it, and the adapter also enables redirects when forwarding. Test with a harmless ¥1 entry and verify the Supabase row before switching the production Shortcut.

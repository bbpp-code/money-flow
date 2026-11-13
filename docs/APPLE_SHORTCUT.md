# Apple Shortcut setup (minimal migration)

The API accepts Thai UTF-8 and keeps the existing “dictate then POST” shape. If the current Shortcut already sends `text`, change only its URL, Authorization header, and add `client_request_id`. No Google credential belongs on the phone.

## Direct secure API — exact actions

1. Add **Dictate Text**. Language: **Thai (Thailand)**. Stop Listening: **After Pause**.
2. Add **Set Variable** immediately after Dictate Text. Name it `Spoken Expense` and set its input explicitly to the output of Dictate Text. Add an **If** check: if `Spoken Expense` does not have any value, show an alert and use **Stop This Shortcut**.
3. Add **Get Contents of URL** with method **GET**. Use `https://YOUR_DOMAIN/api/transactions/voice` and the same Authorization header as the POST. Add **Get Dictionary Value** immediately after it, with key `client_request_id` and input set to the GET response. Select this value explicitly in the POST. A correctly configured Shortcut can also keep using its existing unique formatted date ID.
4. Add a second **Get Contents of URL** with method **POST**.
   - URL: `https://YOUR_DOMAIN/api/transactions/voice`
   - Method: `POST`
   - Headers: `Authorization` = `Bearer YOUR_DEVICE_TOKEN`
   - Request Body: `JSON`
   - Add three **Text** fields directly under Request Body: `text` = variable **Spoken Expense**, `source` = `iphone_shortcut`, `client_request_id` = the **Dictionary Value** from step 3. Select the variables from the variable picker.
5. Add **Get Dictionary Value**. Key: `success`, Dictionary: **Contents of URL**.
6. Add **If** where the value **is 1** (true).
7. Inside If: add **Get Dictionary Value**, key `confirmation_th`, then **Speak Text** and optionally **Show Notification** using that value.
8. Inside Otherwise: add **Get Dictionary Value**, key `error`; then another **Get Dictionary Value**, key `message_th`; use **Show Alert**. This prevents a failed request from sounding saved.

Get a fresh request ID for each new expense. If you retry the POST within the same run, reuse the ID already fetched in step 3. The API returns the prior saved record with `duplicate: true`.

To troubleshoot without saving, add `?preview=1` to the voice URL in the copied Shortcut and put **Show Result** (input: **Contents of URL**) immediately after the POST. Temporarily type `กาแฟ 250 เยน` into the JSON `text` field and run it once; `status: preview` confirms the request settings work. Restore **Spoken Expense** in that field and repeat by voice. If the typed preview works but the voice preview reports an empty `text`, check what **Show Result** displays when fed **Spoken Expense** just before the POST. Once voice preview works, remove `?preview=1` and the temporary Show Result actions to enable saving and the normal confirmation.

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

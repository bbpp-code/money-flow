/**
 * Optional compatibility adapter for an existing Shortcut that already calls Apps Script.
 * Set ADAPTER_SECRET and MONEYFLOW_DEVICE_TOKEN in Apps Script > Project Settings > Script properties.
 * Set MONEYFLOW_API_URL to https://your-domain.example/api/transactions/voice.
 */
function doPost(e) {
  var output = ContentService.createTextOutput().setMimeType(ContentService.MimeType.JSON);
  try {
    if (!e || !e.postData || !e.postData.contents) throw new Error("missing_body");
    var body = JSON.parse(e.postData.contents);
    var properties = PropertiesService.getScriptProperties();
    if (!body.adapter_secret || body.adapter_secret !== properties.getProperty("ADAPTER_SECRET")) {
      return output.setContent(JSON.stringify({ success: false, error: { code: "unauthorized", message_th: "ไม่ได้รับอนุญาต" } }));
    }
    if (typeof body.text !== "string" || !body.text.trim()) throw new Error("missing_text");
    var requestId = body.client_request_id || Utilities.getUuid();
    var response = UrlFetchApp.fetch(properties.getProperty("MONEYFLOW_API_URL"), {
      method: "post",
      contentType: "application/json; charset=utf-8",
      headers: { Authorization: "Bearer " + properties.getProperty("MONEYFLOW_DEVICE_TOKEN") },
      payload: JSON.stringify({ text: body.text, source: "iphone_shortcut", client_request_id: requestId }),
      muteHttpExceptions: true,
      followRedirects: true
    });
    return output.setContent(response.getContentText("UTF-8"));
  } catch (error) {
    return output.setContent(JSON.stringify({ success: false, error: { code: String(error.message || error), message_th: "คำขอไม่ถูกต้อง" } }));
  }
}

function doGet() {
  return ContentService.createTextOutput(JSON.stringify({ ok: true, service: "moneyflow-shortcut-adapter" })).setMimeType(ContentService.MimeType.JSON);
}

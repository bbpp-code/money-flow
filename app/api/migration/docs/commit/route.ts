import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOwner } from "@/lib/security";
import { buildMigrationPreview, readGoogleDoc, verifyMigrationToken } from "@/lib/services/migration";
import { getRepository } from "@/lib/repositories";
import { ingestVoice } from "@/lib/services/transactions";

const schema = z.object({ confirm: z.literal(true), preview_token: z.string().min(20), include_needs_review: z.boolean().default(true) });

export async function POST(request: Request) {
  if (!await requireOwner()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const input = schema.parse(await request.json());
    const signed = await verifyMigrationToken(input.preview_token);
    const current = await readGoogleDoc(signed.docId);
    if (createHash("sha256").update(current.text).digest("hex") !== signed.digest) return NextResponse.json({ error: "Source document changed after preview. Preview again." }, { status: 409 });
    const preview = await buildMigrationPreview(signed.docId);
    const repository = await getRepository();
    let imported = 0; let skipped = 0;
    for (const item of preview.items) {
      if (item.error || item.duplicate || (!input.include_needs_review && item.reviewStatus === "needs_review")) { skipped++; continue; }
      const result = await ingestVoice({ text: `${item.date} ${item.originalText}`, source: "google_docs_import", client_request_id: String(item.reference) }, repository);
      await repository.updateTransaction(result.transactions[0].transaction_id, {
        original_text: String(item.originalText),
        date: String(item.date),
        review_status: item.reviewStatus === "needs_review" ? "needs_review" : "confirmed",
        notes: `${result.transactions[0].notes}${result.transactions[0].notes ? "," : ""}migration_fingerprint:${item.fingerprint}`,
      });
      imported++;
    }
    return NextResponse.json({ success: true, imported, skipped, source_unchanged: true });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Import failed" }, { status: 400 }); }
}

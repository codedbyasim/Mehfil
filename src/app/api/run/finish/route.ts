import { json } from "@/lib/http";
import { settleRun } from "@/server/ledger-store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { runId?: string; used?: number } | null;
  if (!body?.runId) return json({ error: "bad_request" }, 400);
  const used = Math.max(0, Math.round(Number(body.used) || 0));
  await settleRun(body.runId.slice(0, 80), used);
  return json({ ok: true, used });
}

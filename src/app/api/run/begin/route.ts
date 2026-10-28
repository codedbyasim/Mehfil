import { hashIp, clientIp, json } from "@/lib/http";
import { authorizeRun } from "@/server/ledger-store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!process.env.YOUCAM_API_KEY) {
    return json({ allow: false, reason: "no_key", fallback: "demo" });
  }
  const body = (await request.json().catch(() => null)) as { runId?: string; estimate?: number } | null;
  const runId = body?.runId?.slice(0, 80);
  const estimate = Number(body?.estimate);
  if (!runId || !Number.isFinite(estimate) || estimate <= 0) return json({ error: "bad_request" }, 400);
  const decision = await authorizeRun({
    runId,
    ip: hashIp(clientIp(request.headers)),
    estimate,
  });
  if (!decision.allow) {
    return json({ allow: false, reason: decision.reason, fallback: "demo", limits: decision.limits });
  }
  return json({ allow: true, runId, reserved: estimate, limits: decision.limits });
}

import { capMessage } from "@/lib/cap-message";
import { hashIp, clientIp, json } from "@/lib/http";
import { authorizeRun } from "@/server/ledger-store";
import { runCookie, withCookies } from "@/server/run-auth";
import type { RunGrant } from "@/lib/run-grant";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!process.env.YOUCAM_API_KEY) {
    return json({ allow: false, reason: "no_key", hint: capMessage("no_key"), fallback: "demo" });
  }
  const body = (await request.json().catch(() => null)) as { runId?: string; estimate?: number } | null;
  const runId = body?.runId?.slice(0, 80);
  const estimate = Number(body?.estimate);
  if (!runId || !Number.isFinite(estimate) || estimate <= 0) return json({ error: "bad_request" }, 400);
  const visitor = hashIp(clientIp(request.headers));
  const decision = await authorizeRun({
    runId,
    ip: visitor,
    estimate,
  });
  if (!decision.allow) {
    return json({
      allow: false,
      reason: decision.reason,
      hint: capMessage(decision.reason),
      fallback: "demo",
      limits: decision.limits,
    });
  }
  const grant: RunGrant = {
    typ: "run",
    runId,
    visitor,
    exp: Date.now() + decision.limits.reservationTtlMs,
    reserved: estimate,
    charged: 0,
    pending: {},
  };
  return withCookies(json({ allow: true, runId, reserved: estimate }), [runCookie(request, grant)]);
}

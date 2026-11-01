import { capMessage } from "@/lib/cap-message";
import { hashIp, clientIp, json } from "@/lib/http";
import type { VisitGrant } from "@/lib/run-grant";
import { authorizeRun } from "@/server/ledger-store";
import { knownRunIds, runCookie, visitCookie, withCookies } from "@/server/run-auth";
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
    knownRunIds: knownRunIds(request),
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
  const visit: VisitGrant = {
    typ: "visit",
    visitor,
    day: decision.ledger.day,
    runIds: decision.ledger.runsByIp[visitor] ?? [runId],
  };
  return withCookies(json({ allow: true, runId, reserved: estimate, limits: decision.limits }), [
    runCookie(request, grant),
    visitCookie(request, visit),
  ]);
}

import { json } from "@/lib/http";
import type { VisitGrant } from "@/lib/run-grant";
import { boundGrant, clearRunCookie, endRun, runRequired, visitCookie, withCookies } from "@/server/run-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const grant = boundGrant(request);
  const body = (await request.json().catch(() => null)) as { runId?: string; delivered?: boolean } | null;
  if (!grant || (body?.runId && body.runId.slice(0, 80) !== grant.runId)) return json(runRequired(), 401);
  const delivered = body?.delivered === true;
  const settled = await endRun(grant, delivered);
  const visit: VisitGrant = {
    typ: "visit",
    visitor: grant.visitor,
    day: settled.day,
    runIds: settled.runIds,
  };
  return withCookies(json({ ok: true, used: settled.used, delivered }), [clearRunCookie(request), visitCookie(request, visit)]);
}
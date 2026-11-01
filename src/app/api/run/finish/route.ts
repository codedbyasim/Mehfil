import { json } from "@/lib/http";
import { boundGrant, clearRunCookie, endRun, runRequired, withCookies } from "@/server/run-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const grant = boundGrant(request);
  const body = (await request.json().catch(() => null)) as { runId?: string } | null;
  if (!grant || (body?.runId && body.runId.slice(0, 80) !== grant.runId)) return json(runRequired(), 401);
  const used = await endRun(grant);
  return withCookies(json({ ok: true, used }), [clearRunCookie(request)]);
}

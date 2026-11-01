import { capMessage } from "@/lib/cap-message";
import { clientIp, hashIp } from "@/lib/http";
import { commitment, seal, verifyRun, verifyVisit, type RunGrant, type VisitGrant } from "@/lib/run-grant";
import { utcDay } from "@/lib/guard";
import { budgetAllows, closeRun, finishTask, trackTask } from "@/server/ledger-store";

export const RUN_COOKIE = "mehfil_run";
export const VISIT_COOKIE = "mehfil_visits";

export function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    if (trimmed.slice(0, eq) !== name) continue;
    const raw = trimmed.slice(eq + 1);
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
  return null;
}

export function cookieHeader(request: Request, name: string, value: string, maxAge: number): string {
  const forwarded = request.headers.get("x-forwarded-proto");
  const proto = forwarded || new URL(request.url).protocol.replace(":", "");
  const secure = proto === "https" ? "; Secure" : "";
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.max(0, Math.floor(maxAge))}${secure}`;
}

export function withCookies(response: Response, cookies: string[]): Response {
  for (const cookie of cookies) response.headers.append("set-cookie", cookie);
  return response;
}

function pickGrant(left: RunGrant | null, right: RunGrant | null): RunGrant | null {
  if (!left) return right;
  if (!right) return left;
  return commitment(left) >= commitment(right) ? left : right;
}

export function boundGrant(request: Request, now = Date.now()): RunGrant | null {
  const header = request.headers.get("x-mehfil-run");
  const cookie = readCookie(request.headers.get("cookie"), RUN_COOKIE);
  const grant = pickGrant(header ? verifyRun(header, now) : null, cookie ? verifyRun(cookie, now) : null);
  if (!grant) return null;
  if (grant.visitor !== hashIp(clientIp(request.headers))) return null;
  return grant;
}

export function knownRunIds(request: Request): string[] {
  const token = readCookie(request.headers.get("cookie"), VISIT_COOKIE);
  if (!token) return [];
  const visit = verifyVisit(token);
  if (!visit) return [];
  if (visit.visitor !== hashIp(clientIp(request.headers))) return [];
  if (visit.day !== utcDay()) return [];
  return visit.runIds;
}

export function runCookie(request: Request, grant: RunGrant): string {
  const ttl = Math.max(60, Math.ceil((grant.exp - Date.now()) / 1000));
  return cookieHeader(request, RUN_COOKIE, seal(grant), ttl);
}

export function visitCookie(request: Request, visit: VisitGrant): string {
  return cookieHeader(request, VISIT_COOKIE, seal(visit), 60 * 60 * 36);
}

export function clearRunCookie(request: Request): string {
  return cookieHeader(request, RUN_COOKIE, "", 0);
}

const RUN_REQUIRED = {
  error: "run_required",
  hint: "Start a live run from your photo. Direct calls are not accepted.",
};

export function runRequired() {
  return RUN_REQUIRED;
}

export async function gateTask(request: Request, units: number): Promise<{ grant: RunGrant } | { error: string; hint: string; status: number }> {
  const grant = boundGrant(request);
  if (!grant) return { ...RUN_REQUIRED, status: 401 };
  const allowed = await budgetAllows(grant, units);
  if (allowed === "ok") return { grant };
  if (allowed === "reservation_spent") {
    return { error: allowed, hint: "This live run has used the units it reserved.", status: 409 };
  }
  return { ...RUN_REQUIRED, status: 401 };
}

export async function rememberTask(grant: RunGrant, taskId: string, units: number) {
  return trackTask(grant, taskId, units);
}

export async function settleTask(grant: RunGrant, taskId: string, outcome: "ok" | "error") {
  return finishTask(grant, taskId, outcome);
}

export async function endRun(grant: RunGrant) {
  return closeRun(grant);
}

export { capMessage };

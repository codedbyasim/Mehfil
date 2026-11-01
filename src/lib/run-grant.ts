import { createHmac, timingSafeEqual } from "node:crypto";

export type RunGrant = {
  typ: "run";
  runId: string;
  visitor: string;
  exp: number;
  reserved: number;
  charged: number;
  pending: Record<string, number>;
};

export type VisitGrant = {
  typ: "visit";
  visitor: string;
  day: string;
  runIds: string[];
};

function secret(): string {
  const key = process.env.YOUCAM_API_KEY || "";
  const salt = process.env.IP_HASH_SALT || "mehfil-v1";
  return `${key}:${salt}:mehfil-grant-v1`;
}

function signBody(body: string): string {
  return createHmac("sha256", secret()).update(body).digest("base64url");
}

export function seal(value: RunGrant | VisitGrant): string {
  const body = Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${body}.${signBody(body)}`;
}

function openSeal<T>(token: string): T | null {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  const expected = signBody(body);
  const left = Buffer.from(mac);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}

export function verifyRun(token: string, now = Date.now()): RunGrant | null {
  const grant = openSeal<RunGrant>(token);
  if (!grant || grant.typ !== "run") return null;
  if (!grant.runId || !grant.visitor) return null;
  if (!Number.isFinite(grant.exp) || grant.exp < now) return null;
  if (!Number.isFinite(grant.reserved) || grant.reserved <= 0) return null;
  if (!Number.isFinite(grant.charged) || grant.charged < 0) return null;
  if (!grant.pending || typeof grant.pending !== "object" || Array.isArray(grant.pending)) return null;
  const pending: Record<string, number> = {};
  for (const [id, units] of Object.entries(grant.pending)) {
    if (typeof units === "number" && units > 0) pending[id] = units;
  }
  return { ...grant, pending };
}

export function verifyVisit(token: string): VisitGrant | null {
  const grant = openSeal<VisitGrant>(token);
  if (!grant || grant.typ !== "visit") return null;
  if (!grant.visitor || !/^\d{4}-\d{2}-\d{2}$/.test(grant.day) || !Array.isArray(grant.runIds)) return null;
  return {
    ...grant,
    runIds: grant.runIds.filter((id) => typeof id === "string" && id.length > 0).slice(0, 24),
  };
}

export function commitment(grant: Pick<RunGrant, "charged" | "pending">): number {
  return grant.charged + Object.values(grant.pending).reduce((sum, units) => sum + units, 0);
}

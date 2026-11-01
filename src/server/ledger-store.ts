import { beginRun, emptyLedger, finishRun, resolveTask, rollDay, stageTask, utcDay, type Ledger } from "@/lib/guard";
import type { RunGrant } from "@/lib/run-grant";
import { limitsFromEnv, type Limits } from "@/lib/units";

type GlobalLedger = typeof globalThis & { __mehfilLedger?: Ledger; __mehfilVersion?: number };

type Loaded = { ledger: Ledger; etag?: string; writable: boolean };

function todayMemory(): { ledger: Ledger; version: number } {
  const g = globalThis as GlobalLedger;
  const today = utcDay();
  if (!g.__mehfilLedger || g.__mehfilLedger.day !== today) {
    g.__mehfilLedger = emptyLedger(today);
    g.__mehfilVersion = 0;
  }
  return { ledger: g.__mehfilLedger, version: g.__mehfilVersion ?? 0 };
}

function writeMemory(ledger: Ledger, expected: number): boolean {
  const g = globalThis as GlobalLedger;
  if ((g.__mehfilVersion ?? 0) !== expected) return false;
  g.__mehfilLedger = ledger;
  g.__mehfilVersion = expected + 1;
  return true;
}

function storeKind(): "upstash" | "blob" | "memory" {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) return "upstash";
  if (process.env.BLOB_READ_WRITE_TOKEN) return "blob";
  return "memory";
}

async function upstash(command: unknown[]): Promise<{ ok: true; result: unknown } | { ok: false }> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return { ok: false };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(command),
    });
    if (!res.ok) return { ok: false };
    const json = (await res.json()) as { result?: unknown };
    return { ok: true, result: json.result ?? null };
  } catch {
    return { ok: false };
  }
}

async function readUpstash(): Promise<Loaded> {
  const today = utcDay();
  const remote = await upstash(["GET", `mehfil:ledger:${today}`]);
  if (!remote.ok) return { ledger: todayMemory().ledger, writable: false };
  if (typeof remote.result !== "string") return { ledger: emptyLedger(today), writable: true };
  try {
    return { ledger: rollDay(JSON.parse(remote.result) as Ledger, today), writable: true };
  } catch {
    return { ledger: todayMemory().ledger, writable: false };
  }
}

async function writeUpstash(ledger: Ledger) {
  await upstash(["SET", `mehfil:ledger:${ledger.day}`, JSON.stringify(ledger), "EX", 60 * 60 * 48]);
}

async function readBlob(): Promise<Loaded> {
  const today = utcDay();
  const pathname = `mehfil/ledger-${today}.json`;
  try {
    const { get } = await import("@vercel/blob");
    const result = await get(pathname, {
      access: "private",
      useCache: false,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    if (!result || result.statusCode !== 200 || !result.stream) {
      return { ledger: emptyLedger(today), writable: true };
    }
    const text = await new Response(result.stream).text();
    return { ledger: rollDay(JSON.parse(text) as Ledger, today), etag: result.blob.etag, writable: true };
  } catch (error) {
    const missing = error instanceof Error && (error.name === "BlobNotFoundError" || /not found/i.test(error.message));
    if (missing) return { ledger: emptyLedger(today), writable: true };
    console.warn("[mehfil] blob ledger read failed", error instanceof Error ? error.message : "error");
    return { ledger: todayMemory().ledger, writable: false };
  }
}

async function writeBlob(ledger: Ledger, etag?: string) {
  const { put } = await import("@vercel/blob");
  await put(`mehfil/ledger-${ledger.day}.json`, JSON.stringify(ledger), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 60,
    token: process.env.BLOB_READ_WRITE_TOKEN,
    ...(etag ? { ifMatch: etag } : {}),
  });
}

function isConflict(error: unknown): boolean {
  return error instanceof Error && (error.name === "BlobPreconditionFailedError" || /precondition/i.test(error.message));
}

export async function updateLedger(mutate: (ledger: Ledger) => Ledger | null): Promise<Ledger> {
  const kind = storeKind();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    if (kind === "memory") {
      const { ledger, version } = todayMemory();
      const next = mutate(ledger);
      if (!next) return ledger;
      if (writeMemory(next, version)) return next;
      continue;
    }
    if (kind === "upstash") {
      const loaded = await readUpstash();
      const next = mutate(loaded.ledger);
      if (!next) return loaded.ledger;
      if (loaded.writable) await writeUpstash(next);
      else console.warn("[mehfil] upstash ledger unreachable; this instance kept the count");
      return next;
    }
    const loaded = await readBlob();
    const next = mutate(loaded.ledger);
    if (!next) return loaded.ledger;
    if (!loaded.writable) {
      console.warn("[mehfil] blob ledger unreachable; this instance kept the count");
      return next;
    }
    try {
      await writeBlob(next, loaded.etag);
      return next;
    } catch (error) {
      if (isConflict(error) && attempt < 4) continue;
      console.warn("[mehfil] blob ledger write failed", error instanceof Error ? error.message : "error");
      return next;
    }
  }
  throw new Error("ledger_conflict");
}

export async function authorizeRun(input: { runId: string; ip: string; estimate: number; knownRunIds?: string[] }) {
  const limits: Limits = limitsFromEnv();
  let decision = beginRun(emptyLedger(), input, limits);
  await updateLedger((ledger) => {
    decision = beginRun(ledger, input, limits);
    return decision.ledger;
  });
  return { ...decision, limits };
}

export async function settleRun(runId: string, used: number) {
  let ledger = emptyLedger();
  await updateLedger((current) => {
    ledger = finishRun(current, runId, used);
    return ledger;
  });
  return ledger;
}

export async function budgetAllows(grant: RunGrant, units: number): Promise<"ok" | "reservation_spent" | "run_required"> {
  let reason: "ok" | "reservation_spent" | "run_required" = "ok";
  await updateLedger((ledger) => {
    const staged = stageTask(ledger, {
      runId: grant.runId,
      visitor: grant.visitor,
      units,
      grantCharged: grant.charged,
      grantPending: grant.pending,
      reserved: grant.reserved,
    });
    reason = staged.ok ? "ok" : staged.reason;
    return null;
  });
  return reason;
}

export async function trackTask(grant: RunGrant, taskId: string, units: number): Promise<RunGrant | "reservation_spent" | "run_required"> {
  let outcome: RunGrant | "reservation_spent" | "run_required" = "run_required";
  await updateLedger((ledger) => {
    const staged = stageTask(ledger, {
      runId: grant.runId,
      visitor: grant.visitor,
      units,
      taskId,
      grantCharged: grant.charged,
      grantPending: grant.pending,
      reserved: grant.reserved,
    });
    if (!staged.ok) {
      outcome = staged.reason;
      return null;
    }
    outcome = { ...grant, charged: staged.charged, pending: staged.pending };
    return staged.write ? staged.ledger : null;
  });
  return outcome;
}

export async function finishTask(grant: RunGrant, taskId: string, outcome: "ok" | "error"): Promise<RunGrant> {
  let next = grant;
  await updateLedger((ledger) => {
    const updated = resolveTask(ledger, grant.runId, taskId, outcome);
    const reservation = updated.reservations[grant.runId];
    next = {
      ...grant,
      charged: reservation?.charged ?? grant.charged,
      pending: reservation?.pending ?? grant.pending,
    };
    return updated;
  });
  return next;
}

export async function closeRun(grant: RunGrant, delivered: boolean): Promise<{ used: number; runIds: string[]; day: string }> {
  let used = grant.charged;
  let runIds: string[] = [];
  let day = "";
  await updateLedger((ledger) => {
    const reservation = ledger.reservations[grant.runId];
    used = Math.max(grant.charged, reservation?.charged ?? 0);
    const next = finishRun(ledger, grant.runId, used, Date.now(), { delivered, visitor: grant.visitor });
    runIds = next.runsByIp[grant.visitor] ?? [];
    day = next.day;
    return next;
  });
  return { used, runIds, day };
}

export function resetLedgerForTests() {
  const g = globalThis as GlobalLedger;
  g.__mehfilLedger = emptyLedger();
  g.__mehfilVersion = 0;
}

import type { Limits } from "@/lib/units";

export type Reservation = {
  units: number;
  at: number;
  runId: string;
  ip: string;
  charged?: number;
  pending?: Record<string, number>;
};

export type Ledger = {
  day: string;
  spent: number;
  reserved: number;
  reservations: Record<string, Reservation>;
  runsByIp: Record<string, string[]>;
  /** Older ledgers stored this. It is not used to block a visit. */
  failedByIp?: Record<string, string[]>;
};

export type GuardDecision = {
  allow: boolean;
  reason?: "ip" | "daily" | "session" | "failed" | "ok";
  ledger: Ledger;
  runId: string;
};

export function utcDay(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function emptyLedger(day = utcDay()): Ledger {
  return { day, spent: 0, reserved: 0, reservations: {}, runsByIp: {}, failedByIp: {} };
}

export function expireReservations(ledger: Ledger, now: number, ttlMs: number): Ledger {
  const next: Ledger = {
    ...ledger,
    reservations: {},
    reserved: 0,
    runsByIp: { ...ledger.runsByIp },
  };
  for (const [id, reservation] of Object.entries(ledger.reservations)) {
    if (now - reservation.at > ttlMs) continue;
    next.reservations[id] = reservation;
    next.reserved += reservation.units;
  }
  return next;
}

export function rollDay(ledger: Ledger, day: string): Ledger {
  if (ledger.day === day) return ledger;
  return emptyLedger(day);
}

export function beginRun(
  ledger: Ledger,
  request: { runId: string; ip: string; estimate: number; now?: number; knownRunIds?: string[]; failedCap?: number },
  limits: Limits,
): GuardDecision {
  const now = request.now ?? Date.now();
  const rolled = expireReservations(rollDay(ledger, utcDay(new Date(now))), now, limits.reservationTtlMs);
  const previous = rolled.reservations[request.runId];
  const reserved = rolled.reserved - (previous?.units ?? 0) + request.estimate;
  return {
    allow: true,
    reason: "ok",
    runId: request.runId,
    ledger: {
      ...rolled,
      reserved,
      runsByIp: rolled.runsByIp,
      reservations: {
        ...rolled.reservations,
        [request.runId]: {
          units: request.estimate,
          at: now,
          runId: request.runId,
          ip: request.ip,
          charged: previous?.charged ?? 0,
          pending: previous?.pending ?? {},
        },
      },
    },
  };
}

/**
 * Settle a reservation. Charged units stay on the ledger. The unused hold is released.
 * Delivered or not, this does not block the next visit.
 */
export function finishRun(
  ledger: Ledger,
  runId: string,
  used: number,
  now = Date.now(),
  options?: { delivered?: boolean; visitor?: string },
): Ledger {
  void options;
  const current = expireReservations(ledger, now, 30 * 60 * 1000);
  const reservation = current.reservations[runId];
  const spent = current.spent + Math.max(0, used);
  if (!reservation) return { ...current, spent };
  const rest = { ...current.reservations };
  delete rest[runId];
  return {
    ...current,
    spent,
    reserved: Math.max(0, current.reserved - reservation.units),
    reservations: rest,
  };
}

export function releaseRun(ledger: Ledger, runId: string, now = Date.now()): Ledger {
  return finishRun(ledger, runId, 0, now);
}

function mergePending(left: Record<string, number> = {}, right: Record<string, number> = {}): Record<string, number> {
  const pending: Record<string, number> = {};
  for (const id of new Set([...Object.keys(left), ...Object.keys(right)])) {
    const units = Math.max(left[id] ?? 0, right[id] ?? 0);
    if (units > 0) pending[id] = units;
  }
  return pending;
}

/**
 * Record a task against a signed run.
 * A valid token is never refused for how many units the run has used.
 * Without a task id this only reads the reservation and does not write.
 */
export function stageTask(
  ledger: Ledger,
  input: {
    runId: string;
    visitor: string;
    units: number;
    taskId?: string;
    grantCharged: number;
    grantPending: Record<string, number>;
    reserved: number;
    now?: number;
  },
):
  | { ok: true; ledger: Ledger; charged: number; pending: Record<string, number>; write: boolean }
  | { ok: false; reason: "run_required" } {
  const now = input.now ?? Date.now();
  const current = expireReservations(ledger, now, 30 * 60 * 1000);
  const existing = current.reservations[input.runId];
  if (existing && existing.ip !== input.visitor) return { ok: false, reason: "run_required" };
  const charged = Math.max(existing?.charged ?? 0, input.grantCharged);
  const pending = mergePending(existing?.pending, input.grantPending);
  const reserved = existing?.units ?? input.reserved;
  const already = input.taskId ? pending[input.taskId] : undefined;
  if (!input.taskId) {
    return { ok: true, ledger: current, charged, pending, write: false };
  }
  const nextPending = already ? pending : { ...pending, [input.taskId]: input.units };
  const reservation: Reservation = {
    units: reserved,
    at: existing?.at ?? now,
    runId: input.runId,
    ip: input.visitor,
    charged,
    pending: nextPending,
  };
  return {
    ok: true,
    ledger: {
      ...current,
      reserved: current.reserved,
      reservations: { ...current.reservations, [input.runId]: reservation },
    },
    charged,
    pending: nextPending,
    write: true,
  };
}

/** Move a pending task into charged on success, or drop it when YouCam reports an error. */
export function resolveTask(
  ledger: Ledger,
  runId: string,
  taskId: string,
  outcome: "ok" | "error",
  now = Date.now(),
): Ledger {
  const current = expireReservations(ledger, now, 30 * 60 * 1000);
  const reservation = current.reservations[runId];
  const units = reservation?.pending?.[taskId];
  if (!reservation || !units) return current;
  const pending = { ...reservation.pending };
  delete pending[taskId];
  return {
    ...current,
    reservations: {
      ...current.reservations,
      [runId]: {
        ...reservation,
        charged: (reservation.charged ?? 0) + (outcome === "ok" ? units : 0),
        pending,
      },
    },
  };
}

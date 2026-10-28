import type { Limits } from "@/lib/units";

export type Reservation = {
  units: number;
  at: number;
  runId: string;
  ip: string;
};

export type Ledger = {
  day: string;
  spent: number;
  reserved: number;
  reservations: Record<string, Reservation>;
  runsByIp: Record<string, string[]>;
};

export type GuardDecision = {
  allow: boolean;
  reason?: "ip" | "daily" | "session" | "ok";
  ledger: Ledger;
  runId: string;
};

export function utcDay(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function emptyLedger(day = utcDay()): Ledger {
  return { day, spent: 0, reserved: 0, reservations: {}, runsByIp: {} };
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
  request: { runId: string; ip: string; estimate: number; now?: number },
  limits: Limits,
): GuardDecision {
  const now = request.now ?? Date.now();
  const rolled = expireReservations(rollDay(ledger, utcDay(new Date(now))), now, limits.reservationTtlMs);
  const runs = rolled.runsByIp[request.ip] ?? [];
  const already = runs.includes(request.runId) || Boolean(rolled.reservations[request.runId]);
  if (!already && runs.length >= limits.perIp) {
    return { allow: false, reason: "ip", ledger: rolled, runId: request.runId };
  }
  if (request.estimate > limits.session) {
    return { allow: false, reason: "session", ledger: rolled, runId: request.runId };
  }
  if (rolled.spent + rolled.reserved + request.estimate > limits.daily) {
    return { allow: false, reason: "daily", ledger: rolled, runId: request.runId };
  }
  const nextRuns = already ? runs : [...runs, request.runId];
  const previous = rolled.reservations[request.runId];
  const reserved = rolled.reserved - (previous?.units ?? 0) + request.estimate;
  return {
    allow: true,
    reason: "ok",
    runId: request.runId,
    ledger: {
      ...rolled,
      reserved,
      runsByIp: { ...rolled.runsByIp, [request.ip]: nextRuns },
      reservations: {
        ...rolled.reservations,
        [request.runId]: { units: request.estimate, at: now, runId: request.runId, ip: request.ip },
      },
    },
  };
}

export function finishRun(ledger: Ledger, runId: string, used: number, now = Date.now()): Ledger {
  const current = expireReservations(ledger, now, 30 * 60 * 1000);
  const reservation = current.reservations[runId];
  if (!reservation) {
    return { ...current, spent: current.spent + Math.max(0, used) };
  }
  const rest = { ...current.reservations };
  delete rest[runId];
  return {
    ...current,
    spent: current.spent + Math.max(0, used),
    reserved: Math.max(0, current.reserved - reservation.units),
    reservations: rest,
  };
}

export function releaseRun(ledger: Ledger, runId: string, now = Date.now()): Ledger {
  return finishRun(ledger, runId, 0, now);
}

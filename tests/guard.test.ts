import { describe, expect, it } from "vitest";
import { beginRun, emptyLedger, finishRun, releaseRun } from "@/lib/guard";
import { limitsFromEnv, skinAnalysisCost, skinSimulationCost } from "@/lib/units";

const limits = { daily: 150, perIp: 2, session: 60, reservationTtlMs: 1_800_000 };
const now = Date.parse("2026-10-28T12:00:00Z");

describe("unit guard", () => {
  it("prices the groom chain the way the live table does", () => {
    expect(skinAnalysisCost(7)).toBe(12);
    expect(skinAnalysisCost(4)).toBe(9);
    expect(skinAnalysisCost(7, "hd")).toBe(16);
    expect(skinSimulationCost(4)).toBe(4);
    expect(skinSimulationCost(5)).toBe(6);
    expect(limitsFromEnv({}).daily).toBe(Number.POSITIVE_INFINITY);
    expect(limitsFromEnv({ DAILY_UNIT_CAP: "1", LIVE_RUNS_PER_IP: "1" }).daily).toBe(Number.POSITIVE_INFINITY);
    expect(limitsFromEnv({ DAILY_UNIT_CAP: "1", LIVE_RUNS_PER_IP: "1" }).perIp).toBe(Number.POSITIVE_INFINITY);
  });

  it("allows repeated runs for the same visitor", () => {
    let ledger = emptyLedger("2026-10-28");
    for (const runId of ["a", "b", "c", "d"]) {
      const next = beginRun(ledger, { runId, ip: "ip1", estimate: 46, now }, limits);
      expect(next.allow).toBe(true);
      ledger = next.ledger;
    }
  });

  it("does not stop at a daily total and still releases unused reservations", () => {
    let ledger = emptyLedger("2026-10-28");
    ledger = { ...ledger, spent: 10000 };
    const ok = beginRun(ledger, { runId: "a", ip: "ip1", estimate: 46, now }, limits);
    expect(ok.allow).toBe(true);
    expect(ok.reason).toBe("ok");
    const finished = finishRun(ok.ledger, "a", 12, now + 1000);
    expect(finished.spent).toBe(10012);
    expect(finished.reserved).toBe(0);
    const released = releaseRun(ok.ledger, "a", now + 1000);
    expect(released.spent).toBe(10000);
    expect(released.reserved).toBe(0);
  });

  it("allows a large estimate and expires stale holds", () => {
    const ledger = emptyLedger("2026-10-28");
    const huge = beginRun(ledger, { runId: "a", ip: "ip1", estimate: 80, now }, limits);
    expect(huge.allow).toBe(true);
    const held = beginRun(ledger, { runId: "a", ip: "ip1", estimate: 40, now }, limits);
    const later = beginRun(held.ledger, { runId: "b", ip: "ip1", estimate: 120, now: now + limits.reservationTtlMs + 5 }, limits);
    expect(later.allow).toBe(true);
    expect(later.ledger.reserved).toBe(120);
  });

  it("does not block after failed finishes", () => {
    let ledger = emptyLedger("2026-10-28");
    for (const runId of ["a", "b", "c", "d"]) {
      const started = beginRun(ledger, { runId, ip: "ip1", estimate: 40, now }, limits);
      expect(started.allow).toBe(true);
      ledger = finishRun(started.ledger, runId, 4, now + 1000, { delivered: false });
    }
    expect(ledger.spent).toBe(16);
    const again = beginRun(ledger, { runId: "e", ip: "ip1", estimate: 40, now: now + 2000 }, limits);
    expect(again.allow).toBe(true);
  });

  it("ignores a visit-cookie run list", () => {
    const next = beginRun(emptyLedger("2026-10-28"), { runId: "c", ip: "ip1", estimate: 10, knownRunIds: ["a", "b"], now }, limits);
    expect(next.allow).toBe(true);
    expect(next.reason).toBe("ok");
  });

  it("resets the ledger on the next UTC day", () => {
    const ledger = beginRun(emptyLedger("2026-10-28"), { runId: "a", ip: "ip1", estimate: 40, now }, limits).ledger;
    const next = beginRun(ledger, { runId: "b", ip: "ip1", estimate: 40, now: Date.parse("2026-10-29T00:00:00Z") }, limits);
    expect(next.allow).toBe(true);
    expect(next.ledger.day).toBe("2026-10-29");
    expect(next.ledger.spent).toBe(0);
  });
});

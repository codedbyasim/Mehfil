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
    expect(limitsFromEnv({}).daily).toBe(150);
    expect(limitsFromEnv({ DAILY_UNIT_CAP: "90" }).daily).toBe(90);
  });

  it("allows two runs per IP and then falls closed", () => {
    let ledger = emptyLedger("2026-10-28");
    const first = beginRun(ledger, { runId: "a", ip: "ip1", estimate: 46, now }, limits);
    expect(first.allow).toBe(true);
    ledger = first.ledger;
    const second = beginRun(ledger, { runId: "b", ip: "ip1", estimate: 46, now: now + 10 }, limits);
    expect(second.allow).toBe(true);
    const third = beginRun(second.ledger, { runId: "c", ip: "ip1", estimate: 46, now: now + 20 }, limits);
    expect(third.allow).toBe(false);
    expect(third.reason).toBe("ip");
    const other = beginRun(second.ledger, { runId: "d", ip: "ip2", estimate: 46, now: now + 20 }, limits);
    expect(other.allow).toBe(true);
  });

  it("stops at the daily ceiling and releases unused reservations", () => {
    let ledger = emptyLedger("2026-10-28");
    ledger = { ...ledger, spent: 120 };
    const blocked = beginRun(ledger, { runId: "a", ip: "ip1", estimate: 46, now }, limits);
    expect(blocked.allow).toBe(false);
    expect(blocked.reason).toBe("daily");
    const ok = beginRun(ledger, { runId: "a", ip: "ip1", estimate: 30, now }, limits);
    expect(ok.allow).toBe(true);
    const finished = finishRun(ok.ledger, "a", 12, now + 1000);
    expect(finished.spent).toBe(132);
    expect(finished.reserved).toBe(0);
    const released = releaseRun(ok.ledger, "a", now + 1000);
    expect(released.spent).toBe(120);
    expect(released.reserved).toBe(0);
  });

  it("refuses a session over the per-run budget and expires stale holds", () => {
    const ledger = emptyLedger("2026-10-28");
    const huge = beginRun(ledger, { runId: "a", ip: "ip1", estimate: 80, now }, limits);
    expect(huge.reason).toBe("session");
    const held = beginRun(ledger, { runId: "a", ip: "ip1", estimate: 40, now }, limits);
    const later = beginRun(held.ledger, { runId: "b", ip: "ip1", estimate: 120, now: now + limits.reservationTtlMs + 5 }, limits);
    expect(later.allow).toBe(false);
    expect(later.reason).toBe("session");
    expect(later.ledger.reserved).toBe(0);
  });

  it("resets the ledger on the next UTC day", () => {
    const ledger = beginRun(emptyLedger("2026-10-28"), { runId: "a", ip: "ip1", estimate: 40, now }, limits).ledger;
    const next = beginRun(ledger, { runId: "b", ip: "ip1", estimate: 40, now: Date.parse("2026-10-29T00:00:00Z") }, limits);
    expect(next.allow).toBe(true);
    expect(next.ledger.day).toBe("2026-10-29");
    expect(next.ledger.spent).toBe(0);
  });
});

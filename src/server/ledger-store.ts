import { beginRun, emptyLedger, finishRun, rollDay, utcDay, type Ledger } from "@/lib/guard";
import { limitsFromEnv, type Limits } from "@/lib/units";

type GlobalLedger = typeof globalThis & { __mehfilLedger?: Ledger };

function memory(): Ledger {
  const g = globalThis as GlobalLedger;
  const today = utcDay();
  if (!g.__mehfilLedger || g.__mehfilLedger.day !== today) g.__mehfilLedger = emptyLedger(today);
  return g.__mehfilLedger;
}

function writeMemory(ledger: Ledger) {
  (globalThis as GlobalLedger).__mehfilLedger = ledger;
}

async function upstash(command: unknown[]): Promise<unknown> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(command),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { result?: unknown };
    return json.result ?? null;
  } catch {
    return null;
  }
}

async function readLedger(): Promise<Ledger> {
  const today = utcDay();
  const remote = await upstash(["GET", `mehfil:ledger:${today}`]);
  if (typeof remote === "string") {
    try {
      return rollDay(JSON.parse(remote) as Ledger, today);
    } catch {
      return memory();
    }
  }
  return memory();
}

async function writeLedger(ledger: Ledger) {
  writeMemory(ledger);
  await upstash(["SET", `mehfil:ledger:${ledger.day}`, JSON.stringify(ledger), "EX", 60 * 60 * 48]);
}

export async function authorizeRun(input: { runId: string; ip: string; estimate: number }) {
  const limits: Limits = limitsFromEnv();
  const decision = beginRun(await readLedger(), input, limits);
  if (decision.allow) await writeLedger(decision.ledger);
  return { ...decision, limits };
}

export async function settleRun(runId: string, used: number) {
  const ledger = finishRun(await readLedger(), runId, used);
  await writeLedger(ledger);
  return ledger;
}

export function resetLedgerForTests() {
  writeMemory(emptyLedger());
}

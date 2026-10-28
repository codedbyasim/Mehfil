"use client";

import { EmptyWeek } from "@/components/shell";
import { useSession } from "@/components/session";
import { runLiveSession } from "@/lib/live-run";
import type { TraceStep } from "@/lib/types";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

export default function StudioPage() {
  const { session, setSession, loadDemo } = useSession();
  const [shown, setShown] = useState(1);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [statuses, setStatuses] = useState<Record<string, string>>({});

  const plan = session?.plan;

  useEffect(() => {
    if (!plan) return;
    setShown(1);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setShown(plan.trace.length);
      return;
    }
    const timer = window.setInterval(() => {
      setShown((count) => {
        if (count >= plan.trace.length) {
          window.clearInterval(timer);
          return count;
        }
        return count + 1;
      });
    }, 450);
    return () => window.clearInterval(timer);
  }, [plan]);

  const visible = useMemo(() => (plan?.trace ?? []).slice(0, shown), [plan, shown]);
  const spent = visible.reduce((sum, step) => sum + (session?.mode === "demo" ? 0 : step.units), 0);

  if (!session) return <EmptyWeek title="The stylist" />;

  async function ensurePlan() {
    if (session!.plan) return session!.plan;
    if (session!.mode === "demo" && session!.scenarioId) {
      const loaded = await loadDemo(session!.scenarioId);
      return loaded.plan!;
    }
    return null;
  }

  async function runLive() {
    setLiveError(null);
    setRunning(true);
    try {
      const result = await runLiveSession(session!, (update) => {
        setStatuses((current) => ({ ...current, [update.traceId]: update.status }));
      });
      setSession(result.session);
    } catch (error) {
      const fallback = (error as { fallback?: string }).fallback;
      const message = error instanceof Error ? error.message : "Live run stopped.";
      if (fallback === "demo") {
        const demo = await loadDemo(session!.role === "bride" ? "bride" : session!.role === "guest" ? "guest" : "groom");
        setSession({ ...demo, fallbackBanner: message });
      } else {
        setLiveError(message);
      }
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
      <section>
        <p className="text-xs uppercase tracking-[0.22em] text-gold">Stylist</p>
        <h1 className="display text-5xl text-maroon-deep">The agent, in the open.</h1>
        <p className="mt-3 max-w-xl text-muted">
          {plan
            ? plan.orderReason
            : "Demo weeks already have a plan. A live photo runs skin analysis and color tones first, then the chain the role calls for."}
        </p>
        {session.fallbackBanner ? <p className="mt-4 rounded-2xl bg-gold-bright/40 px-4 py-3 text-sm">{session.fallbackBanner} Showing the matching demo.</p> : null}
        {session.placeholder ? <p className="mt-4 text-sm text-gold">Placeholder scores. Not a live scan.</p> : null}
        <ol className="mt-6 space-y-3" aria-live="polite">
          {visible.map((step) => (
            <TraceRow key={step.id} step={step} status={statuses[step.id] ?? (session.mode === "demo" ? "demo" : "ready")} charged={session.mode === "demo" ? 0 : step.units} />
          ))}
        </ol>
        {liveError ? <p className="mt-4 text-sm text-maroon">{liveError}</p> : null}
        <div className="mt-6 flex flex-wrap gap-3">
          {session.mode === "live" && session.selfieUrl ? (
            <button type="button" className="rounded-full bg-maroon px-5 py-3 text-ivory disabled:opacity-40" disabled={running} onClick={() => void runLive()}>
              {running ? "Running…" : "Run live"}
            </button>
          ) : null}
          {!plan && session.mode === "demo" ? (
            <button type="button" className="rounded-full border border-gold px-5 py-3" onClick={() => void ensurePlan()}>
              Build the plan
            </button>
          ) : null}
          <Link href="/looks" className="rounded-full border border-maroon/30 px-5 py-3">See the looks</Link>
        </div>
      </section>
      <aside className="h-fit rounded-3xl border border-gold/30 bg-maroon-deep p-6 text-ivory">
        <p className="text-xs uppercase tracking-[0.2em] text-gold-bright">Unit counter</p>
        <p className="display mt-3 text-6xl">{session.mode === "demo" ? 0 : spent}</p>
        <p className="mt-2 text-sm text-ivory/75">
          {session.mode === "demo"
            ? `Demo charges nothing. A live week of this plan is ${plan?.unitsIfLive ?? "—"} units.`
            : "Charged only when a YouCam task succeeds."}
        </p>
        <p className="mt-6 text-sm text-ivory/75">
          Daily ceiling and two live runs per visitor sit on the server. Past that, MEHFIL returns to the demo.
        </p>
        {plan ? (
          <p className="mt-6 text-sm">
            Chain: {plan.vtoOrder === "makeup-first" ? "makeup, then each outfit" : "outfit, then makeup, per function"}.
          </p>
        ) : null}
      </aside>
    </div>
  );
}

function TraceRow({ step, status, charged }: { step: TraceStep; status: string; charged: number }) {
  return (
    <li className="rounded-2xl border border-gold/25 bg-paper px-4 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg">{step.title}</h2>
        <span className="text-xs uppercase tracking-[0.14em] text-gold">{status} · {charged}</span>
      </div>
      <p className="mt-1 text-sm text-muted">{step.detail}</p>
      {step.api ? <p className="mt-1 font-mono text-xs text-maroon/80">{step.api}</p> : null}
    </li>
  );
}

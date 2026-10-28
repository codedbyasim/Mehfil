"use client";

import { Compare } from "@/components/compare";
import { EmptyWeek } from "@/components/shell";
import { useSession } from "@/components/session";
import { toneFactsForDisplay } from "@/lib/skin";
import { useState } from "react";

export default function SkinPage() {
  const { session } = useSession();
  const [mask, setMask] = useState<string | null>(null);
  if (!session?.plan) return <EmptyWeek title="Skin goal" />;
  const skin = session.plan;
  const facts = toneFactsForDisplay({
    skinColor: skin.profile.skinHex,
    eyeColor: null,
    eyeColorName: null,
    lipColor: skin.profile.lipHex,
    eyebrowColor: null,
    hairColor: null,
    hairColorName: null,
  });
  const first = [...session.events].sort((a, b) => a.date.localeCompare(b.date))[0];
  const days = first ? daysUntil(first.date) : null;
  const before = session.faceCropUrl || session.selfieUrl || "";
  const after = session.simulationImage || before;

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs uppercase tracking-[0.22em] text-gold">Skin</p>
        <h1 className="display text-5xl text-maroon-deep">The event-day goal.</h1>
        <p className="mt-3 max-w-2xl text-muted">{skin.simulation.note}</p>
        {session.placeholder ? <p className="mt-2 text-sm text-gold">Placeholder scores and illustration. Not a live analysis.</p> : null}
      </header>
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Overall" value={score(session, "overall")} />
        <Stat label="Skin age score" value={score(session, "age")} />
        <Stat label="Dark circles" value={score(session, "dark")} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {before && after ? (
          <Compare
            before={mask || before}
            after={after}
            beforeLabel={mask ? "Mask overlay" : "Face crop"}
            afterLabel="Skin goal"
            focus={session.eyeFocus ?? { x: 50, y: 42, scale: 1.85 }}
            alt="Event-day skin simulation, zoomed toward the eyes"
          />
        ) : null}
        <div className="space-y-4">
          <p className="text-sm text-muted">Drag the slider. It is zoomed to the eyes because the live simulation is subtle.</p>
          <p>
            Undertone {skin.profile.undertone}. {skin.profile.ita !== null ? `ITA° ${Math.round(skin.profile.ita)}, ${skin.profile.itaBand} band, computed from the skin hex.` : ""}
          </p>
          <p>Skin type from the analysis: {skin.profile.skinTypeLabel}.</p>
          <ul className="flex flex-wrap gap-3">
            {facts.skinColor ? <Swatch label="Skin" hex={facts.skinColor} /> : null}
            {facts.lipColor ? <Swatch label="Lip" hex={facts.lipColor} /> : null}
          </ul>
          {session.masks ? (
            <div className="flex flex-wrap gap-2">
              <button type="button" className="rounded-full border border-gold px-3 py-1 text-sm" onClick={() => setMask(null)}>Photo</button>
              {Object.entries(session.masks).map(([name, src]) => (
                <button key={name} type="button" className="rounded-full border border-gold px-3 py-1 text-sm" onClick={() => setMask(src)}>
                  {name.replaceAll("_", " ")}
                </button>
              ))}
            </div>
          ) : null}
          <section className="rounded-3xl bg-maroon-deep p-5 text-ivory">
            <p className="text-xs uppercase tracking-[0.18em] text-gold-bright">Countdown</p>
            <p className="display mt-2 text-5xl">{days === null ? "—" : days < 0 ? "Past" : days}</p>
            <p className="text-sm text-ivory/75">{first ? `days until ${first.name}` : ""}</p>
            <ol className="mt-4 space-y-3 text-sm">
              {skin.checklist.map((item) => (
                <li key={item.id}>
                  <span className="text-gold-bright">{item.when}. </span>
                  {item.text}
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-gold/30 bg-paper p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className="display text-4xl text-maroon">{value}</p>
    </div>
  );
}

function Swatch({ label, hex }: { label: string; hex: string }) {
  return (
    <li className="flex items-center gap-2 rounded-full bg-paper px-3 py-2 text-sm">
      <span className="h-5 w-5 rounded-full border border-ink/10" style={{ background: hex }} />
      {label} {hex}
    </li>
  );
}

function score(session: { plan?: { looks: Array<{ why: string }> } | null }, kind: string): string {
  const why = session.plan?.looks.map((look) => look.why).join(" ") ?? "";
  if (kind === "overall") return match(why, /Overall score (\d+)/) ?? "—";
  if (kind === "age") return match(why, /skin age score (\d+)/) ?? "—";
  return match(why, /display (\d+)/) ?? "—";
}

function match(text: string, pattern: RegExp): string | null {
  return pattern.exec(text)?.[1] ?? null;
}

function daysUntil(date: string): number {
  const target = new Date(`${date}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

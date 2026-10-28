"use client";

import { EmptyWeek } from "@/components/shell";
import { useSession } from "@/components/session";

export default function ShadesPage() {
  const { session, setSession } = useSession();
  if (!session?.plan) return <EmptyWeek title="Shade list" />;
  const bag = new Set(session.bag);

  function toggle(id: string) {
    const next = bag.has(id) ? session!.bag.filter((item) => item !== id) : [...session!.bag, id];
    setSession({ ...session!, bag: next });
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.22em] text-gold">Shades</p>
        <h1 className="display text-5xl text-maroon-deep">A list you can shop from.</h1>
        <p className="mt-3 max-w-2xl text-muted">
          Generic descriptions only. No brand names and no logos. Add a shade to the bag for this session. It is not a checkout.
        </p>
      </header>
      <ul className="grid gap-3 md:grid-cols-2">
        {session.plan.shades.map((shade) => (
          <li key={shade.id} className="flex items-center justify-between gap-4 rounded-3xl border border-gold/30 bg-paper p-4">
            <div className="flex items-center gap-3">
              <span className="h-12 w-12 rounded-2xl border border-ink/10" style={{ background: shade.hex }} />
              <span>
                <span className="block font-medium">{shade.name}</span>
                <span className="text-sm text-muted">{shade.note}</span>
                <span className="block font-mono text-xs text-maroon">{shade.hex}</span>
              </span>
            </div>
            <button type="button" className="rounded-full border border-maroon px-3 py-2 text-sm" onClick={() => toggle(shade.id)}>
              {bag.has(shade.id) ? "In the bag" : "Add"}
            </button>
          </li>
        ))}
      </ul>
      <p className="text-sm text-muted">{session.bag.length} in the bag.</p>
    </div>
  );
}

"use client";

import { EmptyWeek, } from "@/components/shell";
import { eventsFor, useSession } from "@/components/session";
import type { Presentation, Role, TimeOfDay } from "@/lib/types";
import { useRouter } from "next/navigation";

const ROLES: Array<{ id: Role; label: string; copy: string }> = [
  { id: "groom", label: "Groom", copy: "One grooming look, then each outfit." },
  { id: "bride", label: "Bride", copy: "A different makeup for each function, on the outfit." },
  { id: "guest", label: "Guest", copy: "Festive, not bridal. Lighter than the couple." },
];

export default function SetupPage() {
  const { session, setSession } = useSession();
  const router = useRouter();
  if (!session) return <EmptyWeek title="Set the week" />;

  function setRole(role: Role) {
    const presentation: Presentation = role === "groom" ? "man" : session!.presentation === "man" && role === "guest" ? "man" : role === "bride" ? "woman" : session!.presentation;
    const nextPresentation = role === "groom" ? "man" : role === "bride" ? "woman" : presentation;
    setSession({ ...session!, role, presentation: nextPresentation, events: eventsFor(role, nextPresentation), plan: undefined });
  }

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs uppercase tracking-[0.22em] text-gold">Week</p>
        <h1 className="display text-5xl text-maroon-deep">Who is dressing, and when.</h1>
        <p className="mt-3 max-w-2xl text-muted">Pick the role, the three functions, and whether each one is day, evening, or night. Night looks are deeper. The groom path keeps one grooming recipe.</p>
      </header>
      <div className="grid gap-3 md:grid-cols-3">
        {ROLES.map((role) => (
          <button
            key={role.id}
            type="button"
            onClick={() => setRole(role.id)}
            className={`rounded-3xl border p-5 text-left ${session.role === role.id ? "border-maroon bg-maroon text-ivory" : "border-gold/30 bg-paper"}`}
          >
            <span className="display block text-3xl">{role.label}</span>
            <span className={`mt-2 block text-sm ${session.role === role.id ? "text-ivory/80" : "text-muted"}`}>{role.copy}</span>
          </button>
        ))}
      </div>
      {session.role === "guest" ? (
        <label className="flex items-center gap-3 text-sm">
          <span>Dressing as</span>
          <select
            className="rounded-full border border-gold/40 bg-paper px-3 py-2"
            value={session.presentation}
            onChange={(event) => {
              const presentation = event.target.value as Presentation;
              setSession({ ...session, presentation, events: eventsFor(session.role, presentation), plan: undefined });
            }}
          >
            <option value="woman">A woman</option>
            <option value="man">A man</option>
          </select>
        </label>
      ) : null}
      <ul className="space-y-4">
        {session.events.map((event) => (
          <li key={event.id} className="grid gap-3 rounded-3xl border border-gold/25 bg-paper p-4 md:grid-cols-[1fr_160px_160px_1fr]">
            <p className="display text-3xl text-maroon-deep">{event.name}</p>
            <label className="text-sm text-muted">
              Date
              <input
                type="date"
                className="mt-1 w-full rounded-xl border border-gold/30 bg-ivory px-2 py-2 text-ink"
                value={event.date}
                onChange={(change) => {
                  setSession({
                    ...session,
                    events: session.events.map((item) => (item.id === event.id ? { ...item, date: change.target.value } : item)),
                  });
                }}
              />
            </label>
            <label className="text-sm text-muted">
              Light
              <select
                className="mt-1 w-full rounded-xl border border-gold/30 bg-ivory px-2 py-2"
                value={event.timeOfDay}
                onChange={(change) => {
                  const timeOfDay = change.target.value as TimeOfDay;
                  setSession({
                    ...session,
                    events: session.events.map((item) => (item.id === event.id ? { ...item, timeOfDay } : item)),
                  });
                }}
              >
                <option value="day">Day</option>
                <option value="evening">Evening</option>
                <option value="night">Night</option>
              </select>
            </label>
            <label className="text-sm text-muted">
              Venue
              <input
                className="mt-1 w-full rounded-xl border border-gold/30 bg-ivory px-2 py-2"
                value={event.venue ?? ""}
                onChange={(change) => {
                  setSession({
                    ...session,
                    events: session.events.map((item) => (item.id === event.id ? { ...item, venue: change.target.value } : item)),
                  });
                }}
              />
            </label>
          </li>
        ))}
      </ul>
      <button type="button" className="rounded-full bg-maroon px-6 py-3 text-ivory" onClick={() => router.push("/outfits")}>
        Choose outfits
      </button>
    </div>
  );
}

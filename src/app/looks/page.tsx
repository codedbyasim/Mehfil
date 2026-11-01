"use client";

import { Compare } from "@/components/compare";
import { EmptyWeek } from "@/components/shell";
import { useSession } from "@/components/session";
import { frameLabel } from "@/lib/demo";
import { useState } from "react";

export default function LooksPage() {
  const { session } = useSession();
  const [index, setIndex] = useState(0);
  const [alt, setAlt] = useState(false);
  if (!session?.plan) return <EmptyWeek title="The looks" />;
  const look = session.plan.looks[index];
  const event = session.events.find((item) => item.id === look.eventId);
  const outfitOnly = Boolean(event?.alternateTryOn) && /outfit only/i.test(event?.alternateLabel ?? "");
  const after = outfitOnly ? event?.tryOnImage || "" : alt && event?.alternateTryOn ? event.alternateTryOn : event?.tryOnImage || event?.garmentImage || "";
  const before = outfitOnly && !alt ? event?.alternateTryOn || after : event?.beforeImage || session.selfieUrl || after;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-gold">Looks</p>
          <h1 className="display text-5xl text-maroon-deep">{look.name}</h1>
          <p className="text-muted">{look.date} · {look.timeOfDay}{look.venue ? ` · ${look.venue}` : ""}</p>
        </div>
        <p className={`text-sm ${session.placeholder ? "text-gold" : "text-muted"}`}>{frameLabel(session)}</p>
      </header>
      <div className="flex gap-2 overflow-x-auto">
        {session.plan.looks.map((item, itemIndex) => (
          <button
            key={item.eventId}
            type="button"
            className={`rounded-full px-4 py-2 ${itemIndex === index ? "bg-maroon text-ivory" : "bg-paper"}`}
            onClick={() => {
              setIndex(itemIndex);
              setAlt(false);
            }}
          >
            {item.name}
          </button>
        ))}
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        {after ? (
          <Compare
            before={before}
            after={after}
            beforeLabel={outfitOnly && !alt ? "Outfit only" : "Portrait"}
            afterLabel={outfitOnly ? "With makeup" : look.garmentName}
            alt={`${look.name} try-on`}
          />
        ) : null}
        <div className="space-y-4">
          <p className="text-lg leading-relaxed">{look.why}</p>
          {session.plan.source === "llm" ? <p className="text-xs uppercase tracking-[0.16em] text-gold">Wording from the live copy pass.</p> : null}
          <p className="text-sm text-muted">Finish: {look.finish}. Garment category: {look.garmentCategory.replaceAll("_", " ")}.</p>
          {event?.alternateTryOn ? (
            <button type="button" className="rounded-full border border-gold px-4 py-2 text-sm" onClick={() => setAlt((value) => !value)}>
              {outfitOnly
                ? alt
                  ? "Compare outfit and makeup"
                  : "Compare with the original portrait"
                : alt
                  ? "Show makeup first, then the outfit"
                  : event.alternateLabel || "Compare the other order"}
            </button>
          ) : null}
          {session.groomingImage && look.eventId === "baraat" ? (
            <figure className="overflow-hidden rounded-3xl border border-gold/30">
              <img src={session.groomingImage} alt="Makeup only, before the outfit" className="aspect-[4/5] w-full object-cover" />
              <figcaption className="px-4 py-3 text-sm text-muted">The shared grooming pass, before clothes.</figcaption>
            </figure>
          ) : null}
          <ul className="flex flex-wrap gap-2">
            {session.plan.shades
              .filter((shade) => shade.eventId === look.eventId)
              .map((shade) => (
                <li key={shade.id} className="flex items-center gap-2 rounded-full bg-paper px-3 py-1 text-sm">
                  <span className="h-3 w-3 rounded-full" style={{ background: shade.hex }} />
                  {shade.name}
                </li>
              ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

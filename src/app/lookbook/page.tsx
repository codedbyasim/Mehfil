"use client";

import { EmptyWeek } from "@/components/shell";
import { useSession } from "@/components/session";
import { useState } from "react";

export default function LookbookPage() {
  const { session } = useSession();
  const [message, setMessage] = useState<string | null>(null);
  if (!session?.plan) return <EmptyWeek title="Look book" />;

  async function download() {
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1350;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.fillStyle = "#f4efe6";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#3c1018";
    context.font = "64px Georgia, serif";
    context.fillText("MEHFIL", 64, 110);
    context.font = "28px Georgia, serif";
    context.fillStyle = "#6f5d53";
    context.fillText(session!.placeholder ? "Placeholder week" : "Wedding week", 64, 160);
    const images = session!.events.slice(0, 3);
    for (let index = 0; index < images.length; index += 1) {
      const event = images[index];
      if (!event.tryOnImage) continue;
      try {
        const image = await load(event.tryOnImage);
        const x = 64 + index * 330;
        context.drawImage(image, x, 220, 300, 400);
        context.fillStyle = "#3c1018";
        context.font = "28px Georgia, serif";
        context.fillText(event.name, x, 660);
      } catch {
        /* Skip a frame that cannot be drawn. */
      }
    }
    context.fillStyle = "#6e1d2c";
    context.font = "32px Georgia, serif";
    context.fillText(session!.plan?.profile.skinHex ?? "", 64, 760);
    let y = 830;
    context.font = "26px Georgia, serif";
    context.fillStyle = "#241812";
    for (const shade of session!.plan!.shades.slice(0, 6)) {
      context.fillStyle = shade.hex;
      context.fillRect(64, y - 18, 28, 28);
      context.fillStyle = "#241812";
      context.fillText(shade.name, 108, y);
      y += 48;
    }
    context.fillStyle = "#6f5d53";
    context.font = "22px Georgia, serif";
    context.fillText("Cosmetic preview. Not a brand list.", 64, 1280);
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/jpeg", 0.92);
    link.download = `mehfil-${session!.scenarioId ?? "week"}.jpg`;
    link.click();
    setMessage("Saved a look-book image.");
  }

  return (
    <article className="print-sheet space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-gold">Look book</p>
          <h1 className="display text-5xl text-maroon-deep">The week, on one page.</h1>
          <p className="mt-2 text-muted">{session.subject || "This session"}</p>
        </div>
        <div className="no-print flex gap-3">
          <button type="button" className="rounded-full bg-maroon px-5 py-3 text-ivory" onClick={() => window.print()}>
            Print
          </button>
          <button type="button" className="rounded-full border border-gold px-5 py-3" onClick={() => void download()}>
            Download image
          </button>
        </div>
      </header>
      {message ? <p className="no-print text-sm text-muted">{message}</p> : null}
      {session.placeholder ? <p className="text-sm text-gold">Placeholder illustrations. Swap them for a live run when you have consent.</p> : null}
      <div className="grid gap-4 md:grid-cols-3">
        {session.events.map((event) => {
          const look = session.plan!.looks.find((item) => item.eventId === event.id);
          return (
            <section key={event.id} className="overflow-hidden rounded-3xl border border-gold/30 bg-paper">
              {event.tryOnImage ? <img src={event.tryOnImage} alt={`${event.name} look`} className="aspect-[3/4] w-full object-cover" /> : null}
              <div className="p-4">
                <h2 className="display text-3xl text-maroon-deep">{event.name}</h2>
                <p className="text-sm text-muted">{event.date} · {event.timeOfDay}</p>
                <p className="mt-2 text-sm">{look?.garmentName}</p>
              </div>
            </section>
          );
        })}
      </div>
      <section>
        <h2 className="display text-3xl text-maroon-deep">Shades</h2>
        <ul className="mt-3 grid gap-2 md:grid-cols-2">
          {session.plan.shades.map((shade) => (
            <li key={shade.id} className="flex items-center gap-3 text-sm">
              <span className="h-4 w-4 rounded-full" style={{ background: shade.hex }} />
              {shade.name} · {shade.hex}
            </li>
          ))}
        </ul>
      </section>
      <p className="text-sm text-muted">{session.plan.disclaimer}</p>
    </article>
  );
}

function load(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("image"));
    image.src = src;
  });
}

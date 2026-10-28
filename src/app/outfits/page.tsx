"use client";

import { EmptyWeek } from "@/components/shell";
import { useSession } from "@/components/session";
import { dominantFromPixels } from "@/lib/color";
import { outfitsFor, type Outfit } from "@/lib/outfits";
import type { SessionEvent } from "@/lib/types";
import { useRouter } from "next/navigation";

export default function OutfitsPage() {
  const { session, setSession } = useSession();
  const router = useRouter();
  if (!session) return <EmptyWeek title="Choose the clothes" />;
  const catalog = outfitsFor(session.presentation, session.role);

  function choose(eventId: string, outfit: Outfit) {
    setSession({
      ...session!,
      plan: undefined,
      events: session!.events.map((event) =>
        event.id === eventId
          ? {
              ...event,
              outfitId: outfit.id,
              garmentName: outfit.name,
              garmentHex: outfit.dominant,
              garmentCategory: outfit.suggestedCategory,
              garmentImage: outfit.image,
              tryOnImage: session!.mode === "demo" ? event.tryOnImage : undefined,
            }
          : event,
      ),
    });
  }

  async function custom(event: SessionEvent, file: File) {
    const url = URL.createObjectURL(file);
    const image = await loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = 40;
    canvas.height = 40;
    const context = canvas.getContext("2d");
    context?.drawImage(image, 0, 0, 40, 40);
    const pixels = context?.getImageData(0, 0, 40, 40).data ?? new Uint8ClampedArray();
    const hex = dominantFromPixels(pixels);
    const dataUrl = await fileToDataUrl(file);
    URL.revokeObjectURL(url);
    setSession({
      ...session!,
      plan: undefined,
      events: session!.events.map((item) =>
        item.id === event.id
          ? {
              ...item,
              outfitId: `custom-${event.id}`,
              garmentName: file.name.replace(/\.[^.]+$/, "") || "Uploaded outfit",
              garmentHex: hex,
              garmentImage: dataUrl,
              garmentCategory: session!.framing === "full-body" ? "full_body" : "upper_body",
              tryOnImage: undefined,
            }
          : item,
      ),
    });
  }

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs uppercase tracking-[0.22em] text-gold">Outfits</p>
        <h1 className="display text-5xl text-maroon-deep">Clothes for each function.</h1>
        <p className="mt-3 max-w-2xl text-muted">
          Sample garments are either AI-generated product shots or original drawings. No brand marks. A chest-up photo tries the upper body. A full-length photo can try a lehenga or a full sherwani as a full garment.
        </p>
      </header>
      {session.events.map((event) => (
        <section key={event.id}>
          <h2 className="display text-3xl text-maroon-deep">{event.name}</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
            {catalog
              .filter((outfit) => outfit.functionId === event.id)
              .map((outfit) => {
                const selected = event.outfitId === outfit.id;
                return (
                  <button
                    key={outfit.id}
                    type="button"
                    onClick={() => choose(event.id, outfit)}
                    className={`overflow-hidden rounded-3xl border text-left ${selected ? "border-maroon ring-2 ring-maroon/30" : "border-gold/30"}`}
                  >
                    <img src={outfit.image} alt={outfit.name} className="aspect-[3/4] w-full bg-ivory object-cover" />
                    <span className="block px-3 py-3">
                      <span className="block font-medium">{outfit.name}</span>
                      <span className="mt-1 flex items-center gap-2 text-xs text-muted">
                        <span className="inline-block h-3 w-3 rounded-full border border-ink/10" style={{ background: outfit.dominant }} />
                        {outfit.dominant}
                      </span>
                    </span>
                  </button>
                );
              })}
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-gold bg-paper p-4 text-center text-sm text-muted">
              Upload a product photo
              <input
                className="sr-only"
                type="file"
                accept="image/jpeg,image/png"
                onChange={(change) => {
                  const file = change.target.files?.[0];
                  if (file) void custom(event, file);
                }}
              />
            </label>
          </div>
        </section>
      ))}
      <button type="button" className="rounded-full bg-maroon px-6 py-3 text-ivory" onClick={() => router.push("/studio")}>
        Ask the stylist
      </button>
    </div>
  );
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("image"));
    image.src = url;
  });
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

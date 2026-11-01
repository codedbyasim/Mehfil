"use client";

import { useSession } from "@/components/session";
import type { Role } from "@/lib/types";
import Link from "next/link";
import { useRouter } from "next/navigation";

const WEEKS: Array<{
  id: Role;
  title: string;
  kicker: string;
  copy: string;
  live: string;
  demo: string;
  frames: Array<{ src: string; name: string; note: string }>;
}> = [
  {
    id: "bride",
    title: "Bride",
    kicker: "Fictional model",
    copy: "Outfit first, then makeup. A soft Mehndi, a bold red Baraat, and a pastel Walima. The face is an AI-generated fictional model, not a real person.",
    live: "Try with your own photo",
    demo: "Watch the bride week",
    frames: [
      { src: "/demo/bride/makeup/cloth_then_makeup_mehndi.jpg", name: "Mehndi", note: "Soft fresh" },
      { src: "/demo/bride/makeup/cloth_then_makeup_baraat.jpg", name: "Baraat", note: "Bold red" },
      { src: "/demo/bride/makeup/cloth_then_makeup_walima.jpg", name: "Walima", note: "Pastel" },
    ],
  },
  {
    id: "groom",
    title: "Groom",
    kicker: "Consented run",
    copy: "One grooming look, then each outfit. The demo is Muhammad Asim, used with consent. Overall 89, dark circles 63, skin #805E46.",
    live: "Try with your own photo",
    demo: "Watch the groom week",
    frames: [
      { src: "/demo/groom/tryon/cloth_mehndi_kurta_mustard.jpg", name: "Mehndi", note: "Mustard kurta" },
      { src: "/demo/groom/makeup/orderB_makeup_then_cloth_baraat.jpg", name: "Baraat", note: "Ivory sherwani" },
      { src: "/demo/groom/tryon/cloth_walima_princecoat_navy.jpg", name: "Walima", note: "Navy prince coat" },
    ],
  },
];

export default function HomePage() {
  const { loadDemo, startLive } = useSession();
  const router = useRouter();

  async function openDemo(id: string, href: string) {
    await loadDemo(id);
    router.push(href);
  }

  function tryLive(role: Role) {
    startLive(role);
    router.push("/capture");
  }

  return (
    <div className="space-y-16">
      <section className="rise">
        <p className="text-xs uppercase tracking-[0.28em] text-gold">South Asian wedding week</p>
        <h1 className="display mt-3 text-5xl leading-[0.95] text-maroon-deep md:text-7xl">
          Three functions.<br />One face.
        </h1>
        <p className="urdu mt-3 text-2xl text-gold">محفل</p>
        <p className="mt-5 max-w-2xl text-lg text-muted">
          MEHFIL puts Mehndi, Baraat, and Walima on the same portrait. Try it with your own photo, or watch a week that already ran. Bride and groom are the same kind of choice.
        </p>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        {WEEKS.map((week) => (
          <article key={week.id} className="flex flex-col rounded-3xl border border-gold/40 bg-paper p-4 shadow-sm">
            <div className="grid grid-cols-3 gap-2">
              {week.frames.map((frame) => (
                <figure key={frame.name} className="overflow-hidden rounded-2xl">
                  <img src={frame.src} alt={`${week.title} ${frame.name}: ${frame.note}`} className="aspect-[3/4] w-full object-cover" />
                  <figcaption className="px-1 py-2 text-xs">
                    <span className="display block text-lg text-maroon-deep">{frame.name}</span>
                    <span className="text-muted">{frame.note}</span>
                  </figcaption>
                </figure>
              ))}
            </div>
            <div className="mt-3 flex items-baseline justify-between gap-3 px-1">
              <h2 className="display text-4xl text-maroon-deep">{week.title}</h2>
              <p className="text-xs uppercase tracking-[0.16em] text-gold">{week.kicker}</p>
            </div>
            <p className="mt-2 flex-1 px-1 text-sm text-muted">{week.copy}</p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button type="button" className="flex-1 rounded-full bg-maroon px-4 py-3 text-ivory" onClick={() => tryLive(week.id)}>
                {week.live}
              </button>
              <button type="button" className="flex-1 rounded-full border border-gold px-4 py-3" onClick={() => void openDemo(week.id, "/looks")}>
                {week.demo}
              </button>
            </div>
          </article>
        ))}
      </section>

      <p className="text-sm text-muted">
        A guest week is lighter.{" "}
        <button type="button" className="underline decoration-gold underline-offset-4" onClick={() => void openDemo("guest", "/studio")}>
          Watch the guest demo
        </button>
        {" · "}
        <button type="button" className="underline decoration-gold underline-offset-4" onClick={() => tryLive("guest")}>
          Try with your own photo as a guest
        </button>
      </p>

      <section>
        <h2 className="display text-4xl text-maroon-deep">How the week is built</h2>
        <ol className="mt-6 grid gap-4 md:grid-cols-5">
          {[
            ["1", "Skin analysis", "Seven standard concerns on a face crop."],
            ["2", "Color tones", "Skin, lip, eye, and brow. Not the hair name."],
            ["3", "Clothes VTO", "Upper body on a chest-up photo. Full garment when the photo is full length."],
            ["4", "Makeup VTO", "Once for a groom. Once per look for a bride, on the outfit."],
            ["5", "Skin goal", "A subtle simulation, zoomed to the eyes."],
          ].map(([n, title, copy]) => (
            <li key={n} className="rounded-3xl border border-gold/25 bg-paper p-4">
              <span className="display text-3xl text-gold">{n}</span>
              <h3 className="mt-2 text-lg">{title}</h3>
              <p className="mt-1 text-sm text-muted">{copy}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="rounded-3xl bg-maroon-deep px-6 py-8 text-ivory md:px-10">
        <h2 className="display text-4xl">A preview, not a fitting.</h2>
        <p className="mt-3 max-w-2xl text-ivory/80">
          Live try-on is open through 20 November. The demo weeks spend nothing.
        </p>
        <Link href="/boutiques" className="mt-5 inline-block rounded-full bg-gold-bright px-5 py-2 text-maroon-deep">For boutiques</Link>
      </section>
    </div>
  );
}

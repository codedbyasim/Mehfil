"use client";

import { useSession } from "@/components/session";
import Link from "next/link";
import { useRouter } from "next/navigation";

const HERO = [
  { src: "/demo/groom/tryon/cloth_mehndi_kurta_mustard.jpg", name: "Mehndi", urdu: "مہندی", note: "Mustard kurta" },
  { src: "/demo/groom/makeup/orderB_makeup_then_cloth_baraat.jpg", name: "Baraat", urdu: "بارات", note: "Ivory sherwani" },
  { src: "/demo/groom/tryon/cloth_walima_princecoat_navy.jpg", name: "Walima", urdu: "ولیمہ", note: "Navy prince coat" },
];

export default function HomePage() {
  const { loadDemo, startLive } = useSession();
  const router = useRouter();

  async function openDemo(id: string, href: string) {
    await loadDemo(id);
    router.push(href);
  }

  return (
    <div className="space-y-16">
      <section className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="rise">
          <p className="text-xs uppercase tracking-[0.28em] text-gold">South Asian wedding week</p>
          <h1 className="display mt-3 text-5xl leading-[0.95] text-maroon-deep md:text-7xl">
            Three functions.<br />One face.
          </h1>
          <p className="urdu mt-3 text-2xl text-gold">محفل</p>
          <p className="mt-5 max-w-xl text-lg text-muted">
            MEHFIL puts Mehndi, Baraat, and Walima on the same portrait. An agent matches grooming to the outfit and the measured skin, then shows an honest event-day skin goal.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <button type="button" className="rounded-full bg-maroon px-6 py-3 text-ivory" onClick={() => void openDemo("groom", "/looks")}>
              Open the groom week
            </button>
            <button
              type="button"
              className="rounded-full border border-gold px-6 py-3"
              onClick={() => {
                startLive("groom");
                router.push("/capture");
              }}
            >
              Use my photo
            </button>
          </div>
          <dl className="mt-8 grid grid-cols-3 gap-3 text-sm">
            {[
              ["89", "overall score"],
              ["63", "dark circles"],
              ["#805E46", "skin hex"],
            ].map(([value, label]) => (
              <div key={label} className="rounded-2xl border border-gold/30 bg-paper px-3 py-3">
                <dt className="display text-2xl text-maroon">{value}</dt>
                <dd className="text-muted">{label}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-muted">From the consented live groom run. Hair color from the analyzer is hidden.</p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {HERO.map((card, index) => (
            <figure key={card.name} className="rise overflow-hidden rounded-3xl border border-gold/40 bg-paper shadow-sm" style={{ animationDelay: `${index * 80}ms` }}>
              <img src={card.src} alt={`${card.name}: ${card.note}`} className="aspect-[3/4] w-full object-cover" />
              <figcaption className="px-3 py-3">
                <span className="display block text-xl text-maroon-deep">{card.name}</span>
                <span className="urdu text-sm text-gold">{card.urdu}</span>
                <span className="mt-1 block text-xs text-muted">{card.note}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section>
        <h2 className="display text-4xl text-maroon-deep">How the week is built</h2>
        <ol className="mt-6 grid gap-4 md:grid-cols-5">
          {[
            ["1", "Skin analysis", "Seven standard concerns on a face crop."],
            ["2", "Color tones", "Skin, lip, eye, and brow. Not the hair name."],
            ["3", "Clothes VTO", "Each outfit, upper body on a chest-up photo."],
            ["4", "Makeup VTO", "Once for a groom. Once per look for a bride."],
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

      <section className="grid gap-4 md:grid-cols-3">
        {[
          ["groom", "Groom", "Live YouCam images. The face is Muhammad Asim, used with consent.", false],
          ["bride", "Bride", "Placeholder art and fixture scores, so the path is visible before a live bride run.", true],
          ["guest", "Guest", "A lighter week. Placeholder art, clearly marked.", true],
        ].map(([id, title, copy, placeholder]) => (
          <article key={String(id)} className="flex flex-col rounded-3xl border border-gold/30 bg-paper p-5">
            <h3 className="display text-3xl text-maroon-deep">{title}</h3>
            {placeholder ? <p className="mt-2 text-xs uppercase tracking-[0.16em] text-gold">Placeholder</p> : <p className="mt-2 text-xs uppercase tracking-[0.16em] text-maroon">Live demo</p>}
            <p className="mt-3 flex-1 text-sm text-muted">{copy}</p>
            <button type="button" className="mt-5 rounded-full border border-maroon/30 px-4 py-2 text-left" onClick={() => void openDemo(String(id), "/studio")}>
              Watch the stylist
            </button>
          </article>
        ))}
      </section>

      <section className="rounded-3xl bg-maroon-deep px-6 py-8 text-ivory md:px-10">
        <h2 className="display text-4xl">A preview, not a fitting.</h2>
        <p className="mt-3 max-w-2xl text-ivory/80">
          Cross-border wedding clothes are hard to return. MEHFIL shows the outfit and the grooming on one face, and it says when a score is already fine. Boutiques can read the short note.
        </p>
        <Link href="/boutiques" className="mt-5 inline-block rounded-full bg-gold-bright px-5 py-2 text-maroon-deep">For boutiques</Link>
      </section>
    </div>
  );
}

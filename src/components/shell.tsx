"use client";

import { useSession } from "@/components/session";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  ["/capture", "Photo"],
  ["/setup", "Week"],
  ["/outfits", "Outfits"],
  ["/studio", "Stylist"],
  ["/looks", "Looks"],
  ["/skin", "Skin"],
  ["/shades", "Shades"],
  ["/lookbook", "Look book"],
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { session } = useSession();
  const units = session?.unitsCharged ?? 0;
  const liveEstimate = session?.plan?.unitsIfLive;

  return (
    <div className="relative min-h-screen">
      <header className="no-print sticky top-0 z-30 border-b border-gold/25 bg-ivory/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 md:px-6">
          <Link href="/" className="shrink-0">
            <span className="display block text-2xl leading-none text-maroon-deep">MEHFIL</span>
            <span className="urdu text-xs text-gold">محفل</span>
          </Link>
          <nav className="flex flex-1 gap-1 overflow-x-auto text-sm text-muted" aria-label="Steps">
            {LINKS.map(([href, label]) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`shrink-0 rounded-full px-3 py-1.5 ${active ? "bg-maroon text-ivory" : "hover:bg-paper"}`}
                  aria-current={active ? "page" : undefined}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
          <p className="hidden shrink-0 text-right text-xs text-muted sm:block">
            <span className="block font-medium text-ink">{units} units used</span>
            <span>{session?.mode === "live" ? "Live" : "Demo"}{liveEstimate ? ` · live week ${liveEstimate}` : ""}</span>
          </p>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-12">{children}</main>
      <footer className="no-print border-t border-gold/20 px-4 py-8 text-sm text-muted">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <p>Cosmetic preview only. No account. Photos stay in this browser.</p>
          <p className="flex gap-4">
            <Link href="/privacy" className="underline decoration-gold/60 underline-offset-4">Privacy</Link>
            <Link href="/boutiques" className="underline decoration-gold/60 underline-offset-4">For boutiques</Link>
          </p>
        </div>
      </footer>
    </div>
  );
}

export function EmptyWeek({ title }: { title: string }) {
  const { loadDemo } = useSession();
  return (
    <section className="rise rounded-3xl border border-gold/30 bg-paper p-8 shadow-sm">
      <h1 className="display text-4xl text-maroon-deep">{title}</h1>
      <p className="mt-3 max-w-xl text-muted">Open a week to see this screen with a plan, or start from your own photo.</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/" className="rounded-full bg-maroon px-5 py-3 text-ivory">Back to the start</Link>
        <button type="button" className="rounded-full border border-gold px-5 py-3" onClick={() => void loadDemo("groom")}>
          Load the groom demo
        </button>
      </div>
    </section>
  );
}

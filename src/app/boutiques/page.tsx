import Link from "next/link";

export default function BoutiquesPage() {
  return (
    <article className="max-w-3xl space-y-5">
      <p className="text-xs uppercase tracking-[0.22em] text-gold">Boutiques</p>
      <h1 className="display text-5xl text-maroon-deep">Show the week, not a flat product photo.</h1>
      <p className="text-lg text-muted">
        A bride in another city buys a sherwani or a lehenga from a photo, then discovers the makeup and the cloth do not belong together. Returns across a border are slow, expensive, or simply refused.
      </p>
      <p>
        MEHFIL is the week on the shopper’s own face: three functions, grooming matched to the garment color and the measured skin, and a skin goal that does not pretend a score will vanish. The label on every result is the same: this is a preview, not a fit guarantee and not a diagnosis.
      </p>
      <p>
        A shop can hand over a product image. The shopper brings one portrait. The chain is Clothes VTO and Makeup VTO, in the order the role needs. Failed tasks do not spend units. The demo spends none.
      </p>
      <Link href="/" className="inline-block rounded-full bg-maroon px-5 py-3 text-ivory">See the groom week</Link>
    </article>
  );
}

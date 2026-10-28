"use client";

import { useState } from "react";

export function Compare({
  before,
  after,
  beforeLabel = "Before",
  afterLabel = "After",
  focus,
  alt,
}: {
  before: string;
  after: string;
  beforeLabel?: string;
  afterLabel?: string;
  focus?: { x: number; y: number; scale: number };
  alt: string;
}) {
  const [pos, setPos] = useState(58);
  const transform = focus ? `scale(${focus.scale})` : undefined;
  const origin = focus ? `${focus.x}% ${focus.y}%` : undefined;

  return (
    <figure className="overflow-hidden rounded-3xl border border-gold/30 bg-maroon-deep shadow-sm">
      <div className="relative aspect-[4/5] w-full">
        <img
          src={before}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          style={{ transform, transformOrigin: origin }}
        />
        <img
          src={after}
          alt={alt}
          className="absolute inset-0 h-full w-full object-cover"
          style={{ clipPath: `inset(0 0 0 ${pos}%)`, transform, transformOrigin: origin }}
        />
        <div className="pointer-events-none absolute inset-y-0 w-px bg-gold-bright" style={{ left: `${pos}%` }} />
        <label className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-maroon-deep/80 to-transparent p-4 text-ivory">
          <span className="mb-2 flex justify-between text-xs uppercase tracking-[0.18em]">
            <span>{beforeLabel}</span>
            <span>{afterLabel}</span>
          </span>
          <input
            className="w-full accent-gold-bright"
            type="range"
            min={0}
            max={100}
            value={pos}
            aria-label="Drag to compare before and after"
            onChange={(event) => setPos(Number(event.target.value))}
          />
        </label>
      </div>
    </figure>
  );
}

export type Rgb = { r: number; g: number; b: number };
export type Lab = { l: number; a: number; b: number };
export type Hsl = { h: number; s: number; l: number };

const HEX = /^#?([0-9a-f]{6})$/i;

export function normalizeHex(input: string | null | undefined): string | null {
  if (!input) return null;
  const match = HEX.exec(input.trim());
  if (!match) return null;
  return `#${match[1].toUpperCase()}`;
}

export function hexToRgb(hex: string): Rgb {
  const clean = normalizeHex(hex);
  if (!clean) throw new Error("bad hex");
  return {
    r: parseInt(clean.slice(1, 3), 16),
    g: parseInt(clean.slice(3, 5), 16),
    b: parseInt(clean.slice(5, 7), 16),
  };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`.toUpperCase();
}

function srgbToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function pivot(t: number): number {
  const delta = 6 / 29;
  return t > delta ** 3 ? Math.cbrt(t) : t / (3 * delta * delta) + 4 / 29;
}

/** sRGB to CIE Lab (D65). */
export function rgbToLab(rgb: Rgb): Lab {
  const r = srgbToLinear(rgb.r);
  const g = srgbToLinear(rgb.g);
  const b = srgbToLinear(rgb.b);
  const x = pivot((0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047);
  const y = pivot(0.2126729 * r + 0.7151522 * g + 0.072175 * b);
  const z = pivot((0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883);
  return {
    l: 116 * y - 16,
    a: 500 * (x - y),
    b: 200 * (y - z),
  };
}

export function hexToLab(hex: string): Lab {
  return rgbToLab(hexToRgb(hex));
}

/** Individual Typology Angle in degrees. Unstable when b* is near zero. */
export function itaDegrees(lab: Lab): number {
  const denom = Math.abs(lab.b) < 0.01 ? (lab.b < 0 ? -0.01 : 0.01) : lab.b;
  return (Math.atan2(lab.l - 50, denom) * 180) / Math.PI;
}

export function itaBand(degrees: number): string {
  if (degrees > 55) return "very light";
  if (degrees > 41) return "light";
  if (degrees > 28) return "intermediate";
  if (degrees > 10) return "tan";
  if (degrees > -30) return "brown";
  return "dark";
}

export function undertoneFromLab(lab: Lab): "warm" | "cool" | "neutral" {
  if (lab.b >= 10 && lab.a > 1) return "warm";
  if (lab.b <= 6 || lab.a < 0) return "cool";
  return "neutral";
}

export function rgbToHsl(rgb: Rgb): Hsl {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return { h, s, l };
}

export function hexToHsl(hex: string): Hsl {
  return rgbToHsl(hexToRgb(hex));
}

export function hslToHex(h: number, s: number, l: number): string {
  const hue = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (hue < 60) [r, g, b] = [c, x, 0];
  else if (hue < 120) [r, g, b] = [x, c, 0];
  else if (hue < 180) [r, g, b] = [0, c, x];
  else if (hue < 240) [r, g, b] = [0, x, c];
  else if (hue < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}

export function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return Math.min(d, 360 - d);
}

/**
 * Awkward hues clash. Close hues and near-complements do not.
 * Very grey garments (ivory, black) are treated as neutral.
 */
export function colorsClash(lipHex: string, garmentHex: string): boolean {
  const garment = hexToHsl(garmentHex);
  const lip = hexToHsl(lipHex);
  if (garment.s < 0.18) return false;
  if (lip.s < 0.15) return false;
  const distance = hueDistance(lip.h, garment.h);
  if (distance <= 48) return false;
  if (distance >= 150) return false;
  return true;
}

export function mixHex(a: string, b: string, t: number): string {
  const from = hexToRgb(a);
  const to = hexToRgb(b);
  const mix = (x: number, y: number) => x + (y - x) * t;
  return rgbToHex(mix(from.r, to.r), mix(from.g, to.g), mix(from.b, to.b));
}

export function lightenHex(hex: string, amount: number): string {
  return mixHex(hex, "#FFFFFF", amount);
}

export function lipFromGarment(garmentHex: string, time: "day" | "evening" | "night", strong: boolean): string {
  const garment = hexToHsl(garmentHex);
  const hue = garment.s < 0.15 ? 8 : garment.h;
  const sat = strong ? (time === "night" ? 0.58 : time === "evening" ? 0.5 : 0.4) : 0.32;
  const light = strong ? (time === "night" ? 0.38 : 0.46) : 0.5;
  return hslToHex(hue, sat, light);
}

export type Pixel = { r: number; g: number; b: number; a: number };

/** Dominant non-background color. Buckets by hue and keeps the most saturated group. */
export function dominantFromPixels(pixels: Uint8ClampedArray | number[]): string {
  const buckets = new Map<number, { r: number; g: number; b: number; w: number }>();
  const data = pixels instanceof Uint8ClampedArray ? pixels : Uint8ClampedArray.from(pixels);
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a < 128) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (r > 242 && g > 242 && b > 242) continue;
    if (r < 12 && g < 12 && b < 12) continue;
    const hsl = rgbToHsl({ r, g, b });
    const key = hsl.s < 0.12 ? 999 : Math.round(hsl.h / 12);
    const weight = hsl.s * Math.max(0.15, 1 - Math.abs(hsl.l - 0.5) * 1.4);
    const prev = buckets.get(key) ?? { r: 0, g: 0, b: 0, w: 0 };
    prev.r += r * weight;
    prev.g += g * weight;
    prev.b += b * weight;
    prev.w += weight;
    buckets.set(key, prev);
  }
  let best: { r: number; g: number; b: number; w: number } | null = null;
  for (const bucket of buckets.values()) {
    if (!best || bucket.w > best.w) best = bucket;
  }
  if (!best || best.w <= 0) return "#C4A574";
  return rgbToHex(best.r / best.w, best.g / best.w, best.b / best.w);
}

export function luminanceStats(pixels: Uint8ClampedArray, stride = 16): { mean: number } {
  let sum = 0;
  let count = 0;
  const step = Math.max(4, stride);
  for (let i = 0; i + 2 < pixels.length; i += step) {
    sum += 0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2];
    count += 1;
  }
  return { mean: count ? sum / count : 0 };
}

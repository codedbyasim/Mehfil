import { normalizeHex } from "@/lib/color";
import type { Concern, NormalizedSkin, NormalizedTones, SkinTypeMap } from "@/lib/types";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function findOutput(value: unknown): Record<string, unknown>[] | null {
  const node = asRecord(value);
  if (!node) return null;
  if (Array.isArray(node.output)) return node.output.map((item) => asRecord(item)).filter(Boolean) as Record<string, unknown>[];
  if (Array.isArray(node.results)) return null;
  const results = asRecord(node.results);
  if (results && Array.isArray(results.output)) {
    return results.output.map((item) => asRecord(item)).filter(Boolean) as Record<string, unknown>[];
  }
  const data = asRecord(node.data);
  if (data) return findOutput(data.results ? { results: data.results } : data);
  return null;
}

function skinTypeLabel(item: Record<string, unknown>): string | null {
  for (const key of ["skin_type", "class", "label", "value", "output", "category"]) {
    const value = item[key];
    if (typeof value === "string" && value.trim() && !/^skin_type$/i.test(value)) return value.trim();
  }
  return null;
}

function assignRegion(map: SkinTypeMap, region: string, label: string | null) {
  if (!label) return;
  const key = region.toLowerCase();
  if (key.includes("t_zone") || key.includes("t-zone") || key === "t") map.tZone = label;
  else if (key.includes("u_zone") || key.includes("u-zone") || key === "u") map.uZone = label;
  else map.whole = label;
}

function emptySkin(): NormalizedSkin {
  return { overall: null, skinAge: null, concerns: [], skinType: {} };
}

export function normalizeSkin(input: unknown): NormalizedSkin {
  if (Array.isArray(input)) return normalizeSkin({ output: input });
  const skin = emptySkin();
  const output = findOutput(input);
  if (output) {
    for (const item of output) {
      const type = String(item.type ?? "");
      if (type === "all") {
        skin.overall = num(item.score ?? item.ui_score ?? item.raw_score);
      } else if (type === "skin_age") {
        skin.skinAge = num(item.score ?? item.ui_score ?? item.raw_score);
      } else if (type === "skin_type" || type === "hd_skin_type") {
        const region = String(item.region ?? item.zone ?? item.sub_type ?? item.area ?? "whole");
        assignRegion(skin.skinType, region, skinTypeLabel(item));
      } else if (type) {
        const raw = num(item.raw_score);
        const ui = num(item.ui_score);
        if (raw !== null || ui !== null) skin.concerns.push({ type, raw, ui });
      }
    }
  }

  const root = asRecord(input) ?? {};
  const friendly = asRecord(root.scores) ?? root;
  if (skin.overall === null) {
    const all = friendly.all;
    skin.overall = typeof all === "number" ? all : num(asRecord(all)?.score);
  }
  if (skin.skinAge === null) {
    const age = friendly.skin_age ?? friendly.skinAge;
    skin.skinAge = typeof age === "number" ? age : num(asRecord(age)?.score);
  }
  if (skin.concerns.length === 0 && Array.isArray(root.concerns)) {
    for (const item of root.concerns) {
      const record = asRecord(item);
      if (!record) continue;
      const type = String(record.type ?? "");
      if (!type || type === "skin_type") {
        if (type === "skin_type") {
          assignRegion(skin.skinType, "whole", typeof record.whole === "string" ? record.whole : skinTypeLabel(record));
          if (typeof record.t_zone === "string") skin.skinType.tZone = record.t_zone;
          if (typeof record.u_zone === "string") skin.skinType.uZone = record.u_zone;
        }
        continue;
      }
      skin.concerns.push({
        type,
        raw: num(record.raw_score ?? record.raw),
        ui: num(record.ui_score ?? record.ui),
      });
    }
  }
  const typeNode = asRecord(friendly.skin_type);
  if (typeNode) {
    if (!skin.skinType.whole && typeof typeNode.whole === "string") skin.skinType.whole = typeNode.whole;
    if (!skin.skinType.tZone && typeof typeNode.t_zone === "string") skin.skinType.tZone = typeNode.t_zone;
    if (!skin.skinType.uZone && typeof typeNode.u_zone === "string") skin.skinType.uZone = typeNode.u_zone;
  }
  return skin;
}

function findColor(value: unknown): Record<string, unknown> {
  const node = asRecord(value);
  if (!node) return {};
  if (typeof node.skin_color === "string") return node;
  if (node.color) return findColor(node.color);
  if (node.results) return findColor(node.results);
  if (node.data) return findColor(node.data);
  return {};
}

export function normalizeTones(input: unknown): NormalizedTones {
  const color = findColor(input);
  return {
    skinColor: normalizeHex(typeof color.skin_color === "string" ? color.skin_color : null),
    eyeColor: normalizeHex(typeof color.eye_color === "string" ? color.eye_color : null),
    eyeColorName: typeof color.eye_color_name === "string" ? color.eye_color_name : null,
    lipColor: normalizeHex(typeof color.lip_color === "string" ? color.lip_color : null),
    eyebrowColor: normalizeHex(typeof color.eyebrow_color === "string" ? color.eyebrow_color : null),
    hairColor: normalizeHex(typeof color.hair_color === "string" ? color.hair_color : null),
    hairColorName: typeof color.hair_color_name === "string" ? color.hair_color_name : null,
  };
}

/** Fields the skin page is allowed to show. Hair name is omitted on purpose. */
export function toneFactsForDisplay(tones: NormalizedTones) {
  return {
    skinColor: tones.skinColor,
    eyeColor: tones.eyeColor,
    eyeColorName: tones.eyeColorName,
    lipColor: tones.lipColor,
    eyebrowColor: tones.eyebrowColor,
  };
}

export function concern(skin: NormalizedSkin, type: string): Concern | undefined {
  return skin.concerns.find((item) => item.type === type);
}

export function skinTypeLabelText(map: SkinTypeMap): string {
  const parts = [
    map.whole ? map.whole : null,
    map.tZone ? `T-zone ${map.tZone}` : null,
    map.uZone ? `U-zone ${map.uZone}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "not returned";
}

/**
 * Analysis names differ from simulation fields.
 * oiliness is intentionally absent: the published scale adds shine at 1.0.
 */
export const SIM_FIELD_BY_CONCERN: Record<string, string> = {
  dark_circle_v2: "dark_circle",
  pore: "pores",
  age_spot: "spots",
  eye_bag: "eye_bags",
  texture: "texture",
  acne: "acne",
  redness: "redness",
  wrinkle: "wrinkle",
  radiance: "radiance",
};

export function simulationFromSkin(skin: NormalizedSkin, maxFields = 4): Record<string, number> {
  const ranked = skin.concerns
    .map((item) => ({ item, field: SIM_FIELD_BY_CONCERN[item.type] }))
    .filter((item): item is { item: Concern; field: string } => Boolean(item.field) && item.item.raw !== null)
    .sort((a, b) => (a.item.raw as number) - (b.item.raw as number));

  const intensities: Record<string, number> = {};
  for (const entry of ranked) {
    if (Object.keys(intensities).length >= maxFields) break;
    const raw = entry.item.raw as number;
    if (raw >= 85 && Object.keys(intensities).length > 0) continue;
    const span = (100 - raw) / 100;
    const intensity = Math.round(Math.min(0.55, Math.max(0.15, span * 0.75)) * 100) / 100;
    intensities[entry.field] = intensity;
  }
  if (Object.keys(intensities).length === 0 && ranked[0]) {
    intensities[ranked[0].field] = 0.2;
  }
  return intensities;
}

export function positiveSimFields(fields: Record<string, number>): number {
  return Object.values(fields).filter((value) => value > 0).length;
}

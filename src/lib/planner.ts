import { bannedClaimHits, unsourcedNumbers } from "@/lib/claims";
import {
  colorsClash,
  hexToHsl,
  hexToLab,
  itaBand,
  itaDegrees,
  lightenHex,
  lipFromGarment,
  mixHex,
  normalizeHex,
  undertoneFromLab,
} from "@/lib/color";
import { concern, positiveSimFields, simulationFromSkin, skinTypeLabelText } from "@/lib/skin";
import type {
  GarmentCategory,
  LookPlan,
  MakeupEffect,
  PlanEvent,
  PlanInput,
  Presentation,
  Role,
  TimeOfDay,
  TraceStep,
  VtoOrder,
  WeddingPlan,
} from "@/lib/types";
import {
  CLOTH_V4_UNITS,
  estimateLiveUnits,
  FACE_TONE_UNITS,
  MAKEUP_VTO_UNITS,
  skinAnalysisCost,
  skinSimulationCost,
} from "@/lib/units";

export function chooseOrder(role: Role, presentation: Presentation): { order: VtoOrder; reason: string } {
  if (role === "groom" || (role === "guest" && presentation === "man")) {
    return {
      order: "makeup-first",
      reason:
        "One grooming look is shared across the week, so makeup runs once and each outfit follows. A separate makeup for every function costs more and is reserved for looks that change with the clothes.",
    };
  }
  return {
    order: "cloth-first",
    reason:
      "Each function gets its own makeup on the finished outfit. In the live test that order kept more real skin detail than dressing a face that had already been retouched.",
  };
}

export function resolveGarmentCategory(
  framing: "chest-up" | "full-body",
  suggested: GarmentCategory,
): GarmentCategory {
  if (framing === "chest-up") return "upper_body";
  return suggested;
}

function shown(value: number): number {
  return Math.round(value);
}

function naturalLipRole(role: Role, presentation: Presentation): boolean {
  return role === "groom" || (role === "guest" && presentation === "man");
}

function finishFor(oilinessRaw: number | null): "matte" | "satin" {
  if (oilinessRaw !== null && oilinessRaw < 72) return "matte";
  return "satin";
}

function proposeLip(input: PlanInput, event: PlanEvent, measuredLip: string): string {
  if (input.debugForceLipHex && normalizeHex(input.debugForceLipHex)) {
    return normalizeHex(input.debugForceLipHex) as string;
  }
  const strong = !naturalLipRole(input.role, input.presentation);
  if (!strong) return measuredLip;
  return lipFromGarment(event.garmentHex, event.timeOfDay, true);
}

function fallbackLip(input: PlanInput, event: PlanEvent, measuredLip: string): string {
  if (naturalLipRole(input.role, input.presentation)) return measuredLip;
  return lipFromGarment(event.garmentHex, event.timeOfDay, true);
}

function intensity(base: number, time: TimeOfDay, role: Role): number {
  const boost = time === "night" ? 14 : time === "evening" ? 8 : 0;
  const scale = role === "bride" ? 1 : role === "guest" ? 0.72 : 0.45;
  return Math.max(8, Math.min(88, Math.round(base * scale + boost * (role === "groom" ? 0.25 : 1))));
}

function buildEffects(input: PlanInput, event: PlanEvent, lipHex: string, finish: "matte" | "satin"): MakeupEffect[] {
  const skinHex = input.tones.skinColor ?? "#C4A484";
  const natural = naturalLipRole(input.role, input.presentation);
  const dark = concern(input.skin, "dark_circle_v2");
  const underEye = dark?.raw !== null && dark?.raw !== undefined && dark.raw < 80;
  const smooth = natural ? 22 : input.role === "bride" ? 42 : 32;
  const effects: MakeupEffect[] = [
    {
      category: "skin_smooth",
      skinSmoothStrength: smooth,
      skinSmoothColorIntensity: natural ? 14 : 30,
    },
    {
      category: "foundation",
      palettes: [
        {
          color: skinHex,
          colorIntensity: natural ? 14 : finish === "matte" ? 48 : 40,
          glowIntensity: finish === "matte" ? 12 : natural ? 16 : 36,
          coverageIntensity: natural ? 18 : 34,
        },
      ],
    },
  ];
  if (underEye || natural) {
    effects.push({
      category: "concealer",
      palettes: [
        {
          color: lightenHex(skinHex, 0.16),
          colorIntensity: natural ? 16 : 28,
          colorUnderEyeIntensity: underEye ? 46 : 22,
          coverageLevel: underEye ? 36 : 20,
        },
      ],
    });
  }
  if (!natural) {
    const blush = mixHex(event.garmentHex, "#C47A74", 0.45);
    effects.push({
      category: "blush",
      pattern: { name: "1color1" },
      palettes: [
        {
          color: blush,
          texture: "matte",
          colorIntensity: intensity(36, event.timeOfDay, input.role),
        },
      ],
    });
    effects.push({
      category: "eye_shadow",
      pattern: { name: "1color1" },
      palettes: [
        {
          color: mixHex(event.garmentHex, "#3A241C", 0.35),
          texture: "matte",
          colorIntensity: intensity(30, event.timeOfDay, input.role),
        },
      ],
    });
  }
  effects.push({
    category: "lip_color",
    shape: { name: "original" },
    style: { type: "full" },
    palettes: [
      {
        color: lipHex,
        texture: "matte",
        colorIntensity: natural ? 18 : intensity(58, event.timeOfDay, input.role),
      },
    ],
  });
  return effects;
}

function shadeName(hex: string, kind: "lip" | "veil" | "under-eye"): string {
  if (kind === "veil") return "Sheer skin-matched veil";
  if (kind === "under-eye") return "Under-eye softener";
  const { h, s } = hexToHsl(hex);
  if (s < 0.12) return "Sheer nude lip tint";
  if (h < 20 || h >= 340) return "Natural rose lip tint";
  if (h < 50) return "Warm coral lip";
  if (h < 75) return "Soft marigold lip";
  if (h < 170) return "Muted olive lip";
  return "Deep berry lip";
}

function whyFor(input: PlanInput, event: PlanEvent, lipHex: string, finish: "matte" | "satin", replanned: boolean): string {
  const dark = concern(input.skin, "dark_circle_v2");
  const oily = concern(input.skin, "oiliness");
  const redness = concern(input.skin, "redness");
  const sentences: string[] = [];
  sentences.push(`${event.garmentName} for ${event.name}, marked ${event.timeOfDay}.`);
  if (naturalLipRole(input.role, input.presentation)) {
    sentences.push("The lip stays near the measured lip color so grooming does not chase the clothes.");
  } else {
    sentences.push("The lip follows the garment so the function reads as one look.");
  }
  if (replanned) sentences.push("The first lip clashed, so it was corrected once.");
  if (dark?.ui !== null && dark?.ui !== undefined && dark.raw !== null) {
    sentences.push(
      `Dark circles are the score that asks for the under-eye softener, display ${shown(dark.ui)}, raw ${shown(dark.raw)}.`,
    );
  }
  if (input.skin.overall !== null) sentences.push(`Overall score ${shown(input.skin.overall)}.`);
  if (input.skin.skinAge !== null) sentences.push(`YouCam skin age score ${shown(input.skin.skinAge)}.`);
  if (oily?.raw !== null && oily?.raw !== undefined) {
    sentences.push(
      finish === "matte"
        ? `Oiliness raw ${shown(oily.raw)} keeps the veil matte.`
        : `Oiliness raw ${shown(oily.raw)} leaves the veil sheer.`,
    );
  }
  if (!naturalLipRole(input.role, input.presentation) && redness?.raw !== null && redness?.raw !== undefined && redness.raw < 80) {
    sentences.push(`Redness raw ${shown(redness.raw)} keeps the cheek soft.`);
  }
  if (input.placeholder) sentences.push("These scores are placeholder fixtures, not a live scan.");
  sentences.push(`Lip color ${lipHex}.`);
  return sentences.join(" ");
}

function simulationNote(input: PlanInput, intensities: Record<string, number>, source: "recorded" | "planner"): string {
  const dark = concern(input.skin, "dark_circle_v2");
  const lead =
    dark?.ui !== null && dark?.ui !== undefined
      ? `Dark circles are the concern to watch, display ${shown(dark.ui)}.`
      : "The preview follows the weakest returned scores.";
  if (source === "recorded") {
    const parts = Object.entries(intensities)
      .map(([key, value]) => `${key.replaceAll("_", " ")} ${value}`)
      .join(", ");
    return `${lead} This preview is the recorded Skin Simulation render: ${parts}. The change is subtle and sits mostly under the eyes. It is a cosmetic preview, not a promise.`;
  }
  const parts = Object.entries(intensities)
    .map(([key, value]) => `${key.replaceAll("_", " ")} ${value}`)
    .join(", ");
  return `${lead} Skin Simulation fields: ${parts}. Oiliness is left unset because that scale adds shine. Cosmetic preview only.`;
}

function checklist(input: PlanInput): WeddingPlan["checklist"] {
  const first = input.events.slice().sort((a, b) => a.date.localeCompare(b.date))[0];
  const name = first?.name ?? "the first function";
  const dark = concern(input.skin, "dark_circle_v2");
  const darkLine =
    dark?.ui !== null && dark?.ui !== undefined
      ? `Under-eyes are the one place the scores ask for care, display ${shown(dark.ui)}.`
      : "Keep the routine the face already knows.";
  return [
    {
      id: "today",
      when: "Today",
      text: `${darkLine} Do not start a new product this week.`,
    },
    {
      id: "week",
      when: "This week",
      text: "Sleep, and a cool compress in the morning, is the whole under-eye prep. Steam the outfits. No new actives.",
    },
    {
      id: "morning",
      when: `Morning of ${name}`,
      text: "Use the sheer veil and the under-eye softener from the shade list. Blot only if the skin feels shiny.",
    },
  ];
}

function buildTrace(input: PlanInput, order: VtoOrder, looks: LookPlan[], simFields: number, replanned: boolean): TraceStep[] {
  const steps: TraceStep[] = [
    {
      id: "quality",
      title: "Photo check",
      detail: "Format, size, brightness, and a single front-facing face are checked in the browser before any paid call.",
      units: 0,
    },
    {
      id: "crop",
      title: "Face crop",
      detail:
        "Skin analysis, color tones, and skin simulation use a crop where the face fills about sixty percent of the width. Outfit try-on keeps the full photo.",
      units: 0,
    },
    {
      id: "skin",
      title: "Skin analysis",
      detail: "Standard quality, seven concerns: oiliness, redness, dark circles, texture, pores, acne, and skin type.",
      api: "POST /s2s/v2.0/task/skin-analysis",
      units: skinAnalysisCost(7),
    },
    {
      id: "tone",
      title: "Color tones",
      detail: "Skin, lip, eye, and brow colors. The hair color name is ignored.",
      api: "POST /s2s/v2.0/task/skin-tone-analysis",
      units: FACE_TONE_UNITS,
    },
    {
      id: "order",
      title: order === "makeup-first" ? "Shared grooming, then outfits" : "Outfit first, then makeup",
      detail: chooseOrder(input.role, input.presentation).reason,
      units: 0,
    },
  ];
  if (order === "makeup-first") {
    steps.push({
      id: "makeup",
      title: "Makeup VTO, once",
      detail: "One grooming recipe, with skin smooth set explicitly so it does not fall back to the engine default.",
      api: "POST /s2s/v2.0/task/makeup-vto",
      units: MAKEUP_VTO_UNITS,
    });
    for (const look of looks) {
      steps.push({
        id: `cloth-${look.eventId}`,
        title: `${look.name} outfit`,
        detail: `${look.garmentName}, category ${look.garmentCategory.replaceAll("_", " ")}. The grooming result is uploaded as a new file and used as the source.`,
        api: "POST /s2s/v2.0/task/cloth-v4",
        units: CLOTH_V4_UNITS,
      });
    }
  } else {
    for (const look of looks) {
      steps.push({
        id: `cloth-${look.eventId}`,
        title: `${look.name} outfit`,
        detail: `${look.garmentName}, category ${look.garmentCategory.replaceAll("_", " ")}.`,
        api: "POST /s2s/v2.0/task/cloth-v4",
        units: CLOTH_V4_UNITS,
      });
      steps.push({
        id: `makeup-${look.eventId}`,
        title: `${look.name} makeup`,
        detail: "Makeup runs on the try-on. That result is uploaded as a new file first.",
        api: "POST /s2s/v2.0/task/makeup-vto",
        units: MAKEUP_VTO_UNITS,
      });
    }
  }
  steps.push({
    id: "critique",
    title: replanned ? "Color check, corrected once" : "Color check",
    detail: replanned
      ? "A lip clashed with its garment. The stylist corrected that look once and stopped."
      : "Lip and garment hues sit in a comfortable range. No second pass.",
    units: 0,
  });
  steps.push({
    id: "sim",
    title: "Event-day skin preview",
    detail: "Skin simulation on the face crop. The slider is zoomed to the eyes because the change is subtle.",
    api: "POST /s2s/v2.0/task/skin-simulation",
    units: skinSimulationCost(simFields),
  });
  return steps;
}

export function allowedNumbers(input: PlanInput, extraHexes: string[] = []): number[] {
  const values: number[] = [];
  const push = (value: number | null | undefined) => {
    if (value === null || value === undefined || !Number.isFinite(value)) return;
    values.push(value, Math.round(value), Math.round(value * 10) / 10, Math.round(value * 100) / 100);
  };
  push(input.skin.overall);
  push(input.skin.skinAge);
  for (const item of input.skin.concerns) {
    push(item.raw);
    push(item.ui);
  }
  if (input.tones.skinColor) {
    push(itaDegrees(hexToLab(input.tones.skinColor)));
  }
  const hexes = [
    input.tones.skinColor,
    input.tones.lipColor,
    input.tones.eyeColor,
    input.tones.eyebrowColor,
    ...input.events.map((event) => event.garmentHex),
    ...extraHexes,
  ].filter((hex): hex is string => Boolean(hex));
  for (const hex of hexes) push(Math.round(hexToHsl(hex).h));
  if (input.recordedSimulation) {
    for (const value of Object.values(input.recordedSimulation)) push(value);
  }
  const recommended = simulationFromSkin(input.skin);
  for (const value of Object.values(recommended)) push(value);
  return values;
}

export function planProse(plan: WeddingPlan): string {
  return [
    plan.orderReason,
    plan.simulation.note,
    plan.profile.skinTypeLabel,
    plan.disclaimer,
    ...plan.looks.map((look) => look.why),
    ...plan.shades.flatMap((shade) => [shade.name, shade.note]),
    ...plan.checklist.map((item) => `${item.when} ${item.text}`),
    ...plan.trace.flatMap((step) => [step.title, step.detail]),
  ].join("\n");
}

export function planWedding(input: PlanInput): WeddingPlan {
  const choice = chooseOrder(input.role, input.presentation);
  const measuredLip = input.tones.lipColor ?? "#A56A66";
  const skinHex = input.tones.skinColor;
  const lab = skinHex ? hexToLab(skinHex) : null;
  const ita = lab ? itaDegrees(lab) : null;
  const oil = concern(input.skin, "oiliness");
  const finish = finishFor(oil?.raw ?? null);
  const replannedIds: string[] = [];
  const looks: LookPlan[] = input.events.map((event) => {
    const category = resolveGarmentCategory(input.framing, event.garmentCategory);
    const proposed = proposeLip(input, event, measuredLip);
    const natural = naturalLipRole(input.role, input.presentation);
    const clash = natural
      ? normalizeHex(proposed) !== normalizeHex(measuredLip)
      : colorsClash(proposed, event.garmentHex);
    const lipHex = clash ? fallbackLip(input, event, measuredLip) : proposed;
    if (clash) replannedIds.push(event.id);
    const lookFinish = finish;
    return {
      eventId: event.id,
      name: event.name,
      date: event.date,
      timeOfDay: event.timeOfDay,
      venue: event.venue,
      outfitId: event.outfitId,
      garmentName: event.garmentName,
      garmentHex: event.garmentHex,
      garmentCategory: category,
      why: whyFor(input, { ...event, garmentCategory: category }, lipHex, lookFinish, clash),
      finish: lookFinish,
      lipHex,
      effects: buildEffects(input, event, lipHex, lookFinish),
      replanned: clash,
    };
  });
  const recorded = input.recordedSimulation && Object.keys(input.recordedSimulation).length > 0;
  const intensities = recorded ? { ...input.recordedSimulation } : simulationFromSkin(input.skin);
  const source = recorded ? "recorded" : "planner";
  const simCount = positiveSimFields(intensities as Record<string, number>);
  const trace = buildTrace(input, choice.order, looks, Math.max(1, simCount), replannedIds.length > 0);
  const shades = looks.flatMap((look) => {
    const items = [
      {
        id: `${look.eventId}-lip`,
        name: shadeName(look.lipHex, "lip"),
        hex: look.lipHex,
        note: `${look.name}. Generic description, not a brand.`,
        eventId: look.eventId,
      },
    ];
    if (skinHex) {
      items.push({
        id: `${look.eventId}-veil`,
        name: shadeName(skinHex, "veil"),
        hex: skinHex,
        note: "Matched to the measured skin hex.",
        eventId: look.eventId,
      });
    }
    return items;
  });
  if (skinHex && concern(input.skin, "dark_circle_v2")) {
    shades.push({
      id: "under-eye",
      name: shadeName(skinHex, "under-eye"),
      hex: lightenHex(skinHex, 0.16),
      note: "A little lighter than the measured skin hex, for the under-eye only.",
      eventId: looks[0]?.eventId ?? "week",
    });
  }
  const seen = new Set<string>();
  const uniqueShades = shades.filter((shade) => {
    const key = `${shade.name}|${shade.hex}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const plan: WeddingPlan = {
    source: "rules",
    vtoOrder: choice.order,
    orderReason: choice.reason,
    profile: {
      skinHex,
      lipHex: measuredLip,
      undertone: lab ? undertoneFromLab(lab) : "unknown",
      ita,
      itaBand: ita === null ? null : itaBand(ita),
      finish,
      skinTypeLabel: skinTypeLabelText(input.skin.skinType),
    },
    looks,
    simulation: {
      source,
      intensities: intensities as Record<string, number>,
      note: simulationNote(input, intensities as Record<string, number>, source),
    },
    shades: uniqueShades,
    checklist: checklist(input),
    trace,
    unitsCharged: 0,
    unitsIfLive: estimateLiveUnits({
      order: choice.order,
      events: looks.length,
      includeAnalysis: true,
      simulationFields: Math.max(1, simCount),
      makeupReplans: choice.order === "cloth-first" ? Math.min(1, replannedIds.length) : replannedIds.length > 0 ? 1 : 0,
      clothReplans: choice.order === "makeup-first" && replannedIds.length > 0 ? 1 : 0,
    }),
    critique: { replanned: replannedIds.length > 0, eventIds: replannedIds },
    disclaimer: "Cosmetic preview only. MEHFIL does not name a skin condition or promise a result.",
  };
  const allowed = allowedNumbers(input, looks.map((look) => look.lipHex));
  const prose = planProse(plan);
  const stray = unsourcedNumbers(prose, allowed);
  const banned = bannedClaimHits(prose);
  if (stray.length > 0 || banned.length > 0) {
    throw new Error(`planner citation check failed: numbers ${stray.join(",")} claims ${banned.join(",")}`);
  }
  return plan;
}

export function chainSteps(plan: WeddingPlan): { id: string; feature: string; eventId?: string }[] {
  const steps: { id: string; feature: string; eventId?: string }[] = [
    { id: "skin", feature: "skin-analysis" },
    { id: "tone", feature: "skin-tone-analysis" },
  ];
  if (plan.vtoOrder === "makeup-first") {
    steps.push({ id: "makeup", feature: "makeup-vto" });
    for (const look of plan.looks) steps.push({ id: `cloth-${look.eventId}`, feature: "cloth-v4", eventId: look.eventId });
  } else {
    for (const look of plan.looks) {
      steps.push({ id: `cloth-${look.eventId}`, feature: "cloth-v4", eventId: look.eventId });
      steps.push({ id: `makeup-${look.eventId}`, feature: "makeup-vto", eventId: look.eventId });
    }
  }
  steps.push({ id: "sim", feature: "skin-simulation" });
  return steps;
}

import type { GarmentCategory } from "@/lib/types";
import { CLOTH_V4_UNITS, FACE_TONE_UNITS, MAKEUP_VTO_UNITS, skinAnalysisCost, skinSimulationCost } from "@/lib/units";

export const SKIN_CONCERNS = [
  "oiliness",
  "redness",
  "dark_circle_v2",
  "texture",
  "pore",
  "acne",
  "skin_type",
] as const;

export const GARMENT_CATEGORIES: GarmentCategory[] = [
  "full_body",
  "lower_body",
  "upper_body",
  "shoes",
  "auto",
  "outer",
];

export const YOUCAM_FEATURES = [
  "skin-analysis",
  "skin-tone-analysis",
  "cloth-v4",
  "makeup-vto",
  "skin-simulation",
] as const;

export type YouCamFeature = (typeof YOUCAM_FEATURES)[number];

const SIM_KEYS = [
  "wrinkle",
  "radiance",
  "oiliness",
  "acne",
  "eye_bags",
  "dark_circle",
  "spots",
  "pores",
  "texture",
  "redness",
] as const;

export function skinAnalysisBody(fileId: string) {
  return {
    src_file_id: fileId,
    dst_actions: [...SKIN_CONCERNS],
    format: "json" as const,
    miniserver_args: { enable_mask_overlay: true },
  };
}

export function toneBody(fileId: string) {
  return {
    src_file_id: fileId,
    face_angle_strictness_level: "medium" as const,
  };
}

export function clothBody(input: {
  srcFileId?: string;
  srcFileUrl?: string;
  refFileId?: string;
  refFileUrl?: string;
  templateId?: string;
  garmentCategory: GarmentCategory;
  filterMultiPerson?: "off" | "normal" | "strict";
  changeShoes?: boolean;
}) {
  if (!GARMENT_CATEGORIES.includes(input.garmentCategory)) {
    throw new Error("invalid_garment_category");
  }
  const body: Record<string, unknown> = { garment_category: input.garmentCategory };
  if (input.srcFileId) body.src_file_id = input.srcFileId;
  else if (input.srcFileUrl) body.src_file_url = input.srcFileUrl;
  else throw new Error("missing_src");
  if (input.refFileId) body.ref_file_id = input.refFileId;
  else if (input.refFileUrl) body.ref_file_url = input.refFileUrl;
  else if (input.templateId) body.template_id = input.templateId;
  else throw new Error("missing_ref");
  if (input.filterMultiPerson) body.filter_multi_person = input.filterMultiPerson;
  if (typeof input.changeShoes === "boolean") body.change_shoes = input.changeShoes;
  return body;
}

export function makeupBody(fileId: string, effects: unknown[]) {
  if (!Array.isArray(effects) || effects.length === 0 || effects.length > 12) {
    throw new Error("invalid_effects");
  }
  const hasSmooth = effects.some((effect) => {
    const record = effect as { category?: string };
    return record.category === "skin_smooth";
  });
  if (!hasSmooth) throw new Error("skin_smooth_required");
  return { src_file_id: fileId, effects, version: "1.0" as const };
}

export function simulationBody(fileId: string, fields: Record<string, number>) {
  const body: Record<string, unknown> = { src_file_id: fileId };
  for (const key of SIM_KEYS) {
    const value = fields[key];
    if (typeof value === "number" && value > 0 && value <= 1) body[key] = value;
  }
  if (Object.keys(body).length < 2) throw new Error("simulation_empty");
  return body;
}

export function taskSpec(
  feature: string,
  input: Record<string, unknown>,
): { feature: YouCamFeature; path: string; body: Record<string, unknown>; units: number } {
  if (!YOUCAM_FEATURES.includes(feature as YouCamFeature)) throw new Error("unknown_feature");
  if (feature === "skin-analysis") {
    const fileId = String(input.fileId ?? "");
    if (!fileId) throw new Error("missing_file");
    return {
      feature,
      path: "/s2s/v2.0/task/skin-analysis",
      body: skinAnalysisBody(fileId),
      units: skinAnalysisCost(SKIN_CONCERNS.length),
    };
  }
  if (feature === "skin-tone-analysis") {
    const fileId = String(input.fileId ?? "");
    if (!fileId) throw new Error("missing_file");
    return {
      feature,
      path: "/s2s/v2.0/task/skin-tone-analysis",
      body: toneBody(fileId),
      units: FACE_TONE_UNITS,
    };
  }
  if (feature === "cloth-v4") {
    const body = clothBody({
      srcFileId: typeof input.srcFileId === "string" ? input.srcFileId : undefined,
      srcFileUrl: typeof input.srcFileUrl === "string" ? input.srcFileUrl : undefined,
      refFileId: typeof input.refFileId === "string" ? input.refFileId : undefined,
      refFileUrl: typeof input.refFileUrl === "string" ? input.refFileUrl : undefined,
      templateId: typeof input.templateId === "string" ? input.templateId : undefined,
      garmentCategory: input.garmentCategory as GarmentCategory,
      filterMultiPerson: input.filterMultiPerson as "off" | "normal" | "strict" | undefined,
      changeShoes: typeof input.changeShoes === "boolean" ? input.changeShoes : undefined,
    });
    return { feature, path: "/s2s/v2.0/task/cloth-v4", body, units: CLOTH_V4_UNITS };
  }
  if (feature === "makeup-vto") {
    const fileId = String(input.fileId ?? input.srcFileId ?? "");
    const body = makeupBody(fileId, (input.effects as unknown[]) ?? []);
    return { feature, path: "/s2s/v2.0/task/makeup-vto", body, units: MAKEUP_VTO_UNITS };
  }
  const fileId = String(input.fileId ?? "");
  const fields = (input.simulation as Record<string, number>) ?? {};
  const body = simulationBody(fileId, fields);
  const count = Object.keys(body).filter((key) => key !== "src_file_id").length;
  return {
    feature: "skin-simulation",
    path: "/s2s/v2.0/task/skin-simulation",
    body,
    units: skinSimulationCost(count),
  };
}

export const ERROR_HINTS: Record<string, string> = {
  error_no_face: "No face was found. Use a front-facing photo.",
  error_face_position_too_small: "The face is too small. MEHFIL crops it to about 60% of the width before skin calls.",
  error_multiple_people: "Use a photo with one person.",
  error_multi_person: "Use a photo with one person.",
  error_large_face_angle: "Look straight at the camera.",
  error_face_not_forward_facing: "Look straight at the camera.",
  error_no_shoulder: "Include both shoulders for the outfit try-on.",
  error_pose: "Face the camera, with shoulders in frame.",
  error_lighting_dark: "The photo is too dark. Face a window.",
  exceed_max_filesize: "That image is too large.",
  error_nsfw_content_detected: "That image was rejected by the content check.",
  CreditInsufficiency: "The YouCam account is out of units. MEHFIL will stay on the demo.",
  InvalidTaskId: "That task expired. Start the look again.",
  missing_api_key: "Live mode is off until a server key is set.",
};

import { outfitById } from "@/lib/outfits";
import { planWedding } from "@/lib/planner";
import { normalizeSkin, normalizeTones } from "@/lib/skin";
import type { PhotoFraming, PlanInput, Role, Session, SessionEvent, TimeOfDay, VtoOrder } from "@/lib/types";

export type DemoManifest = {
  id: string;
  title: string;
  placeholder: boolean;
  subject?: string;
  role: Role;
  presentation: "woman" | "man";
  framing: PhotoFraming;
  vtoOrder?: VtoOrder;
  selfie: string;
  faceCrop: string;
  simulationImage?: string;
  groomingImage?: string;
  eyeFocus?: { x: number; y: number; scale: number };
  simulation?: Record<string, number> | null;
  skin: unknown;
  tones: unknown;
  masks?: Record<string, string>;
  events: Array<{
    id: string;
    name: string;
    date: string;
    timeOfDay: TimeOfDay;
    venue?: string;
    outfitId: string;
    tryOnImage: string;
    beforeImage?: string;
    alternateTryOn?: string;
    alternateLabel?: string;
  }>;
  preferManifestPlan?: boolean;
  plan?: unknown;
};

export function manifestToInput(manifest: DemoManifest, today?: string): PlanInput {
  const events: SessionEvent[] = manifest.events.map((event) => {
    const outfit = outfitById(event.outfitId);
    if (!outfit) throw new Error(`unknown outfit ${event.outfitId}`);
    return {
      id: event.id,
      name: event.name,
      date: event.date,
      timeOfDay: event.timeOfDay,
      venue: event.venue,
      outfitId: outfit.id,
      garmentHex: outfit.dominant,
      garmentName: outfit.name,
      garmentCategory: outfit.suggestedCategory,
      tryOnImage: event.tryOnImage,
      beforeImage: event.beforeImage ?? manifest.selfie,
      alternateTryOn: event.alternateTryOn,
      alternateLabel: event.alternateLabel,
    };
  });
  return {
    role: manifest.role,
    presentation: manifest.presentation,
    framing: manifest.framing,
    skin: normalizeSkin(manifest.skin),
    tones: normalizeTones(manifest.tones),
    events,
    today,
    recordedSimulation: manifest.simulation ?? null,
    placeholder: manifest.placeholder,
  };
}

export function sessionFromManifest(manifest: DemoManifest, today?: string): Session {
  const input = manifestToInput(manifest, today);
  const plan = planWedding(input);
  const events = input.events.map((event, index) => {
    const raw = manifest.events[index];
    return {
      ...event,
      tryOnImage: raw.tryOnImage,
      beforeImage: raw.beforeImage ?? manifest.selfie,
      alternateTryOn: raw.alternateTryOn,
      alternateLabel: raw.alternateLabel,
    };
  });
  return {
    mode: "demo",
    scenarioId: manifest.id,
    placeholder: manifest.placeholder,
    subject: manifest.subject,
    role: manifest.role,
    presentation: manifest.presentation,
    consent: true,
    framing: manifest.framing,
    selfieUrl: manifest.selfie,
    faceCropUrl: manifest.faceCrop,
    simulationImage: manifest.simulationImage,
    groomingImage: manifest.groomingImage,
    masks: manifest.masks,
    eyeFocus: manifest.eyeFocus,
    events,
    plan,
    unitsCharged: 0,
    bag: [],
  };
}

export function isDemoManifest(value: unknown): value is DemoManifest {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<DemoManifest>;
  return typeof record.id === "string" && Array.isArray(record.events) && Boolean(record.skin) && Boolean(record.tones);
}

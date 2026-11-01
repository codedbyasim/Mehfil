import { normalizeHex } from "@/lib/color";
import { GARMENT_CATEGORIES } from "@/lib/payloads";
import { planWedding } from "@/lib/planner";
import { outfitById } from "@/lib/outfits";
import { normalizeSkin, normalizeTones } from "@/lib/skin";
import { maybeEnhancePlan } from "@/server/llm";
import type { GarmentCategory, PhotoFraming, PlanEvent, PlanInput, Presentation, Role, TimeOfDay } from "@/lib/types";
import { json } from "@/lib/http";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

function asRole(value: unknown): Role {
  return value === "bride" || value === "groom" || value === "guest" ? value : "groom";
}

function garmentLabel(value: unknown, outfitId: string): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed && trimmed !== "undefined" && trimmed !== "null") return trimmed;
  }
  return outfitById(outfitId)?.name ?? "the outfit";
}

function asEvent(value: unknown): PlanEvent | null {
  if (!value || typeof value !== "object") return null;
  const event = value as Partial<PlanEvent>;
  if (typeof event.id !== "string" || !event.id.trim() || typeof event.name !== "string" || !event.name.trim()) return null;
  const outfitId = typeof event.outfitId === "string" ? event.outfitId : "";
  const outfit = outfitById(outfitId);
  const hex = normalizeHex(typeof event.garmentHex === "string" ? event.garmentHex : null) ?? normalizeHex(outfit?.dominant) ?? null;
  if (!hex) return null;
  const suggested = outfit?.suggestedCategory ?? "upper_body";
  const category = GARMENT_CATEGORIES.includes(event.garmentCategory as GarmentCategory)
    ? (event.garmentCategory as GarmentCategory)
    : suggested;
  const time = event.timeOfDay;
  return {
    id: event.id.slice(0, 80),
    name: event.name.slice(0, 80),
    date: typeof event.date === "string" ? event.date : "",
    timeOfDay: (time === "day" || time === "evening" || time === "night" ? time : "evening") as TimeOfDay,
    venue: typeof event.venue === "string" ? event.venue : undefined,
    outfitId,
    garmentHex: hex,
    garmentName: garmentLabel(event.garmentName, outfitId),
    garmentCategory: category,
  };
}

export async function POST(request: Request) {
  let body: Partial<PlanInput> & { mode?: string };
  try {
    body = (await request.json()) as Partial<PlanInput> & { mode?: string };
  } catch {
    return json({ error: "bad_json" }, 400);
  }
  if (!body.skin || !body.tones || !Array.isArray(body.events) || body.events.length === 0) {
    return json({ error: "incomplete" }, 400);
  }
  const events: PlanEvent[] = [];
  for (const event of body.events) {
    const parsed = asEvent(event);
    if (!parsed) return json({ error: "incomplete" }, 400);
    events.push(parsed);
  }
  const input: PlanInput = {
    role: asRole(body.role),
    presentation: (body.presentation === "woman" ? "woman" : "man") as Presentation,
    framing: (body.framing === "full-body" ? "full-body" : "chest-up") as PhotoFraming,
    skin: normalizeSkin(body.skin),
    tones: normalizeTones(body.tones),
    events,
    today: typeof body.today === "string" ? body.today : undefined,
    recordedSimulation: body.recordedSimulation ?? null,
    placeholder: Boolean(body.placeholder),
  };
  try {
    const rules = planWedding(input);
    if (body.mode === "live") {
      const enhanced = await maybeEnhancePlan(input, rules);
      return json({ ...enhanced, unitsCharged: 0 });
    }
    return json(rules);
  } catch (error) {
    const message = error instanceof Error ? error.message : "plan_failed";
    return json({ error: message }, 422);
  }
}

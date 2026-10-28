import { hasBannedClaim, unsourcedNumbers } from "@/lib/claims";
import { allowedNumbers, planProse, planWedding } from "@/lib/planner";
import { normalizeHex } from "@/lib/color";
import { colorsClash } from "@/lib/color";
import type { PlanInput, WeddingPlan } from "@/lib/types";

export function parseJsonLoose(text: string): unknown {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fence ? fence[1] : trimmed;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("no_json");
  return JSON.parse(raw.slice(start, end + 1));
}

type LlmLook = { eventId?: string; lipHex?: string; why?: string };

export function mergeLlm(base: WeddingPlan, input: PlanInput, parsed: unknown): WeddingPlan | null {
  if (!parsed || typeof parsed !== "object") return null;
  const looks = (parsed as { looks?: LlmLook[] }).looks;
  if (!Array.isArray(looks)) return null;
  const next: WeddingPlan = {
    ...base,
    source: "llm",
    looks: base.looks.map((look) => {
      const suggestion = looks.find((item) => item.eventId === look.eventId);
      if (!suggestion) return look;
      const lip = normalizeHex(suggestion.lipHex ?? "");
      const why = typeof suggestion.why === "string" ? suggestion.why.trim() : "";
      let updated = look;
      if (lip && !colorsClash(lip, look.garmentHex)) {
        updated = {
          ...updated,
          lipHex: lip,
          effects: updated.effects.map((effect) => {
            if (effect.category !== "lip_color") return effect;
            const palettes = Array.isArray(effect.palettes) ? [...(effect.palettes as Array<Record<string, unknown>>)] : [];
            if (palettes[0]) palettes[0] = { ...palettes[0], color: lip };
            return { ...effect, palettes };
          }),
        };
      }
      if (why && !hasBannedClaim(why) && unsourcedNumbers(why, allowedNumbers(input, [updated.lipHex])).length === 0) {
        updated = { ...updated, why };
      }
      return updated;
    }),
  };
  const stray = unsourcedNumbers(planProse(next), allowedNumbers(input, next.looks.map((look) => look.lipHex)));
  if (stray.length || hasBannedClaim(planProse(next))) return null;
  return next;
}

export async function maybeEnhancePlan(input: PlanInput, base: WeddingPlan): Promise<WeddingPlan> {
  const key = process.env.AIML_API_KEY;
  if (!key) return base;
  const model = process.env.AIML_MODEL || "gpt-4o-mini";
  const root = (process.env.AIML_BASE_URL || "https://api.aimlapi.com/v1").replace(/\/$/, "");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${root}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You rewrite wedding-makeup notes. Return JSON {looks:[{eventId, lipHex, why}]}. Use only numbers present in the user payload. Cosmetic language only. No brands. No hair color name.",
          },
          {
            role: "user",
            content: JSON.stringify({
              role: input.role,
              skin: input.skin,
              tones: {
                skin: input.tones.skinColor,
                lip: input.tones.lipColor,
                eye: input.tones.eyeColorName,
              },
              events: input.events.map((event) => ({
                id: event.id,
                name: event.name,
                time: event.timeOfDay,
                garment: event.garmentHex,
              })),
              current: base.looks.map((look) => ({ eventId: look.eventId, lipHex: look.lipHex, why: look.why })),
            }),
          },
        ],
      }),
    });
    if (!res.ok) return base;
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = json.choices?.[0]?.message?.content;
    if (!content) return base;
    const merged = mergeLlm(base, input, parseJsonLoose(content));
    return merged ?? base;
  } catch {
    return base;
  } finally {
    clearTimeout(timer);
  }
}

export function planFromInput(input: PlanInput): WeddingPlan {
  return planWedding(input);
}

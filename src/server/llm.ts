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

type LlmLook = { eventId?: string; lipHex?: string; why?: string; note?: string; copy?: string };

export type MergeOutcome = { plan: WeddingPlan; dropped: string[] };

function wordingOf(suggestion: LlmLook): string {
  if (typeof suggestion.why === "string" && suggestion.why.trim()) return suggestion.why.trim();
  if (typeof suggestion.note === "string" && suggestion.note.trim()) return suggestion.note.trim();
  if (typeof suggestion.copy === "string" && suggestion.copy.trim()) return suggestion.copy.trim();
  return "";
}

export function mergeLlm(base: WeddingPlan, input: PlanInput, parsed: unknown): MergeOutcome | null {
  if (!parsed || typeof parsed !== "object") return null;
  const looks = (parsed as { looks?: LlmLook[] }).looks;
  if (!Array.isArray(looks)) return null;
  const dropped: string[] = [];
  let changed = false;
  const nextLooks = base.looks.map((look) => {
    const suggestion = looks.find((item) => item.eventId === look.eventId);
    if (!suggestion) return look;
    const lip = normalizeHex(suggestion.lipHex ?? "");
    const why = wordingOf(suggestion);
    let updated = look;
    if (lip && !colorsClash(lip, look.garmentHex) && lip !== look.lipHex) {
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
      changed = true;
    } else if (lip && colorsClash(lip, look.garmentHex)) {
      dropped.push(`${look.eventId} lip clashed with the garment`);
    }
    if (why) {
      if (hasBannedClaim(why)) dropped.push(`${look.eventId} wording had a banned claim`);
      else {
        const stray = unsourcedNumbers(why, allowedNumbers(input, [updated.lipHex]));
        if (stray.length) dropped.push(`${look.eventId} wording used ${stray.join(", ")}`);
        else if (why !== look.why) {
          updated = { ...updated, why };
          changed = true;
        }
      }
    }
    return updated;
  });
  if (!changed) return { plan: base, dropped };
  const next: WeddingPlan = { ...base, source: "llm", looks: nextLooks };
  const allowed = allowedNumbers(input, next.looks.map((look) => look.lipHex));
  const prose = planProse(next);
  const stray = unsourcedNumbers(prose, allowed);
  if (stray.length || hasBannedClaim(prose)) {
    dropped.push(stray.length ? `combined copy used ${stray.join(", ")}` : "combined copy had a banned claim");
    const lipsOnly: WeddingPlan = {
      ...next,
      looks: next.looks.map((look, index) => ({ ...look, why: base.looks[index]?.why ?? look.why })),
    };
    const lipChanged = lipsOnly.looks.some((look, index) => look.lipHex !== base.looks[index]?.lipHex);
    const lipsProse = planProse(lipChanged ? { ...lipsOnly, source: "llm" } : base);
    if (!lipChanged || unsourcedNumbers(lipsProse, allowed).length || hasBannedClaim(lipsProse)) {
      return { plan: base, dropped };
    }
    return { plan: { ...lipsOnly, source: "llm" }, dropped };
  }
  return { plan: next, dropped };
}

function logFallback(reason: string) {
  console.warn(`[mehfil] llm copy fell back to the rules: ${reason}`);
}

export async function maybeEnhancePlan(input: PlanInput, base: WeddingPlan): Promise<WeddingPlan> {
  const key = process.env.AIML_API_KEY;
  if (!key) {
    logFallback("AIML_API_KEY is unset");
    return base;
  }
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
    if (!res.ok) {
      logFallback(`the model returned HTTP ${res.status}`);
      return base;
    }
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = json.choices?.[0]?.message?.content;
    if (!content) {
      logFallback("the model returned an empty message");
      return base;
    }
    const merged = mergeLlm(base, input, parseJsonLoose(content));
    if (!merged) {
      logFallback("the model JSON had no looks");
      return base;
    }
    if (merged.dropped.length) logFallback(merged.dropped.join("; "));
    return merged.plan;
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    logFallback(aborted ? "the model timed out" : `the model request failed (${error instanceof Error ? error.message : "error"})`);
    return base;
  } finally {
    clearTimeout(timer);
  }
}

export function planFromInput(input: PlanInput): WeddingPlan {
  return planWedding(input);
}

import { planWedding } from "@/lib/planner";
import { maybeEnhancePlan } from "@/server/llm";
import type { PhotoFraming, PlanInput, Presentation, Role, TimeOfDay } from "@/lib/types";
import { json } from "@/lib/http";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

function asRole(value: unknown): Role {
  return value === "bride" || value === "groom" || value === "guest" ? value : "groom";
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
  const input: PlanInput = {
    role: asRole(body.role),
    presentation: (body.presentation === "woman" ? "woman" : "man") as Presentation,
    framing: (body.framing === "full-body" ? "full-body" : "chest-up") as PhotoFraming,
    skin: body.skin,
    tones: body.tones,
    events: body.events.map((event) => ({
      ...event,
      timeOfDay: (["day", "evening", "night"].includes(event.timeOfDay) ? event.timeOfDay : "evening") as TimeOfDay,
    })),
    today: body.today,
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

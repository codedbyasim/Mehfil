import { ERROR_HINTS, taskSpec } from "@/lib/payloads";
import { json } from "@/lib/http";
import { YouCamError, createTask } from "@/server/youcam";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

export async function POST(request: Request) {
  if (!process.env.YOUCAM_API_KEY) return json({ error: "missing_api_key", fallback: "demo" }, 503);
  const body = (await request.json().catch(() => null)) as { feature?: string; input?: Record<string, unknown> } | null;
  if (!body?.feature || !body.input) return json({ error: "bad_request" }, 400);
  try {
    const spec = taskSpec(body.feature, body.input);
    const taskId = await createTask(spec.path, spec.body);
    return json({ taskId, feature: spec.feature, units: spec.units });
  } catch (error) {
    const code = error instanceof YouCamError ? error.code : error instanceof Error ? error.message : "task_failed";
    const status = error instanceof YouCamError ? error.status : 400;
    return json(
      { error: code, hint: ERROR_HINTS[code] ?? "The YouCam task did not start.", fallback: code === "CreditInsufficiency" ? "demo" : undefined },
      status >= 400 && status < 600 ? status : 400,
    );
  }
}

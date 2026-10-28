import { ERROR_HINTS, YOUCAM_FEATURES } from "@/lib/payloads";
import { json } from "@/lib/http";
import { YouCamError, bytesToDataUrl, downloadResult, pollTask, resultUrlOf, taskStatusOf } from "@/server/youcam";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

type Params = { params: Promise<{ feature: string; taskId: string }> };

export async function GET(request: Request, context: Params) {
  if (!process.env.YOUCAM_API_KEY) return json({ error: "missing_api_key", fallback: "demo" }, 503);
  const { feature, taskId } = await context.params;
  if (!YOUCAM_FEATURES.includes(feature as (typeof YOUCAM_FEATURES)[number])) return json({ error: "unknown_feature" }, 400);
  try {
    const payload = await pollTask(feature, taskId);
    const taskStatus = taskStatusOf(payload);
    const data = (payload.data as { error?: string; failure_reason?: string; results?: unknown } | undefined) ?? {};
    if (taskStatus === "error") {
      const code = String(data.error ?? data.failure_reason ?? "task_error");
      return json({ taskStatus, error: code, hint: ERROR_HINTS[code] ?? "The task failed. YouCam does not charge failed tasks." });
    }
    if (taskStatus !== "success") return json({ taskStatus: taskStatus || "running" });
    const url = resultUrlOf(payload);
    const inline = new URL(request.url).searchParams.get("inline") === "1";
    if (inline && url) {
      const file = await downloadResult(url);
      return json({
        taskStatus,
        mime: file.mime,
        dataUrl: bytesToDataUrl(file.bytes, file.mime),
        results: data.results ?? null,
      });
    }
    return json({ taskStatus, resultUrl: url, results: data.results ?? null });
  } catch (error) {
    const code = error instanceof YouCamError ? error.code : "poll_failed";
    return json({ error: code, hint: ERROR_HINTS[code] }, 502);
  }
}

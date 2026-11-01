import { ERROR_HINTS, YOUCAM_FEATURES } from "@/lib/payloads";
import { json } from "@/lib/http";
import { YouCamError, bytesToDataUrl, downloadResult, pollTask, resultUrlOf, taskStatusOf } from "@/server/youcam";
import { boundGrant, runCookie, runRequired, settleTask, withCookies } from "@/server/run-auth";

export const dynamic = "force-dynamic";
/** One status check. The browser keeps polling; cloth try-on may take up to three minutes. */
export const maxDuration = 10;

type Params = { params: Promise<{ feature: string; taskId: string }> };

export async function GET(request: Request, context: Params) {
  if (!process.env.YOUCAM_API_KEY) return json({ error: "missing_api_key", hint: ERROR_HINTS.missing_api_key, fallback: "demo" }, 503);
  const grant = boundGrant(request);
  if (!grant) return json(runRequired(), 401);
  const { feature, taskId } = await context.params;
  if (!YOUCAM_FEATURES.includes(feature as (typeof YOUCAM_FEATURES)[number])) return json({ error: "unknown_feature" }, 400);
  try {
    const payload = await pollTask(feature, taskId);
    const taskStatus = taskStatusOf(payload);
    const data = (payload.data as { error?: string; failure_reason?: string; results?: unknown } | undefined) ?? {};
    if (taskStatus === "error") {
      const code = String(data.error ?? data.failure_reason ?? "task_error");
      console.warn("[mehfil] task error", feature, code);
      const next = await settleTask(grant, taskId, "error");
      return withCookies(
        json({ taskStatus, error: code, hint: ERROR_HINTS[code] ?? "The task failed. YouCam does not charge failed tasks." }),
        [runCookie(request, next)],
      );
    }
    if (taskStatus !== "success") return json({ taskStatus: taskStatus || "running" });
    const url = resultUrlOf(payload);
    const next = await settleTask(grant, taskId, "ok");
    const inline = new URL(request.url).searchParams.get("inline") === "1";
    if (inline && url) {
      const file = await downloadResult(url);
      return withCookies(
        json({
          taskStatus,
          mime: file.mime,
          dataUrl: bytesToDataUrl(file.bytes, file.mime),
          results: data.results ?? null,
        }),
        [runCookie(request, next)],
      );
    }
    return withCookies(json({ taskStatus, resultUrl: url, results: data.results ?? null }), [runCookie(request, next)]);
  } catch (error) {
    const code = error instanceof YouCamError ? error.code : "poll_failed";
    return json({ error: code, hint: ERROR_HINTS[code] }, 502);
  }
}

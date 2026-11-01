import { capMessage } from "@/lib/cap-message";
import { cropAroundFace, isFaceBoundError, isFaceSizeError, LOOSER_FACE_WIDTH_RATIOS, TIGHTER_FACE_WIDTH_RATIO } from "@/lib/crop";
import { cropToCanvas } from "@/lib/detect-face";
import { pollJson, type PollResult } from "@/lib/poll";
import { planWedding } from "@/lib/planner";
import { normalizeSkin, normalizeTones } from "@/lib/skin";
import { estimateLiveUnits } from "@/lib/units";
import type { Session, WeddingPlan } from "@/lib/types";

export type LiveUpdate = {
  traceId: string;
  status: "running" | "done" | "error";
  detail?: string;
  units?: number;
};

async function asBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const size = 0x8000;
  for (let i = 0; i < bytes.length; i += size) binary += String.fromCharCode(...bytes.subarray(i, i + size));
  return btoa(binary);
}

async function uploadBlob(blob: Blob, name: string): Promise<string> {
  const res = await fetch("/api/youcam/file", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ dataBase64: await asBase64(blob), fileName: name }),
  });
  const json = (await res.json()) as { fileId?: string; error?: string; fallback?: string };
  if (!res.ok || !json.fileId) {
    const error = new Error(json.error || "upload_failed") as Error & { fallback?: string };
    error.fallback = json.fallback;
    throw error;
  }
  return json.fileId;
}

async function runFeature(feature: string, input: Record<string, unknown>): Promise<PollResult & { units: number }> {
  const created = (await fetch("/api/youcam/task", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ feature, input }),
  }).then((res) => res.json())) as { taskId?: string; units?: number; error?: string; fallback?: string; hint?: string };
  if (!created.taskId) {
    const error = new Error(created.hint || created.error || "task_failed") as Error & { code?: string; fallback?: string };
    error.code = created.error;
    error.fallback = created.fallback;
    throw error;
  }
  const slow = feature === "cloth-v4";
  const done = await pollJson(`/api/youcam/task/${feature}/${encodeURIComponent(created.taskId)}?inline=1`, {
    intervalMs: slow ? 4000 : 3000,
    capMs: slow ? 180000 : 120000,
    backoff: slow ? 1.35 : undefined,
    maxIntervalMs: slow ? 12000 : undefined,
  });
  if (done.taskStatus === "error") {
    const error = new Error(done.hint || done.error || "task_error") as Error & { code?: string };
    error.code = done.error;
    throw error;
  }
  if (done.taskStatus !== "success") {
    const error = new Error("The task took too long. A failed task is not charged.") as Error & { code?: string };
    error.code = "timeout";
    throw error;
  }
  return { ...done, units: created.units ?? 0 };
}

function isTimeoutError(error: unknown): boolean {
  const code = (error as { code?: string }).code;
  return code === "timeout" || (error instanceof Error && /took too long/i.test(error.message));
}

async function blobFromUrl(url: string): Promise<Blob> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Could not read an image for upload.");
  return res.blob();
}

function loadHtmlImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not read the photo for a tighter crop."));
    image.src = url;
  });
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, data] = dataUrl.split(",");
  const mime = /data:(.*?);/.exec(header)?.[1] || "image/jpeg";
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export async function runLiveSession(
  session: Session,
  onUpdate: (update: LiveUpdate) => void,
): Promise<{ session: Session; units: number }> {
  if (!session.selfieUrl || !session.faceCropUrl) throw new Error("Add a photo first.");
  const estimate = estimateLiveUnits({
    order: session.role === "bride" || (session.role === "guest" && session.presentation === "woman") ? "cloth-first" : "makeup-first",
    events: session.events.length,
    includeAnalysis: true,
    simulationFields: 4,
    makeupReplans: 1,
    clothReplans: 1,
  });
  const runId = crypto.randomUUID();
  const gate = (await fetch("/api/run/begin", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ runId, estimate }),
  }).then((res) => res.json())) as { allow?: boolean; reason?: string; hint?: string };
  if (!gate.allow) {
    const error = new Error(gate.hint || capMessage(gate.reason)) as Error & { fallback?: string };
    error.fallback = "demo";
    throw error;
  }

  let used = 0;
  const charge = async (id: string, work: () => Promise<PollResult & { units: number }>) => {
    onUpdate({ traceId: id, status: "running" });
    try {
      const result = await work();
      used += result.units;
      onUpdate({ traceId: id, status: "done", units: result.units });
      return result;
    } catch (error) {
      onUpdate({
        traceId: id,
        status: "error",
        detail: error instanceof Error ? error.message : "failed",
        units: 0,
      });
      throw error;
    }
  };

  const settle = (delivered: boolean) =>
    fetch("/api/run/finish", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ runId, delivered }),
    }).catch(() => undefined);

  let faceCropUrl = session.faceCropUrl;
  const events = session.events.map((event) => ({ ...event }));
  let plan: WeddingPlan | undefined = session.plan;
  let simulationImage = session.simulationImage;
  let notice: string | undefined;

  try {
    onUpdate({ traceId: "crop", status: "done" });
    let faceId = await uploadBlob(await blobFromUrl(session.faceCropUrl), "face-crop.jpg");
    let cropWidth = 0;
    if (session.selfieUrl && session.faceBox) {
      const image = await loadHtmlImage(session.selfieUrl);
      cropWidth = cropAroundFace({ width: image.naturalWidth, height: image.naturalHeight }, session.faceBox).width;
    }
    let tightened = false;
    let looserStep = 0;

    const recrop = async (ratio: number, pad: boolean, name: string) => {
      if (!session.selfieUrl || !session.faceBox) return false;
      const image = await loadHtmlImage(session.selfieUrl);
      const rect = cropAroundFace(
        { width: image.naturalWidth, height: image.naturalHeight },
        session.faceBox,
        { faceWidthRatio: ratio, pad },
      );
      if (pad === false && rect.width <= cropWidth + 8) return false;
      const url = cropToCanvas(image, rect);
      faceId = await uploadBlob(dataUrlToBlob(url), name);
      faceCropUrl = url;
      cropWidth = rect.width;
      return true;
    };

    const runFace = async (traceId: string, feature: string, extra: Record<string, unknown> = {}): Promise<PollResult & { units: number }> => {
      for (;;) {
        try {
          return await charge(traceId, () => runFeature(feature, { ...extra, fileId: faceId }));
        } catch (error) {
          const code = (error as { code?: string }).code ?? (error instanceof Error ? error.message : "");
          if (isFaceSizeError(code) && !tightened && (await recrop(TIGHTER_FACE_WIDTH_RATIO, true, "face-crop-tight.jpg"))) {
            tightened = true;
            onUpdate({ traceId, status: "running", detail: "Retrying with a tighter face crop." });
            continue;
          }
          if (isFaceBoundError(code)) {
            let loosened = false;
            while (looserStep < LOOSER_FACE_WIDTH_RATIOS.length && !loosened) {
              const ratio = LOOSER_FACE_WIDTH_RATIOS[looserStep];
              looserStep += 1;
              loosened = await recrop(ratio, false, `face-crop-loose-${looserStep}.jpg`);
            }
            if (loosened) {
              onUpdate({ traceId, status: "running", detail: "Retrying with a looser face crop." });
              continue;
            }
          }
          throw error;
        }
      }
    };

    const skin = await runFace("skin", "skin-analysis");
    const tone = await runFace("tone", "skin-tone-analysis");
    const planInput = {
      role: session.role,
      presentation: session.presentation,
      framing: session.framing,
      skin: normalizeSkin(skin.results),
      tones: normalizeTones(tone.results),
      events: session.events,
      placeholder: false,
    };
    plan = planWedding(planInput);
    const planned = (await fetch("/api/plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: "live", ...planInput }),
    }).then((res) => res.json())) as WeddingPlan;
    if (planned?.looks) plan = { ...planned, unitsCharged: 0 };
    onUpdate({ traceId: "order", status: "done" });

    try {
      const simulation = await runFace("sim", "skin-simulation", { simulation: plan.simulation.intensities });
      if (simulation.dataUrl) simulationImage = simulation.dataUrl;
    } catch (error) {
      notice = "The outfit and makeup are still yours. The event-day skin preview didn't finish, so that frame stays on the portrait.";
      onUpdate({
        traceId: "sim",
        status: "error",
        detail: error instanceof Error ? error.message : notice,
        units: 0,
      });
    }

    const fullId = await uploadBlob(await blobFromUrl(session.selfieUrl), "portrait.jpg");
    const uploadGarment = async (event: (typeof events)[number]) => {
      const catalog = (await import("@/lib/outfits")).outfitById(event.outfitId);
      const source = event.garmentImage || catalog?.image;
      if (!source) throw new Error(`Missing garment for ${event.name}.`);
      const blob = source.startsWith("data:") ? dataUrlToBlob(source) : await blobFromUrl(source);
      return uploadBlob(blob, `${event.id}.jpg`);
    };

    const tryCloth = async (traceId: string, input: Record<string, unknown>) => {
      try {
        return await charge(traceId, () => runFeature("cloth-v4", input));
      } catch (error) {
        if (!isTimeoutError(error)) return null;
        onUpdate({ traceId, status: "running", detail: "That outfit is still rendering. Trying it once more." });
        try {
          return await charge(traceId, () => runFeature("cloth-v4", input));
        } catch {
          return null;
        }
      }
    };

    const missed: string[] = [];
    if (plan.vtoOrder === "makeup-first") {
      const makeup = await charge("makeup", () => runFeature("makeup-vto", { fileId: fullId, effects: plan?.looks[0]?.effects ?? [] }));
      if (!makeup.dataUrl) throw new Error("Makeup did not return an image.");
      const groomedId = await uploadBlob(dataUrlToBlob(makeup.dataUrl), "groomed.png");
      for (const look of plan.looks) {
        const event = events.find((item) => item.id === look.eventId);
        if (!event) continue;
        const refId = await uploadGarment(event);
        const cloth = await tryCloth(`cloth-${look.eventId}`, {
          srcFileId: groomedId,
          refFileId: refId,
          garmentCategory: look.garmentCategory,
        });
        if (cloth?.dataUrl) {
          event.tryOnImage = cloth.dataUrl;
          event.beforeImage = session.selfieUrl;
        } else {
          missed.push(look.name);
        }
      }
    } else {
      for (const look of plan.looks) {
        const event = events.find((item) => item.id === look.eventId);
        if (!event) continue;
        const refId = await uploadGarment(event);
        const cloth = await tryCloth(`cloth-${look.eventId}`, {
          srcFileId: fullId,
          refFileId: refId,
          garmentCategory: look.garmentCategory,
        });
        if (!cloth?.dataUrl) {
          missed.push(look.name);
          continue;
        }
        try {
          const dressedId = await uploadBlob(dataUrlToBlob(cloth.dataUrl), `${look.eventId}.png`);
          const makeup = await charge(`makeup-${look.eventId}`, () =>
            runFeature("makeup-vto", { fileId: dressedId, effects: look.effects }),
          );
          event.tryOnImage = makeup.dataUrl || cloth.dataUrl;
          event.beforeImage = session.selfieUrl;
        } catch {
          event.tryOnImage = cloth.dataUrl;
          event.beforeImage = session.selfieUrl;
          missed.push(`${look.name} makeup`);
        }
      }
    }
    if (missed.length) {
      const line = `${missed.join(" and ")} didn't finish. The other looks are still here.`;
      notice = notice ? `${notice} ${line}` : line;
    }
    onUpdate({ traceId: "critique", status: "done" });
    await settle(true);
    return {
      units: used,
      session: {
        ...session,
        mode: "live" as const,
        events,
        plan,
        faceCropUrl,
        simulationImage,
        unitsCharged: used,
        fallbackBanner: notice,
      },
    };
  } catch (error) {
    const kept = events.some((event) => event.tryOnImage);
    await settle(kept);
    if (kept && plan) {
      const detail = error instanceof Error ? error.message : "Part of the live run stopped.";
      return {
        units: used,
        session: {
          ...session,
          mode: "live" as const,
          events,
          plan,
          faceCropUrl,
          simulationImage,
          unitsCharged: used,
          fallbackBanner: notice ?? `${detail} The looks that finished are still here.`,
        },
      };
    }
    throw error;
  }
}

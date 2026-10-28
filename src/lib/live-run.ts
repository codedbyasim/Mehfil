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
    const error = new Error(created.hint || created.error || "task_failed") as Error & { fallback?: string };
    error.fallback = created.fallback;
    throw error;
  }
  const done = await pollJson(`/api/youcam/task/${feature}/${encodeURIComponent(created.taskId)}?inline=1`, {
    intervalMs: 3000,
    capMs: 120000,
  });
  if (done.taskStatus === "error") throw new Error(done.hint || done.error || "task_error");
  if (done.taskStatus !== "success") throw new Error("The task took too long. Nothing was charged for a failed task.");
  return { ...done, units: created.units ?? 0 };
}

async function blobFromUrl(url: string): Promise<Blob> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Could not read an image for upload.");
  return res.blob();
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
  }).then((res) => res.json())) as { allow?: boolean; reason?: string };
  if (!gate.allow) {
    const error = new Error(gate.reason === "no_key" ? "Live mode needs a server key." : "The live unit cap is full.") as Error & { fallback?: string };
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
      onUpdate({ traceId: id, status: "error", detail: error instanceof Error ? error.message : "failed" });
      throw error;
    }
  };

  try {
    onUpdate({ traceId: "crop", status: "done" });
    const faceId = await uploadBlob(await blobFromUrl(session.faceCropUrl), "face-crop.jpg");
    const skin = await charge("skin", () => runFeature("skin-analysis", { fileId: faceId }));
    const tone = await charge("tone", () => runFeature("skin-tone-analysis", { fileId: faceId }));
    const planInput = {
      role: session.role,
      presentation: session.presentation,
      framing: session.framing,
      skin: normalizeSkin(skin.results),
      tones: normalizeTones(tone.results),
      events: session.events,
      placeholder: false,
    };
    let plan: WeddingPlan = planWedding(planInput);
    const planned = (await fetch("/api/plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: "live", ...planInput }),
    }).then((res) => res.json())) as WeddingPlan;
    if (planned?.looks) plan = { ...planned, unitsCharged: 0 };
    onUpdate({ traceId: "order", status: "done" });

    const fullId = await uploadBlob(await blobFromUrl(session.selfieUrl), "portrait.jpg");
    const events = session.events.map((event) => ({ ...event }));
    const uploadGarment = async (event: (typeof events)[number]) => {
      const catalog = (await import("@/lib/outfits")).outfitById(event.outfitId);
      const source = event.garmentImage || catalog?.image;
      if (!source) throw new Error(`Missing garment for ${event.name}.`);
      const blob = source.startsWith("data:") ? dataUrlToBlob(source) : await blobFromUrl(source);
      return uploadBlob(blob, `${event.id}.jpg`);
    };

    if (plan.vtoOrder === "makeup-first") {
      const makeup = await charge("makeup", () => runFeature("makeup-vto", { fileId: fullId, effects: plan.looks[0]?.effects ?? [] }));
      if (!makeup.dataUrl) throw new Error("Makeup did not return an image.");
      const groomedId = await uploadBlob(dataUrlToBlob(makeup.dataUrl), "groomed.png");
      for (const look of plan.looks) {
        const event = events.find((item) => item.id === look.eventId);
        if (!event) continue;
        const refId = await uploadGarment(event);
        const cloth = await charge(`cloth-${look.eventId}`, () =>
          runFeature("cloth-v4", { srcFileId: groomedId, refFileId: refId, garmentCategory: look.garmentCategory }),
        );
        if (cloth.dataUrl) event.tryOnImage = cloth.dataUrl;
        event.beforeImage = session.selfieUrl;
      }
    } else {
      for (const look of plan.looks) {
        const event = events.find((item) => item.id === look.eventId);
        if (!event) continue;
        const refId = await uploadGarment(event);
        const cloth = await charge(`cloth-${look.eventId}`, () =>
          runFeature("cloth-v4", { srcFileId: fullId, refFileId: refId, garmentCategory: look.garmentCategory }),
        );
        if (!cloth.dataUrl) throw new Error(`${look.name} try-on did not return an image.`);
        const dressedId = await uploadBlob(dataUrlToBlob(cloth.dataUrl), `${look.eventId}.png`);
        const makeup = await charge(`makeup-${look.eventId}`, () =>
          runFeature("makeup-vto", { fileId: dressedId, effects: look.effects }),
        );
        event.tryOnImage = makeup.dataUrl || cloth.dataUrl;
        event.beforeImage = session.selfieUrl;
      }
    }
    onUpdate({ traceId: "critique", status: "done" });
    const simulation = await charge("sim", () => runFeature("skin-simulation", { fileId: faceId, simulation: plan.simulation.intensities }));
    await fetch("/api/run/finish", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ runId, used }),
    });
    return {
      units: used,
      session: {
        ...session,
        mode: "live",
        events,
        plan,
        simulationImage: simulation.dataUrl || session.simulationImage,
        unitsCharged: used,
        fallbackBanner: undefined,
      },
    };
  } catch (error) {
    await fetch("/api/run/finish", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ runId, used }),
    }).catch(() => undefined);
    throw error;
  }
}

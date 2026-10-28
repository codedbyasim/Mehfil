"use client";

import { useSession } from "@/components/session";
import { cropToCanvas, detectFaces, fallbackCrop, resizeFull } from "@/lib/detect-face";
import { meanLuma, reportFromImage, type QualityReport } from "@/lib/quality";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function CapturePage() {
  const { session, setSession } = useSession();
  const router = useRouter();
  const [report, setReport] = useState<QualityReport | null>(null);
  const [preview, setPreview] = useState<string | null>(session?.selfieUrl ?? null);
  const [cropPreview, setCropPreview] = useState<string | null>(session?.faceCropUrl ?? null);
  const [busy, setBusy] = useState(false);
  const [consent, setConsent] = useState(session?.consent ?? false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File) {
    setError(null);
    setBusy(true);
    try {
      const url = URL.createObjectURL(file);
      const image = await loadImage(url);
      const canvas = document.createElement("canvas");
      const sample = 48;
      canvas.width = sample;
      canvas.height = sample;
      const context = canvas.getContext("2d");
      context?.drawImage(image, 0, 0, sample, sample);
      const pixels = context?.getImageData(0, 0, sample, sample).data ?? new Uint8ClampedArray();
      const detected = await detectFaces(image);
      const next = reportFromImage({
        bytes: file.size,
        mime: file.type === "image/png" ? "image/png" : file.type === "image/jpeg" ? "image/jpeg" : sniffMime(file),
        width: image.naturalWidth,
        height: image.naturalHeight,
        meanLuma: meanLuma(pixels),
        faces: detected.faces,
        detector: detected.engine === "none" ? "unavailable" : "found",
      });
      const faceRect = next.faceCrop ?? fallbackCrop(image.naturalWidth, image.naturalHeight);
      const full = resizeFull(image);
      const crop = cropToCanvas(image, faceRect);
      setReport(next);
      setPreview(full);
      setCropPreview(crop);
      if (session) {
        setSession({
          ...session,
          mode: session.scenarioId ? session.mode : "live",
          selfieUrl: full,
          faceCropUrl: crop,
          framing: next.framing,
          placeholder: false,
        });
      }
      URL.revokeObjectURL(url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not read that photo.");
    } finally {
      setBusy(false);
    }
  }

  const demoPhoto = session?.mode === "demo" && session.selfieUrl && !report;

  return (
    <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
      <section>
        <p className="text-xs uppercase tracking-[0.22em] text-gold">Photo</p>
        <h1 className="display mt-2 text-5xl text-maroon-deep">One portrait, two crops.</h1>
        <p className="mt-3 max-w-xl text-muted">
          Skin analysis, color tones, and the skin goal need a face that fills about sixty percent of the width. Outfit try-on keeps the full photo, shoulders included. Nothing is uploaded until you continue in live mode.
        </p>
        <label className="mt-6 flex cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-gold bg-paper px-6 py-12 text-center">
          <span className="display text-3xl text-maroon">Drop a JPEG or PNG</span>
          <span className="mt-2 text-sm text-muted">Or take one now. Under 10 MB. One person, facing the camera.</span>
          <input
            className="sr-only"
            type="file"
            accept="image/jpeg,image/png"
            capture="user"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void onFile(file);
            }}
          />
        </label>
        {busy ? <p className="mt-4 text-sm text-muted">Checking the photo…</p> : null}
        {error ? <p className="mt-4 text-sm text-maroon">{error}</p> : null}
        {report ? (
          <ul className="mt-6 space-y-2">
            {report.checks.map((check) => (
              <li key={check.id} className="flex items-start justify-between gap-4 rounded-2xl bg-paper px-4 py-3">
                <span>
                  <span className="block font-medium">{check.label}</span>
                  <span className="text-sm text-muted">{check.detail}</span>
                </span>
                <span className={`text-xs uppercase tracking-[0.14em] ${check.status === "fail" ? "text-maroon" : "text-gold"}`}>{check.status}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <label className="mt-6 flex items-start gap-3 text-sm">
          <input type="checkbox" className="mt-1" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
          <span>This photo is used only to build the week in this browser. MEHFIL does not create an account and does not keep the photo on the server after the response.</span>
        </label>
        <button
          type="button"
          className="mt-6 rounded-full bg-maroon px-6 py-3 text-ivory disabled:opacity-40"
          disabled={!consent || (report ? !report.ok : !demoPhoto)}
          onClick={() => {
            if (session) setSession({ ...session, consent: true });
            router.push("/setup");
          }}
        >
          Continue to the week
        </button>
      </section>
      <aside className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
        <figure className="overflow-hidden rounded-3xl border border-gold/30 bg-paper">
          {preview || demoPhoto ? (
            <img src={preview || session?.selfieUrl} alt="Full portrait used for outfit try-on" className="aspect-[4/5] w-full object-cover" />
          ) : (
            <div className="flex aspect-[4/5] items-center justify-center text-sm text-muted">Full photo</div>
          )}
          <figcaption className="px-4 py-3 text-sm text-muted">Full photo · clothes try-on</figcaption>
        </figure>
        <figure className="overflow-hidden rounded-3xl border border-gold/30 bg-paper">
          {cropPreview || (demoPhoto && session?.faceCropUrl) ? (
            <img src={cropPreview || session?.faceCropUrl} alt="Face crop used for skin calls" className="aspect-[4/5] w-full object-cover" />
          ) : (
            <div className="flex aspect-[4/5] items-center justify-center text-sm text-muted">Face crop</div>
          )}
          <figcaption className="px-4 py-3 text-sm text-muted">Face crop · skin, tones, simulation</figcaption>
        </figure>
      </aside>
    </div>
  );
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not decode the image."));
    image.src = url;
  });
}

function sniffMime(file: File): string {
  if (file.type) return file.type;
  return file.name.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
}

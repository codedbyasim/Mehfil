import { luminanceStats } from "@/lib/color";
import { cropAroundFace, framingFromFace, type Rect } from "@/lib/crop";

export type CheckStatus = "pass" | "warn" | "fail";

export type QualityCheck = {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
};

export type QualityReport = {
  ok: boolean;
  checks: QualityCheck[];
  framing: "chest-up" | "full-body";
  faceCrop?: Rect;
  face?: Rect;
};

const MAX_BYTES = 10 * 1024 * 1024;

export function reportFromImage(input: {
  bytes: number;
  mime: string;
  width: number;
  height: number;
  meanLuma: number;
  faces: Rect[];
  detector: "found" | "unavailable";
}): QualityReport {
  const checks: QualityCheck[] = [];
  const mimeOk = input.mime === "image/jpeg" || input.mime === "image/png";
  checks.push({
    id: "type",
    label: "JPEG or PNG",
    status: mimeOk ? "pass" : "fail",
    detail: mimeOk ? "Supported file." : "Use a JPEG or PNG.",
  });
  checks.push({
    id: "size",
    label: "Under 10 MB",
    status: input.bytes > 0 && input.bytes <= MAX_BYTES ? "pass" : "fail",
    detail: input.bytes <= MAX_BYTES ? "File size is fine." : "That file is over 10 MB.",
  });
  const shortSide = Math.min(input.width, input.height);
  const longSide = Math.max(input.width, input.height);
  checks.push({
    id: "dimensions",
    label: "Large enough to read a face",
    status: shortSide >= 480 && longSide <= 4096 ? "pass" : "fail",
    detail:
      shortSide >= 480
        ? `${input.width} by ${input.height}.`
        : "The short side should be at least 480 pixels.",
  });
  const bright = input.meanLuma >= 42 && input.meanLuma <= 225;
  checks.push({
    id: "light",
    label: "Even light",
    status: bright ? "pass" : "fail",
    detail: bright ? "The frame is neither black nor blown out." : "Move toward softer light and try again.",
  });

  let face: Rect | undefined;
  let faceCrop: Rect | undefined;
  let framing: "chest-up" | "full-body" = "chest-up";
  if (input.detector === "unavailable") {
    checks.push({
      id: "face",
      label: "One face",
      status: "warn",
      detail: "This browser could not run a face detector. Confirm the crop before a live run.",
    });
  } else if (input.faces.length === 0) {
    checks.push({
      id: "face",
      label: "One face",
      status: "fail",
      detail: "No face was found. Look straight at the camera.",
    });
  } else if (input.faces.length > 1) {
    checks.push({
      id: "face",
      label: "One face",
      status: "fail",
      detail: "Use a photo with one person.",
    });
  } else {
    face = input.faces[0];
    framing = framingFromFace(input.width, face.width);
    faceCrop = cropAroundFace({ width: input.width, height: input.height }, face);
    const ratio = face.width / Math.max(1, faceCrop.width);
    checks.push({
      id: "face",
      label: "One face",
      status: "pass",
      detail:
        ratio >= 0.55
          ? "A crop can put the face near sixty percent of the width for skin calls."
          : "The face is small. A full-length photo can still try on clothes. Skin calls will use a tighter crop.",
    });
  }
  if (framing === "full-body") {
    checks.push({
      id: "framing",
      label: "Full-length frame",
      status: "warn",
      detail: "Clothes try-on will use full body. A lehenga or full sherwani can use that. Skin calls still use the face crop.",
    });
  } else {
    checks.push({
      id: "framing",
      label: "Shoulders in frame",
      status: "pass",
      detail: "Chest-up photos use the upper body outfit category.",
    });
  }
  const ok = checks.every((check) => check.status !== "fail");
  return { ok, checks, framing, face, faceCrop };
}

export function meanLuma(pixels: Uint8ClampedArray): number {
  return luminanceStats(pixels, 16).mean;
}

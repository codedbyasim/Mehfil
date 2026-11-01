export type Rect = { x: number; y: number; width: number; height: number };

/**
 * Face width divided by crop width.
 * 0.64 left a 462px face on a 1080×1350 frame at about 722px wide, and skin analysis
 * returned error_src_face_too_small. 0.72 (about 642×802) was accepted.
 * One tighter pass uses 0.84 if YouCam still says the face is too small.
 */
export const DEFAULT_FACE_WIDTH_RATIO = 0.72;
export const TIGHTER_FACE_WIDTH_RATIO = 0.84;

const FACE_SIZE_ERRORS = ["error_src_face_too_small", "error_face_position_too_small"] as const;

export function isFaceSizeError(code: string | null | undefined): boolean {
  if (!code) return false;
  return FACE_SIZE_ERRORS.some((item) => code.includes(item));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Crop so the detected face fills about 72% of the width.
 * Skin analysis, face tone, and skin simulation fail when the face is smaller.
 * Clothes try-on keeps the original photo.
 */
export function cropAroundFace(
  image: { width: number; height: number },
  face: Rect,
  options?: { faceWidthRatio?: number; aspect?: number },
): Rect {
  const ratio = options?.faceWidthRatio ?? DEFAULT_FACE_WIDTH_RATIO;
  const aspect = options?.aspect ?? 4 / 5;
  let cropW = face.width / ratio;
  let cropH = cropW / aspect;
  if (cropH > image.height) {
    cropH = image.height;
    cropW = cropH * aspect;
  }
  if (cropW > image.width) {
    cropW = image.width;
    cropH = cropW / aspect;
  }
  cropW = Math.max(1, cropW);
  cropH = Math.max(1, cropH);
  const centerX = face.x + face.width / 2;
  const centerY = face.y + face.height / 2;
  const x = clamp(centerX - cropW / 2, 0, Math.max(0, image.width - cropW));
  const y = clamp(centerY - cropH * 0.46, 0, Math.max(0, image.height - cropH));
  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(cropW),
    height: Math.round(cropH),
  };
}

export function faceWidthRatio(imageWidth: number, faceWidth: number): number {
  if (imageWidth <= 0) return 0;
  return faceWidth / imageWidth;
}

/** A small face in a tall frame is treated as a full-body photo. */
export function framingFromFace(imageWidth: number, faceWidth: number): "chest-up" | "full-body" {
  return faceWidthRatio(imageWidth, faceWidth) < 0.28 ? "full-body" : "chest-up";
}

/** Used when the browser has no face detector. The live retry can still tighten this box. */
export function syntheticFace(width: number, height: number): Rect {
  return { x: width * 0.22, y: height * 0.08, width: width * 0.56, height: height * 0.5 };
}

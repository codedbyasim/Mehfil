export type Rect = { x: number; y: number; width: number; height: number };

/**
 * BlazeFace boxes are tight. On the 1080×1350 groom frame the detector box is about
 * 347px wide. Dividing that raw box by 0.72 made a ~482px crop, which cut the ears
 * and forehead. Skin analysis and tone accepted it. Skin simulation returned
 * error_src_face_out_of_bound.
 *
 * The box is padded about 1.3× before the ratio, with more of the pad above the
 * box so the forehead stays inside. A 347px detector box then lands near 640px wide.
 * A 641×802 crop passed skin analysis, tone, and simulation. A ~722px crop failed
 * skin analysis with error_src_face_too_small.
 */
export const DETECTOR_PAD = 1.33;
/** Share of the extra vertical pad placed above the detector box. */
export const FOREHEAD_PAD_SHARE = 0.7;
/** Applied to the padded box. A 347px detector box becomes about 641px of crop. */
export const DEFAULT_FACE_WIDTH_RATIO = 0.72;
/** One tighter retry when YouCam says the face is too small. */
export const TIGHTER_FACE_WIDTH_RATIO = 0.84;
/**
 * Looser retries when the crop cuts the face off. These ratios are the raw detector
 * width over the crop width, with no extra pad. 0.55 is tried first; 0.45 is wider.
 */
export const LOOSER_FACE_WIDTH_RATIOS = [0.55, 0.45] as const;

const FACE_TOO_SMALL = ["error_src_face_too_small", "error_face_position_too_small"] as const;
const FACE_OUT_OF_BOUND = ["error_src_face_out_of_bound"] as const;

export function isFaceSizeError(code: string | null | undefined): boolean {
  if (!code) return false;
  return FACE_TOO_SMALL.some((item) => code.includes(item));
}

export function isFaceBoundError(code: string | null | undefined): boolean {
  if (!code) return false;
  return FACE_OUT_OF_BOUND.some((item) => code.includes(item));
}

export function isFaceCropError(code: string | null | undefined): boolean {
  return isFaceSizeError(code) || isFaceBoundError(code);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Expand a tight detector box. Most of the extra height sits above the forehead. */
export function padDetectorBox(face: Rect, pad = DETECTOR_PAD): Rect {
  const width = Math.max(1, face.width * pad);
  const height = Math.max(1, face.height * pad);
  const extraH = Math.max(0, height - face.height);
  const above = extraH * FOREHEAD_PAD_SHARE;
  return {
    x: face.x - (width - face.width) / 2,
    y: face.y - above,
    width,
    height,
  };
}

/**
 * Crop so a tight detector box, once padded, fills about 72% of the crop width.
 * Pass pad:false with faceWidthRatio to size from the raw box (the looser retries).
 * Clothes try-on keeps the original photo.
 */
export function cropAroundFace(
  image: { width: number; height: number },
  face: Rect,
  options?: { faceWidthRatio?: number; aspect?: number; pad?: boolean },
): Rect {
  const source = options?.pad === false ? face : padDetectorBox(face);
  const ratio = options?.faceWidthRatio ?? DEFAULT_FACE_WIDTH_RATIO;
  const aspect = options?.aspect ?? 4 / 5;
  let cropW = source.width / ratio;
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
  const centerX = source.x + source.width / 2;
  const centerY = source.y + source.height / 2;
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

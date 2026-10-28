export type Rect = { x: number; y: number; width: number; height: number };

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Crop so the detected face fills about 60% of the width.
 * Skin analysis, face tone, and skin simulation fail with error_face_position_too_small otherwise.
 * Clothes try-on keeps the original photo.
 */
export function cropAroundFace(
  image: { width: number; height: number },
  face: Rect,
  options?: { faceWidthRatio?: number; aspect?: number },
): Rect {
  const ratio = options?.faceWidthRatio ?? 0.64;
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

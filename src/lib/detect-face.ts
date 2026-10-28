import { cropAroundFace, type Rect } from "@/lib/crop";

type VisionModule = {
  FaceDetector: {
    createFromOptions: (
      fileset: unknown,
      options: {
        baseOptions: { modelAssetPath: string; delegate?: "CPU" | "GPU" };
        runningMode: "IMAGE";
        minDetectionConfidence?: number;
      },
    ) => Promise<{
      detect: (image: HTMLImageElement | HTMLCanvasElement) => { detections: Array<{ boundingBox?: { originX: number; originY: number; width: number; height: number } }> };
      close: () => void;
    }>;
  };
  FilesetResolver: {
    forVisionTasks: (wasm: string) => Promise<unknown>;
  };
};

let detectorPromise: Promise<VisionModule["FaceDetector"] extends never ? never : Awaited<ReturnType<VisionModule["FaceDetector"]["createFromOptions"]>>> | null = null;

async function mediaPipeDetector() {
  if (!detectorPromise) {
    detectorPromise = (async () => {
      const load = new Function("specifier", "return import(specifier)") as (specifier: string) => Promise<VisionModule>;
      const vision = await load("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/+esm");
      const fileset = await vision.FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm",
      );
      return vision.FaceDetector.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite",
          delegate: "CPU",
        },
        runningMode: "IMAGE",
        minDetectionConfidence: 0.5,
      });
    })();
  }
  return detectorPromise;
}

type BrowserFaceDetector = {
  detect: (source: CanvasImageSource) => Promise<Array<{ boundingBox: { x: number; y: number; width: number; height: number } }>>;
};

export async function detectFaces(image: HTMLImageElement): Promise<{ faces: Rect[]; engine: "browser" | "mediapipe" | "none" }> {
  const BrowserDetector = (globalThis as { FaceDetector?: new (options?: { fastMode?: boolean; maxDetectedFaces?: number }) => BrowserFaceDetector }).FaceDetector;
  if (BrowserDetector) {
    try {
      const found = await new BrowserDetector({ fastMode: true, maxDetectedFaces: 2 }).detect(image);
      if (found.length) {
        return {
          engine: "browser",
          faces: found.map((face) => ({
            x: face.boundingBox.x,
            y: face.boundingBox.y,
            width: face.boundingBox.width,
            height: face.boundingBox.height,
          })),
        };
      }
    } catch {
      /* Try MediaPipe next. */
    }
  }
  try {
    const detector = await mediaPipeDetector();
    const result = detector.detect(image);
    const faces = result.detections
      .map((detection) => detection.boundingBox)
      .filter((box): box is NonNullable<typeof box> => Boolean(box))
      .map((box) => ({ x: box.originX, y: box.originY, width: box.width, height: box.height }));
    return { engine: faces.length ? "mediapipe" : "none", faces };
  } catch {
    return { engine: "none", faces: [] };
  }
}

export function cropToCanvas(image: HTMLImageElement, rect: Rect, maxSide = 1000): string {
  const scale = Math.min(1, maxSide / Math.max(rect.width, rect.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(rect.width * scale));
  canvas.height = Math.max(1, Math.round(rect.height * scale));
  const context = canvas.getContext("2d");
  if (!context) return image.src;
  context.drawImage(image, rect.x, rect.y, rect.width, rect.height, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.92);
}

export function resizeFull(image: HTMLImageElement, maxSide = 1600): string {
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) return image.src;
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.92);
}

export function fallbackCrop(width: number, height: number): Rect {
  return cropAroundFace({ width, height }, { x: width * 0.22, y: height * 0.08, width: width * 0.56, height: height * 0.5 });
}

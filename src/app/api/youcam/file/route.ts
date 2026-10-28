import { sniffImage } from "@/lib/sniff";
import { json } from "@/lib/http";
import { YouCamError, uploadImage } from "@/server/youcam";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

export async function POST(request: Request) {
  if (!process.env.YOUCAM_API_KEY) return json({ error: "missing_api_key", fallback: "demo" }, 503);
  const body = (await request.json().catch(() => null)) as { dataBase64?: string; fileName?: string; contentType?: string } | null;
  if (!body?.dataBase64) return json({ error: "bad_request" }, 400);
  const raw = body.dataBase64.replace(/^data:[^,]*,/, "");
  let bytes: Uint8Array;
  try {
    bytes = Uint8Array.from(Buffer.from(raw, "base64"));
  } catch {
    return json({ error: "bad_base64" }, 400);
  }
  if (bytes.byteLength < 32 || bytes.byteLength > 10 * 1024 * 1024) return json({ error: "bad_size" }, 400);
  const sniffed = sniffImage(bytes);
  if (sniffed.mime !== "image/jpeg" && sniffed.mime !== "image/png" && sniffed.mime !== "image/webp") {
    return json({ error: "bad_type" }, 400);
  }
  try {
    const fileId = await uploadImage(bytes, sniffed.mime, (body.fileName || `mehfil.${sniffed.ext}`).slice(0, 80));
    return json({ fileId, mime: sniffed.mime });
  } catch (error) {
    const code = error instanceof YouCamError ? error.code : "upload_failed";
    return json({ error: code, fallback: code === "missing_api_key" || code === "CreditInsufficiency" ? "demo" : undefined }, 502);
  }
}

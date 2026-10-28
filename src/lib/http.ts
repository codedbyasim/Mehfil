import { createHash } from "node:crypto";

export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return headers.get("x-real-ip")?.trim() || "unknown";
}

export function hashIp(ip: string): string {
  const salt = process.env.IP_HASH_SALT || "mehfil-v1";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 24);
}

export async function sha256Hex(bytes: BufferSource): Promise<string> {
  const view = bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const digest = await crypto.subtle.digest("SHA-256", view);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function json(data: unknown, status = 200, extra?: HeadersInit): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", ...Object.fromEntries(new Headers(extra).entries()) },
  });
}

const CACHE = new Map<string, { skin: unknown; tones: unknown; at: number }>();

export function readAnalysisCache(hash: string) {
  const hit = CACHE.get(hash);
  if (!hit) return null;
  if (Date.now() - hit.at > 1000 * 60 * 60 * 12) {
    CACHE.delete(hash);
    return null;
  }
  return hit;
}

export function writeAnalysisCache(hash: string, skin: unknown, tones: unknown) {
  CACHE.set(hash, { skin, tones, at: Date.now() });
  if (CACHE.size > 40) {
    const oldest = [...CACHE.entries()].sort((a, b) => a[1].at - b[1].at)[0];
    if (oldest) CACHE.delete(oldest[0]);
  }
}

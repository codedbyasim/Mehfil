import { json, readAnalysisCache, writeAnalysisCache } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const hash = new URL(request.url).searchParams.get("hash") ?? "";
  if (!/^[a-f0-9]{64}$/i.test(hash)) return json({ hit: false });
  const hit = readAnalysisCache(hash);
  if (!hit) return json({ hit: false });
  return json({ hit: true, skin: hit.skin, tones: hit.tones });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { hash?: string; skin?: unknown; tones?: unknown } | null;
  if (!body?.hash || !/^[a-f0-9]{64}$/i.test(body.hash) || !body.skin || !body.tones) {
    return json({ error: "bad_request" }, 400);
  }
  writeAnalysisCache(body.hash, body.skin, body.tones);
  return json({ ok: true });
}

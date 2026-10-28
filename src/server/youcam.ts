import { sniffImage } from "@/lib/sniff";

const BASE = "https://yce-api-01.makeupar.com";

export class YouCamError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, status: number) {
    super(code);
    this.name = "YouCamError";
    this.code = code;
    this.status = status;
  }
}

type FetchImpl = typeof fetch;

function apiKey(): string {
  const key = process.env.YOUCAM_API_KEY;
  if (!key) throw new YouCamError("missing_api_key", 500);
  return key;
}

async function readBody(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { error: "unreadable_response" };
  }
}

function fail(json: Record<string, unknown>, status: number): never {
  const code = String(json.error_code ?? json.error ?? `http_${status}`);
  throw new YouCamError(code, status);
}

export async function youcamFetch(path: string, init: RequestInit = {}, fetchImpl: FetchImpl = fetch): Promise<Record<string, unknown>> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${apiKey()}`);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const res = await fetchImpl(`${BASE}${path}`, { ...init, headers });
  const json = await readBody(res);
  if (!res.ok) fail(json, res.status);
  return json;
}

/** Sum of amount_dec from GET /s2s/v1.0/client/credit. This call is free. */
export async function creditBalance(fetchImpl: FetchImpl = fetch): Promise<number> {
  const json = await youcamFetch("/s2s/v1.0/client/credit", {}, fetchImpl);
  const rows = (json.results ?? (json.data as { results?: unknown } | undefined)?.results ?? []) as Array<{
    amount_dec?: number;
    amount?: number;
  }>;
  if (!Array.isArray(rows)) return 0;
  return rows.reduce((sum, row) => sum + Number(row.amount_dec ?? row.amount ?? 0), 0);
}

/**
 * Create a file record, then PUT the bytes to the presigned URL.
 * Skipping the PUT makes later tasks fail with unknown_internal_error.
 */
export async function uploadImage(
  bytes: Uint8Array,
  contentType: string,
  fileName: string,
  fetchImpl: FetchImpl = fetch,
): Promise<string> {
  const sniffed = sniffImage(bytes);
  const mime = sniffed.mime === "application/octet-stream" ? contentType : sniffed.mime;
  const json = await youcamFetch(
    "/s2s/v2.0/file",
    {
      method: "POST",
      body: JSON.stringify({
        files: [{ content_type: mime, file_name: fileName, file_size: bytes.byteLength }],
      }),
    },
    fetchImpl,
  );
  const data = json.data as { files?: Array<{ file_id: string; requests?: Array<{ method?: string; url: string; headers?: Record<string, string> }> }> };
  const file = data?.files?.[0];
  const request = file?.requests?.[0];
  if (!file?.file_id || !request?.url) throw new YouCamError("file_response_incomplete", 502);
  const headers = new Headers(request.headers ?? {});
  if (!headers.has("Content-Type")) headers.set("Content-Type", mime);
  const put = await fetchImpl(request.url, {
    method: request.method || "PUT",
    headers,
    body: bytes as unknown as BodyInit,
  });
  if (!put.ok) throw new YouCamError("upload_failed", put.status);
  return file.file_id;
}

export async function createTask(
  featurePath: string,
  body: Record<string, unknown>,
  fetchImpl: FetchImpl = fetch,
): Promise<string> {
  const json = await youcamFetch(featurePath, { method: "POST", body: JSON.stringify(body) }, fetchImpl);
  const data = json.data as { task_id?: string } | undefined;
  if (!data?.task_id) throw new YouCamError("missing_task_id", 502);
  return data.task_id;
}

export async function pollTask(feature: string, taskId: string, fetchImpl: FetchImpl = fetch): Promise<Record<string, unknown>> {
  return youcamFetch(`/s2s/v2.0/task/${feature}/${encodeURIComponent(taskId)}`, {}, fetchImpl);
}

const RESULT_HOST =
  /(^|\.)((s3[.-].*\.amazonaws\.com)|(amazonaws\.com)|(makeupar\.com)|(perfectcorp\.com)|(cloudfront\.net))$/i;

export function resultHostAllowed(hostname: string): boolean {
  return RESULT_HOST.test(hostname);
}

export async function downloadResult(url: string, fetchImpl: FetchImpl = fetch): Promise<{ bytes: Uint8Array; mime: string; ext: string }> {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || !resultHostAllowed(parsed.hostname)) {
    throw new YouCamError("bad_result_url", 400);
  }
  const res = await fetchImpl(parsed.toString(), { redirect: "manual" });
  if (res.status >= 300 && res.status < 400) {
    const location = res.headers.get("location");
    if (!location) throw new YouCamError("bad_redirect", 502);
    return downloadResult(new URL(location, parsed).toString(), fetchImpl);
  }
  if (!res.ok) throw new YouCamError("download_failed", res.status);
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.byteLength > 8_000_000) throw new YouCamError("result_too_large", 502);
  const sniffed = sniffImage(bytes);
  const headerType = res.headers.get("content-type")?.split(";")[0]?.trim();
  const mime = sniffed.mime !== "application/octet-stream" ? sniffed.mime : headerType || sniffed.mime;
  return { bytes, mime, ext: sniffed.ext };
}

export function taskStatusOf(json: Record<string, unknown>): string {
  const data = (json.data as { task_status?: string } | undefined) ?? json;
  return String(data.task_status ?? "");
}

export function resultUrlOf(json: Record<string, unknown>): string | null {
  const data = (json.data as { results?: { url?: string; download_url?: string } | Array<{ url?: string }> } | undefined)?.results;
  if (!data) return null;
  if (Array.isArray(data)) return data[0]?.url ?? null;
  return data.url ?? data.download_url ?? null;
}

export function bytesToDataUrl(bytes: Uint8Array, mime: string): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return `data:${mime};base64,${btoa(binary)}`;
}

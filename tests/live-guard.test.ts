import { afterEach, describe, expect, it, vi } from "vitest";
import { hashIp } from "@/lib/http";
import { seal, verifyRun, type RunGrant } from "@/lib/run-grant";
import { POST as taskPost } from "@/app/api/youcam/task/route";
import { POST as filePost } from "@/app/api/youcam/file/route";
import { GET as creditGet } from "@/app/api/youcam/credit/route";
import { resetLedgerForTests } from "@/server/ledger-store";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  resetLedgerForTests();
});

function grant(over: Partial<RunGrant> = {}) {
  vi.stubEnv("YOUCAM_API_KEY", "test-key");
  const visitor = hashIp("unknown");
  const value: RunGrant = {
    typ: "run",
    runId: "run-1",
    visitor,
    exp: Date.now() + 60_000,
    reserved: 60,
    charged: 0,
    pending: {},
    ...over,
  };
  return seal(value);
}

describe("live run token", () => {
  it("rejects a tampered or expired grant", () => {
    vi.stubEnv("YOUCAM_API_KEY", "test-key");
    const token = grant();
    expect(verifyRun(token)?.runId).toBe("run-1");
    expect(verifyRun(`${token.slice(0, -1)}x`)).toBeNull();
    const expired = grant({ exp: Date.now() - 1000 });
    expect(verifyRun(expired)).toBeNull();
  });

  it("does not call YouCam without a run approved by begin", async () => {
    vi.stubEnv("YOUCAM_API_KEY", "test-key");
    const fetchSpy = vi.fn(() => {
      throw new Error("network");
    });
    vi.stubGlobal("fetch", fetchSpy);
    const task = await taskPost(
      new Request("http://localhost/api/youcam/task", {
        method: "POST",
        body: JSON.stringify({ feature: "skin-analysis", input: { fileId: "face" } }),
      }),
    );
    expect(task.status).toBe(401);
    const file = await filePost(new Request("http://localhost/api/youcam/file", { method: "POST", body: "{}" }));
    expect(file.status).toBe(401);
    const credit = await creditGet(new Request("http://localhost/api/youcam/credit"));
    expect(credit.status).toBe(401);
    const body = await credit.json();
    expect(body.balance).toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("stops a task that would exceed the signed reservation and hides the credit balance", async () => {
    const fetchSpy = vi.fn(() => {
      throw new Error("network");
    });
    vi.stubGlobal("fetch", fetchSpy);
    const token = grant({ reserved: 4, charged: 0, pending: {} });
    const task = await taskPost(
      new Request("http://localhost/api/youcam/task", {
        method: "POST",
        headers: { "x-mehfil-run": token },
        body: JSON.stringify({ feature: "skin-analysis", input: { fileId: "face" } }),
      }),
    );
    expect(task.status).toBe(409);
    const credit = await creditGet(new Request("http://localhost/api/youcam/credit", { headers: { "x-mehfil-run": token } }));
    expect(credit.status).toBe(200);
    const body = await credit.json();
    expect(body).toEqual({ available: true });
    expect(body.balance).toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

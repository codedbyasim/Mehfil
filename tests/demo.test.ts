import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { sessionFromManifest, type DemoManifest } from "@/lib/demo";
import { cropAroundFace, faceWidthRatio, isFaceBoundError, isFaceSizeError } from "@/lib/crop";
import { ERROR_HINTS, taskSpec } from "@/lib/payloads";
import { sniffImage } from "@/lib/sniff";
import { displayScores, normalizeSkin, toneFactsForDisplay } from "@/lib/skin";
import { pollJson } from "@/lib/poll";
import { POST as planPost } from "@/app/api/plan/route";

function manifest(id: string): DemoManifest {
  return JSON.parse(readFileSync(path.join("public/demo", id, "manifest.json"), "utf8")) as DemoManifest;
}

describe("demo path", () => {
  it("builds the groom scenario from shipped files and never calls the network", async () => {
    const fetchSpy = vi.fn(() => {
      throw new Error("network");
    });
    vi.stubGlobal("fetch", fetchSpy);
    const groom = manifest("groom");
    const session = sessionFromManifest(groom, "2026-10-28");
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(session.mode).toBe("demo");
    expect(session.placeholder).toBe(false);
    expect(session.unitsCharged).toBe(0);
    expect(session.plan?.unitsCharged).toBe(0);
    expect(session.selfieUrl).toBe("/demo/groom/input/asim_original.jpg");
    for (const event of session.events) {
      expect(existsSync(path.join("public", event.tryOnImage!.slice(1)))).toBe(true);
    }
    expect(existsSync("public/demo/groom/simulation/event_day_goal.png")).toBe(true);
    expect(existsSync("public/demo/groom/input/asim_face_crop_skin.jpg")).toBe(true);
    const skin = normalizeSkin(groom.skin);
    expect(skin.overall).toBe(89);
    expect(skin.skinAge).toBe(29);
    expect(skin.concerns.find((item) => item.type === "dark_circle_v2")?.ui).toBe(63);
    expect(skin.skinType).toEqual({ whole: "Normal", tZone: "Normal", uZone: "Normal" });
    const facts = toneFactsForDisplay(session.plan ? (await import("@/lib/skin")).normalizeTones(groom.tones) : (await import("@/lib/skin")).normalizeTones(groom.tones));
    expect(facts.skinColor).toBe("#805E46");
    expect(JSON.stringify(facts)).not.toContain("Auburn");
    expect("hairColorName" in facts).toBe(false);
    const response = await planPost(
      new Request("http://localhost/api/plan", {
        method: "POST",
        body: JSON.stringify({ mode: "demo", ...(await inputBody()) }),
      }),
    );
    const json = await response.json();
    expect(json.unitsCharged).toBe(0);
    expect(json.vtoOrder).toBe("makeup-first");
    expect(fetchSpy).not.toHaveBeenCalled();
    const raw = await planPost(
      new Request("http://localhost/api/plan", {
        method: "POST",
        body: JSON.stringify({
          role: "bride",
          presentation: "woman",
          framing: "chest-up",
          mode: "demo",
          skin: { output: [{ type: "all", score: 80 }, { type: "oiliness", ui_score: 65, raw_score: 44.4 }, { type: "skin_type", region: "whole", skin_type: "Oily" }] },
          tones: { skin_color: "#A68265", lip_color: "#B06B65" },
          events: [{ id: "mehndi", name: "Mehndi", date: "2026-11-14", timeOfDay: "evening", outfitId: "bride-mehndi-lehenga", garmentCategory: "upper_body" }],
        }),
      }),
    );
    expect(raw.status).toBe(200);
    const planned = await raw.json();
    expect(planned.looks[0].garmentName).toBe("Yellow-green lehenga");
    expect(planned.looks[0].why).not.toContain("undefined");
    expect(planned.profile.skinHex).toBe("#A68265");
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("loads the fictional bride run from real files", () => {
    const bride = manifest("bride");
    const session = sessionFromManifest(bride);
    expect(session.placeholder).toBe(false);
    expect(session.mode).toBe("demo");
    expect(session.unitsCharged).toBe(0);
    expect(session.role).toBe("bride");
    expect(session.presentation).toBe("woman");
    expect(session.groomingImage).toBeUndefined();
    expect(session.subject).toMatch(/fictional/i);
    expect(session.eyeFocus).toEqual({ x: 50, y: 39, scale: 1.85 });
    expect(session.selfieUrl).toBe("/demo/bride/input/bride_original.jpg");
    for (const event of session.events) {
      expect(existsSync(path.join("public", event.tryOnImage!.slice(1)))).toBe(true);
      expect(existsSync(path.join("public", event.alternateTryOn!.slice(1)))).toBe(true);
      expect(event.tryOnImage).toContain("/makeup/");
      expect(event.alternateTryOn).toContain("/tryon/");
    }
    expect(existsSync("public/demo/bride/garments/mehndi_lehenga_yellow_green.jpg")).toBe(true);
    expect(existsSync("public/demo/bride/garments/baraat_lehenga_red_gold.jpg")).toBe(true);
    expect(existsSync("public/demo/bride/garments/walima_gharara_pastel_silver.jpg")).toBe(true);
  });

  it("keeps the guest portrait visibly marked as a placeholder", () => {
    const session = sessionFromManifest(manifest("guest"));
    expect(session.placeholder).toBe(true);
    expect(session.plan?.unitsCharged).toBe(0);
    expect(readFileSync(path.join("public", session.selfieUrl!.slice(1)), "utf8")).toContain("PLACEHOLDER");
    expect(existsSync("public/demo/guest/garments/guest-mehndi-anarkali.jpg")).toBe(true);
  });
});

describe("youcam payload shapes", () => {
  it("pads a 347px detector box to about 640px so the forehead stays in frame", () => {
    const image = { width: 1080, height: 1350 };
    const blaze = { x: 366, y: 280, width: 347, height: 430 };
    const crop = cropAroundFace(image, blaze);
    expect(crop.width).toBeGreaterThanOrEqual(620);
    expect(crop.width).toBeLessThanOrEqual(660);
    expect(crop.x).toBeGreaterThanOrEqual(0);
    expect(crop.y).toBeGreaterThanOrEqual(0);
    expect(crop.x + crop.width).toBeLessThanOrEqual(image.width);
    expect(crop.y + crop.height).toBeLessThanOrEqual(image.height);
    const raw = faceWidthRatio(crop.width, blaze.width);
    expect(raw).toBeGreaterThan(0.5);
    expect(raw).toBeLessThan(0.6);
    const tighter = cropAroundFace(image, blaze, { faceWidthRatio: 0.84 });
    expect(tighter.width).toBeLessThan(crop.width);
    const looser = cropAroundFace(image, blaze, { faceWidthRatio: 0.45, pad: false });
    expect(looser.width).toBeGreaterThan(crop.width);
    expect(isFaceSizeError("error_src_face_too_small")).toBe(true);
    expect(isFaceSizeError("error_face_position_too_small")).toBe(true);
    expect(isFaceBoundError("error_src_face_out_of_bound")).toBe(true);
    expect(isFaceSizeError("error_src_face_out_of_bound")).toBe(false);
    expect(ERROR_HINTS.error_src_face_out_of_bound).toMatch(/looser/i);
    expect(ERROR_HINTS.invalid_params).toBeTruthy();
    expect(ERROR_HINTS.below_min_image_size).toBeTruthy();
    expect(ERROR_HINTS.error_below_min_image_size).toBeTruthy();
    expect(ERROR_HINTS.exceed_max_image_size).toBeTruthy();
    expect(ERROR_HINTS.error_exceed_max_image_size).toBeTruthy();
  });

  it("builds the verified task bodies", () => {
    const skin = taskSpec("skin-analysis", { fileId: "face" });
    expect(skin.units).toBe(12);
    expect(skin.body.dst_actions).toContain("dark_circle_v2");
    expect(skin.body.dst_actions).not.toContain("hd_pore");
    const cloth = taskSpec("cloth-v4", { srcFileId: "person", refFileId: "kurta", garmentCategory: "upper_body" });
    expect(cloth.body).toEqual({ src_file_id: "person", ref_file_id: "kurta", garment_category: "upper_body" });
    const makeup = taskSpec("makeup-vto", {
      fileId: "next",
      effects: [{ category: "skin_smooth", skinSmoothStrength: 22, skinSmoothColorIntensity: 14 }],
    });
    expect(makeup.body).toMatchObject({ src_file_id: "next", version: "1.0" });
    const sim = taskSpec("skin-simulation", { fileId: "face", simulation: { dark_circle_v2: 0.5, dark_circle: 0.5, pores: 0.3 } });
    expect(sim.body).toMatchObject({ src_file_id: "face", dark_circle: 0.5, pores: 0.3 });
    expect(sim.body).not.toHaveProperty("dark_circle_v2");
    expect(sim.units).toBe(4);
    expect(() => taskSpec("makeup-vto", { fileId: "x", effects: [{ category: "foundation", palettes: [] }] })).toThrow(/skin_smooth/);
  });

  it("sniffs PNG bytes even when the URL said jpg", () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(sniffImage(png)).toEqual({ mime: "image/png", ext: "png" });
    const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    expect(sniffImage(jpg).mime).toBe("image/jpeg");
  });

  it("reads a live skin payload, including the score_info map", () => {
    const jsonFormat = {
      output: [
        { type: "pore", ui_score: 86, raw_score: 91.07 },
        { type: "dark_circle", ui_score: 63, raw_score: 45.55 },
        { type: "oiliness", ui_score: 89, raw_score: 92.95 },
        { type: "all", score: 89 },
        { type: "skin_age", score: 29 },
      ],
    };
    const fromJson = normalizeSkin(jsonFormat);
    expect(fromJson.overall).toBe(89);
    expect(fromJson.skinAge).toBe(29);
    expect(fromJson.concerns.find((item) => item.type === "dark_circle_v2")).toMatchObject({ ui: 63, raw: 45.55 });
    expect(displayScores(fromJson).darkCircles).toBe(63);

    const scoreInfo = {
      pore: { raw_score: 91.07, ui_score: 86, output_mask_name: "pore_output.png" },
      dark_circle_v2: { raw_score: 45.55, ui_score: 63, output_mask_name: "dark_circle_v2_output.png" },
      oiliness: { raw_score: 92.95, ui_score: 89, output_mask_name: "oiliness_output.png" },
      all: { score: 89 },
      skin_age: 29,
    };
    expect(displayScores(normalizeSkin(scoreInfo))).toEqual({ overall: 89, skinAge: 29, darkCircles: 63 });
  });

  it("backs off while a slow cloth task is still running", async () => {
    const waits: number[] = [];
    let calls = 0;
    let clock = 0;
    const result = await pollJson("/api/youcam/task/cloth-v4/slow?inline=1", {
      intervalMs: 4000,
      capMs: 180000,
      backoff: 1.35,
      maxIntervalMs: 12000,
      now: () => clock,
      sleep: async (ms) => {
        waits.push(ms);
        clock += ms;
      },
      fetchImpl: async () => ({
        json: async () => {
          calls += 1;
          return calls < 4 ? { taskStatus: "running" } : { taskStatus: "success", dataUrl: "data:image/jpeg;base64,xx" };
        },
      }),
    });
    expect(result.taskStatus).toBe("success");
    expect(waits[0]).toBe(4000);
    expect(waits[1]).toBeGreaterThan(waits[0]);
    expect(waits[2]).toBeGreaterThan(waits[1]);
    expect(clock).toBeLessThanOrEqual(180000);
  });

  it("polls until success without holding the loop open", async () => {
    let calls = 0;
    let clock = 0;
    const result = await pollJson("/api/youcam/task/cloth-v4/abc?inline=1", {
      now: () => clock,
      sleep: async () => {
        clock += 3000;
      },
      fetchImpl: async () => ({
        json: async () => {
          calls += 1;
          return calls < 3 ? { taskStatus: "running" } : { taskStatus: "success", dataUrl: "data:image/png;base64,xx" };
        },
      }),
    });
    expect(result.taskStatus).toBe("success");
    expect(calls).toBe(3);
  });
});

async function inputBody() {
  const { manifestToInput } = await import("@/lib/demo");
  return manifestToInput(manifest("groom"), "2026-10-28");
}

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { sessionFromManifest, type DemoManifest } from "@/lib/demo";
import { cropAroundFace, faceWidthRatio, isFaceSizeError } from "@/lib/crop";
import { ERROR_HINTS, taskSpec } from "@/lib/payloads";
import { sniffImage } from "@/lib/sniff";
import { normalizeSkin, toneFactsForDisplay } from "@/lib/skin";
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
  it("crops a face to about seventy-two percent of the width", () => {
    const crop = cropAroundFace({ width: 1080, height: 1350 }, { x: 390, y: 180, width: 280, height: 340 });
    const ratio = faceWidthRatio(crop.width, 280);
    expect(ratio).toBeGreaterThan(0.68);
    expect(ratio).toBeLessThan(0.76);
    const reported = cropAroundFace({ width: 1080, height: 1350 }, { x: 300, y: 180, width: 462, height: 520 });
    expect(reported.width).toBe(642);
    expect(reported.height).toBe(802);
    const tighter = cropAroundFace({ width: 1080, height: 1350 }, { x: 300, y: 180, width: 462, height: 520 }, { faceWidthRatio: 0.84 });
    expect(tighter.width).toBeLessThan(reported.width);
    expect(isFaceSizeError("error_src_face_too_small")).toBe(true);
    expect(isFaceSizeError("error_face_position_too_small")).toBe(true);
    expect(ERROR_HINTS.error_src_face_too_small).toMatch(/tighter/i);
    expect(ERROR_HINTS.error_face_position_too_small).toMatch(/too small/i);
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

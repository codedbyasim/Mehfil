import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { hasBannedClaim, unsourcedNumbers } from "@/lib/claims";
import { colorsClash } from "@/lib/color";
import { manifestToInput, sessionFromManifest, type DemoManifest } from "@/lib/demo";
import { allowedNumbers, chainSteps, planProse, planWedding } from "@/lib/planner";
import { mergeLlm, parseJsonLoose } from "@/server/llm";

function load(id: string): DemoManifest {
  return JSON.parse(readFileSync(path.join("public/demo", id, "manifest.json"), "utf8")) as DemoManifest;
}

describe("planner", () => {
  const groom = sessionFromManifest(load("groom"), "2026-10-28");
  const bride = sessionFromManifest(load("bride"), "2026-10-28");

  it("plans the groom week from the live scores and charges nothing", () => {
    const plan = groom.plan!;
    expect(plan.unitsCharged).toBe(0);
    expect(plan.vtoOrder).toBe("makeup-first");
    expect(plan.looks).toHaveLength(3);
    expect(plan.profile.skinHex).toBe("#805E46");
    expect(plan.profile.overall).toBe(89);
    expect(plan.profile.skinAge).toBe(29);
    expect(plan.profile.darkCircles).toBe(63);
    expect(plan.profile.skinTypeLabel).toContain("Normal");
    expect(plan.simulation.source).toBe("recorded");
    expect(plan.simulation.intensities.dark_circle).toBe(0.5);
    expect(plan.simulation.intensities.oiliness).toBe(0.4);
    const prose = planProse(plan);
    expect(prose).toContain("89");
    expect(prose).toContain("63");
    expect(prose).toContain("29");
    expect(prose.toLowerCase()).not.toContain("auburn");
    expect(prose).not.toContain("#B56637");
    expect(hasBannedClaim(prose)).toBe(false);
    const input = manifestToInput(load("groom"), "2026-10-28");
    expect(unsourcedNumbers(prose, allowedNumbers(input, plan.looks.map((look) => look.lipHex)))).toEqual([]);
    for (const look of plan.looks) {
      expect(look.effects.some((effect) => effect.category === "skin_smooth")).toBe(true);
      const smooth = look.effects.find((effect) => effect.category === "skin_smooth");
      expect(smooth?.skinSmoothStrength).not.toBe(50);
    }
    expect(plan.critique.replanned).toBe(false);
  });

  it("uses cloth-first presets for the fictional bride", () => {
    const plan = bride.plan!;
    expect(bride.placeholder).toBe(false);
    expect(bride.groomingImage).toBeUndefined();
    expect(bride.subject).toMatch(/fictional/i);
    expect(plan.vtoOrder).toBe("cloth-first");
    expect(plan.profile.skinHex).toBe("#A68265");
    expect(plan.profile.skinTypeLabel).toContain("Oily");
    expect(plan.simulation.source).toBe("recorded");
    expect(plan.simulation.intensities.oiliness).toBe(0.5);
    expect(plan.simulation.intensities.dark_circle).toBe(0.5);
    const prose = planProse(plan);
    expect(prose).toContain("80");
    expect(prose).toContain("30");
    expect(prose).toContain("68");
    expect(prose).toContain("65");
    expect(prose.toLowerCase()).not.toContain("auburn");
    expect(prose).not.toContain("#B56637");
    expect(hasBannedClaim(prose)).toBe(false);
    const mehndi = plan.looks.find((look) => look.eventId === "mehndi")!;
    const baraat = plan.looks.find((look) => look.eventId === "baraat")!;
    const walima = plan.looks.find((look) => look.eventId === "walima")!;
    expect(mehndi.why).toContain("soft fresh");
    expect(baraat.why).toContain("bold classic");
    expect(walima.why).toContain("pastel");
    expect(mehndi.garmentName).toBe("Yellow-green lehenga");
    expect(walima.garmentName).toBe("Pastel gharara");
    expect(mehndi.garmentCategory).toBe("upper_body");
    expect(mehndi.lipHex).toBe("#D0927E");
    expect(baraat.lipHex).toBe("#9E1C2C");
    expect(plan.shades.find((shade) => shade.hex === "#9E1C2C")?.name).toBe("Bold red lip");
    expect(walima.lipHex).toBe("#C98998");
    expect(lipIntensity(baraat)).toBeGreaterThan(lipIntensity(mehndi));
    for (const look of [mehndi, baraat, walima]) {
      const names = look.effects.map((effect) => effect.category);
      expect(names).toEqual(expect.arrayContaining(["skin_smooth", "foundation", "blush", "eye_shadow", "eye_liner", "lip_color"]));
      const foundation = look.effects.find((effect) => effect.category === "foundation");
      const palettes = foundation?.palettes as Array<{ color: string }>;
      expect(palettes[0].color).toBe("#A68265");
      expect(look.effects.find((effect) => effect.category === "skin_smooth")?.skinSmoothStrength).not.toBe(50);
    }
    const liner = baraat.effects.find((effect) => effect.category === "eye_liner") as { pattern?: { name?: string } };
    expect(liner.pattern?.name).toBe("FullRim6");
    const shadow = walima.effects.find((effect) => effect.category === "eye_shadow") as { palettes?: Array<{ texture?: string }> };
    expect(shadow.palettes?.[0].texture).toBe("shimmer");
    const full = planWedding({ ...manifestInput(load("bride")), framing: "full-body" });
    expect(full.looks.every((look) => look.garmentCategory === "full_body")).toBe(true);
  });

  it("replans a clashing lip once and then stops", () => {
    const input = manifestInput(load("groom"));
    expect(colorsClash("#22AA44", "#D89C30")).toBe(true);
    const forced = planWedding({ ...input, debugForceLipHex: "#22AA44" });
    expect(forced.critique.replanned).toBe(true);
    expect(forced.looks.every((look) => look.lipHex !== "#22AA44")).toBe(true);
    expect(forced.critique.eventIds.length).toBeGreaterThan(0);
    const calm = planWedding(input);
    expect(calm.critique.replanned).toBe(false);
  });

  it("orders groom tasks as makeup then each outfit", () => {
    const steps = chainSteps(groom.plan!).map((step) => step.feature);
    expect(steps.indexOf("makeup-vto")).toBeLessThan(steps.indexOf("cloth-v4"));
    expect(steps.filter((step) => step === "makeup-vto")).toHaveLength(1);
    expect(steps.filter((step) => step === "cloth-v4")).toHaveLength(3);
    const brideSteps = chainSteps(bride.plan!).map((step) => `${step.feature}:${step.eventId ?? ""}`);
    expect(brideSteps.indexOf("cloth-v4:mehndi")).toBeLessThan(brideSteps.indexOf("makeup-vto:mehndi"));
  });

  it("rejects model copy that invents a score", () => {
    const input = manifestInput(load("groom"));
    const base = planWedding(input);
    const parsed = parseJsonLoose("```json\n{\"looks\":[{\"eventId\":\"mehndi\",\"why\":\"Your score is 12 and you need treatment.\"}]}\n```");
    const merged = mergeLlm(base, input, parsed);
    expect(merged?.plan.source).toBe("rules");
    expect(merged?.plan.looks.find((look) => look.eventId === "mehndi")?.why).toBe(
      base.looks.find((look) => look.eventId === "mehndi")?.why,
    );
    expect(merged?.dropped.length).toBeGreaterThan(0);
  });

  it("shows valid model wording instead of the rule sentence", () => {
    const input = manifestInput(load("groom"));
    const base = planWedding(input);
    const why = "The mustard kurta for Mehndi stays near the measured lip.";
    const merged = mergeLlm(base, input, { looks: [{ eventId: "mehndi", why }] });
    expect(merged?.plan.source).toBe("llm");
    expect(merged?.plan.looks.find((look) => look.eventId === "mehndi")?.why).toBe(why);
    expect(merged?.dropped).toEqual([]);
  });
});

function lipIntensity(look: { effects: Array<Record<string, unknown>> }): number {
  const lip = look.effects.find((effect) => effect.category === "lip_color");
  const palettes = lip?.palettes as Array<{ colorIntensity: number }>;
  return palettes[0].colorIntensity;
}

function manifestInput(manifest: DemoManifest) {
  return manifestToInput(manifest, "2026-10-28");
}

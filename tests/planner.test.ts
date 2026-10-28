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

  it("uses cloth-first for the bride and a stronger night lip", () => {
    const plan = bride.plan!;
    expect(plan.vtoOrder).toBe("cloth-first");
    expect(plan.looks.find((look) => look.eventId === "baraat")!.timeOfDay).toBe("night");
    const night = lipIntensity(plan.looks.find((look) => look.eventId === "baraat")!);
    const dayish = lipIntensity(plan.looks.find((look) => look.eventId === "mehndi")!);
    expect(night).toBeGreaterThan(dayish);
    expect(hasBannedClaim(planProse(plan))).toBe(false);
    expect(plan.simulation.intensities.oiliness).toBeUndefined();
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
    expect(mergeLlm(base, input, parsed)?.looks.find((look) => look.eventId === "mehndi")?.why).toBe(
      base.looks.find((look) => look.eventId === "mehndi")?.why,
    );
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

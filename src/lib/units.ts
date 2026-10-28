import type { VtoOrder } from "@/lib/types";

export const FACE_TONE_UNITS = 20;
export const CLOTH_V4_UNITS = 2;
export const MAKEUP_VTO_UNITS = 1;

export function skinAnalysisCost(concerns: number, quality: "sd" | "hd" = "sd"): number {
  const table = quality === "hd" ? [12, 16, 20, 22] : [9, 12, 14, 16];
  const band = concerns <= 4 ? 0 : concerns <= 8 ? 1 : concerns <= 12 ? 2 : 3;
  return table[band];
}

export function skinSimulationCost(fields: number): number {
  if (fields <= 0) return 0;
  return fields <= 4 ? 4 : 6;
}

export const DEFAULT_SKIN_CONCERN_COUNT = 7;

export function estimateLiveUnits(options: {
  order: VtoOrder;
  events: number;
  includeAnalysis: boolean;
  simulationFields?: number;
  makeupReplans?: number;
  clothReplans?: number;
}): number {
  let units = 0;
  if (options.includeAnalysis) {
    units += skinAnalysisCost(DEFAULT_SKIN_CONCERN_COUNT) + FACE_TONE_UNITS;
  }
  const events = Math.max(0, options.events);
  const makeupReplans = options.makeupReplans ?? 0;
  const clothReplans = options.clothReplans ?? 0;
  if (options.order === "makeup-first") {
    units += MAKEUP_VTO_UNITS + events * CLOTH_V4_UNITS;
    units += makeupReplans * MAKEUP_VTO_UNITS;
    units += clothReplans * CLOTH_V4_UNITS;
  } else {
    units += events * (CLOTH_V4_UNITS + MAKEUP_VTO_UNITS);
    units += makeupReplans * MAKEUP_VTO_UNITS;
  }
  units += skinSimulationCost(options.simulationFields ?? 4);
  return units;
}

export type Limits = {
  daily: number;
  perIp: number;
  session: number;
  reservationTtlMs: number;
};

export function limitsFromEnv(env: Record<string, string | undefined> = process.env): Limits {
  const daily = Number(env.DAILY_UNIT_CAP);
  const perIp = Number(env.LIVE_RUNS_PER_IP);
  const session = Number(env.SESSION_UNIT_BUDGET);
  return {
    daily: Number.isFinite(daily) && daily > 0 ? daily : 150,
    perIp: Number.isFinite(perIp) && perIp > 0 ? perIp : 2,
    session: Number.isFinite(session) && session > 0 ? session : 60,
    reservationTtlMs: 30 * 60 * 1000,
  };
}

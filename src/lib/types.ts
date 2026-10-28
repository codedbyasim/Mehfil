export type Role = "bride" | "groom" | "guest";
export type Presentation = "woman" | "man";
export type TimeOfDay = "day" | "evening" | "night";
export type VtoOrder = "makeup-first" | "cloth-first";
export type PhotoFraming = "chest-up" | "full-body";
export type GarmentCategory =
  | "full_body"
  | "lower_body"
  | "upper_body"
  | "shoes"
  | "auto"
  | "outer";

export type Concern = {
  type: string;
  raw: number | null;
  ui: number | null;
};

export type SkinTypeMap = {
  whole?: string;
  tZone?: string;
  uZone?: string;
};

export type NormalizedSkin = {
  overall: number | null;
  skinAge: number | null;
  concerns: Concern[];
  skinType: SkinTypeMap;
};

export type NormalizedTones = {
  skinColor: string | null;
  eyeColor: string | null;
  eyeColorName: string | null;
  lipColor: string | null;
  eyebrowColor: string | null;
  hairColor: string | null;
  hairColorName: string | null;
};

export type PlanEvent = {
  id: string;
  name: string;
  date: string;
  timeOfDay: TimeOfDay;
  venue?: string;
  garmentHex: string;
  garmentName: string;
  garmentCategory: GarmentCategory;
  outfitId: string;
};

export type PlanInput = {
  role: Role;
  presentation: Presentation;
  framing: PhotoFraming;
  skin: NormalizedSkin;
  tones: NormalizedTones;
  events: PlanEvent[];
  today?: string;
  recordedSimulation?: Record<string, number> | null;
  placeholder?: boolean;
  /** Test hook. The plan route strips this. */
  debugForceLipHex?: string;
};

export type MakeupEffect = Record<string, unknown>;

export type LookPlan = {
  eventId: string;
  name: string;
  date: string;
  timeOfDay: TimeOfDay;
  venue?: string;
  outfitId: string;
  garmentName: string;
  garmentHex: string;
  garmentCategory: GarmentCategory;
  why: string;
  finish: "matte" | "satin";
  lipHex: string;
  effects: MakeupEffect[];
  replanned: boolean;
};

export type Shade = {
  id: string;
  name: string;
  hex: string;
  note: string;
  eventId: string;
};

export type CheckItem = {
  id: string;
  when: string;
  text: string;
};

export type TraceStep = {
  id: string;
  title: string;
  detail: string;
  api?: string;
  units: number;
};

export type WeddingPlan = {
  source: "rules" | "llm";
  vtoOrder: VtoOrder;
  orderReason: string;
  profile: {
    skinHex: string | null;
    lipHex: string | null;
    undertone: "warm" | "cool" | "neutral" | "unknown";
    ita: number | null;
    itaBand: string | null;
    finish: "matte" | "satin";
    skinTypeLabel: string;
  };
  looks: LookPlan[];
  simulation: {
    source: "recorded" | "planner";
    intensities: Record<string, number>;
    note: string;
  };
  shades: Shade[];
  checklist: CheckItem[];
  trace: TraceStep[];
  unitsCharged: 0;
  unitsIfLive: number;
  critique: { replanned: boolean; eventIds: string[] };
  disclaimer: string;
};

export type SessionEvent = PlanEvent & {
  tryOnImage?: string;
  beforeImage?: string;
  alternateTryOn?: string;
  alternateLabel?: string;
  garmentImage?: string;
};

export type Session = {
  mode: "demo" | "live";
  scenarioId?: string;
  placeholder: boolean;
  subject?: string;
  role: Role;
  presentation: Presentation;
  consent: boolean;
  framing: PhotoFraming;
  selfieUrl?: string;
  faceCropUrl?: string;
  simulationImage?: string;
  groomingImage?: string;
  masks?: Record<string, string>;
  eyeFocus?: { x: number; y: number; scale: number };
  events: SessionEvent[];
  plan?: WeddingPlan;
  fallbackBanner?: string;
  unitsCharged: number;
  bag: string[];
};

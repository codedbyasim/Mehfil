const BANNED =
  /\b(diagnos(?:is|e|tic)|diseases?|cures?|treat(?:ment|ments|s)?|clinical|prescriptions?|medications?|heal(?:s|ing)?|therap(?:y|ies)|dermatologists?|cancers?|medical|rosacea|melanoma|eczema|psoriasis)\b/i;

export function hasBannedClaim(text: string): boolean {
  return BANNED.test(text);
}

export function bannedClaimHits(text: string): string[] {
  const found = new Set<string>();
  const flags = text.match(new RegExp(BANNED.source, "gi")) ?? [];
  for (const hit of flags) found.add(hit.toLowerCase());
  return [...found];
}

/** Decimal numbers, after hex colors are removed so #805E46 does not become 805. */
export function numbersInText(text: string): number[] {
  const stripped = text.replace(/#[0-9A-Fa-f]{3,8}/g, " ");
  const found = stripped.match(/\d+(?:\.\d+)?/g) ?? [];
  return found.map(Number);
}

export function unsourcedNumbers(text: string, allowed: number[]): number[] {
  return numbersInText(text).filter((value) => !allowed.some((candidate) => Math.abs(candidate - value) < 0.051));
}

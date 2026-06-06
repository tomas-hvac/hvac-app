/**
 * SHARED PHYSICS & CLIMATE UTILITIES
 * 
 * This file serves as the single source of truth for HVAC physics constants,
 * regional climate design temperatures, and envelope property assumptions.
 * 
 * Both the whole-house Manual J engine (app/lib/manualJCalculations.ts)
 * and the room-level load service (lib/hvac/roomLoad/roomLoadService.ts)
 * must import from here to ensure mathematical consistency across the app.
 */

export const INDOOR_HEATING_TARGET = 70;
export const INDOOR_COOLING_TARGET = 75;

export type OregonDesignTemperatures = {
  region: string;
  heatingOutdoor: number;
  coolingOutdoor: number;
  heatingDeltaT: number;
  coolingDeltaT: number;
};

const OREGON_DESIGN_MAP: Record<string, { region: string; heatingOutdoor: number; coolingOutdoor: number }> = {
  "Portland / Beaverton / West Oregon": { region: "Portland / Beaverton / West Oregon", heatingOutdoor: 28, coolingOutdoor: 88 },
  "Coast / Marine": { region: "Coast / Marine", heatingOutdoor: 32, coolingOutdoor: 80 },
  "Central Oregon": { region: "Central Oregon", heatingOutdoor: 15, coolingOutdoor: 93 },
  "Eastern Oregon": { region: "Eastern Oregon", heatingOutdoor: 8, coolingOutdoor: 96 },
  "Southern Oregon": { region: "Southern Oregon", heatingOutdoor: 25, coolingOutdoor: 95 },
};

/**
 * Returns design temperature data for a specific Oregon region.
 */
export function getOregonDesignTemperatures(region: string): OregonDesignTemperatures {
  const design = OREGON_DESIGN_MAP[region] || OREGON_DESIGN_MAP["Portland / Beaverton / West Oregon"];
  return {
    ...design,
    heatingDeltaT: Math.max(0, INDOOR_HEATING_TARGET - design.heatingOutdoor),
    coolingDeltaT: Math.max(0, design.coolingOutdoor - INDOOR_COOLING_TARGET),
  };
}

/**
 * Returns wall U-factor based on qualitative insulation level.
 * BTU/hr·sq ft·°F
 */
export function getInsulationUFactor(quality: string): number {
  const normalized = quality.toLowerCase();
  const map: Record<string, number> = {
    excellent: 0.035, // R-28 equivalent
    good: 0.045,      // R-22 equivalent
    average: 0.055,   // R-18 equivalent
    poor: 0.075,      // R-13 equivalent
  };
  return map[normalized] || map.average;
}

/**
 * Returns window U-factor based on efficiency rating.
 */
export function getWindowUFactor(efficiency: string, verifiedUFactor?: number): number {
  if (verifiedUFactor !== undefined && !isNaN(verifiedUFactor)) {
    return verifiedUFactor;
  }
  const normalized = efficiency.toLowerCase();
  const map: Record<string, number> = {
    passive: 0.15,   // Triple glazed, low-E
    "low-e": 0.25,     // Double glazed, low-E
    standard: 0.35,  // Double glazed, clear
    drafty: 0.50,    // Single glazed
  };
  return map[normalized] || map.standard;
}

/**
 * Returns Solar Heat Gain Coefficient (SHGC) for windows.
 */
export function getWindowSHGC(efficiency: string, verifiedSHGC?: number): number {
  if (verifiedSHGC !== undefined && !isNaN(verifiedSHGC)) {
    return verifiedSHGC;
  }
  const normalized = efficiency.toLowerCase();
  const map: Record<string, number> = {
    passive: 0.25,
    "low-e": 0.40,
    standard: 0.65,
    drafty: 0.80,
  };
  return map[normalized] || map.standard;
}

/**
 * Orientation multipliers for window solar gain.
 */
export function getWindowOrientationFactor(orientation: string): number {
  const normalized = orientation.toLowerCase();
  if (normalized.includes("north")) return 0.9;
  if (normalized.includes("east")) return 1.03;
  if (normalized.includes("south")) return 1.08;
  if (normalized.includes("west")) return 1.18;
  return 1.0;
}

/**
 * Solar gain base factors by climate zone.
 */
export function getSolarGainFactor(zone: string): number {
  const map: Record<string, number> = {
    "zone 1": 180,
    "zone 2": 160,
    "zone 3": 140,
    "zone 4": 120,
    "zone 5": 100,
  };
  return map[zone.toLowerCase()] || 140;
}

import { SENSIBLE_HEAT_FACTOR, BTU_PER_TON } from "./hvacConstants";

/**
 * Manual J Calculation Service
 * 
 * Provides pure mathematical functions for residential load calculations
 * according to ACCA Manual J standards.
 */

/**
 * Calculates conductive heat transfer for a building component (wall, ceiling, floor).
 * Formula: Q = U × A × ΔT
 */
export function calculateConductiveLoad(area: number, uValue: number, deltaT: number): number {
  return uValue * area * deltaT;
}

/**
 * Calculates sensible load due to air infiltration.
 * Formula: Q = 1.08 × CFM × ΔT
 */
export function calculateInfiltrationLoad(cfm: number, deltaT: number): number {
  return SENSIBLE_HEAT_FACTOR * cfm * deltaT;
}

export interface RoomCoolingLoadInputs {
  conductiveLoads: number[];
  infiltrationLoad: number;
  internalGains?: {
    people?: number; // BTU/hr
    appliances?: number; // BTU/hr
    lighting?: number; // BTU/hr
  };
}

/**
 * Combines various load components into a total room cooling load.
 */
export function calculateRoomCoolingLoad(inputs: RoomCoolingLoadInputs): number {
  const totalConductive = inputs.conductiveLoads.reduce((sum, load) => sum + dropZero(load), 0);
  
  const peopleGain = inputs.internalGains?.people || 0;
  const applianceGain = inputs.internalGains?.appliances || 0;
  const lightingGain = inputs.internalGains?.lighting || 0;

  // TODO: Add Window Solar Heat Gain (SHGC) logic here
  // TODO: Add Latent Load (humidity) components
  // TODO: Add Ventilation air load logic

  return totalConductive + inputs.infiltrationLoad + peopleGain + applianceGain + lightingGain;
}

/**
 * Estimates required cooling tonnage from total BTU load.
 * Formula: tons = BTU / 12,000
 */
export function estimateCoolingTons(totalBtu: number): number {
  return totalBtu / BTU_PER_TON;
}

export interface ManualJValidationInputs {
  area?: number;
  uValue?: number;
  deltaT?: number;
  cfm?: number;
}

/**
 * Validates basic Manual J design inputs.
 */
export function validateManualJInputs(inputs: ManualJValidationInputs): string[] {
  const errors: string[] = [];

  if (inputs.area === undefined || inputs.area <= 0) {
    errors.push("Invalid area: must be greater than 0");
  }

  if (inputs.uValue === undefined || inputs.uValue <= 0) {
    errors.push("Invalid U-value: must be greater than 0");
  }

  if (inputs.deltaT === undefined || inputs.deltaT <= 0) {
    errors.push("Invalid deltaT: must be greater than 0");
  }

  if (inputs.cfm !== undefined && inputs.cfm < 0) {
    errors.push("Invalid airflow: CFM cannot be negative");
  }

  return errors;
}

/**
 * Helper to ensure we don't process negative values in summation.
 */
function dropZero(val: number): number {
  return Math.max(0, val);
}

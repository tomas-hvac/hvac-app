import { SENSIBLE_HEAT_FACTOR, DEFAULT_DESIGN_DELTA_T } from "./hvacConstants";

/**
 * Manual D Calculation Service
 * 
 * Provides pure mathematical functions for residential duct design
 * according to ACCA Manual D standards.
 */

/**
 * Calculates the required airflow (CFM) for a given room load.
 * Formula: CFM = BTU / (1.08 × ΔT)
 */
export function calculateRoomAirflowTarget(
  roomLoadBtu: number,
  designDeltaT = DEFAULT_DESIGN_DELTA_T
): number {
  if (designDeltaT <= 0) return 0;
  return roomLoadBtu / (SENSIBLE_HEAT_FACTOR * designDeltaT);
}

/**
 * Calculates the Available Static Pressure (ASP).
 * Formula: ASP = TESP - sum(component pressure drops)
 */
export function calculateAvailableStaticPressure(
  totalExternalStaticPressure: number,
  componentPressureDrops: number[]
): number {
  const totalComponentDrops = componentPressureDrops.reduce((sum, drop) => sum + drop, 0);
  return Math.max(0, totalExternalStaticPressure - totalComponentDrops);
}

/**
 * Calculates the Friction Rate (FR) per 100 feet.
 * Formula: FR = (ASP × 100) / TEL
 */
export function calculateFrictionRate(
  availableStaticPressure: number,
  totalEquivalentLength: number
): number {
  if (totalEquivalentLength <= 0) return 0;
  return (availableStaticPressure * 100) / totalEquivalentLength;
}

export interface ManualDValidationInputs {
  roomLoadBtu?: number;
  designDeltaT?: number;
  totalExternalStaticPressure?: number;
  totalEquivalentLength?: number;
}

/**
 * Validates basic Manual D design inputs.
 */
export function validateManualDInputs(inputs: ManualDValidationInputs): string[] {
  const errors: string[] = [];

  if (inputs.roomLoadBtu === undefined || inputs.roomLoadBtu <= 0) {
    errors.push("Missing or invalid room load (BTU)");
  }

  if (inputs.designDeltaT !== undefined && inputs.designDeltaT <= 0) {
    errors.push("Invalid design delta T");
  } else if (inputs.designDeltaT === undefined) {
    errors.push("Missing design delta T");
  }

  if (inputs.totalExternalStaticPressure === undefined || inputs.totalExternalStaticPressure <= 0) {
    errors.push("Invalid total external static pressure");
  }

  if (inputs.totalEquivalentLength === undefined || inputs.totalEquivalentLength <= 0) {
    errors.push("Invalid total equivalent length");
  }

  return errors;
}

// Manual J HVAC Load Calculation Engine
// Based on ACCA Manual J residential load calculation methodology
// Formulas organized by calculation type for modularity and future expansion

export interface ManualJInputs {
  squareFeet: number;
  ceilingHeight: number;
  insulationQuality: string;
  windowCount: number;
  windowEfficiency: string;
  climateZone: string;
  numberOfRooms: number;
  homeAge: string;
  ductLocation: string;
  occupancy: string;
}

export interface ManualJResults {
  estimatedBTU: number;
  recommendedTonnage: string;
  airflow: string;
  confidence: string;
  confidenceExplanation: string;
  whyText: string;
  // Future: room-by-room breakdown
  loadBreakdown?: {
    conduction: number;
    solarGain: number;
    infiltration: number;
    internalGains: number;
  };
}

/**
 * 1. CONDUCTION LOAD CALCULATION
 * Q = U × A × ΔT
 * Heat transfer through building envelope surfaces
 */
export function calculateConductionLoad(inputs: ManualJInputs): number {
  const { squareFeet, ceilingHeight, insulationQuality, climateZone } = inputs;

  // U-factor (thermal transmittance) based on insulation quality
  const uFactor = getInsulationUFactor(insulationQuality);

  // Surface area calculations (simplified for whole-house approach)
  const floorArea = squareFeet;
  const wallArea = Math.sqrt(squareFeet) * 4 * ceilingHeight * 0.7; // Assume 70% of perimeter has walls
  const ceilingArea = squareFeet;
  const totalArea = floorArea + wallArea + ceilingArea;

  // Design temperature difference (simplified - would vary by climate)
  const deltaT = getDesignTemperatureDifference(climateZone);

  // Q = U × A × ΔT
  const conductionLoad = uFactor * totalArea * deltaT;

  return Math.round(conductionLoad);
}

/**
 * 2. SOLAR WINDOW GAIN CALCULATION
 * Q = Area × SHGC × Factor
 * Solar heat gain through windows
 */
export function calculateSolarWindowGain(inputs: ManualJInputs): number {
  const { windowCount, windowEfficiency, climateZone } = inputs;

  // Assume average window size (placeholder - would be calculated per window)
  const avgWindowArea = 15; // sq ft per window (placeholder)
  const totalWindowArea = windowCount * avgWindowArea;

  // SHGC (Solar Heat Gain Coefficient) based on window efficiency
  const shgc = getWindowSHGC(windowEfficiency);

  // Solar gain factor based on climate and orientation (simplified)
  const solarFactor = getSolarGainFactor(climateZone);

  // Q = Area × SHGC × Factor
  const solarGain = totalWindowArea * shgc * solarFactor;

  return Math.round(solarGain);
}

/**
 * 3. WINDOW CONDUCTION GAIN CALCULATION
 * Q = Area × U × ΔT
 * Heat conduction through window glass and frames
 */
export function calculateWindowConductionGain(inputs: ManualJInputs): number {
  const { windowCount, windowEfficiency, climateZone } = inputs;

  // Assume average window size
  const avgWindowArea = 15; // sq ft per window
  const totalWindowArea = windowCount * avgWindowArea;

  // Window U-factor based on efficiency rating
  const windowUFactor = getWindowUFactor(windowEfficiency);

  // Design temperature difference
  const deltaT = getDesignTemperatureDifference(climateZone);

  // Q = Area × U × ΔT
  const windowConduction = totalWindowArea * windowUFactor * deltaT;

  return Math.round(windowConduction);
}

/**
 * 4. INFILTRATION LOAD CALCULATION
 * Q = CFM × ΔT × 1.08
 * Heat loss/gain due to air leakage
 */
export function calculateInfiltrationLoad(inputs: ManualJInputs): number {
  const { squareFeet, homeAge, climateZone } = inputs;

  // Calculate infiltration rate (CFM) based on home age and size
  const cfm = calculateInfiltrationCFM(squareFeet, homeAge);

  // Design temperature difference
  const deltaT = getDesignTemperatureDifference(climateZone);

  // Q = CFM × ΔT × 1.08 (1.08 converts to BTU/hr)
  const infiltrationLoad = cfm * deltaT * 1.08;

  return Math.round(infiltrationLoad);
}

/**
 * 5. INTERNAL GAINS CALCULATION
 * Occupants × 100 BTU/hr + appliance/internal load allowance
 */
export function calculateInternalGains(inputs: ManualJInputs): number {
  const { occupancy, numberOfRooms, squareFeet } = inputs;

  // Occupant heat gain: 100 BTU/hr per person (Manual J average)
  const occupants = getOccupantCount(occupancy);
  const occupantGain = occupants * 100;

  // Appliance and internal load allowance (simplified)
  // Includes lighting, appliances, cooking, etc.
  const applianceGain = numberOfRooms * 300; // 300 BTU/hr per room (placeholder)

  // Additional miscellaneous gains
  const miscellaneousGain = squareFeet * 0.5; // 0.5 BTU/hr per sq ft

  const totalInternalGains = occupantGain + applianceGain + miscellaneousGain;

  return Math.round(totalInternalGains);
}

/**
 * 6. TOTAL LOAD AGGREGATION
 * Combine all major loads into total BTUh
 */
export function calculateTotalLoad(inputs: ManualJInputs): {
  totalBTU: number;
  breakdown: {
    conduction: number;
    solarGain: number;
    windowConduction: number;
    infiltration: number;
    internalGains: number;
  };
} {
  const conduction = calculateConductionLoad(inputs);
  const solarGain = calculateSolarWindowGain(inputs);
  const windowConduction = calculateWindowConductionGain(inputs);
  const infiltration = calculateInfiltrationLoad(inputs);
  const internalGains = calculateInternalGains(inputs);

  // For cooling load: conduction + solar + infiltration - internal gains (negative)
  // For heating load: conduction + infiltration - internal gains
  // Use the larger absolute value for design (Manual J approach)
  const coolingLoad = conduction + solarGain + windowConduction + infiltration - internalGains;
  const heatingLoad = conduction + windowConduction + infiltration - internalGains;

  // Design load is the larger of heating or cooling load
  const totalBTU = Math.max(Math.abs(coolingLoad), Math.abs(heatingLoad));

  return {
    totalBTU,
    breakdown: {
      conduction,
      solarGain,
      windowConduction,
      infiltration,
      internalGains,
    },
  };
}

/**
 * 7. TONNAGE CONVERSION
 * BTUh / 12000 = tons
 */
export function convertToTonnage(btuLoad: number): {
  exactTonnage: number;
  recommendedRange: { min: number; max: number };
} {
  // BTUh / 12000 = tons of cooling capacity
  const exactTonnage = btuLoad / 12000;

  // Provide a range accounting for safety factors and oversizing
  const minTonnage = Math.max(1, Math.round((exactTonnage * 0.9) * 10) / 10);
  const maxTonnage = Math.round((exactTonnage * 1.1) * 10) / 10;

  return {
    exactTonnage: Math.max(1, Math.round(exactTonnage * 10) / 10),
    recommendedRange: { min: minTonnage, max: maxTonnage },
  };
}

/**
 * MAIN MANUAL J CALCULATION ENGINE
 * Orchestrates all load calculations
 */
export function calculateManualJLoad(inputs: ManualJInputs): ManualJResults {
  // Calculate total load with breakdown
  const { totalBTU, breakdown } = calculateTotalLoad(inputs);

  // Apply duct location adjustment
  const ductAdjustedLoad = applyDuctAdjustment(totalBTU, inputs.ductLocation);

  // Convert to tonnage
  const tonnage = convertToTonnage(ductAdjustedLoad);

  // Calculate airflow range (400 CFM per ton is typical)
  const airflowMin = Math.max(350, Math.round(tonnage.recommendedRange.min * 400));
  const airflowMax = Math.round(tonnage.recommendedRange.max * 450);

  // Calculate confidence score
  const confidence = calculateConfidenceScore(inputs);

  // Generate explanation
  const whyText = `Load calculation based on ${inputs.squareFeet.toLocaleString()} sq.ft. at ${inputs.ceilingHeight}ft ceilings, ${inputs.insulationQuality.toLowerCase()} insulation, ${inputs.windowCount} windows (${inputs.windowEfficiency.toLowerCase()}), ${inputs.ductLocation.toLowerCase()} ducts, ${inputs.occupancy.toLowerCase()} in ${inputs.climateZone}.`;

  return {
    estimatedBTU: ductAdjustedLoad,
    recommendedTonnage: `${tonnage.recommendedRange.min.toFixed(1)}–${tonnage.recommendedRange.max.toFixed(1)} tons`,
    airflow: `${airflowMin}–${airflowMax} cfm`,
    confidence: `${confidence.score}%`,
    confidenceExplanation: confidence.explanation,
    whyText,
    loadBreakdown: breakdown,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getInsulationUFactor(quality: string): number {
  // U-factor (BTU/hr·sq ft·°F) - lower is better insulation
  const uFactors: { [key: string]: number } = {
    "Excellent": 0.035, // R-28 equivalent
    "Good": 0.045,      // R-22 equivalent
    "Average": 0.055,   // R-18 equivalent
    "Poor": 0.075,      // R-13 equivalent
  };
  return uFactors[quality] || 0.055;
}

function getDesignTemperatureDifference(zone: string): number {
  // Simplified design ΔT (would vary by actual design conditions)
  const deltas: { [key: string]: number } = {
    "Zone 1": 25,  // Mild climate
    "Zone 2": 35,
    "Zone 3": 45,  // Moderate climate
    "Zone 4": 55,
    "Zone 5": 65,  // Cold climate
  };
  return deltas[zone] || 45;
}

function getWindowSHGC(efficiency: string): number {
  // Solar Heat Gain Coefficient (0-1, higher = more solar gain)
  const shgcValues: { [key: string]: number } = {
    "Passive": 0.25,   // Triple glazed, low-E
    "Low-E": 0.40,     // Double glazed, low-E
    "Standard": 0.65,  // Double glazed, clear
    "Drafty": 0.80,    // Single glazed or poor
  };
  return shgcValues[efficiency] || 0.65;
}

function getSolarGainFactor(zone: string): number {
  // Solar gain factor accounting for latitude and orientation
  const factors: { [key: string]: number } = {
    "Zone 1": 180,  // High solar gain areas
    "Zone 2": 160,
    "Zone 3": 140,  // Moderate
    "Zone 4": 120,
    "Zone 5": 100,  // Lower solar gain
  };
  return factors[zone] || 140;
}

function getWindowUFactor(efficiency: string): number {
  // Window U-factor (BTU/hr·sq ft·°F)
  const uFactors: { [key: string]: number } = {
    "Passive": 0.15,   // Triple glazed, low-E
    "Low-E": 0.25,     // Double glazed, low-E
    "Standard": 0.35,  // Double glazed, clear
    "Drafty": 0.50,    // Single glazed
  };
  return uFactors[efficiency] || 0.35;
}

function calculateInfiltrationCFM(squareFeet: number, homeAge: string): number {
  // Base infiltration rate (CFM) per square foot
  const baseRate = 0.05; // CFM per sq ft (placeholder - would use ACH calculations)

  // Adjustment for home age/tightness
  const ageMultiplier: { [key: string]: number } = {
    "New": 0.8,     // Tight construction
    "Modern": 1.0,  // Standard
    "Old": 1.3,     // Leaky construction
  };

  const multiplier = ageMultiplier[homeAge] || 1.0;

  return Math.round(squareFeet * baseRate * multiplier);
}

function getOccupantCount(occupancy: string): number {
  const counts: { [key: string]: number } = {
    "1-2 People": 1.5,
    "3 People": 3,
    "4-5 People": 4.5,
    "6+ People": 6,
  };
  return counts[occupancy] || 3;
}

function applyDuctAdjustment(baseLoad: number, ductLocation: string): number {
  // Duct location efficiency adjustment
  const adjustments: { [key: string]: number } = {
    "Conditioned": 0.95,  // Minimal loss
    "Crawl Space": 1.04,  // Moderate loss
    "Attic": 1.10,        // Significant loss
  };

  const adjustment = adjustments[ductLocation] || 1.06;
  return Math.round(baseLoad * adjustment);
}

function calculateConfidenceScore(inputs: ManualJInputs): { score: number; explanation: string } {
  const { squareFeet, ceilingHeight, insulationQuality, windowCount, windowEfficiency, climateZone, numberOfRooms, homeAge, ductLocation, occupancy } = inputs;

  let confidenceBase = 70;
  let missingInputs: string[] = [];

  // Check for missing or default inputs
  if (!squareFeet || squareFeet < 500) missingInputs.push("square footage");
  if (!ceilingHeight || ceilingHeight < 6) missingInputs.push("ceiling height");
  if (!windowCount) missingInputs.push("window count");
  if (!numberOfRooms) missingInputs.push("room count");

  // Quality of inputs
  if (insulationQuality === "Excellent") confidenceBase += 5;
  else if (insulationQuality === "Good") confidenceBase += 3;

  if (windowEfficiency === "Passive") confidenceBase += 4;
  else if (windowEfficiency === "Low-E") confidenceBase += 3;
  else if (windowEfficiency === "Standard") confidenceBase += 2;

  if (ductLocation === "Conditioned") confidenceBase += 3;

  if (numberOfRooms >= 4) confidenceBase += 1;

  // Climate zone specificity
  if (climateZone !== "Zone 3") confidenceBase += 1;

  const finalScore = Math.min(96, Math.max(58, confidenceBase - missingInputs.length * 12));

  const explanation = missingInputs.length
    ? `Medium confidence — verify ${missingInputs.join(", ")} for a tighter Manual J estimate.`
    : `High confidence — core project, envelope, and duct factors are captured for a strong sizing estimate.`;

  return { score: finalScore, explanation };
}
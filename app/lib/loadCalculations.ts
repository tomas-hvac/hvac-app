// Manual J-style HVAC Load Calculation Helper Functions
// Based on ACCA Manual J residential load calculation methodology

export interface LoadCalculationInputs {
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

export interface LoadCalculationResults {
  estimatedBTU: number;
  recommendedTonnage: string;
  airflow: string;
  confidence: string;
  confidenceExplanation: string;
  whyText: string;
}

/**
 * Calculate heat loss estimate based on building envelope
 * Manual J Section 3: Heat Loss Calculations
 */
export function calculateHeatLoss(inputs: LoadCalculationInputs): number {
  const { squareFeet, ceilingHeight, insulationQuality, windowCount, windowEfficiency, climateZone, homeAge } = inputs;

  // Base heat loss per square foot (BTU/hr/sq.ft) - varies by climate zone
  const baseHeatLoss = getClimateZoneHeatLoss(climateZone);

  // Insulation adjustment factor
  const insulationFactor = getInsulationFactor(insulationQuality);

  // Window adjustment factor
  const windowFactor = getWindowFactor(windowEfficiency, windowCount, squareFeet);

  // Home age/tightness factor
  const ageFactor = getHomeAgeFactor(homeAge);

  // Ceiling height volume adjustment
  const volumeFactor = 1 + (ceilingHeight - 8) * 0.04;

  return Math.round(squareFeet * baseHeatLoss * insulationFactor * windowFactor * ageFactor * volumeFactor);
}

/**
 * Calculate heat gain estimate based on solar and internal loads
 * Manual J Section 4: Heat Gain Calculations
 */
export function calculateHeatGain(inputs: LoadCalculationInputs): number {
  const { squareFeet, windowCount, windowEfficiency, climateZone, occupancy, numberOfRooms } = inputs;

  // Base solar heat gain per square foot
  const baseSolarGain = getClimateZoneSolarGain(climateZone);

  // Window solar gain factor
  const windowSolarFactor = getWindowSolarFactor(windowEfficiency);

  // Internal heat gain from occupants and appliances
  const internalGain = getInternalHeatGain(occupancy, numberOfRooms);

  // Room count adjustment
  const roomFactor = 1 + Math.min(0.12, Math.max(-0.06, (numberOfRooms - 4) * 0.02));

  const solarGain = squareFeet * baseSolarGain * windowSolarFactor * (windowCount / Math.max(1, squareFeet / 1000));
  const totalGain = (solarGain + internalGain) * roomFactor;

  return Math.round(totalGain);
}

/**
 * Apply duct system adjustment factors
 * Manual J Section 6: Duct System Calculations
 */
export function calculateDuctAdjustment(baseLoad: number, ductLocation: string): number {
  let ductFactor = 1.0;

  switch (ductLocation) {
    case "Conditioned":
      ductFactor = 0.95; // Minimal loss in conditioned space
      break;
    case "Crawl Space":
      ductFactor = 1.04; // Moderate loss
      break;
    case "Attic":
      ductFactor = 1.10; // Significant loss due to temperature difference
      break;
    default:
      ductFactor = 1.06; // Default attic assumption
  }

  return Math.round(baseLoad * ductFactor);
}

/**
 * Calculate infiltration adjustment based on home tightness
 * Manual J Section 5: Infiltration Calculations
 */
export function calculateInfiltrationAdjustment(baseLoad: number, homeAge: string, climateZone: string): number {
  // Infiltration rates based on home age and construction quality
  let infiltrationFactor = 1.0;

  switch (homeAge) {
    case "New":
      infiltrationFactor = 0.96; // Tight construction
      break;
    case "Modern":
      infiltrationFactor = 1.0; // Standard construction
      break;
    case "Old":
      infiltrationFactor = 1.10; // Looser construction, higher infiltration
      break;
    default:
      infiltrationFactor = 1.0;
  }

  // Climate zone adjustment for wind and temperature differences
  const climateAdjustment = getClimateZoneInfiltration(climateZone);

  return Math.round(baseLoad * infiltrationFactor * climateAdjustment);
}

/**
 * Calculate window adjustment factor
 * Manual J Section 4.3: Fenestration Calculations
 */
export function calculateWindowAdjustment(baseLoad: number, windowCount: number, windowEfficiency: string, squareFeet: number): number {
  // Window count factor - more windows = higher load
  const windowCountFactor = 1 + Math.min(0.18, windowCount * 0.0065);

  // Window efficiency factor
  const windowEfficiencyFactor = getWindowEfficiencyFactor(windowEfficiency);

  // Window-to-floor area ratio adjustment
  const windowAreaRatio = Math.min(0.25, windowCount * 15 / squareFeet); // Assume 15 sq.ft per window
  const areaFactor = 1 + (windowAreaRatio - 0.15) * 0.5; // Baseline 15% window area

  return Math.round(baseLoad * windowCountFactor * windowEfficiencyFactor * areaFactor);
}

/**
 * Calculate confidence score based on input completeness and quality
 * Manual J Section 1: General Requirements
 */
export function calculateConfidenceScore(inputs: LoadCalculationInputs): { score: number; explanation: string } {
  const { squareFeet, ceilingHeight, insulationQuality, windowCount, windowEfficiency, climateZone, numberOfRooms, homeAge, ductLocation, occupancy } = inputs;

  let confidenceBase = 70;
  const missingInputs: string[] = [];

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

/**
 * Main load calculation function combining all Manual J factors
 */
export function calculateManualJLoad(inputs: LoadCalculationInputs): LoadCalculationResults {
  // Calculate heat loss and heat gain components
  const heatLoss = calculateHeatLoss(inputs);
  const heatGain = calculateHeatGain(inputs);

  // Use the larger of heat loss or heat gain for sizing (Manual J design condition)
  const designLoad = Math.max(heatLoss, heatGain);

  // Apply duct and infiltration adjustments
  const ductAdjusted = calculateDuctAdjustment(designLoad, inputs.ductLocation);
  const infiltrationAdjusted = calculateInfiltrationAdjustment(ductAdjusted, inputs.homeAge, inputs.climateZone);

  // Final window adjustment
  const finalLoad = calculateWindowAdjustment(infiltrationAdjusted, inputs.windowCount, inputs.windowEfficiency, inputs.squareFeet);

  // Calculate tonnage and airflow ranges
  const tonnageExact = Math.max(1, finalLoad / 12000);
  const recommendedTonnageMin = Math.max(1, Math.round((tonnageExact * 0.92) * 10) / 10);
  const recommendedTonnageMax = Math.round((tonnageExact * 1.08) * 10) / 10;
  const airflowMin = Math.max(350, Math.round(recommendedTonnageMin * 400));
  const airflowMax = Math.round(recommendedTonnageMax * 450);

  // Calculate confidence
  const confidence = calculateConfidenceScore(inputs);

  // Generate explanation text
  const whyText = `This estimate is driven by ${inputs.squareFeet.toLocaleString()} sq.ft. of conditioned space at ${inputs.ceilingHeight}ft ceilings, ${inputs.insulationQuality.toLowerCase()} insulation, ${inputs.windowCount} ${inputs.windowCount === 1 ? "window" : "windows"} with ${inputs.windowEfficiency.toLowerCase()} glazing, ${inputs.ductLocation.toLowerCase()} ducts, and ${inputs.occupancy.toLowerCase()} occupancy in ${inputs.climateZone}.`;

  return {
    estimatedBTU: finalLoad,
    recommendedTonnage: `${recommendedTonnageMin.toFixed(1)}–${recommendedTonnageMax.toFixed(1)} tons`,
    airflow: `${airflowMin}–${airflowMax} cfm`,
    confidence: `${confidence.score}%`,
    confidenceExplanation: confidence.explanation,
    whyText,
  };
}

// Helper functions for factor calculations

function getClimateZoneHeatLoss(zone: string): number {
  const zoneMap: { [key: string]: number } = {
    "Zone 1": 15, // Mild climate
    "Zone 2": 20,
    "Zone 3": 25, // Moderate climate
    "Zone 4": 30,
    "Zone 5": 35, // Cold climate
  };
  return zoneMap[zone] || 25;
}

function getClimateZoneSolarGain(zone: string): number {
  const zoneMap: { [key: string]: number } = {
    "Zone 1": 12, // High solar gain
    "Zone 2": 15,
    "Zone 3": 18, // Moderate solar gain
    "Zone 4": 20,
    "Zone 5": 22, // Lower solar gain due to latitude
  };
  return zoneMap[zone] || 18;
}

function getClimateZoneInfiltration(zone: string): number {
  const zoneMap: { [key: string]: number } = {
    "Zone 1": 0.95, // Lower wind, less infiltration
    "Zone 2": 0.98,
    "Zone 3": 1.0,
    "Zone 4": 1.03,
    "Zone 5": 1.05, // Higher wind, more infiltration
  };
  return zoneMap[zone] || 1.0;
}

function getInsulationFactor(quality: string): number {
  const factorMap: { [key: string]: number } = {
    "Excellent": 0.92,
    "Good": 1.0,
    "Average": 1.08,
    "Poor": 1.16,
  };
  return factorMap[quality] || 1.08;
}

function getWindowFactor(efficiency: string, count: number, squareFeet: number): number {
  const efficiencyFactor = getWindowEfficiencyFactor(efficiency);
  const countFactor = 1 + Math.min(0.15, count * 0.005);
  return efficiencyFactor * countFactor;
}

function getWindowEfficiencyFactor(efficiency: string): number {
  const factorMap: { [key: string]: number } = {
    "Passive": 0.94,
    "Low-E": 0.98,
    "Standard": 1.0,
    "Drafty": 1.1,
  };
  return factorMap[efficiency] || 1.0;
}

function getWindowSolarFactor(efficiency: string): number {
  const factorMap: { [key: string]: number } = {
    "Passive": 0.85, // Low solar gain
    "Low-E": 0.90,
    "Standard": 1.0,
    "Drafty": 1.05, // Higher solar gain
  };
  return factorMap[efficiency] || 1.0;
}

function getHomeAgeFactor(age: string): number {
  const factorMap: { [key: string]: number } = {
    "New": 0.96,
    "Modern": 1.0,
    "Old": 1.10,
  };
  return factorMap[age] || 1.0;
}

function getInternalHeatGain(occupancy: string, rooms: number): number {
  const baseGainPerPerson = 230; // BTU/hr per person (Manual J average)
  const applianceGain = 1500; // BTU/hr from appliances

  let people = 3; // Default
  switch (occupancy) {
    case "1-2 People": people = 1.5; break;
    case "3 People": people = 3; break;
    case "4-5 People": people = 4.5; break;
    case "6+ People": people = 6; break;
  }

  return Math.round((people * baseGainPerPerson) + applianceGain + (rooms * 200)); // Room lighting/plug loads
}

// Manual J HVAC Load Calculation Engine
// Based on ACCA Manual J residential load calculation methodology
// Formulas organized by calculation type for modularity and future expansion

export interface ManualJInputs {
  squareFeet: number;
  ceilingHeight: number;
  insulationQuality: string;
  windowCount: number;
  windowArea: number;
  windowEfficiency: string;
  windowOrientation: string;
  climateZone: string;
  oregonRegion: string;
  numberOfRooms: number;
  homeAge: string;
  ductLocation: string;
  ductCondition: string;
  infiltrationTightness: string;
  existingSystemSize: string;
  comfortPriority: string;
  occupancy: string;
}

export interface ManualJResults {
  estimatedBTU: number;
  estimatedHeatingBTU: number;
  estimatedCoolingBTU: number;
  recommendedTonnage: string;
  recommendedEquipmentType: string;
  equipmentRecommendationExplanation: string;
  equipmentMatchConfidence: string;
  equipmentMatchExplanation: string;
  retrofitComplexityScore: string;
  retrofitComplexityExplanation: string;
  airflow: string;
  confidence: string;
  confidenceExplanation: string;
  whyText: string;
  systemVerificationNotes: string[];
  oversizingRiskNotes: string[];
  comfortRiskAreas: string[];
  systemLongevityOutlook: string;
  systemLongevityExplanation: string;
  homeownerRecommendationSummary: string[];
  // Future: room-by-room breakdown
  loadBreakdown?: {
    conduction: number;
    solarGain: number;
    windowConduction: number;
    infiltration: number;
    internalGains: number;
    heating: number;
    cooling: number;
  };
}

type LoadType = "heating" | "cooling";

type OregonDesignTemperatures = {
  region: string;
  heatingOutdoor: number;
  coolingOutdoor: number;
  heatingDeltaT: number;
  coolingDeltaT: number;
};

/**
 * 1. CONDUCTION LOAD CALCULATION
 * Q = U × A × ΔT
 * Heat transfer through building envelope surfaces
 */
export function calculateConductionLoad(inputs: ManualJInputs, loadType: LoadType = "heating"): number {
  const { squareFeet, ceilingHeight, insulationQuality } = inputs;

  // U-factor (thermal transmittance) based on insulation quality
  const uFactor = getInsulationUFactor(insulationQuality);

  // Surface area calculations (simplified for whole-house approach)
  const floorArea = squareFeet;
  const wallArea = Math.sqrt(squareFeet) * 4 * ceilingHeight * 0.7; // Assume 70% of perimeter has walls
  const ceilingArea = squareFeet;
  const totalArea = floorArea + wallArea + ceilingArea;

  const designTemps = getOregonDesignTemperatures(inputs);
  const deltaT = loadType === "heating" ? designTemps.heatingDeltaT : designTemps.coolingDeltaT;

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
  const { windowEfficiency, windowOrientation, climateZone } = inputs;

  const totalWindowArea = getEffectiveWindowArea(inputs);

  // SHGC (Solar Heat Gain Coefficient) based on window efficiency
  const shgc = getWindowSHGC(windowEfficiency);

  // Solar gain factor based on climate and orientation (simplified)
  const solarFactor = getSolarGainFactor(climateZone) * getWindowOrientationFactor(windowOrientation);

  // Q = Area × SHGC × Factor
  const solarGain = totalWindowArea * shgc * solarFactor;

  return Math.round(solarGain);
}

/**
 * 3. WINDOW CONDUCTION GAIN CALCULATION
 * Q = Area × U × ΔT
 * Heat conduction through window glass and frames
 */
export function calculateWindowConductionGain(inputs: ManualJInputs, loadType: LoadType = "heating"): number {
  const { windowEfficiency } = inputs;

  const totalWindowArea = getEffectiveWindowArea(inputs);

  // Window U-factor based on efficiency rating
  const windowUFactor = getWindowUFactor(windowEfficiency);

  const designTemps = getOregonDesignTemperatures(inputs);
  const deltaT = loadType === "heating" ? designTemps.heatingDeltaT : designTemps.coolingDeltaT;

  // Q = Area × U × ΔT
  const windowConduction = totalWindowArea * windowUFactor * deltaT;

  return Math.round(windowConduction);
}

/**
 * 4. INFILTRATION LOAD CALCULATION
 * Q = CFM × ΔT × 1.08
 * Heat loss/gain due to air leakage
 */
export function calculateInfiltrationLoad(inputs: ManualJInputs, loadType: LoadType = "heating"): number {
  const { squareFeet, homeAge, infiltrationTightness } = inputs;

  // Calculate infiltration rate (CFM) based on home age and size
  const cfm = calculateInfiltrationCFM(squareFeet, homeAge, infiltrationTightness);

  const designTemps = getOregonDesignTemperatures(inputs);
  const deltaT = loadType === "heating" ? designTemps.heatingDeltaT : designTemps.coolingDeltaT;

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
  heatingBTU: number;
  coolingBTU: number;
  dominantLoadType: "heating" | "cooling";
  breakdown: {
    conduction: number;
    solarGain: number;
    windowConduction: number;
    infiltration: number;
    internalGains: number;
    heating: number;
    cooling: number;
  };
} {
  const heatingConduction = calculateConductionLoad(inputs, "heating");
  const coolingConduction = calculateConductionLoad(inputs, "cooling");
  const solarGain = calculateSolarWindowGain(inputs);
  const heatingWindowConduction = calculateWindowConductionGain(inputs, "heating");
  const coolingWindowConduction = calculateWindowConductionGain(inputs, "cooling");
  const heatingInfiltration = calculateInfiltrationLoad(inputs, "heating");
  const coolingInfiltration = calculateInfiltrationLoad(inputs, "cooling");
  const internalGains = calculateInternalGains(inputs);

  // Cooling is more sensitive to glass area, solar exposure, and occupancy/internal gains.
  const coolingBase = (coolingConduction * 0.75) + (solarGain * 1.35) + coolingWindowConduction + (coolingInfiltration * 0.7) + (internalGains * 1.15);

  // Heating is more sensitive to envelope loss, climate-driven infiltration, insulation, and ducts.
  const heatingBase = (heatingConduction * 1.2) + heatingWindowConduction + (heatingInfiltration * 1.3) - (internalGains * 0.35);

  const coolingLoad = applyDuctAdjustmentForLoad(coolingBase, inputs.ductLocation, inputs.ductCondition, "cooling");
  const heatingLoad = applyDuctAdjustmentForLoad(Math.max(0, heatingBase), inputs.ductLocation, inputs.ductCondition, "heating");

  // Design load is the larger of heating or cooling load
  const totalBTU = Math.max(coolingLoad, heatingLoad);
  const dominantLoadType = heatingLoad >= coolingLoad ? "heating" : "cooling";

  return {
    totalBTU,
    heatingBTU: heatingLoad,
    coolingBTU: coolingLoad,
    dominantLoadType,
    breakdown: {
      conduction: Math.max(heatingConduction, coolingConduction),
      solarGain,
      windowConduction: Math.max(heatingWindowConduction, coolingWindowConduction),
      infiltration: Math.max(heatingInfiltration, coolingInfiltration),
      internalGains,
      heating: heatingLoad,
      cooling: coolingLoad,
    },
  };
}

/**
 * 7. TONNAGE CONVERSION
 * BTUh / 12000 = tons
 */
export function convertToTonnage(btuLoad: number, comfortPriority = "Balanced Comfort"): {
  exactTonnage: number;
  recommendedRange: { min: number; max: number };
} {
  // BTUh / 12000 = tons of cooling capacity
  const exactTonnage = btuLoad / 12000;
  const sizingPreference = getComfortSizingPreference(comfortPriority);

  // Provide a range accounting for safety factors and oversizing
  const minTonnage = Math.max(1, Math.round((exactTonnage * sizingPreference.minFactor) * 10) / 10);
  const maxTonnage = Math.round((exactTonnage * sizingPreference.maxFactor) * 10) / 10;

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
  const { totalBTU, heatingBTU, coolingBTU, dominantLoadType, breakdown } = calculateTotalLoad(inputs);

  // Convert to tonnage
  const tonnage = convertToTonnage(totalBTU, inputs.comfortPriority);

  // Calculate airflow range (400 CFM per ton is typical)
  const airflowMin = Math.max(350, Math.round(tonnage.recommendedRange.min * 400));
  const airflowMax = Math.round(tonnage.recommendedRange.max * 450);

  const existingSystemComparison = getExistingSystemComparison(inputs.existingSystemSize, tonnage.recommendedRange);
  const systemVerificationNotes = getSystemVerificationNotes(inputs, tonnage.recommendedRange);
  const loadBalanceExplanation = ` Heating load is ${heatingBTU.toLocaleString()} BTU, cooling load is ${coolingBTU.toLocaleString()} BTU, and tonnage is based on the larger ${dominantLoadType} load.`;
  const designTemps = getOregonDesignTemperatures(inputs);
  const designTemperatureNote = ` Oregon ${designTemps.region} design defaults use ${designTemps.heatingOutdoor}°F heating outdoor design and ${designTemps.coolingOutdoor}°F cooling outdoor design, with indoor targets of 70°F heating and 75°F cooling.`;
  const ductConditionNote = getDuctConditionNote(inputs.ductCondition);
  const comfortPriorityNote = getComfortPriorityNote(inputs.comfortPriority);

  // Calculate confidence score
  const confidence = calculateConfidenceScore(inputs, existingSystemComparison, loadBalanceExplanation, designTemperatureNote, ductConditionNote, comfortPriorityNote);
  const equipmentRecommendation = getEquipmentRecommendation(inputs, heatingBTU, coolingBTU, tonnage.recommendedRange, confidence.score);
  const oversizingRiskNotes = getOversizingRiskNotes(inputs, tonnage.recommendedRange, equipmentRecommendation.type);
  const equipmentMatch = getEquipmentMatchConfidence(inputs, heatingBTU, coolingBTU, tonnage.recommendedRange, confidence.score, equipmentRecommendation.type, systemVerificationNotes);
  const retrofitComplexity = getRetrofitComplexityScore(inputs, tonnage.recommendedRange, confidence.score, systemVerificationNotes);
  const comfortRiskAreas = getComfortRiskAreas(inputs, tonnage.recommendedRange);
  const systemLongevity = getSystemLongevityOutlook(inputs, tonnage.recommendedRange, equipmentRecommendation.type, systemVerificationNotes);
  const homeownerRecommendationSummary = getHomeownerRecommendationSummary(inputs, tonnage.recommendedRange, equipmentRecommendation, systemVerificationNotes, oversizingRiskNotes);

  // Generate explanation
  const windowAreaText = inputs.windowArea > 0
    ? `${inputs.windowArea.toLocaleString()} sq.ft. of window area`
    : `${inputs.windowCount} windows with estimated glass area`;
  const comparisonText = existingSystemComparison ? ` ${existingSystemComparison}` : "";
  const whyText = `Load calculation based on ${inputs.squareFeet.toLocaleString()} sq.ft. at ${inputs.ceilingHeight}ft ceilings, ${inputs.insulationQuality.toLowerCase()} insulation, ${windowAreaText} (${inputs.windowEfficiency.toLowerCase()}), ${inputs.windowOrientation.toLowerCase()} exposure, ${inputs.ductLocation.toLowerCase()} ducts, ${inputs.ductCondition.toLowerCase()} duct condition, ${inputs.infiltrationTightness.toLowerCase()} home tightness/infiltration, ${inputs.occupancy.toLowerCase()}, and ${inputs.comfortPriority.toLowerCase()} comfort priority in ${inputs.oregonRegion}.${designTemperatureNote}${ductConditionNote}${comfortPriorityNote} Heating load is ${heatingBTU.toLocaleString()} BTU and cooling load is ${coolingBTU.toLocaleString()} BTU, so recommended tonnage uses the larger ${dominantLoadType} load. ${equipmentRecommendation.explanation}${comparisonText}`;

  return {
    estimatedBTU: totalBTU,
    estimatedHeatingBTU: heatingBTU,
    estimatedCoolingBTU: coolingBTU,
    recommendedTonnage: `${tonnage.recommendedRange.min.toFixed(1)}–${tonnage.recommendedRange.max.toFixed(1)} tons`,
    recommendedEquipmentType: equipmentRecommendation.type,
    equipmentRecommendationExplanation: equipmentRecommendation.explanation,
    equipmentMatchConfidence: equipmentMatch.confidence,
    equipmentMatchExplanation: equipmentMatch.explanation,
    retrofitComplexityScore: retrofitComplexity.score,
    retrofitComplexityExplanation: retrofitComplexity.explanation,
    airflow: `${airflowMin}–${airflowMax} cfm`,
    confidence: `${confidence.score}%`,
    confidenceExplanation: confidence.explanation,
    whyText,
    systemVerificationNotes,
    oversizingRiskNotes,
    comfortRiskAreas,
    systemLongevityOutlook: systemLongevity.outlook,
    systemLongevityExplanation: systemLongevity.explanation,
    homeownerRecommendationSummary,
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

function getOregonDesignTemperatures(inputs: ManualJInputs): OregonDesignTemperatures {
  const indoorHeatingTarget = 70;
  const indoorCoolingTarget = 75;
  const designByRegion: { [key: string]: { region: string; heatingOutdoor: number; coolingOutdoor: number } } = {
    "Portland / Beaverton / West Oregon": { region: "Portland / Beaverton / West Oregon", heatingOutdoor: 28, coolingOutdoor: 88 },
    "Coast / Marine": { region: "Coast / Marine", heatingOutdoor: 32, coolingOutdoor: 80 },
    "Central Oregon": { region: "Central Oregon", heatingOutdoor: 15, coolingOutdoor: 93 },
    "Eastern Oregon": { region: "Eastern Oregon", heatingOutdoor: 8, coolingOutdoor: 96 },
    "Southern Oregon": { region: "Southern Oregon", heatingOutdoor: 25, coolingOutdoor: 95 },
  };
  const design = designByRegion[inputs.oregonRegion] || designByRegion["Portland / Beaverton / West Oregon"];

  return {
    ...design,
    heatingDeltaT: indoorHeatingTarget - design.heatingOutdoor,
    coolingDeltaT: design.coolingOutdoor - indoorCoolingTarget,
  };
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

function getWindowOrientationFactor(orientation: string): number {
  const factors: { [key: string]: number } = {
    "North / Low Solar Gain": 0.9,
    "East / Morning Sun": 1.03,
    "South / Moderate Solar Gain": 1.08,
    "West / High Afternoon Sun": 1.18,
    "Mixed / Average Exposure": 1.0,
  };
  return factors[orientation] || 1.0;
}

function getEffectiveWindowArea(inputs: ManualJInputs): number {
  return inputs.windowArea > 0 ? inputs.windowArea : inputs.windowCount * 15;
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

function calculateInfiltrationCFM(squareFeet: number, homeAge: string, infiltrationTightness: string): number {
  // Base infiltration rate (CFM) per square foot
  const baseRate = 0.05; // CFM per sq ft (placeholder - would use ACH calculations)

  // Adjustment for home age/tightness
  const ageMultiplier: { [key: string]: number } = {
    "New": 0.8,     // Tight construction
    "Modern": 1.0,  // Standard
    "Old": 1.3,     // Leaky construction
  };

  const tightnessMultiplier: { [key: string]: number } = {
    "Tight / Air Sealed": 0.85,
    "Average": 1.0,
    "Leaky / Older Home": 1.15,
  };

  const multiplier = (ageMultiplier[homeAge] || 1.0) * (tightnessMultiplier[infiltrationTightness] || 1.0);

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

function applyDuctAdjustmentForLoad(baseLoad: number, ductLocation: string, ductCondition: string, loadType: "heating" | "cooling"): number {
  // Duct location efficiency adjustment
  const heatingAdjustments: { [key: string]: number } = {
    "Conditioned": 0.95,
    "Crawl Space": 1.05,
    "Attic": 1.12,
  };
  const coolingAdjustments: { [key: string]: number } = {
    "Conditioned": 0.97,
    "Crawl Space": 1.03,
    "Attic": 1.08,
  };

  const adjustments = loadType === "heating" ? heatingAdjustments : coolingAdjustments;
  const locationAdjustment = adjustments[ductLocation] || (loadType === "heating" ? 1.08 : 1.05);
  return Math.round(baseLoad * locationAdjustment * getDuctConditionFactor(ductCondition));
}

function getDuctConditionFactor(ductCondition: string): number {
  const factors: { [key: string]: number } = {
    "Excellent / Sealed": 0.95,
    "Average": 1.0,
    "Poor / Leaking": 1.12,
  };
  return factors[ductCondition] || 1.0;
}

function getDuctConditionNote(ductCondition: string): string {
  if (ductCondition === "Excellent / Sealed") {
    return " Excellent sealed duct condition reduces airflow and distribution losses.";
  }
  if (ductCondition === "Poor / Leaking") {
    return " Existing duct condition may reduce system efficiency and should be verified before final equipment selection.";
  }
  return " Average duct condition is treated as neutral for distribution losses.";
}

function getComfortSizingPreference(comfortPriority: string): { minFactor: number; maxFactor: number } {
  if (comfortPriority === "Maximum Efficiency") {
    return { minFactor: 0.88, maxFactor: 1.03 };
  }
  if (comfortPriority === "Maximum Comfort / Humidity Control") {
    return { minFactor: 0.9, maxFactor: 1.04 };
  }
  return { minFactor: 0.9, maxFactor: 1.1 };
}

function getComfortPriorityNote(comfortPriority: string): string {
  if (comfortPriority === "Maximum Efficiency") {
    return " Equipment recommendation favors a tighter sizing range, efficient modulation, and energy savings.";
  }
  if (comfortPriority === "Maximum Comfort / Humidity Control") {
    return " Comfort-focused settings favor inverter-style modulation and improved humidity control while reducing aggressive oversizing.";
  }
  return " Balanced comfort keeps sizing behavior neutral.";
}

function getEquipmentRecommendation(
  inputs: ManualJInputs,
  heatingBTU: number,
  coolingBTU: number,
  recommendedRange: { min: number; max: number },
  confidenceScore: number
): { type: string; explanation: string } {
  const loadSpread = Math.abs(heatingBTU - coolingBTU) / Math.max(heatingBTU, coolingBTU, 1);
  const highWindowExposure = inputs.windowOrientation === "West / High Afternoon Sun"
    || inputs.windowOrientation === "South / Moderate Solar Gain"
    || inputs.windowArea >= inputs.squareFeet * 0.16;
  const largerHome = inputs.squareFeet >= 2400;
  const tightSizingRange = recommendedRange.max - recommendedRange.min <= 0.4;
  const retrofitUncertainty = inputs.ductCondition === "Poor / Leaking"
    || inputs.ductLocation === "Attic"
    || inputs.ductLocation === "Crawl Space";
  const variableLoadProfile = loadSpread >= 0.25 || highWindowExposure || largerHome;
  const simpleApplication = inputs.squareFeet <= 1800
    && !variableLoadProfile
    && inputs.comfortPriority === "Balanced Comfort";

  if (
    inputs.comfortPriority === "Maximum Comfort / Humidity Control"
    || (inputs.comfortPriority === "Maximum Efficiency" && (variableLoadProfile || tightSizingRange))
    || (variableLoadProfile && highWindowExposure && !retrofitUncertainty)
  ) {
    return {
      type: "Inverter / Variable Speed",
      explanation: "Variable-speed inverter system recommended for improved comfort and modulation.",
    };
  }

  if ((confidenceScore < 74 && retrofitUncertainty) || simpleApplication) {
    return {
      type: "Single-Stage",
      explanation: "Single-stage system may be acceptable for simpler retrofit conditions.",
    };
  }

  return {
    type: "Two-Stage",
    explanation: "Two-stage equipment provides balanced efficiency and comfort.",
  };
}

function getEquipmentMatchConfidence(
  inputs: ManualJInputs,
  heatingBTU: number,
  coolingBTU: number,
  recommendedRange: { min: number; max: number },
  confidenceScore: number,
  equipmentType: string,
  systemVerificationNotes: string[]
): { confidence: string; explanation: string } {
  const loadSpread = Math.abs(heatingBTU - coolingBTU) / Math.max(heatingBTU, coolingBTU, 1);
  const stableLoadProfile = loadSpread <= 0.2;
  const balancedTonnageRange = recommendedRange.max - recommendedRange.min <= 0.6;
  const goodDuctCondition = inputs.ductCondition === "Excellent / Sealed" || inputs.ductCondition === "Average";
  const comfortOrientedSetup = inputs.comfortPriority !== "Balanced Comfort";
  const ductConcern = inputs.ductCondition === "Poor / Leaking"
    || inputs.ductLocation === "Attic"
    || inputs.ductLocation === "Crawl Space";
  const infiltrationConcern = inputs.infiltrationTightness === "Leaky / Older Home";
  const airflowConcern = systemVerificationNotes.some((note) => note.includes("airflow") || note.includes("Static pressure"));
  const existingTons = parseExistingSystemTons(inputs.existingSystemSize);
  const oversizedExistingEquipment = existingTons > recommendedRange.max && existingTons > 0;
  const conflictingInputs = equipmentType === "Single-Stage" && inputs.comfortPriority === "Maximum Comfort / Humidity Control";

  if (confidenceScore < 72 || airflowConcern || conflictingInputs) {
    return {
      confidence: "Further Verification Recommended",
      explanation: "Duct and airflow conditions suggest additional verification before final equipment selection.",
    };
  }

  if (ductConcern || infiltrationConcern || oversizedExistingEquipment) {
    return {
      confidence: "Moderate Match",
      explanation: "Duct, infiltration, or existing equipment conditions add retrofit uncertainty to the equipment match.",
    };
  }

  if (stableLoadProfile && balancedTonnageRange && goodDuctCondition && comfortOrientedSetup) {
    return {
      confidence: "Strong Match",
      explanation: equipmentType === "Inverter / Variable Speed"
        ? "Home profile strongly supports inverter-style equipment."
        : "Home profile strongly supports the recommended equipment type.",
    };
  }

  return {
    confidence: "Good Match",
    explanation: "Home profile generally supports the recommended equipment type with normal field verification.",
  };
}

function getRetrofitComplexityScore(
  inputs: ManualJInputs,
  recommendedRange: { min: number; max: number },
  confidenceScore: number,
  systemVerificationNotes: string[]
): { score: string; explanation: string } {
  let complexity = 0;
  const existingTons = parseExistingSystemTons(inputs.existingSystemSize);
  const largeTonnageCorrection = existingTons > 0
    && Math.abs(existingTons - ((recommendedRange.min + recommendedRange.max) / 2)) >= 0.75;
  const airflowOrStaticWarning = systemVerificationNotes.some((note) => note.includes("airflow") || note.includes("Static pressure"));
  const highSolarExposure = inputs.windowOrientation === "West / High Afternoon Sun"
    || inputs.windowOrientation === "South / Moderate Solar Gain";

  if (inputs.ductCondition === "Poor / Leaking") complexity += 3;
  else if (inputs.ductCondition === "Average") complexity += 1;

  if (inputs.ductLocation === "Attic" || inputs.ductLocation === "Crawl Space") complexity += 2;
  if (inputs.infiltrationTightness === "Leaky / Older Home") complexity += 2;
  if (inputs.homeAge === "Old") complexity += 2;
  else if (inputs.homeAge === "Modern") complexity += 1;
  if (largeTonnageCorrection) complexity += 2;
  if (highSolarExposure) complexity += 1;
  if (airflowOrStaticWarning) complexity += 3;
  if (confidenceScore < 74) complexity += 2;

  if (
    inputs.homeAge !== "Old"
    && inputs.infiltrationTightness === "Tight / Air Sealed"
    && inputs.ductCondition === "Excellent / Sealed"
    && inputs.ductLocation === "Conditioned"
  ) {
    complexity = Math.max(0, complexity - 2);
  }

  if (complexity >= 9) {
    return {
      score: "High Verification Recommended",
      explanation: "Retrofit conditions may require airflow verification and duct improvements.",
    };
  }

  if (complexity >= 6) {
    return {
      score: "Complex Retrofit",
      explanation: "Home profile indicates higher installation sensitivity.",
    };
  }

  if (complexity >= 3) {
    return {
      score: "Moderate Retrofit",
      explanation: "Retrofit conditions appear manageable with normal duct and airflow verification.",
    };
  }

  return {
    score: "Simple Retrofit",
    explanation: "Existing duct system appears compatible with calculated load.",
  };
}

function getComfortRiskAreas(inputs: ManualJInputs, recommendedRange: { min: number; max: number }): string[] {
  const risks: string[] = [];
  const existingTons = parseExistingSystemTons(inputs.existingSystemSize);
  const oversizedExistingEquipment = existingTons > 0
    && existingTons > recommendedRange.max
    && (existingTons - recommendedRange.max >= 0.5 || existingTons / Math.max(recommendedRange.max, 1) >= 1.15);

  if (inputs.windowOrientation === "West / High Afternoon Sun") {
    risks.push("Solar Heat Gain Risk: West-facing glass may create afternoon overheating.");
  }

  if (inputs.ductCondition === "Poor / Leaking") {
    risks.push("Airflow Imbalance Risk: Existing duct conditions may affect room-to-room airflow balance.");
  }

  if (inputs.infiltrationTightness === "Leaky / Older Home") {
    risks.push("Humidity Control Risk: Leaky homes may experience less stable comfort and humidity control.");
  }

  if (
    inputs.ductLocation === "Attic"
    || inputs.ductLocation === "Crawl Space"
    || (inputs.squareFeet >= 2400 && inputs.ductLocation === "Attic")
  ) {
    risks.push("Duct Loss Risk: Duct location may increase distribution losses and room-to-room variation.");
  }

  if (oversizedExistingEquipment) {
    risks.push("Oversized System Comfort Risk: Oversized systems may reduce humidity control performance.");
  }

  if (!risks.length) {
    risks.push("No elevated comfort risk areas detected from the current home profile.");
  }

  return Array.from(new Set(risks));
}

function getSystemLongevityOutlook(
  inputs: ManualJInputs,
  recommendedRange: { min: number; max: number },
  equipmentType: string,
  systemVerificationNotes: string[]
): { outlook: string; explanation: string } {
  let stress = 0;
  const existingTons = parseExistingSystemTons(inputs.existingSystemSize);
  const oversizedExistingEquipment = existingTons > 0
    && existingTons > recommendedRange.max
    && (existingTons - recommendedRange.max >= 0.5 || existingTons / Math.max(recommendedRange.max, 1) >= 1.15);
  const airflowVerificationNeeded = systemVerificationNotes.some((note) => note.includes("airflow") || note.includes("Static pressure"));
  const goodAirflowProfile = inputs.ductCondition === "Excellent / Sealed" && inputs.ductLocation === "Conditioned";
  const inverterStrategy = equipmentType === "Inverter / Variable Speed";

  if (oversizedExistingEquipment) stress += 3;
  if (inputs.ductCondition === "Poor / Leaking") stress += 3;
  else if (inputs.ductCondition === "Average") stress += 1;
  if (inputs.infiltrationTightness === "Leaky / Older Home") stress += 2;
  if (inputs.ductLocation === "Attic" || inputs.ductLocation === "Crawl Space") stress += 1;
  if (airflowVerificationNeeded) stress += 3;
  if (inverterStrategy) stress -= 2;
  if (goodAirflowProfile) stress -= 2;

  if (airflowVerificationNeeded) {
    return {
      outlook: "Further Airflow Verification Recommended",
      explanation: "Existing duct conditions may increase airflow-related system stress.",
    };
  }

  if (stress >= 5) {
    return {
      outlook: "Elevated System Stress",
      explanation: "Duct leakage, sizing, or infiltration conditions may increase long-term operating strain.",
    };
  }

  if (stress >= 3) {
    return {
      outlook: "Moderate Runtime Stress",
      explanation: "Runtime stability appears workable, with some retrofit factors that should be monitored.",
    };
  }

  if (inverterStrategy) {
    return {
      outlook: "Stable Long-Term Operation",
      explanation: "Variable-speed operation may improve runtime stability and comfort consistency.",
    };
  }

  return {
    outlook: "Stable Long-Term Operation",
    explanation: "Balanced load profile supports stable long-term operation.",
  };
}

function getHomeownerRecommendationSummary(
  inputs: ManualJInputs,
  recommendedRange: { min: number; max: number },
  equipmentRecommendation: { type: string; explanation: string },
  systemVerificationNotes: string[],
  oversizingRiskNotes: string[]
): string[] {
  const summary: string[] = [];
  const tonnageRange = `${recommendedRange.min.toFixed(1)}-${recommendedRange.max.toFixed(1)} tons`;
  const comfortGoal = inputs.comfortPriority === "Maximum Comfort / Humidity Control"
    ? "improved comfort, steadier airflow, and humidity management"
    : inputs.comfortPriority === "Maximum Efficiency"
    ? "energy savings with a carefully sized system"
    : "a balanced blend of comfort and efficiency";
  const hasDuctConcern = inputs.ductCondition === "Poor / Leaking"
    || systemVerificationNotes.some((note) => note.includes("airflow") || note.includes("Static pressure"));
  const hasOversizingConcern = oversizingRiskNotes.some((note) => note.includes("larger than actual calculated demand") || note.includes("short cycle"));

  summary.push(`Based on the calculated heating and cooling load, a ${tonnageRange} ${equipmentRecommendation.type.toLowerCase()} system is recommended for ${comfortGoal}.`);
  summary.push(`This recommendation reflects the home's insulation, window exposure, duct conditions, and larger dominant load so the system is sized to the actual demand instead of simply matching old equipment.`);

  if (inputs.comfortPriority === "Maximum Comfort / Humidity Control" || equipmentRecommendation.type === "Inverter / Variable Speed") {
    summary.push("A variable-speed approach can support quieter operation, more consistent room comfort, and improved humidity control.");
  } else if (equipmentRecommendation.type === "Two-Stage") {
    summary.push("Two-stage equipment provides a premium balance of efficiency, comfort, and practical retrofit value.");
  } else {
    summary.push("A simpler equipment approach may be appropriate when duct conditions and airflow are verified in the field.");
  }

  if (hasDuctConcern) {
    summary.push("Existing duct conditions should be verified before final equipment selection to support proper airflow and long-term system performance.");
  }

  if (hasOversizingConcern) {
    summary.push("The calculated load suggests the existing system may be larger than necessary for the actual heating and cooling demand.");
  }

  return summary;
}

function getExistingSystemComparison(existingSystemSize: string, recommendedRange: { min: number; max: number }): string {
  const existingTons = parseExistingSystemTons(existingSystemSize);

  if (!existingTons) return "";
  if (existingTons > recommendedRange.max) return "Existing system may be oversized.";
  if (existingTons < recommendedRange.min) return "Existing system may be undersized.";
  return "Existing system size appears close to calculated range.";
}

function parseExistingSystemTons(existingSystemSize: string): number {
  if (existingSystemSize === "Unknown") return 0;
  return parseFloat(existingSystemSize.replace(/[^\d.]/g, "")) || 0;
}

function getSystemVerificationNotes(inputs: ManualJInputs, recommendedRange: { min: number; max: number }): string[] {
  const notes: string[] = [];
  const existingTons = parseExistingSystemTons(inputs.existingSystemSize);
  const recommendedIsSignificantlyLarger = existingTons > 0
    && recommendedRange.min > existingTons
    && (recommendedRange.min - existingTons >= 0.5 || recommendedRange.min / existingTons >= 1.15);

  if (recommendedIsSignificantlyLarger) {
    notes.push("Static pressure and airflow verification recommended before final equipment selection.");
    notes.push("Return sizing should be confirmed.");
  }

  if (inputs.ductCondition === "Poor / Leaking") {
    notes.push("Existing duct system may require airflow verification.");
  }

  if (inputs.infiltrationTightness === "Leaky / Older Home" && inputs.ductCondition === "Poor / Leaking") {
    notes.push("Leaky envelope and duct conditions may reduce comfort and efficiency until verified or corrected.");
  }

  if (!notes.length) {
    notes.push("Existing duct system appears compatible with calculated range.");
  }

  return Array.from(new Set(notes));
}

function getOversizingRiskNotes(inputs: ManualJInputs, recommendedRange: { min: number; max: number }, equipmentType: string): string[] {
  const notes: string[] = [];
  const existingTons = parseExistingSystemTons(inputs.existingSystemSize);
  const existingIsSignificantlyLarger = existingTons > 0
    && existingTons > recommendedRange.max
    && (existingTons - recommendedRange.max >= 0.5 || existingTons / Math.max(recommendedRange.max, 1) >= 1.15);
  const humidityFocused = inputs.comfortPriority === "Maximum Comfort / Humidity Control";
  const goodEnvelope = (inputs.insulationQuality === "Good" || inputs.insulationQuality === "Excellent")
    && inputs.infiltrationTightness === "Tight / Air Sealed";

  if (existingIsSignificantlyLarger) {
    notes.push("Existing system may be larger than actual calculated demand.");
    notes.push("Oversized systems may short cycle, which can reduce comfort consistency.");
  }

  if (humidityFocused) {
    notes.push("Humidity control may suffer when equipment capacity is selected too aggressively.");
  }

  if (goodEnvelope) {
    notes.push("Good insulation and tight infiltration support a more conservative sizing range.");
  }

  if (equipmentType === "Inverter / Variable Speed") {
    notes.push("Variable-speed systems may reduce oversizing impact through modulation.");
  }

  if (!notes.length) {
    notes.push("Calculated range does not indicate elevated oversizing risk.");
  }

  return Array.from(new Set(notes));
}

function calculateConfidenceScore(inputs: ManualJInputs, existingSystemComparison: string, loadBalanceExplanation: string, designTemperatureNote: string, ductConditionNote: string, comfortPriorityNote: string): { score: number; explanation: string } {
  const { squareFeet, ceilingHeight, insulationQuality, windowCount, windowArea, windowEfficiency, windowOrientation, climateZone, numberOfRooms, ductLocation, ductCondition, infiltrationTightness } = inputs;

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

  if (windowArea > 0) confidenceBase += 2;

  if (windowOrientation) confidenceBase += 2;

  if (ductLocation === "Conditioned") confidenceBase += 3;
  if (ductCondition === "Excellent / Sealed") confidenceBase += 2;

  if (infiltrationTightness) confidenceBase += 2;

  if (numberOfRooms >= 4) confidenceBase += 1;

  // Climate zone specificity
  if (climateZone !== "Zone 3") confidenceBase += 1;
  if (ductLocation === "Attic" || ductLocation === "Crawl Space") confidenceBase -= 2;

  const finalScore = Math.min(96, Math.max(58, confidenceBase - missingInputs.length * 12));

  const tightnessPhrase = infiltrationTightness
    ? ` Home tightness/infiltration is set to ${infiltrationTightness.toLowerCase()}, so air leakage is included in the load.`
    : "";
  const orientationPhrase = windowOrientation
    ? ` Window orientation is set to ${windowOrientation.toLowerCase()}, so solar exposure is included in the load.`
    : "";
  const windowAreaPhrase = windowArea > 0
    ? ` Window area is set to ${windowArea.toLocaleString()} sq.ft., so glass load is calculated from measured area.`
    : " Window area is estimated from window count.";
  const existingSystemPhrase = existingSystemComparison
    ? ` ${existingSystemComparison}`
    : "";

  const explanation = missingInputs.length
    ? `Medium confidence — verify ${missingInputs.join(", ")} for a tighter Manual J estimate.${tightnessPhrase}${orientationPhrase}${windowAreaPhrase}${designTemperatureNote}${ductConditionNote}${comfortPriorityNote}${loadBalanceExplanation}${existingSystemPhrase}`
    : `High confidence — core project, envelope, window area, duct condition, infiltration, solar exposure, comfort priority, and Oregon design temperature factors are captured for a strong sizing estimate.${tightnessPhrase}${orientationPhrase}${windowAreaPhrase}${designTemperatureNote}${ductConditionNote}${comfortPriorityNote}${loadBalanceExplanation}${existingSystemPhrase}`;

  return { score: finalScore, explanation };
}

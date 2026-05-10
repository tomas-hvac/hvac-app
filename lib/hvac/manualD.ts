export type DuctShape = "round" | "rectangular";
export type DuctType = "main" | "branch";
export type DuctMaterial = "metal";
export type DuctElbowStyle = "radius";
export type VelocityStatus = "low" | "acceptable" | "high";

export type DuctSizingCandidate = {
  shape: DuctShape;
  areaSquareFeet: number;
  velocityFpm: number;
};

export type RoundDuctSizingCandidate = DuctSizingCandidate & {
  shape: "round";
  diameterInches: number;
};

export type DuctSizingRecommendation = DuctSizingCandidate &
  VelocityWarning & {
    ductType: DuctType;
  };

export type RoundDuctSizingRecommendation = VelocityWarning & {
  diameterInches: number;
  areaSqFt: number;
  velocityFpm: number;
};

export type DuctDimensions = {
  shape: DuctShape;
  diameterInches?: number;
  widthInches?: number;
  heightInches?: number;
};

export type VelocityWarning = {
  status: VelocityStatus;
  message: string;
};

export const ROUND_RESIDENTIAL_DUCT_SIZES_INCHES = [
  4, 5, 6, 7, 8, 9, 10, 12, 14, 16, 18,
] as const;

export const DEFAULT_DUCT_SHAPE: DuctShape = "round";
export const DEFAULT_DUCT_MATERIAL: DuctMaterial = "metal";
export const DEFAULT_DUCT_ELBOW_STYLE: DuctElbowStyle = "radius";
export const ROUND_METAL_DESIGN_BASIS_MESSAGE =
  "Recommendations are based on round metal duct design routed inside the conditioned envelope, with radius elbows preferred for future equivalent length calculations.";

export const DUCT_MAX_VELOCITY_FPM: Record<DuctType, number> = {
  main: 900,
  branch: 700,
};

export function calculateAvailableStaticPressure(
  totalExternalStaticPressure: number,
  componentPressureDrops: number[] = []
) {
  const totalDrops = componentPressureDrops.reduce((sum, drop) => sum + Math.max(0, drop), 0);
  return Math.max(0, totalExternalStaticPressure - totalDrops);
}

export function calculateTotalEquivalentLength(
  straightRunLengthFeet: number,
  fittingEquivalentLengthsFeet: number[] = []
) {
  const fittingLength = fittingEquivalentLengthsFeet.reduce(
    (sum, length) => sum + Math.max(0, length),
    0
  );

  return Math.max(0, straightRunLengthFeet) + fittingLength;
}

export function calculateFrictionRate(
  availableStaticPressure: number,
  totalEquivalentLengthFeet: number
) {
  if (totalEquivalentLengthFeet <= 0) return 0;
  return (Math.max(0, availableStaticPressure) * 100) / totalEquivalentLengthFeet;
}

export function calculateDuctAreaSquareFeet(dimensions: DuctDimensions) {
  if (dimensions.shape === "round") {
    const diameter = Math.max(0, dimensions.diameterInches ?? 0);

    // Round duct area uses A = pi * r^2. Diameter is supplied in inches, so
    // radius converts to feet by dividing diameter inches by 24.
    const radiusFeet = diameter / 24;
    return Math.PI * radiusFeet * radiusFeet;
  }

  const widthFeet = Math.max(0, dimensions.widthInches ?? 0) / 12;
  const heightFeet = Math.max(0, dimensions.heightInches ?? 0) / 12;
  return widthFeet * heightFeet;
}

export function calculateAirVelocity(cfm: number, dimensions: DuctDimensions) {
  const areaSquareFeet = calculateDuctAreaSquareFeet(dimensions);
  if (areaSquareFeet <= 0) return 0;

  // Air velocity uses V = CFM / Area, where area is measured in square feet.
  return Math.max(0, cfm) / areaSquareFeet;
}

export function getVelocityStatusWarning(
  velocityFpm: number,
  ductType: DuctType
): VelocityWarning {
  const velocity = Math.max(0, velocityFpm);
  const lowLimit = ductType === "main" ? 500 : 400;
  const highLimit = ductType === "main" ? 900 : 700;

  if (velocity < lowLimit) {
    return {
      status: "low",
      message: `${ductType === "main" ? "Main duct" : "Branch duct"} velocity is low; confirm duct size and airflow balance.`,
    };
  }

  if (velocity > highLimit) {
    return {
      status: "high",
      message: `${ductType === "main" ? "Main duct" : "Branch duct"} velocity is high; check for noise, static pressure, and comfort issues.`,
    };
  }

  return {
    status: "acceptable",
    message: `${ductType === "main" ? "Main duct" : "Branch duct"} velocity is within a typical first-pass design range.`,
  };
}

export function getMaxVelocityForDuctType(ductType: DuctType): number {
  return DUCT_MAX_VELOCITY_FPM[ductType];
}

export function createRoundDuctSizingCandidate(
  cfm: number,
  diameterInches: number
): RoundDuctSizingCandidate {
  const dimensions: DuctDimensions = {
    shape: "round",
    diameterInches,
  };
  const areaSquareFeet = calculateDuctAreaSquareFeet(dimensions);

  return {
    shape: "round",
    diameterInches,
    areaSquareFeet,
    velocityFpm: calculateAirVelocity(cfm, dimensions),
  };
}

function getRecommendationMessage(
  candidate: RoundDuctSizingCandidate,
  ductType: DuctType,
  status: VelocityStatus
): string {
  const ductLabel = ductType === "main" ? "Main duct" : "Branch duct";
  const maxVelocity = getMaxVelocityForDuctType(ductType);
  const roundedVelocity = Math.round(candidate.velocityFpm);

  if (status === "high") {
    return `${ductLabel} recommendation is ${candidate.diameterInches}" round metal, but velocity is ${roundedVelocity} FPM, above the ${maxVelocity} FPM target; consider a larger round trunk path or future rectangular duct review if framing requires it.`;
  }

  if (status === "low") {
    return `${ductLabel} recommendation is ${candidate.diameterInches}" round metal with ${roundedVelocity} FPM velocity; airflow is below the typical first-pass range for this duct type.`;
  }

  return `${ductLabel} recommendation is ${candidate.diameterInches}" round metal with ${roundedVelocity} FPM velocity, within the ${maxVelocity} FPM maximum.`;
}

export function recommendRoundDuctSize(
  cfm: number,
  ductType: DuctType
): RoundDuctSizingRecommendation {
  const airflowCfm = Math.max(0, cfm);
  const maxVelocity = getMaxVelocityForDuctType(ductType);
  const candidates = ROUND_RESIDENTIAL_DUCT_SIZES_INCHES.map((diameterInches) =>
    createRoundDuctSizingCandidate(airflowCfm, diameterInches)
  );

  // Round metal duct is the default residential design path. Select the
  // smallest standard round duct whose velocity stays within the duct-type
  // maximum. Future rectangular support can reuse this candidate pattern
  // without changing the default recommendation away from round duct.
  const recommendedCandidate =
    candidates.find((candidate) => candidate.velocityFpm <= maxVelocity) ??
    candidates[candidates.length - 1];

  const velocityWarning = getVelocityStatusWarning(recommendedCandidate.velocityFpm, ductType);

  return {
    diameterInches: recommendedCandidate.diameterInches,
    areaSqFt: recommendedCandidate.areaSquareFeet,
    velocityFpm: recommendedCandidate.velocityFpm,
    status: velocityWarning.status,
    message: getRecommendationMessage(
      recommendedCandidate,
      ductType,
      velocityWarning.status
    ),
  };
}

export function calculateResidentialAirflow(tons: number) {
  return Math.max(0, tons) * 400;
}

export function getFrictionRateStatus(frictionRate: number): VelocityWarning {
  const rate = Math.max(0, frictionRate);

  if (rate < 0.05) {
    return {
      status: "low",
      message: "Friction rate is below the typical residential target range.",
    };
  }

  if (rate <= 0.1) {
    return {
      status: "acceptable",
      message: "Friction rate is within the typical residential target range.",
    };
  }

  return {
    status: "high",
    message: "Friction rate is above the typical residential target range.",
  };
}

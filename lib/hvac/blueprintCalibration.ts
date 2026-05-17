export type BlueprintCalibrationPoint = {
  xPercent: number;
  yPercent: number;
};

export type CalibrationConfidence = "unverified" | "verified" | "acceptable" | "warning";

export type BlueprintVerificationState = {
  startPoint: BlueprintCalibrationPoint | null;
  endPoint: BlueprintCalibrationPoint | null;
  realWorldDistance: string;
};

export type BlueprintCalibrationState = {
  status: "uncalibrated" | "calibrating" | "ready" | "calibrated";
  startPoint: BlueprintCalibrationPoint | null;
  endPoint: BlueprintCalibrationPoint | null;
  pixelsDistance: number | null;
  pixelsPerFoot: number | null;
  realWorldDistance: string;
  realWorldUnit: "feet" | "inches";
  isLocked: boolean;
  // Verification additions
  verification: BlueprintVerificationState | null;
  confidence: CalibrationConfidence;
};

export function createDefaultBlueprintCalibrationState(): BlueprintCalibrationState {
  return {
    status: "uncalibrated",
    startPoint: null,
    endPoint: null,
    pixelsDistance: null,
    pixelsPerFoot: null,
    realWorldDistance: "",
    realWorldUnit: "feet",
    isLocked: false,
    verification: null,
    confidence: "unverified",
  };
}

export function calculateBlueprintPixelDistance(
  startPoint: BlueprintCalibrationPoint,
  endPoint: BlueprintCalibrationPoint,
  overlayWidthPx: number,
  overlayHeightPx: number
) {
  const xDistancePx = ((endPoint.xPercent - startPoint.xPercent) / 100) * overlayWidthPx;
  const yDistancePx = ((endPoint.yPercent - startPoint.yPercent) / 100) * overlayHeightPx;

  return Math.sqrt(xDistancePx ** 2 + yDistancePx ** 2);
}

export function parseFieldMeasurementToFeet(input: string): number | null {
  const normalizedInput = input.trim().toLowerCase();
  if (!normalizedInput) return null;

  const decimalFeet = Number(normalizedInput);
  if (Number.isFinite(decimalFeet) && decimalFeet > 0) return decimalFeet;

  const feetInchesShorthandMatch = normalizedInput.match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)$/);
  if (feetInchesShorthandMatch) {
    const feet = Number(feetInchesShorthandMatch[1]);
    const inches = Number(feetInchesShorthandMatch[2]);
    if (Number.isFinite(feet) && Number.isFinite(inches) && inches >= 0) {
      return feet + inches / 12;
    }
  }

  const feetMatch = normalizedInput.match(/(\d+(?:\.\d+)?)\s*(?:'|ft\b|feet\b)/);
  const inchesMatch = normalizedInput.match(/(\d+(?:\.\d+)?)\s*(?:"|in\b|inch\b|inches\b)/);
  if (feetMatch || inchesMatch) {
    const feet = feetMatch ? Number(feetMatch[1]) : 0;
    const inches = inchesMatch ? Number(inchesMatch[1]) : 0;
    if (Number.isFinite(feet) && Number.isFinite(inches) && inches >= 0) {
      return feet + inches / 12;
    }
  }

  return null;
}

export function calculateBlueprintNormalizedFeet(
  realWorldDistance: string,
  realWorldUnit: "feet" | "inches"
): number | null {
  const parsedFieldDistance = parseFieldMeasurementToFeet(realWorldDistance);
  const parsedDistance = Math.max(0, Number(realWorldDistance) || 0);
  const distanceInFeet =
    parsedFieldDistance ?? (realWorldUnit === "inches" ? parsedDistance / 12 : parsedDistance);

  return distanceInFeet > 0 ? distanceInFeet : null;
}

export function calculateBlueprintPixelsPerFoot(
  pixelsDistance: number,
  realWorldDistance: string,
  realWorldUnit: BlueprintCalibrationState["realWorldUnit"]
) {
  const distanceInFeet = calculateBlueprintNormalizedFeet(realWorldDistance, realWorldUnit);
  if (pixelsDistance <= 0 || !distanceInFeet) return null;

  return pixelsDistance / distanceInFeet;
}

export function calculateBlueprintMeasuredFeet(
  pixelsDistance: number | null,
  pixelsPerFoot: number | null
) {
  if (pixelsDistance === null || pixelsPerFoot === null || pixelsPerFoot <= 0) return null;

  return pixelsDistance / pixelsPerFoot;
}

export function calculateBlueprintVerificationError(
  measuredFeet: number | null,
  expectedDistance: string,
  unit: "feet" | "inches"
): number | null {
  if (measuredFeet === null || !expectedDistance) return null;

  const expectedFeet = calculateBlueprintNormalizedFeet(expectedDistance, unit);
  if (!expectedFeet || expectedFeet <= 0) return null;

  return (Math.abs(measuredFeet - expectedFeet) / expectedFeet) * 100;
}

export function getBlueprintVerificationConfidence(
  errorPercentage: number | null
): CalibrationConfidence {
  if (errorPercentage === null) return "unverified";
  if (errorPercentage <= 1.0) return "verified";
  if (errorPercentage <= 3.0) return "acceptable";
  return "warning";
}

export function selectBlueprintCalibrationPoint(
  currentState: BlueprintCalibrationState,
  point: BlueprintCalibrationPoint,
  overlaySize?: { widthPx: number; heightPx: number }
): BlueprintCalibrationState {
  if (currentState.isLocked) return currentState;

  if (!currentState.startPoint || currentState.endPoint) {
    return {
      ...currentState,
      status: "calibrating",
      startPoint: point,
      endPoint: null,
      pixelsDistance: null,
      pixelsPerFoot: null,
    };
  }

  const pixelsDistance = overlaySize
    ? calculateBlueprintPixelDistance(
        currentState.startPoint,
        point,
        overlaySize.widthPx,
        overlaySize.heightPx
      )
    : null;
  const pixelsPerFoot =
    pixelsDistance === null
      ? null
      : calculateBlueprintPixelsPerFoot(
          pixelsDistance,
          currentState.realWorldDistance,
          currentState.realWorldUnit
        );

  return {
    ...currentState,
    status: pixelsPerFoot === null ? "calibrating" : "ready",
    endPoint: point,
    pixelsDistance,
    pixelsPerFoot,
  };
}

export function updateBlueprintCalibrationKnownLength(
  currentState: BlueprintCalibrationState,
  realWorldDistance: string,
  overlaySize?: { widthPx: number; heightPx: number }
): BlueprintCalibrationState {
  if (currentState.isLocked) return currentState;

  const pixelsDistance =
    currentState.startPoint && currentState.endPoint && overlaySize
      ? calculateBlueprintPixelDistance(
          currentState.startPoint,
          currentState.endPoint,
          overlaySize.widthPx,
          overlaySize.heightPx
        )
      : currentState.pixelsDistance;
  const pixelsPerFoot =
    pixelsDistance === null
      ? null
      : calculateBlueprintPixelsPerFoot(
          pixelsDistance,
          realWorldDistance,
          currentState.realWorldUnit
        );

  return {
    ...currentState,
    status: currentState.startPoint && currentState.endPoint && pixelsPerFoot !== null ? "ready" : currentState.status,
    realWorldDistance,
    pixelsDistance,
    pixelsPerFoot,
  };
}

export function selectBlueprintVerificationPoint(
  currentState: BlueprintCalibrationState,
  point: BlueprintCalibrationPoint,
  overlaySize?: { widthPx: number; heightPx: number }
): BlueprintCalibrationState {
  const currentVerification = currentState.verification || {
    startPoint: null,
    endPoint: null,
    realWorldDistance: "",
  };

  let nextVerification: BlueprintVerificationState;

  if (!currentVerification.startPoint || currentVerification.endPoint) {
    nextVerification = {
      ...currentVerification,
      startPoint: point,
      endPoint: null,
    };
  } else {
    nextVerification = {
      ...currentVerification,
      endPoint: point,
    };
  }

  // Recalculate results if we have everything
  const pixelsPerFoot = currentState.pixelsPerFoot;
  let confidence: CalibrationConfidence = "unverified";

  if (pixelsPerFoot && nextVerification.startPoint && nextVerification.endPoint && overlaySize) {
    const pixelsDistance = calculateBlueprintPixelDistance(
      nextVerification.startPoint,
      nextVerification.endPoint,
      overlaySize.widthPx,
      overlaySize.heightPx
    );
    const measuredFeet = calculateBlueprintMeasuredFeet(pixelsDistance, pixelsPerFoot);
    const error = calculateBlueprintVerificationError(
      measuredFeet,
      nextVerification.realWorldDistance,
      currentState.realWorldUnit
    );
    confidence = getBlueprintVerificationConfidence(error);
  }

  return {
    ...currentState,
    verification: nextVerification,
    confidence,
  };
}

export function updateBlueprintVerificationKnownLength(
  currentState: BlueprintCalibrationState,
  realWorldDistance: string,
  overlaySize?: { widthPx: number; heightPx: number }
): BlueprintCalibrationState {
  const currentVerification = currentState.verification || {
    startPoint: null,
    endPoint: null,
    realWorldDistance: "",
  };

  const nextVerification = {
    ...currentVerification,
    realWorldDistance,
  };

  // Recalculate results if we have everything
  const pixelsPerFoot = currentState.pixelsPerFoot;
  let confidence: CalibrationConfidence = "unverified";

  if (pixelsPerFoot && nextVerification.startPoint && nextVerification.endPoint && overlaySize) {
    const pixelsDistance = calculateBlueprintPixelDistance(
      nextVerification.startPoint,
      nextVerification.endPoint,
      overlaySize.widthPx,
      overlaySize.heightPx
    );
    const measuredFeet = calculateBlueprintMeasuredFeet(pixelsDistance, pixelsPerFoot);
    const error = calculateBlueprintVerificationError(
      measuredFeet,
      nextVerification.realWorldDistance,
      currentState.realWorldUnit
    );
    confidence = getBlueprintVerificationConfidence(error);
  }

  return {
    ...currentState,
    verification: nextVerification,
    confidence,
  };
}

export function confirmBlueprintCalibration(
  currentState: BlueprintCalibrationState
): BlueprintCalibrationState {
  if (!currentState.startPoint || !currentState.endPoint || currentState.pixelsPerFoot === null) {
    return currentState;
  }

  return {
    ...currentState,
    status: "calibrated",
    isLocked: true,
  };
}

export function getConfirmedBlueprintPixelsPerFoot(
  currentState: BlueprintCalibrationState
) {
  return currentState.status === "calibrated" ? currentState.pixelsPerFoot : null;
}

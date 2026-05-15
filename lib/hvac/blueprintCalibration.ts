export type BlueprintCalibrationPoint = {
  xPercent: number;
  yPercent: number;
};

export type BlueprintCalibrationState = {
  status: "uncalibrated" | "calibrating" | "calibrated";
  startPoint: BlueprintCalibrationPoint | null;
  endPoint: BlueprintCalibrationPoint | null;
  pixelsDistance: number | null;
  pixelsPerFoot: number | null;
  realWorldDistance: string;
  realWorldUnit: "feet" | "inches";
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

export function calculateBlueprintPixelsPerFoot(
  pixelsDistance: number,
  realWorldDistance: string,
  realWorldUnit: BlueprintCalibrationState["realWorldUnit"]
) {
  const parsedDistance = Math.max(0, Number(realWorldDistance) || 0);
  const distanceInFeet = realWorldUnit === "inches" ? parsedDistance / 12 : parsedDistance;

  if (pixelsDistance <= 0 || distanceInFeet <= 0) return null;

  return pixelsDistance / distanceInFeet;
}

export function calculateBlueprintMeasuredFeet(
  pixelsDistance: number | null,
  pixelsPerFoot: number | null
) {
  if (pixelsDistance === null || pixelsPerFoot === null || pixelsPerFoot <= 0) return null;

  return pixelsDistance / pixelsPerFoot;
}

export function selectBlueprintCalibrationPoint(
  currentState: BlueprintCalibrationState,
  point: BlueprintCalibrationPoint,
  overlaySize?: { widthPx: number; heightPx: number }
): BlueprintCalibrationState {
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
    status: pixelsPerFoot === null ? "calibrating" : "calibrated",
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
    status: currentState.startPoint && currentState.endPoint && pixelsPerFoot !== null ? "calibrated" : currentState.status,
    realWorldDistance,
    pixelsDistance,
    pixelsPerFoot,
  };
}

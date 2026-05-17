import type { BlueprintCalibrationPoint } from "./blueprintCalibration";

export type BlueprintRoomOutline = {
  id: string;
  name: string;
  points: BlueprintCalibrationPoint[];
  squareFeet: number | null;
  ceilingHeight: string;
  floorLevel: string;
};

export type BlueprintRoomTraceState = {
  isTracing: boolean;
  draftPoints: BlueprintCalibrationPoint[];
  roomOutlines: BlueprintRoomOutline[];
};

type BlueprintRoomTracePointOptions = {
  straightLineAssist?: boolean;
  finishOptions?: BlueprintRoomTraceFinishOptions;
};

type BlueprintRoomTraceFinishOptions = {
  squareFeet?: number | null;
  ceilingHeight?: string;
  floorLevel?: string;
};

const TRACE_CLOSE_THRESHOLD_PERCENT = 3;
const TRACE_CORNER_SNAP_THRESHOLD_PERCENT = 1.5;

function getPointDistancePercent(
  firstPoint: BlueprintCalibrationPoint,
  secondPoint: BlueprintCalibrationPoint
) {
  const xDistance = secondPoint.xPercent - firstPoint.xPercent;
  const yDistance = secondPoint.yPercent - firstPoint.yPercent;

  return Math.sqrt(xDistance ** 2 + yDistance ** 2);
}

function getAssistedTracePoint(
  currentState: BlueprintRoomTraceState,
  point: BlueprintCalibrationPoint,
  options: BlueprintRoomTracePointOptions = {}
) {
  const previousPoint = currentState.draftPoints.at(-1);
  if (!previousPoint) return point;

  const xDelta = Math.abs(point.xPercent - previousPoint.xPercent);
  const yDelta = Math.abs(point.yPercent - previousPoint.yPercent);

  if (options.straightLineAssist) {
    return xDelta >= yDelta
      ? { ...point, yPercent: previousPoint.yPercent }
      : { ...point, xPercent: previousPoint.xPercent };
  }

  if (xDelta <= TRACE_CORNER_SNAP_THRESHOLD_PERCENT) {
    return { ...point, xPercent: previousPoint.xPercent };
  }

  if (yDelta <= TRACE_CORNER_SNAP_THRESHOLD_PERCENT) {
    return { ...point, yPercent: previousPoint.yPercent };
  }

  return point;
}

export function createDefaultBlueprintRoomTraceState(): BlueprintRoomTraceState {
  return {
    isTracing: false,
    draftPoints: [],
    roomOutlines: [],
  };
}

export function startBlueprintRoomTrace(
  currentState: BlueprintRoomTraceState
): BlueprintRoomTraceState {
  return {
    ...currentState,
    isTracing: true,
    draftPoints: [],
  };
}

export function startBlueprintRoomTraceFromPoints(
  currentState: BlueprintRoomTraceState,
  points: BlueprintCalibrationPoint[]
): BlueprintRoomTraceState {
  return {
    ...currentState,
    isTracing: true,
    draftPoints: points.map((point) => ({ ...point })),
  };
}

export function addBlueprintRoomTracePoint(
  currentState: BlueprintRoomTraceState,
  point: BlueprintCalibrationPoint,
  options: BlueprintRoomTracePointOptions = {}
): BlueprintRoomTraceState {
  if (!currentState.isTracing) return currentState;

  const firstPoint = currentState.draftPoints[0];
  const shouldAutoClose =
    currentState.draftPoints.length >= 3 &&
    firstPoint &&
    getPointDistancePercent(firstPoint, point) <= TRACE_CLOSE_THRESHOLD_PERCENT;

  if (shouldAutoClose) {
    return finishBlueprintRoomTrace(currentState, options.finishOptions);
  }

  const assistedPoint = getAssistedTracePoint(currentState, point, options);

  return {
    ...currentState,
    draftPoints: [...currentState.draftPoints, assistedPoint],
  };
}

export function undoBlueprintRoomTracePoint(
  currentState: BlueprintRoomTraceState
): BlueprintRoomTraceState {
  if (!currentState.isTracing || currentState.draftPoints.length === 0) return currentState;

  return {
    ...currentState,
    draftPoints: currentState.draftPoints.slice(0, -1),
  };
}

export function updateBlueprintRoomTracePoint(
  currentState: BlueprintRoomTraceState,
  pointIndex: number,
  point: BlueprintCalibrationPoint
): BlueprintRoomTraceState {
  if (!currentState.isTracing || pointIndex < 0 || pointIndex >= currentState.draftPoints.length) {
    return currentState;
  }

  return {
    ...currentState,
    draftPoints: currentState.draftPoints.map((currentPoint, index) =>
      index === pointIndex ? { ...point } : currentPoint
    ),
  };
}

export function cancelBlueprintRoomTrace(
  currentState: BlueprintRoomTraceState
): BlueprintRoomTraceState {
  if (!currentState.isTracing && currentState.draftPoints.length === 0) return currentState;

  return {
    ...currentState,
    isTracing: false,
    draftPoints: [],
  };
}

export function finishBlueprintRoomTrace(
  currentState: BlueprintRoomTraceState,
  options: BlueprintRoomTraceFinishOptions = {}
): BlueprintRoomTraceState {
  if (currentState.draftPoints.length < 3) return currentState;

  const roomNumber = currentState.roomOutlines.length + 1;

  return {
    isTracing: false,
    draftPoints: [],
    roomOutlines: [
      ...currentState.roomOutlines,
      {
        id: `blueprint-outline-${Date.now()}-${currentState.roomOutlines.length + 1}`,
        name: `Traced Room ${roomNumber}`,
        points: currentState.draftPoints,
        squareFeet: options.squareFeet ?? null,
        ceilingHeight: options.ceilingHeight ?? "8",
        floorLevel: options.floorLevel ?? "1",
      },
    ],
  };
}

export function renameBlueprintRoomOutline(
  currentState: BlueprintRoomTraceState,
  outlineId: string,
  name: string
): BlueprintRoomTraceState {
  return {
    ...currentState,
    roomOutlines: currentState.roomOutlines.map((outline) =>
      outline.id === outlineId ? { ...outline, name } : outline
    ),
  };
}

export function removeBlueprintRoomOutline(
  currentState: BlueprintRoomTraceState,
  outlineId: string
): BlueprintRoomTraceState {
  return {
    ...currentState,
    roomOutlines: currentState.roomOutlines.filter((outline) => outline.id !== outlineId),
  };
}

export function editBlueprintRoomOutline(
  currentState: BlueprintRoomTraceState,
  outlineId: string
): BlueprintRoomTraceState {
  const outlineToEdit = currentState.roomOutlines.find((outline) => outline.id === outlineId);
  if (!outlineToEdit) return currentState;

  return {
    ...currentState,
    isTracing: true,
    draftPoints: outlineToEdit.points.map((point) => ({ ...point })),
    roomOutlines: currentState.roomOutlines.filter((outline) => outline.id !== outlineId),
  };
}

export function markBlueprintRoomOutlinesNeedRecalculation(
  currentState: BlueprintRoomTraceState
): BlueprintRoomTraceState {
  return {
    ...currentState,
    roomOutlines: currentState.roomOutlines.map((outline) => ({
      ...outline,
      squareFeet: null,
    })),
  };
}

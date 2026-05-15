import type { BlueprintCalibrationPoint } from "./blueprintCalibration";

export type BlueprintRoomOutline = {
  id: string;
  name: string;
  points: BlueprintCalibrationPoint[];
};

export type BlueprintRoomTraceState = {
  isTracing: boolean;
  draftPoints: BlueprintCalibrationPoint[];
  roomOutlines: BlueprintRoomOutline[];
};

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

export function addBlueprintRoomTracePoint(
  currentState: BlueprintRoomTraceState,
  point: BlueprintCalibrationPoint
): BlueprintRoomTraceState {
  if (!currentState.isTracing) return currentState;

  return {
    ...currentState,
    draftPoints: [...currentState.draftPoints, point],
  };
}

export function finishBlueprintRoomTrace(
  currentState: BlueprintRoomTraceState
): BlueprintRoomTraceState {
  if (currentState.draftPoints.length < 3) return currentState;

  return {
    isTracing: false,
    draftPoints: [],
    roomOutlines: [
      ...currentState.roomOutlines,
      {
        id: `blueprint-outline-${Date.now()}-${currentState.roomOutlines.length + 1}`,
        name: `Room Outline ${currentState.roomOutlines.length + 1}`,
        points: currentState.draftPoints,
      },
    ],
  };
}

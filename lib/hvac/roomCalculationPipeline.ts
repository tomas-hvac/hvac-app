import type { RoundDuctSizingRecommendation } from "./manualD";
import { calculateResidentialAirflow, recommendRoundDuctSize } from "./manualD";
import type { BlueprintRoomOutline, EngineeringRoom } from "./blueprintRoomTracing";
import type { DetectedBlueprintRoom } from "./blueprintDetection";

export type HvacRoomSource = "traced" | "manual" | "detected";

export type UnifiedHvacRoomStatus =
  | "calculation-ready"
  | "calibration-required"
  | "needs-review"
  | "confirmed";

export type UnifiedHvacRoom = {
  id: string;
  source: HvacRoomSource;
  name: string;
  squareFeet: number | null;
  ceilingHeight: string;
  floorLevel: string;
  volume: number | null;
  targetCfm: number | null;
  ductSizeRecommendation: RoundDuctSizingRecommendation | null;
  registerCountRecommendation: number | null;
  confidenceStatus: UnifiedHvacRoomStatus;
};



type RoomCalculationContext = {
  totalHomeSquareFeet?: number;
  systemTons?: number;
};

type TracedRoomAdapterInput = {
  tracedRoom: BlueprintRoomOutline;
  outputId: string;
  context?: RoomCalculationContext;
};


type DetectedRoomAdapterInput = {
  detectedRoom: DetectedBlueprintRoom;
  outputId: string;
  defaultCeilingHeight: string;
  defaultFloorLevel: string;
  context?: RoomCalculationContext;
};

export function calculateUnifiedRoomVolume(
  squareFeet: number | null,
  ceilingHeight: string
) {
  if (squareFeet === null || squareFeet <= 0) return null;

  const heightFeet = Math.max(0, Number(ceilingHeight) || 0);
  if (heightFeet <= 0) return null;

  return squareFeet * heightFeet;
}

export function calculateUnifiedRoomTargetCfm(
  squareFeet: number | null,
  context: RoomCalculationContext = {}
) {
  if (squareFeet === null || squareFeet <= 0) return null;

  const totalHomeSquareFeet = Math.max(0, context.totalHomeSquareFeet ?? 0);
  const systemTons = Math.max(0, context.systemTons ?? 0);
  if (totalHomeSquareFeet <= 0 || systemTons <= 0) return null;

  return (squareFeet / totalHomeSquareFeet) * calculateResidentialAirflow(systemTons);
}

export function calculateUnifiedRoomDuctSize(
  targetCfm: number | null
) {
  if (targetCfm === null || targetCfm <= 0) return null;

  return recommendRoundDuctSize(targetCfm, "branch");
}

export function recommendUnifiedRoomRegisterCount(
  targetCfm: number | null
) {
  if (targetCfm === null || targetCfm <= 0) return null;

  return Math.max(1, Math.ceil(targetCfm / 125));
}

export function createUnifiedTracedRoom({
  tracedRoom,
  context,
}: Omit<TracedRoomAdapterInput, "outputId">): UnifiedHvacRoom {
  const squareFeet =
    tracedRoom.squareFeet === null || tracedRoom.squareFeet <= 0
      ? null
      : Math.round(tracedRoom.squareFeet);
  const volume = calculateUnifiedRoomVolume(squareFeet, tracedRoom.ceilingHeight);
  const targetCfm = calculateUnifiedRoomTargetCfm(squareFeet, context);
  const ductSizeRecommendation = calculateUnifiedRoomDuctSize(targetCfm);
  const registerCountRecommendation = recommendUnifiedRoomRegisterCount(targetCfm);

  return {
    id: tracedRoom.id,
    source: "traced",
    name: tracedRoom.name.trim() || "Traced Room",
    squareFeet,
    ceilingHeight: tracedRoom.ceilingHeight,
    floorLevel: tracedRoom.floorLevel,
    volume,
    targetCfm,
    ductSizeRecommendation,
    registerCountRecommendation,
    confidenceStatus: squareFeet === null ? "calibration-required" : "calculation-ready",
  };
}

export function adaptTracedRoomToManualDBlueprintRoom({
  tracedRoom,
  outputId,
  context,
}: TracedRoomAdapterInput): EngineeringRoom {
  const unifiedRoom = createUnifiedTracedRoom({ tracedRoom, context });
  const exteriorWallsCount = tracedRoom.boundaryEdges?.filter(
    (edge) => edge.boundaryType === "exterior"
  ).length ?? 0;

  let totalWindowsCount = 0;
  let totalWindowsArea = 0;

  tracedRoom.boundaryEdges?.forEach((edge) => {
    const windows = edge.openings?.filter((op) => op.type === "window" && op.isVerified) ?? [];
    totalWindowsCount += windows.length;
    windows.forEach((win) => {
      totalWindowsArea += win.widthFeet * win.heightFeet;
    });
  });

  return {
    ...tracedRoom,
    id: outputId,
    name: unifiedRoom.name,
    squareFeet: Math.max(0, Math.round(unifiedRoom.squareFeet ?? 0)),
    ceilingHeight: unifiedRoom.ceilingHeight,
    floorLevel: unifiedRoom.floorLevel,
    windowsCount: String(totalWindowsCount),
    windowsArea: totalWindowsArea > 0 ? totalWindowsArea.toFixed(1) : undefined,
    exteriorWallsCount: String(exteriorWallsCount),
    sourceBlueprintRoomId: tracedRoom.id,
  };
}


export function createUnifiedDetectedRoom({
  detectedRoom,
  defaultCeilingHeight,
  defaultFloorLevel,
  context,
}: Omit<DetectedRoomAdapterInput, "outputId">): UnifiedHvacRoom {
  const squareFeet = Math.max(0, Math.round(detectedRoom.squareFeet));
  const ceilingHeight = defaultCeilingHeight;
  const floorLevel = detectedRoom.floorLevel || defaultFloorLevel;
  const volume = calculateUnifiedRoomVolume(squareFeet, ceilingHeight);
  const targetCfm = calculateUnifiedRoomTargetCfm(squareFeet, context);
  const ductSizeRecommendation = calculateUnifiedRoomDuctSize(targetCfm);
  const registerCountRecommendation = recommendUnifiedRoomRegisterCount(targetCfm);

  return {
    id: detectedRoom.id,
    source: "detected",
    name: detectedRoom.name.trim() || "Detected Room",
    squareFeet,
    ceilingHeight,
    floorLevel,
    volume,
    targetCfm,
    ductSizeRecommendation,
    registerCountRecommendation,
    confidenceStatus: detectedRoom.confirmed ? "confirmed" : "needs-review",
  };
}

export function adaptDetectedRoomToManualDBlueprintRoom({
  detectedRoom,
  outputId,
  defaultCeilingHeight,
  defaultFloorLevel,
  context,
}: DetectedRoomAdapterInput): EngineeringRoom {
  const unifiedRoom = createUnifiedDetectedRoom({
    detectedRoom,
    defaultCeilingHeight,
    defaultFloorLevel,
    context,
  });

  return {
    id: outputId,
    name: unifiedRoom.name,
    points: [],
    squareFeet: Math.max(0, Math.round(unifiedRoom.squareFeet ?? 0)),
    ceilingHeight: unifiedRoom.ceilingHeight,
    floorLevel: unifiedRoom.floorLevel,
    windowsCount: detectedRoom.windowsCount,
    exteriorWallsCount: detectedRoom.exteriorWallsCount,
    sourceBlueprintRoomId: detectedRoom.id,
  };
}

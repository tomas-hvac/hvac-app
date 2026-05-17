import type { RoundDuctSizingRecommendation } from "./manualD";
import { calculateResidentialAirflow, recommendRoundDuctSize } from "./manualD";
import type { BlueprintRoomOutline } from "./blueprintRoomTracing";

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

export type ManualDBlueprintRoomOutput = {
  id: string;
  name: string;
  squareFeet: number;
  ceilingHeight: string;
  floorLevel: string;
  sourceBlueprintRoomId?: string;
  windowsCount?: string;
  exteriorWallsCount?: string;
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
}: TracedRoomAdapterInput): ManualDBlueprintRoomOutput {
  const unifiedRoom = createUnifiedTracedRoom({ tracedRoom, context });

  return {
    id: outputId,
    name: unifiedRoom.name,
    squareFeet: Math.max(0, Math.round(unifiedRoom.squareFeet ?? 0)),
    ceilingHeight: unifiedRoom.ceilingHeight,
    floorLevel: unifiedRoom.floorLevel,
    sourceBlueprintRoomId: tracedRoom.id,
  };
}

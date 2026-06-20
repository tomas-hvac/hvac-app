import type { BlueprintRoomOutline } from "./blueprintRoomTracing";
import type { BlueprintCalibrationState } from "./blueprintCalibration";

export type RoomReadinessStatus = 
  | "INCOMPLETE" 
  | "NEEDS_REVIEW" 
  | "READY_FOR_MANUAL_J";

export type RoomReadinessChecklist = {
  geometry: boolean;
  walls: boolean;
  openings: boolean;
  identity: boolean;
};

export type RoomReadinessResult = {
  status: RoomReadinessStatus;
  checklist: RoomReadinessChecklist;
  warnings: string[];
};

export function calculateRoomReadiness(
  room: BlueprintRoomOutline,
  calibration: BlueprintCalibrationState
): RoomReadinessResult {
  const warnings: string[] = [];
  
  // 1. Geometry Pillar
  const hasMinPoints = room.points.length >= 3;
  const hasValidArea = room.squareFeet !== null && room.squareFeet > 0;
  const geometryOk = hasMinPoints && hasValidArea;

  // 2. Calibration Pillar (Project-wide context)
  const isCalibrated = calibration.status === "calibrated";

  // 3. Walls Pillar
  const totalEdges = room.boundaryEdges?.length || 0;
  const classifiedEdges = room.boundaryEdges?.filter(e => e.boundaryType !== "unknown").length || 0;
  const wallsOk = totalEdges > 0 && classifiedEdges === totalEdges;

  // 4. Openings Pillar
  const exteriorEdges = room.boundaryEdges?.filter(e => e.boundaryType === "exterior") || [];
  const totalExteriorOpenings = exteriorEdges.reduce((acc, e) => acc + (e.openings?.length || 0), 0);
  const unverifiedExteriorOpenings = exteriorEdges.reduce((acc, e) => 
    acc + (e.openings?.filter(op => !op.isVerified).length || 0), 0
  );
  
  // For Phase 1, we consider openings OK if all existing openings on exterior walls are verified.
  // In future phases, we might require an explicit "No openings" confirmation.
  const openingsOk = unverifiedExteriorOpenings === 0;

  // 5. Identity Pillar
  const genericNames = ["Traced Room", "New Room", "Room"];
  const isGeneric = genericNames.some(gn => room.name.startsWith(gn));
  const identityOk = !isGeneric && room.name.length > 0;

  if (isGeneric) {
    warnings.push("Room name should be confirmed");
  }

  // Determine Overall Status
  let status: RoomReadinessStatus = "READY_FOR_MANUAL_J";

  if (!isCalibrated || !geometryOk) {
    status = "INCOMPLETE";
  } else if (!wallsOk || !openingsOk) {
    status = "NEEDS_REVIEW";
  }

  return {
    status,
    checklist: {
      geometry: geometryOk,
      walls: wallsOk,
      openings: openingsOk,
      identity: identityOk
    },
    warnings
  };
}

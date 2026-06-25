import type {
  BuildingModel,
  BuildingOpening,
  BuildingReadinessSummary,
  BuildingRoom,
  BuildingWall,
} from "./buildingModelTypes";

export function getRoomArea(room: BuildingRoom): number | null {
  return room.geometry.areaSquareFeet;
}

export function getRoomCeilingHeight(room: BuildingRoom): number | null {
  return room.ceilingHeightFeet;
}

export function getRoomExteriorWalls(
  model: BuildingModel,
  roomId: string
): BuildingWall[] {
  return model.walls.filter(
    (wall) => wall.roomId === roomId && wall.boundaryType === "exterior"
  );
}

export function getRoomVerifiedWindows(
  model: BuildingModel,
  roomId: string
): BuildingOpening[] {
  return model.openings.filter(
    (opening) =>
      opening.roomId === roomId &&
      opening.type === "window" &&
      opening.verified
  );
}

export function getRoomVerifiedExteriorDoors(
  model: BuildingModel,
  roomId: string
): BuildingOpening[] {
  return model.openings.filter(
    (opening) =>
      opening.roomId === roomId &&
      opening.type === "exterior-door" &&
      opening.verified
  );
}

export function getRoomOpeningArea(
  model: BuildingModel,
  roomId: string
): number {
  return model.openings
    .filter((opening) => opening.roomId === roomId && opening.verified)
    .reduce((total, opening) => total + opening.areaSquareFeet, 0);
}

export function getBuildingReadinessSummary(
  model: BuildingModel
): BuildingReadinessSummary {
  const roomStatuses = model.rooms.map((room) => {
    const blockers: string[] = [];
    const warnings: string[] = [];
    const roomWalls = model.walls.filter((wall) => wall.roomId === room.id);
    const exteriorOpenings = model.openings.filter(
      (opening) =>
        opening.roomId === room.id &&
        model.walls.some(
          (wall) =>
            wall.id === opening.wallId && wall.boundaryType === "exterior"
        )
    );

    if (room.geometry.areaSquareFeet === null || room.geometry.areaSquareFeet <= 0) {
      blockers.push("Room area is missing or invalid.");
    }

    if (room.geometry.method === "blueprint-polygon") {
      if (room.geometry.points.length < 3) {
        blockers.push("Blueprint room geometry requires at least three points.");
      }
      if (room.geometry.evidence.verificationStatus !== "verified") {
        blockers.push("Blueprint room geometry is not verified.");
      }
    }

    if (room.ceilingHeightFeet === null || room.ceilingHeightFeet <= 0) {
      blockers.push("Ceiling height is missing or invalid.");
    }

    if (roomWalls.length === 0) {
      warnings.push("Room has no normalized boundary walls.");
    } else if (roomWalls.some((wall) => wall.boundaryType === "unknown")) {
      warnings.push("One or more room boundaries need classification.");
    }

    if (exteriorOpenings.some((opening) => !opening.verified)) {
      warnings.push("One or more exterior openings need verification.");
    }

    if (!room.name.trim()) {
      warnings.push("Room name is missing.");
    }

    const status =
      blockers.length > 0
        ? "incomplete"
        : warnings.length > 0
          ? "needs-review"
          : "calculation-ready";

    return {
      roomId: room.id,
      status,
      blockers,
      warnings,
    } as const;
  });

  const blockers = roomStatuses.flatMap(({ roomId, blockers: roomBlockers }) =>
    roomBlockers.map((blocker) => `${roomId}: ${blocker}`)
  );
  const warnings = roomStatuses.flatMap(({ roomId, warnings: roomWarnings }) =>
    roomWarnings.map((warning) => `${roomId}: ${warning}`)
  );

  if (model.rooms.length === 0) {
    blockers.push("Building model has no rooms.");
  }

  const readyRoomCount = roomStatuses.filter(
    (room) => room.status === "calculation-ready"
  ).length;
  const status =
    blockers.length > 0
      ? "incomplete"
      : warnings.length > 0
        ? "needs-review"
        : "calculation-ready";

  return {
    status,
    roomCount: model.rooms.length,
    readyRoomCount,
    blockers,
    warnings,
    roomStatuses,
  };
}

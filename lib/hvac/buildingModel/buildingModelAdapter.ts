import {
  calculateBlueprintPixelDistance,
  type BlueprintCalibrationPoint,
  type BlueprintCalibrationState,
} from "../blueprintCalibration";
import { calculateBlueprintExteriorEdgeOrientation } from "../blueprintExteriorLoad";
import type {
  BlueprintEnvelopeSuggestions,
  BlueprintProject,
} from "../blueprintProject";
import type {
  BlueprintRoomBoundaryEdge,
  EngineeringRoom,
  RoomInsulationLevel,
} from "../blueprintRoomTracing";
import { getBuildingReadinessSummary } from "./buildingModelSelectors";
import {
  BUILDING_MODEL_SCHEMA_VERSION,
  type BuildingBoundaryType,
  type BuildingEnvelope,
  type BuildingEnvelopeSuggestion,
  type BuildingFieldEvidence,
  type BuildingFloor,
  type BuildingModel,
  type BuildingOpening,
  type BuildingOpeningType,
  type BuildingPlanSet,
  type BuildingProjectMode,
  type BuildingReadinessSummary,
  type BuildingRoom,
  type BuildingVerificationStatus,
  type BuildingWall,
} from "./buildingModelTypes";

const EMPTY_READINESS: BuildingReadinessSummary = {
  status: "incomplete",
  roomCount: 0,
  readyRoomCount: 0,
  blockers: [],
  warnings: [],
  roomStatuses: [],
};

type LegacyRoomPageContext = {
  pageId?: string;
  calibration: BlueprintCalibrationState;
  overlaySize?: { widthPx: number; heightPx: number };
};

function createEvidence(
  source: BuildingFieldEvidence["source"],
  verificationStatus: BuildingVerificationStatus,
  options: Pick<
    BuildingFieldEvidence,
    "sourceId" | "sourceReference" | "note"
  > = {}
): BuildingFieldEvidence {
  return {
    source,
    verificationStatus,
    ...options,
  };
}

function parsePositiveNumber(value: string | number | undefined): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function getFloorLevel(room: EngineeringRoom): string {
  return room.floorLevel.trim() || "Unassigned";
}

function getFloorId(level: string): string {
  return `floor:${encodeURIComponent(level.toLowerCase())}`;
}

function getWallId(roomId: string, edgeIndex: number): string {
  return `${roomId}:wall:${edgeIndex}`;
}

function getOpeningId(roomId: string, openingId: string): string {
  return `${roomId}:opening:${openingId}`;
}

function getPoint(
  points: readonly BlueprintCalibrationPoint[],
  pointIndex: number
): BlueprintCalibrationPoint | null {
  const point = points[pointIndex];
  return point ? { ...point } : null;
}

function calculateLegacyWallLengthFeet(
  room: EngineeringRoom,
  edge: BlueprintRoomBoundaryEdge,
  calibration: BlueprintCalibrationState,
  overlaySize?: { widthPx: number; heightPx: number }
): number | null {
  const startPoint = getPoint(room.points, edge.startPointIndex);
  const endPoint = getPoint(room.points, edge.endPointIndex);
  if (!startPoint || !endPoint || !overlaySize || !calibration.pixelsPerFoot) {
    return null;
  }

  const pixelDistance = calculateBlueprintPixelDistance(
    startPoint,
    endPoint,
    overlaySize.widthPx,
    overlaySize.heightPx
  );
  if (pixelDistance <= 0 || calibration.pixelsPerFoot <= 0) return null;

  return pixelDistance / calibration.pixelsPerFoot;
}

function normalizeInsulationLevel(
  value: string | undefined
): RoomInsulationLevel | undefined {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "poor" || normalized === "average" || normalized === "good") {
    return normalized;
  }
  if (normalized === "excellent") return "good";
  return undefined;
}

function getOpeningType(
  legacyType: "window" | "door",
  boundaryType: BlueprintRoomBoundaryEdge["boundaryType"]
): BuildingOpeningType {
  if (legacyType === "window") return "window";
  return boundaryType === "exterior" ? "exterior-door" : "interior-door";
}

function getBoundaryType(
  boundaryType: BlueprintRoomBoundaryEdge["boundaryType"]
): BuildingBoundaryType {
  return boundaryType;
}

function getRoomPageContext(
  project: BlueprintProject,
  roomId: string
): LegacyRoomPageContext {
  const sourcePage = project.blueprintDocument?.pages.find((page) =>
    page.tracedRooms?.some((room) => room.id === roomId)
  );

  return {
    pageId:
      sourcePage?.id ??
      (project.blueprintImage ? `plan-page:${project.id}:1` : undefined),
    calibration: sourcePage?.calibration ?? project.calibration,
    overlaySize:
      !sourcePage ||
      sourcePage.id === project.blueprintDocument?.activePageId
        ? project.blueprintOverlaySize
        : undefined,
  };
}

function createPlanSet(project: BlueprintProject): BuildingPlanSet | null {
  if (project.blueprintDocument) {
    return {
      id: project.blueprintDocument.id,
      name: project.blueprintDocument.name,
      assetId: project.blueprintDocument.assetId,
      sourceFileName: project.blueprintImage?.name,
      pages: project.blueprintDocument.pages.map((page) => ({
        id: page.id,
        pageNumber: page.pageNumber,
        label: page.label,
        sheetType: page.sheetType ?? "unknown",
        calibration: page.calibration ?? null,
      })),
    };
  }

  if (!project.blueprintImage) return null;

  return {
    id: `plan-set:${project.id}`,
    name: project.blueprintImage.name,
    sourceFileName: project.blueprintImage.name,
    pages: [
      {
        id: `plan-page:${project.id}:1`,
        pageNumber: 1,
        label: "Sheet 1",
        sheetType: "unknown",
        calibration: project.calibration,
      },
    ],
  };
}

function getProjectMode(
  planSet: BuildingPlanSet | null,
  rooms: readonly EngineeringRoom[]
): BuildingProjectMode {
  const hasBlueprintGeometry = rooms.some((room) => room.points.length >= 3);
  const hasManualGeometry = rooms.some(
    (room) => room.points.length < 3 && room.squareFeet !== null
  );

  if (planSet && hasBlueprintGeometry && hasManualGeometry) return "hybrid";
  if (planSet) return "new-construction";
  return "retrofit";
}

function getBoundaryVerificationStatus(
  edges: readonly BlueprintRoomBoundaryEdge[]
): BuildingVerificationStatus {
  if (edges.length === 0) return "unverified";
  return edges.every((edge) => edge.boundaryType !== "unknown")
    ? "verified"
    : "needs-review";
}

function getOpeningVerificationStatus(
  edges: readonly BlueprintRoomBoundaryEdge[]
): BuildingVerificationStatus {
  const exteriorOpenings = edges
    .filter((edge) => edge.boundaryType === "exterior")
    .flatMap((edge) => edge.openings ?? []);

  return exteriorOpenings.every((opening) => opening.isVerified)
    ? "verified"
    : "needs-review";
}

function adaptRoomEntities(
  project: BlueprintProject,
  room: EngineeringRoom
): {
  room: BuildingRoom;
  walls: BuildingWall[];
  openings: BuildingOpening[];
} {
  const pageContext = getRoomPageContext(project, room.id);
  const edges = room.boundaryEdges ?? [];
  const ceilingHeightFeet = parsePositiveNumber(room.ceilingHeight);
  const roomInsulation =
    room.insulationLevel ??
    normalizeInsulationLevel(project.envelopeSettings.insulationQuality);
  const hasBlueprintGeometry = room.points.length >= 3;
  const geometryVerified =
    hasBlueprintGeometry &&
    pageContext.calibration.status === "calibrated" &&
    room.squareFeet !== null &&
    room.squareFeet > 0;
  const geometryEvidence = createEvidence(
    hasBlueprintGeometry ? "blueprint-measured" : "legacy-imported",
    geometryVerified ? "verified" : hasBlueprintGeometry ? "needs-review" : "assumed",
    {
      sourceId: room.id,
      sourceReference: pageContext.pageId,
    }
  );

  const walls: BuildingWall[] = [];
  const openings: BuildingOpening[] = [];

  edges.forEach((edge, edgeIndex) => {
    const wallId = getWallId(room.id, edgeIndex);
    const wallOpeningIds: string[] = [];
    const orientation = calculateBlueprintExteriorEdgeOrientation(room.points, edge);

    (edge.openings ?? []).forEach((opening) => {
      const openingId = getOpeningId(room.id, opening.id);
      const openingType = getOpeningType(opening.type, edge.boundaryType);
      const openingEvidence = createEvidence(
        "technician-entered",
        opening.isVerified ? "verified" : "unverified",
        {
          sourceId: opening.id,
          sourceReference: wallId,
        }
      );

      wallOpeningIds.push(openingId);
      openings.push({
        id: openingId,
        wallId,
        roomId: room.id,
        type: openingType,
        widthFeet: opening.widthFeet,
        heightFeet: opening.heightFeet,
        areaSquareFeet:
          Math.max(0, opening.widthFeet) * Math.max(0, opening.heightFeet),
        verified: opening.isVerified,
        uFactor: opening.uFactor,
        shgc: opening.shgc,
        scheduleMarkId: opening.scheduleMarkId,
        verification: {
          dimensions: openingEvidence,
          type: openingEvidence,
          thermalProperties: createEvidence(
            opening.uFactor !== undefined || opening.shgc !== undefined
              ? "technician-entered"
              : "system-default",
            opening.uFactor !== undefined || opening.shgc !== undefined
              ? opening.isVerified
                ? "verified"
                : "unverified"
              : "assumed",
            {
              sourceId: opening.id,
            }
          ),
        },
        legacySource: {
          openingId: opening.id,
          roomId: room.id,
          edgeIndex,
        },
      });
    });

    const wallGeometryVerified =
      geometryVerified &&
      getPoint(room.points, edge.startPointIndex) !== null &&
      getPoint(room.points, edge.endPointIndex) !== null;
    walls.push({
      id: wallId,
      roomId: room.id,
      lengthFeet: calculateLegacyWallLengthFeet(
        room,
        edge,
        pageContext.calibration,
        pageContext.overlaySize
      ),
      heightFeet: ceilingHeightFeet,
      boundaryType: getBoundaryType(edge.boundaryType),
      orientation: orientation === "unknown" ? null : orientation,
      startPoint: getPoint(room.points, edge.startPointIndex),
      endPoint: getPoint(room.points, edge.endPointIndex),
      openingIds: wallOpeningIds,
      construction: {
        insulationLevel: roomInsulation,
        rValue: project.envelopeSettings.verifiedInsulation?.wallRValue,
      },
      verification: {
        geometry: createEvidence(
          "blueprint-measured",
          wallGeometryVerified ? "verified" : "needs-review",
          {
            sourceId: wallId,
            sourceReference: pageContext.pageId,
          }
        ),
        boundaryType: createEvidence(
          "technician-entered",
          edge.boundaryType === "unknown" ? "needs-review" : "verified",
          {
            sourceId: wallId,
          }
        ),
        construction: createEvidence(
          project.envelopeSettings.isVerified
            ? "field-measured"
            : "system-default",
          project.envelopeSettings.isVerified ? "verified" : "assumed",
          {
            sourceId: wallId,
          }
        ),
      },
      legacySource: {
        roomId: room.id,
        edgeIndex,
        startPointIndex: edge.startPointIndex,
        endPointIndex: edge.endPointIndex,
      },
    });
  });

  const windowIds = openings
    .filter((opening) => opening.type === "window")
    .map((opening) => opening.id);
  const doorIds = openings
    .filter((opening) => opening.type !== "window")
    .map((opening) => opening.id);
  const identityVerified =
    room.isVerified === true && room.name.trim().length > 0;
  const assumptionsPresent = Boolean(roomInsulation || room.sunExposure);

  return {
    room: {
      id: room.id,
      name: room.name,
      floorId: getFloorId(getFloorLevel(room)),
      floorLevel: getFloorLevel(room),
      geometry: {
        method: hasBlueprintGeometry ? "blueprint-polygon" : "manual-area",
        points: room.points.map((point) => ({ ...point })),
        areaSquareFeet: room.squareFeet,
        sourcePlanPageId: pageContext.pageId,
        evidence: geometryEvidence,
      },
      ceilingHeightFeet,
      wallIds: walls.map((wall) => wall.id),
      windowIds,
      doorIds,
      assumptions: {
        insulationLevel: roomInsulation,
        sunExposure: room.sunExposure,
      },
      verification: {
        identity: createEvidence(
          "technician-entered",
          identityVerified ? "verified" : "unverified",
          {
            sourceId: room.id,
          }
        ),
        geometry: geometryEvidence,
        ceilingHeight: createEvidence(
          "technician-entered",
          ceilingHeightFeet === null ? "needs-review" : "assumed",
          {
            sourceId: room.id,
          }
        ),
        boundaries: getBoundaryVerificationStatus(edges),
        openings: getOpeningVerificationStatus(edges),
        assumptions: assumptionsPresent ? "assumed" : "unverified",
      },
      legacySource: {
        roomId: room.id,
        sourceBlueprintRoomId: room.sourceBlueprintRoomId,
      },
    },
    walls,
    openings,
  };
}

function createFloors(
  project: BlueprintProject,
  rooms: readonly BuildingRoom[]
): BuildingFloor[] {
  const floorsByLevel = new Map<string, BuildingFloor>();

  rooms.forEach((room) => {
    const currentFloor = floorsByLevel.get(room.floorLevel);
    const sourcePlanPageIds = room.geometry.sourcePlanPageId
      ? [room.geometry.sourcePlanPageId]
      : [];

    if (!currentFloor) {
      floorsByLevel.set(room.floorLevel, {
        id: room.floorId,
        name:
          room.floorLevel === "Unassigned"
            ? "Unassigned Floor"
            : room.floorLevel,
        level: room.floorLevel,
        roomIds: [room.id],
        sourcePlanPageIds,
      });
      return;
    }

    floorsByLevel.set(room.floorLevel, {
      ...currentFloor,
      roomIds: [...currentFloor.roomIds, room.id],
      sourcePlanPageIds: [
        ...new Set([...currentFloor.sourcePlanPageIds, ...sourcePlanPageIds]),
      ],
    });
  });

  if (floorsByLevel.size === 0 && project.blueprintDocument?.pages.length) {
    return [];
  }

  return [...floorsByLevel.values()];
}

function adaptEnvelopeSuggestions(
  suggestions: BlueprintEnvelopeSuggestions | undefined
): BuildingEnvelopeSuggestion[] {
  if (!suggestions) return [];

  const mappings: Array<{
    field: BuildingEnvelopeSuggestion["field"];
    suggestion: BlueprintEnvelopeSuggestions[keyof BlueprintEnvelopeSuggestions];
  }> = [
    { field: "atticRValue", suggestion: suggestions.atticRValue },
    { field: "wallRValue", suggestion: suggestions.wallRValue },
    { field: "floorRValue", suggestion: suggestions.floorRValue },
    { field: "windowUFactor", suggestion: suggestions.windowUFactor },
    { field: "windowShgc", suggestion: suggestions.windowSHGC },
    { field: "infiltrationAch50", suggestion: suggestions.infiltrationACH50 },
  ];

  return mappings.flatMap(({ field, suggestion }) => {
    if (!suggestion || Array.isArray(suggestion)) return [];

    return [
      {
        field,
        value: suggestion.value,
        confidence: suggestion.confidence,
        evidence: createEvidence("ai-suggested", "unverified", {
          sourceReference: suggestion.sourceNote,
          note: "Legacy suggestion retained as unverified evidence only.",
        }),
      },
    ];
  });
}

function createEnvelope(project: BlueprintProject): BuildingEnvelope {
  const settings = project.envelopeSettings;

  return {
    climateRegion: settings.oregonRegion,
    defaultInsulationQuality: settings.insulationQuality,
    atticRValue: settings.verifiedInsulation?.atticRValue,
    wallRValue: settings.verifiedInsulation?.wallRValue,
    floorRValue: settings.verifiedInsulation?.floorRValue,
    windowUFactor: settings.verifiedWindows?.uFactor,
    windowShgc: settings.verifiedWindows?.shgc,
    infiltrationAch50: settings.verifiedInfiltration?.ach50,
    verified: settings.isVerified,
    evidence: {
      climateRegion: createEvidence("technician-entered", "assumed"),
      insulation: createEvidence(
        settings.isVerified ? "field-measured" : "system-default",
        settings.isVerified ? "verified" : "assumed"
      ),
      windows: createEvidence(
        settings.isVerified ? "field-measured" : "system-default",
        settings.isVerified ? "verified" : "assumed"
      ),
      infiltration: createEvidence(
        settings.isVerified ? "field-measured" : "system-default",
        settings.isVerified ? "verified" : "assumed"
      ),
    },
    suggestions: adaptEnvelopeSuggestions(project.envelopeSuggestions),
  };
}

export function createBuildingModelFromLegacyProject(
  project: BlueprintProject
): BuildingModel {
  const planSet = createPlanSet(project);
  const adaptedEntities = project.tracedRooms.map((room) =>
    adaptRoomEntities(project, room)
  );
  const rooms = adaptedEntities.map((entities) => entities.room);
  const walls = adaptedEntities.flatMap((entities) => entities.walls);
  const openings = adaptedEntities.flatMap((entities) => entities.openings);

  const modelWithoutReadiness: BuildingModel = {
    id: `building-model:${project.id}`,
    projectId: project.id,
    projectName: project.name,
    schemaVersion: BUILDING_MODEL_SCHEMA_VERSION,
    revision: {
      value: 1,
      derivedFromProjectVersion: project.version,
      sourceUpdatedAt: project.updatedAt,
    },
    mode: getProjectMode(planSet, project.tracedRooms),
    planSet,
    floors: createFloors(project, rooms),
    rooms,
    walls,
    openings,
    envelope: createEnvelope(project),
    verification: EMPTY_READINESS,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };

  return {
    ...modelWithoutReadiness,
    verification: getBuildingReadinessSummary(modelWithoutReadiness),
  };
}

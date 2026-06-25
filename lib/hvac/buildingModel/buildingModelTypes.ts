import type {
  BlueprintCalibrationPoint,
  BlueprintCalibrationState,
} from "../blueprintCalibration";

export const BUILDING_MODEL_SCHEMA_VERSION = 1;

export type BuildingProjectMode =
  | "new-construction"
  | "retrofit"
  | "hybrid";

export type BuildingDataSource =
  | "blueprint-measured"
  | "field-measured"
  | "technician-entered"
  | "schedule-imported"
  | "system-default"
  | "ai-suggested"
  | "legacy-imported";

export type BuildingVerificationStatus =
  | "unverified"
  | "verified"
  | "assumed"
  | "needs-review";

export type BuildingFieldEvidence = {
  readonly source: BuildingDataSource;
  readonly verificationStatus: BuildingVerificationStatus;
  readonly sourceId?: string;
  readonly sourceReference?: string;
  readonly note?: string;
};

export type BuildingModelRevision = {
  readonly value: number;
  readonly derivedFromProjectVersion: string;
  readonly sourceUpdatedAt: string;
};

export type BuildingResultReference = {
  readonly buildingModelRevision: number;
  readonly calculatedAt: string;
  readonly resultId?: string;
};

export type BuildingPlanPage = {
  readonly id: string;
  readonly pageNumber: number;
  readonly label: string;
  readonly sheetType:
    | "floor-plan"
    | "site-plan"
    | "elevation"
    | "roof-plan"
    | "schedule"
    | "detail"
    | "unknown";
  readonly calibration: BlueprintCalibrationState | null;
};

export type BuildingPlanSet = {
  readonly id: string;
  readonly name: string;
  readonly assetId?: string;
  readonly sourceFileName?: string;
  readonly pages: readonly BuildingPlanPage[];
};

export type BuildingFloor = {
  readonly id: string;
  readonly name: string;
  readonly level: string;
  readonly roomIds: readonly string[];
  readonly sourcePlanPageIds: readonly string[];
};

export type BuildingRoomGeometry = {
  readonly method: "blueprint-polygon" | "manual-area";
  readonly points: readonly BlueprintCalibrationPoint[];
  readonly areaSquareFeet: number | null;
  readonly sourcePlanPageId?: string;
  readonly evidence: BuildingFieldEvidence;
};

export type BuildingRoom = {
  readonly id: string;
  readonly name: string;
  readonly floorId: string;
  readonly floorLevel: string;
  readonly geometry: BuildingRoomGeometry;
  readonly ceilingHeightFeet: number | null;
  readonly wallIds: readonly string[];
  readonly windowIds: readonly string[];
  readonly doorIds: readonly string[];
  readonly assumptions: {
    readonly insulationLevel?: "poor" | "average" | "good";
    readonly sunExposure?: "low" | "medium" | "high";
  };
  readonly verification: {
    readonly identity: BuildingFieldEvidence;
    readonly geometry: BuildingFieldEvidence;
    readonly ceilingHeight: BuildingFieldEvidence;
    readonly boundaries: BuildingVerificationStatus;
    readonly openings: BuildingVerificationStatus;
    readonly assumptions: BuildingVerificationStatus;
  };
  readonly legacySource: {
    readonly roomId: string;
    readonly sourceBlueprintRoomId?: string;
  };
};

export type BuildingBoundaryType =
  | "exterior"
  | "interior"
  | "garage"
  | "adjacent"
  | "attic"
  | "crawlspace"
  | "unknown";

export type BuildingWall = {
  readonly id: string;
  readonly roomId: string;
  readonly lengthFeet: number | null;
  readonly heightFeet: number | null;
  readonly boundaryType: BuildingBoundaryType;
  readonly orientation:
    | "north"
    | "northeast"
    | "east"
    | "southeast"
    | "south"
    | "southwest"
    | "west"
    | "northwest"
    | null;
  readonly startPoint: BlueprintCalibrationPoint | null;
  readonly endPoint: BlueprintCalibrationPoint | null;
  readonly openingIds: readonly string[];
  readonly construction: {
    readonly insulationLevel?: "poor" | "average" | "good";
    readonly rValue?: number;
    readonly uFactor?: number;
  };
  readonly verification: {
    readonly geometry: BuildingFieldEvidence;
    readonly boundaryType: BuildingFieldEvidence;
    readonly construction: BuildingFieldEvidence;
  };
  readonly legacySource: {
    readonly roomId: string;
    readonly edgeIndex: number;
    readonly startPointIndex: number;
    readonly endPointIndex: number;
  };
};

export type BuildingOpeningType =
  | "window"
  | "exterior-door"
  | "interior-door";

export type BuildingOpening = {
  readonly id: string;
  readonly wallId: string;
  readonly roomId: string;
  readonly type: BuildingOpeningType;
  readonly widthFeet: number;
  readonly heightFeet: number;
  readonly areaSquareFeet: number;
  readonly verified: boolean;
  readonly uFactor?: number;
  readonly shgc?: number;
  readonly scheduleMarkId?: string;
  readonly verification: {
    readonly dimensions: BuildingFieldEvidence;
    readonly type: BuildingFieldEvidence;
    readonly thermalProperties: BuildingFieldEvidence;
  };
  readonly legacySource: {
    readonly openingId: string;
    readonly roomId: string;
    readonly edgeIndex: number;
  };
};

export type BuildingEnvelopeSuggestion = {
  readonly field:
    | "atticRValue"
    | "wallRValue"
    | "floorRValue"
    | "windowUFactor"
    | "windowShgc"
    | "infiltrationAch50";
  readonly value: number | string;
  readonly confidence: number;
  readonly evidence: BuildingFieldEvidence;
};

export type BuildingEnvelope = {
  readonly climateRegion: string;
  readonly defaultInsulationQuality: string;
  readonly atticRValue?: number;
  readonly wallRValue?: number;
  readonly floorRValue?: number;
  readonly windowUFactor?: number;
  readonly windowShgc?: number;
  readonly infiltrationAch50?: number;
  readonly verified: boolean;
  readonly evidence: {
    readonly climateRegion: BuildingFieldEvidence;
    readonly insulation: BuildingFieldEvidence;
    readonly windows: BuildingFieldEvidence;
    readonly infiltration: BuildingFieldEvidence;
  };
  readonly suggestions: readonly BuildingEnvelopeSuggestion[];
};

export type BuildingReadinessStatus =
  | "incomplete"
  | "needs-review"
  | "calculation-ready";

export type BuildingReadinessSummary = {
  readonly status: BuildingReadinessStatus;
  readonly roomCount: number;
  readonly readyRoomCount: number;
  readonly blockers: readonly string[];
  readonly warnings: readonly string[];
  readonly roomStatuses: readonly {
    readonly roomId: string;
    readonly status: BuildingReadinessStatus;
    readonly blockers: readonly string[];
    readonly warnings: readonly string[];
  }[];
};

export type BuildingModel = {
  readonly id: string;
  readonly projectId: string;
  readonly projectName: string;
  readonly schemaVersion: typeof BUILDING_MODEL_SCHEMA_VERSION;
  readonly revision: BuildingModelRevision;
  readonly mode: BuildingProjectMode;
  readonly planSet: BuildingPlanSet | null;
  readonly floors: readonly BuildingFloor[];
  readonly rooms: readonly BuildingRoom[];
  readonly walls: readonly BuildingWall[];
  readonly openings: readonly BuildingOpening[];
  readonly envelope: BuildingEnvelope;
  readonly verification: BuildingReadinessSummary;
  readonly createdAt: string;
  readonly updatedAt: string;
};

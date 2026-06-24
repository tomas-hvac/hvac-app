import type { BlueprintCalibrationState } from "./blueprintCalibration";
import type { BlueprintRoomOutline, EngineeringRoom } from "./blueprintRoomTracing";
import type { ProjectEngineMetadata, ProjectEngineState } from "./engine/projectEngineTypes";
import { migrateEngineMetadata, prepareEngineStateForSave } from "./engine/projectEnginePersistence";
import type { ManualDProjectState } from "../../app/components/ManualDPanel";

export type BlueprintProjectEnvelopeSettings = {
  insulationQuality: string;
  oregonRegion: string;
  verifiedInsulation?: {
    atticRValue?: number;
    wallRValue?: number;
    floorRValue?: number;
  };
  verifiedWindows?: {
    uFactor?: number;
    shgc?: number;
  };
  verifiedInfiltration?: {
    ach50?: number;
  };
  isVerified: boolean;
};

export type WindowScheduleEntry = {
  id: string;
  mark: string;
  glassArea: number;
  uFactor: number;
  description?: string;
};

export type EnvelopeSuggestion = {
  value: number | string;
  confidence: number;
  sourceNote?: string; // Text from blueprint where this was found
};

export type BlueprintEnvelopeSuggestions = {
  atticRValue?: EnvelopeSuggestion;
  wallRValue?: EnvelopeSuggestion;
  floorRValue?: EnvelopeSuggestion;
  windowUFactor?: EnvelopeSuggestion;
  windowSHGC?: EnvelopeSuggestion;
  infiltrationACH50?: EnvelopeSuggestion;
  constructionNotes?: string[];
};

export type BlueprintPageImage = {
  name: string;
  mimeType?: string;
  dataUrl?: string;
  thumbnailDataUrl?: string;
};

export type BlueprintPage = {
  id: string;
  pageNumber: number;
  label: string;
  sheetType?: "floor-plan" | "site-plan" | "elevation" | "roof-plan" | "schedule" | "detail" | "unknown";
  image?: BlueprintPageImage;
  calibration?: BlueprintCalibrationState | null;
  tracedRooms?: EngineeringRoom[];
  focusArea?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
};

export type BlueprintDocument = {
  id: string;
  name: string;
  assetId?: string; // Reference to IndexedDB large asset (original PDF/image)
  pages: BlueprintPage[];
  activePageId?: string | null;
};

export type BlueprintProject = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  blueprintImage: {
    name: string;
    size: number;
    type: string;
    lastModified: number;
    dataUrl?: string; // Optional, for local persistence if needed
  } | null;
  blueprintDocument?: BlueprintDocument | null;
  blueprintOverlaySize?: { widthPx: number; heightPx: number };
  calibration: BlueprintCalibrationState;
  tracedRooms: EngineeringRoom[];
  windowSchedule?: WindowScheduleEntry[];
  envelopeSettings: BlueprintProjectEnvelopeSettings;
  envelopeSuggestions?: BlueprintEnvelopeSuggestions;
  manualDProjectState: ManualDProjectState | null;
  engineMetadata?: ProjectEngineMetadata;
  version: string;
};

export function createBlueprintProject(name: string): BlueprintProject {
  const now = new Date().toISOString();
  return {
    id: `project-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name,
    createdAt: now,
    updatedAt: now,
    blueprintImage: null,
    calibration: {
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
    },
    tracedRooms: [],
    windowSchedule: [],
    envelopeSettings: {
      insulationQuality: "Average",
      oregonRegion: "Portland / Beaverton / West Oregon",
      isVerified: false,
    },
    manualDProjectState: null,
    version: "3.0",
  };
}

export type BlueprintProjectSnapshotInput = {
  name: string;
  blueprintImage: BlueprintProject["blueprintImage"];
  blueprintDocument?: BlueprintDocument | null;
  blueprintOverlaySize?: { widthPx: number; heightPx: number };
  calibration: BlueprintCalibrationState;
  tracedRooms: BlueprintRoomOutline[];
  windowSchedule?: WindowScheduleEntry[];
  envelopeSettings: BlueprintProjectEnvelopeSettings;
  envelopeSuggestions?: BlueprintEnvelopeSuggestions;
  manualDProjectState: ManualDProjectState | null;
  engineMetadata?: ProjectEngineMetadata;
};

export function createBlueprintProjectSnapshot(input: BlueprintProjectSnapshotInput): BlueprintProject {
  const project = createBlueprintProject(input.name);
  return {
    ...project,
    blueprintImage: input.blueprintImage,
    blueprintDocument: input.blueprintDocument,
    blueprintOverlaySize: input.blueprintOverlaySize,
    calibration: input.calibration,
    tracedRooms: input.tracedRooms,
    windowSchedule: input.windowSchedule || [],
    envelopeSettings: input.envelopeSettings,
    envelopeSuggestions: input.envelopeSuggestions,
    manualDProjectState: input.manualDProjectState,
    engineMetadata: input.engineMetadata,
  };
}

export function updateBlueprintProjectSnapshot(
  existing: BlueprintProject,
  input: BlueprintProjectSnapshotInput
): BlueprintProject {
  return {
    ...existing,
    name: input.name,
    updatedAt: new Date().toISOString(),
    blueprintImage: input.blueprintImage,
    blueprintDocument: input.blueprintDocument,
    blueprintOverlaySize: input.blueprintOverlaySize,
    calibration: input.calibration,
    tracedRooms: input.tracedRooms,
    windowSchedule: input.windowSchedule || existing.windowSchedule || [],
    envelopeSettings: input.envelopeSettings,
    envelopeSuggestions: input.envelopeSuggestions,
    manualDProjectState: input.manualDProjectState,
    engineMetadata: input.engineMetadata || existing.engineMetadata,
  };
}

export function ensureBlueprintDocument(project: BlueprintProject): BlueprintProject {
  if (project.blueprintDocument) return project;

  return {
    ...project,
    blueprintDocument: {
      id: `doc-${Date.now()}`,
      name: project.blueprintImage?.name || project.name,
      pages: [
        {
          id: `page-1`,
          pageNumber: 1,
          label: "Sheet 1",
          calibration: project.calibration,
          tracedRooms: project.tracedRooms,
        }
      ],
      activePageId: "page-1",
    }
  };
}

export function serializeBlueprintProject(project: BlueprintProject): string {
  return JSON.stringify(project);
}

export function deserializeBlueprintProject(json: string): BlueprintProject {
  const project = JSON.parse(json) as BlueprintProject;

  // Ensure we have a default windowSchedule if missing from old versions
  if (!project.windowSchedule) {
    project.windowSchedule = [];
  }

  return project;
}

export function importBlueprintProjectFromFileData(json: string): BlueprintProject | null {
  try {
    const project = deserializeBlueprintProject(json);
    
    // Basic structural validation
    if (!project.id || !project.name || !Array.isArray(project.tracedRooms)) {
      console.error("Import failed: Invalid project structure");
      return null;
    }

    return project;
  } catch (error) {
    console.error("Import failed: Malformed project file", error);
    return null;
  }
}

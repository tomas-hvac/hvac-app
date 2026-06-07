import type { BlueprintCalibrationState } from "./blueprintCalibration";
import type { BlueprintRoomOutline } from "./blueprintRoomTracing";
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
  tracedRooms?: BlueprintRoomOutline[];
};

export type BlueprintDocument = {
  id: string;
  name: string;
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
  tracedRooms: BlueprintRoomOutline[];
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
    envelopeSettings: input.envelopeSettings,
    envelopeSuggestions: input.envelopeSuggestions,
    manualDProjectState: input.manualDProjectState,
    engineMetadata: input.engineMetadata,
  };
}

export function updateBlueprintProjectSnapshot(
  existingProject: BlueprintProject,
  updates: Partial<BlueprintProjectSnapshotInput>
): BlueprintProject {
  return {
    ...existingProject,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
}

export function serializeBlueprintProject(project: BlueprintProject): string {
  return JSON.stringify({
    ...project,
    updatedAt: new Date().toISOString(),
  });
}

export function deserializeBlueprintProject(json: string): BlueprintProject {
  const data = JSON.parse(json);
  
  // Basic version migration logic can go here in the future
  if (!data.version) {
    data.version = "1.0";
  }

  data.engineMetadata = migrateEngineMetadata(data.engineMetadata);

  return data as BlueprintProject;
}

/**
 * ARCHITECTURE DECISION: Multi-Page PDF Workspace (Deferred Activation)
 *
 * Stage 1A: PDF Upload Guard - Complete
 * Stage 1B: Multi-Page Types - Complete
 * Stage 1C: Passive Promotion Helper - Complete
 * Stage 1D: Activation - Deferred
 *
 * Current Source of Truth:
 * - blueprintImage
 * - calibration
 * - tracedRooms
 *
 * The UI and engineering engine currently read and write
 * root-level blueprint state directly.
 *
 * DO NOT invoke ensureBlueprintDocument during normal
 * load/deserialize flows yet.
 *
 * Activating promotion now will create a blueprintDocument
 * that can drift out of sync with technician edits because
 * the UI does not yet read/write blueprintDocument.pages.
 *
 * Activation must wait until:
 * 1. Page-based UI exists.
 * 2. Page switching exists.
 * 3. Calibration is page-specific.
 * 4. Traced rooms are page-specific.
 * 5. blueprintDocument.pages becomes the primary source of truth.
 *
 * Until then, this helper remains a passive migration bridge only.
 */
export function ensureBlueprintDocument(project: BlueprintProject): BlueprintProject {
  // 1. If already has a document with pages, return as-is
  if (project.blueprintDocument && project.blueprintDocument.pages.length > 0) {
    return project;
  }

  // 2. Create a "Legacy Page" from existing root-level data
  const legacyPage: BlueprintPage = {
    id: `page-${project.id}-1`,
    pageNumber: 1,
    label: "Sheet 1",
    sheetType: "floor-plan",
    // Copy lightweight metadata only, NO high-res dataUrl duplication
    image: project.blueprintImage
      ? {
          name: project.blueprintImage.name,
          mimeType: project.blueprintImage.type,
        }
      : undefined,
    // Copy references to existing engineering work
    calibration: project.calibration,
    tracedRooms: [...project.tracedRooms],
  };

  // 3. Attach the new document model
  return {
    ...project,
    blueprintDocument: {
      id: `doc-${project.id}`,
      name: project.name,
      pages: [legacyPage],
      activePageId: legacyPage.id,
    },
  };
}

export function exportBlueprintProjectToFileData(
  project: BlueprintProject,
  engineState?: ProjectEngineState
): string {
  const portableProject = engineState
    ? {
        ...project,
        engineMetadata: prepareEngineStateForSave(engineState, "PROJECT_SAVED").metadata,
      }
    : project;

  return serializeBlueprintProject(portableProject);
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

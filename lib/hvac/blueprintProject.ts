import type { BlueprintCalibrationState } from "./blueprintCalibration";
import type { BlueprintRoomOutline } from "./blueprintRoomTracing";
import type { ManualDProjectState } from "../../app/components/ManualDPanel";

export type BlueprintProjectEnvelopeSettings = {
  insulationQuality: string;
  oregonRegion: string;
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
  calibration: BlueprintCalibrationState;
  tracedRooms: BlueprintRoomOutline[];
  envelopeSettings: BlueprintProjectEnvelopeSettings;
  manualDProjectState: ManualDProjectState | null;
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
    },
    manualDProjectState: null,
    version: "3.0",
  };
}

export type BlueprintProjectSnapshotInput = {
  name: string;
  blueprintImage: BlueprintProject["blueprintImage"];
  calibration: BlueprintCalibrationState;
  tracedRooms: BlueprintRoomOutline[];
  envelopeSettings: BlueprintProjectEnvelopeSettings;
  manualDProjectState: ManualDProjectState | null;
};

export function createBlueprintProjectSnapshot(input: BlueprintProjectSnapshotInput): BlueprintProject {
  const project = createBlueprintProject(input.name);
  return {
    ...project,
    blueprintImage: input.blueprintImage,
    calibration: input.calibration,
    tracedRooms: input.tracedRooms,
    envelopeSettings: input.envelopeSettings,
    manualDProjectState: input.manualDProjectState,
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

  return data as BlueprintProject;
}

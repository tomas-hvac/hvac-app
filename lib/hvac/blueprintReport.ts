import { BlueprintProject } from "./blueprintProject";
import {
  explainBlueprintRoomEnvelopePreview,
  calculateBlueprintRoomEnvelopeConfidence,
  BlueprintRoomEnvelopePreviewStatus,
  BlueprintRoomEnvelopeConfidence,
} from "./blueprintExteriorLoad";

export type BlueprintTechnicianReport = {
  projectId: string;
  projectName: string;
  generatedAt: string;
  blueprintMetadata: {
    fileName: string | null;
    calibrationStatus: string;
    scalePxPerFoot: number | null;
    calibrationConfidence: string;
  };
  rooms: BlueprintRoomReportSummary[];
  manualDSummary: BlueprintManualDReportSummary | null;
  technicianNotes: string;
  version: string;
};

export type BlueprintRoomReportSummary = {
  id: string;
  name: string;
  squareFeet: number | null;
  ceilingHeight: string;
  floorLevel: string;
  envelopeInsight: {
    status: BlueprintRoomEnvelopePreviewStatus;
    messages: string[];
  };
  confidence: BlueprintRoomEnvelopeConfidence;
};

export type BlueprintManualDReportSummary = {
  systemTons: string;
  totalCfm: string;
  availableStatic: string;
  roomCount: number;
  rooms: {
    name: string;
    squareFeet: number;
    registerCount: number;
  }[];
};

/**
 * Creates a static, serializable technician report from a BlueprintProject snapshot.
 * This "bakes" the engine's real-time insights into a fixed structure suitable for 
 * archiving or PDF generation.
 */
export function createBlueprintTechnicianReport(
  project: BlueprintProject
): BlueprintTechnicianReport {
  const rooms: BlueprintRoomReportSummary[] = project.tracedRooms.map((room) => {
    const envelopeInput = {
      room,
      pixelsPerFoot: project.calibration.pixelsPerFoot,
      insulationQuality: project.envelopeSettings.insulationQuality,
      oregonRegion: project.envelopeSettings.oregonRegion,
    };

    return {
      id: room.id,
      name: room.name,
      squareFeet: room.squareFeet,
      ceilingHeight: room.ceilingHeight,
      floorLevel: room.floorLevel,
      envelopeInsight: explainBlueprintRoomEnvelopePreview(envelopeInput),
      confidence: calculateBlueprintRoomEnvelopeConfidence(envelopeInput),
    };
  });

  const manualDSummary: BlueprintManualDReportSummary | null = project.manualDProjectState
    ? {
        systemTons: project.manualDProjectState.settings.systemTons,
        totalCfm: project.manualDProjectState.settings.totalCfm,
        availableStatic: project.manualDProjectState.settings.availableStatic,
        roomCount: project.manualDProjectState.rooms.length,
        rooms: project.manualDProjectState.rooms.map((r) => {
          const bpRoom = r.blueprintSourceRoomId
            ? project.tracedRooms.find((tr) => tr.id === r.blueprintSourceRoomId)
            : null;
          return {
            name: bpRoom ? bpRoom.name : r.name,
            squareFeet: bpRoom ? Math.round(bpRoom.squareFeet ?? 0) : r.squareFeet,
            registerCount: r.supplyRegisterCount,
          };
        }),
      }
    : null;

  return {
    projectId: project.id,
    projectName: project.name,
    generatedAt: new Date().toISOString(),
    blueprintMetadata: {
      fileName: project.blueprintImage?.name ?? null,
      calibrationStatus: project.calibration.status,
      scalePxPerFoot: project.calibration.pixelsPerFoot,
      calibrationConfidence: project.calibration.confidence,
    },
    rooms,
    manualDSummary,
    technicianNotes: "", // Placeholder for technician-added field notes
    version: "4.0",
  };
}

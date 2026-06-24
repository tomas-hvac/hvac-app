import { 
  getOregonDesignTemperatures, 
  getInsulationUFactor, 
  getWindowUFactor, 
  INDOOR_HEATING_TARGET,
  INDOOR_COOLING_TARGET
} from "../loadUtils";
import type { EngineeringRoom } from "../blueprintRoomTracing";

/**
 * Inputs required for a professional room-level Manual J load calculation.
 * Merges room-specific geometry with global project envelope settings.
 */
export type RoomLoadInput = {
  room: EngineeringRoom;
  
  // Global project context for scientific alignment
  globalSettings: {
    oregonRegion: string;
    homeAge: string;
    infiltrationTightness: string;
    ductLocation: string;
    ductCondition: string;
  };
};

/**
 * The resulting load calculation for a single room.
 * Sensible BTU is the primary driver for Manual D airflow distribution.
 */
export type RoomLoadResult = {
  roomId: string;
  roomName: string;
  sensibleBTU: number;
  heatingBTU: number;
  coolingBTU: number;
  recommendedCFM: number;
  confidence: "low" | "medium" | "high";
  assumptions: string[];
  warnings: string[];
};

/**
 * Calculates room-level heat gain and loss based on ACCA Manual J methodologies.
 * This is a foundation service for professional airflow distribution.
 */
export function calculateRoomLoad(input: RoomLoadInput): RoomLoadResult {
  const assumptions: string[] = [];
  const warnings: string[] = [];
  
  const room = input.room;
  const globalSettings = input.globalSettings;

  const squareFeet = room.squareFeet || 0;
  const ceilingHeight = Number(room.ceilingHeight) || 0;

  const exteriorWallCount = room.exteriorWallsCount !== undefined
    ? (Number(room.exteriorWallsCount) || 0)
    : (room.boundaryEdges?.filter((edge) => edge.boundaryType === "exterior").length ?? 0);

  let windowCount = 0;
  if (room.windowsCount !== undefined) {
    windowCount = Number(room.windowsCount) || 0;
  } else {
    room.boundaryEdges?.forEach((edge) => {
      windowCount += edge.openings?.filter((op) => op.type === "window" && op.isVerified).length || 0;
    });
  }

  const insulationQuality = room.insulationLevel || "average";
  const sunExposure = room.sunExposure || "medium";


  // 1. Geometry Verification
  if (squareFeet <= 0) warnings.push("Room square footage is zero; calculation results will be invalid.");
  if (ceilingHeight <= 0) {
    warnings.push("Ceiling height missing; assuming 8ft standard.");
    assumptions.push("Assumed 8ft ceiling height.");
  }
  
  const activeCeilingHeight = ceilingHeight || 8;
  const roomVolume = squareFeet * activeCeilingHeight;

  // 2. Design Temperatures (Scoped to Oregon region)
  const designData = getOregonDesignTemperatures(globalSettings.oregonRegion);
  const heatingDeltaT = designData.heatingDeltaT;
  const coolingDeltaT = designData.coolingDeltaT;

  // 3. Wall Conduction Estimate
  // Heuristic: Linear exterior wall length = count * sqrt(sqft)
  const linearExteriorFeet = exteriorWallCount * Math.sqrt(squareFeet);
  const exteriorWallArea = linearExteriorFeet * activeCeilingHeight;
  
  if (exteriorWallCount > 0) {
    assumptions.push(`Estimated ${Math.round(linearExteriorFeet)} linear feet of exterior wall based on room area and wall count.`);
  }

  const wallUFactor = getInsulationUFactor(insulationQuality);
  const wallHeatingLoad = exteriorWallArea * wallUFactor * heatingDeltaT;
  const wallCoolingLoad = exteriorWallArea * wallUFactor * coolingDeltaT;

  // 4. Window Conduction & Solar Gain
  const windowArea = windowCount * 15; // Assume 15 sqft per window
  if (windowCount > 0) {
    assumptions.push("Assumed average window size of 15 sqft per unit.");
  }
  
  const windowUFactor = getWindowUFactor("standard"); 
  const windowHeatingLoad = windowArea * windowUFactor * heatingDeltaT;
  
  // Solar gain adjusted by qualitative exposure
  const baseSolarFactor = 140; // Moderate
  const sunMultiplier = sunExposure === "high" ? 1.25 : sunExposure === "low" ? 0.75 : 1.0;
  const windowCoolingLoad = (windowArea * windowUFactor * coolingDeltaT) + (windowArea * baseSolarFactor * sunMultiplier);

  // 5. Infiltration Load
  // Simplified room-level infiltration based on volume and global tightness
  const achBase = globalSettings.infiltrationTightness === "Tight / Air Sealed" ? 0.3 : globalSettings.infiltrationTightness === "Leaky / Older Home" ? 0.8 : 0.5;
  const infiltrationCFM = (roomVolume * achBase) / 60;
  const infiltrationHeatingLoad = infiltrationCFM * 1.08 * heatingDeltaT;
  const infiltrationCoolingLoad = infiltrationCFM * 0.68 * coolingDeltaT; // Latent/Sensible blend for room estimate

  // 6. Internal Gains
  const internalSensibleCooling = (squareFeet * 0.5) + 200; // Lighting, equipment, partial occupancy

  // 7. Totals
  const totalHeatingBTU = Math.max(0, Math.round(wallHeatingLoad + windowHeatingLoad + infiltrationHeatingLoad));
  const totalCoolingBTU = Math.max(0, Math.round(wallCoolingLoad + windowCoolingLoad + infiltrationCoolingLoad + internalSensibleCooling));
  
  // Sensible BTU for airflow is cooling-dominant for sizing in most residential applications
  const sensibleBTU = totalCoolingBTU;

  // 8. Recommended CFM
  // CFM = Sensible BTU / (1.08 * Delta T)
  // Assuming standard 20 degree delta across evaporator
  const designCoolingDeltaT = 20; 
  const recommendedCFM = coolingDeltaT > 0 ? Math.max(0, Math.round(sensibleBTU / (1.08 * designCoolingDeltaT))) : 0;

  // 9. Confidence Assessment
  const confidence = (exteriorWallCount > 0 && windowCount > 0 && squareFeet > 10) ? "high" : "medium";

  return {
    roomId: room.id,
    roomName: room.name,
    sensibleBTU,
    heatingBTU: totalHeatingBTU,
    coolingBTU: totalCoolingBTU,
    recommendedCFM,
    confidence,
    assumptions,
    warnings
  };
}

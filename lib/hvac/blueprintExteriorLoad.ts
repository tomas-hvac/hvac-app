import { calculateBlueprintPixelDistance } from "./blueprintCalibration";
import type { BlueprintCalibrationPoint } from "./blueprintCalibration";
import type { BlueprintRoomBoundaryEdge, BlueprintRoomOutline } from "./blueprintRoomTracing";

export type BlueprintExteriorLoadOverlaySize = {
  widthPx: number;
  heightPx: number;
};

export type BlueprintOregonDesignDeltaT = {
  region: string;
  heatingOutdoor: number;
  coolingOutdoor: number;
  heatingDeltaT: number;
  coolingDeltaT: number;
};

export type BlueprintExteriorEdgeOrientation =
  | "north"
  | "south"
  | "east"
  | "west"
  | "northeast"
  | "northwest"
  | "southeast"
  | "southwest"
  | "unknown";

export type BlueprintExteriorEdgeOrientationPreview = {
  edgeIndex: number;
  startPointIndex: number;
  endPointIndex: number;
  orientation: BlueprintExteriorEdgeOrientation;
};

export type BlueprintExteriorWallLoadInput = {
  room: BlueprintRoomOutline;
  pixelsPerFoot: number | null;
  overlaySize?: BlueprintExteriorLoadOverlaySize;
  insulationQuality?: string;
  oregonRegion?: string;
};

export type BlueprintExteriorWallLoadPreview = {
  exteriorEdgeCount: number;
  exteriorLengthFeet: number;
  wallAreaSquareFeet: number;
  uFactor: number;
  heatingDeltaT: number;
  coolingDeltaT: number;
  heatingBtu: number;
  coolingBtu: number;
  dominantBtu: number;
  designRegion: string;
};

function getValidPoint(
  points: BlueprintCalibrationPoint[],
  index: number
): BlueprintCalibrationPoint | null {
  return index >= 0 && index < points.length ? points[index] : null;
}

function calculateBlueprintPolygonCentroid(
  points: BlueprintCalibrationPoint[]
): BlueprintCalibrationPoint | null {
  if (points.length === 0) return null;

  const pointTotal = points.reduce(
    (total, point) => ({
      xPercent: total.xPercent + point.xPercent,
      yPercent: total.yPercent + point.yPercent,
    }),
    { xPercent: 0, yPercent: 0 }
  );

  return {
    xPercent: pointTotal.xPercent / points.length,
    yPercent: pointTotal.yPercent / points.length,
  };
}

function getCompassOrientationFromVector(
  xDelta: number,
  yDelta: number
): BlueprintExteriorEdgeOrientation {
  if (!Number.isFinite(xDelta) || !Number.isFinite(yDelta)) return "unknown";
  if (Math.abs(xDelta) < 0.001 && Math.abs(yDelta) < 0.001) return "unknown";

  const degrees = (Math.atan2(yDelta, xDelta) * 180) / Math.PI;
  const normalizedDegrees = (degrees + 360) % 360;

  if (normalizedDegrees >= 337.5 || normalizedDegrees < 22.5) return "east";
  if (normalizedDegrees < 67.5) return "southeast";
  if (normalizedDegrees < 112.5) return "south";
  if (normalizedDegrees < 157.5) return "southwest";
  if (normalizedDegrees < 202.5) return "west";
  if (normalizedDegrees < 247.5) return "northwest";
  if (normalizedDegrees < 292.5) return "north";
  return "northeast";
}

export function calculateBlueprintExteriorEdgeOrientation(
  points: BlueprintCalibrationPoint[],
  edge: BlueprintRoomBoundaryEdge
): BlueprintExteriorEdgeOrientation {
  const centroid = calculateBlueprintPolygonCentroid(points);
  const startPoint = getValidPoint(points, edge.startPointIndex);
  const endPoint = getValidPoint(points, edge.endPointIndex);
  if (!centroid || !startPoint || !endPoint) return "unknown";

  const edgeMidpoint = {
    xPercent: (startPoint.xPercent + endPoint.xPercent) / 2,
    yPercent: (startPoint.yPercent + endPoint.yPercent) / 2,
  };

  return getCompassOrientationFromVector(
    edgeMidpoint.xPercent - centroid.xPercent,
    edgeMidpoint.yPercent - centroid.yPercent
  );
}

export function getBlueprintExteriorEdgeOrientationPreviews(
  room: BlueprintRoomOutline
): BlueprintExteriorEdgeOrientationPreview[] {
  if (!room.boundaryEdges || room.boundaryEdges.length === 0) return [];

  return room.boundaryEdges
    .map((edge, edgeIndex) => ({ edge, edgeIndex }))
    .filter(({ edge }) => edge.boundaryType === "exterior")
    .map(({ edge, edgeIndex }) => ({
      edgeIndex,
      startPointIndex: edge.startPointIndex,
      endPointIndex: edge.endPointIndex,
      orientation: calculateBlueprintExteriorEdgeOrientation(room.points, edge),
    }));
}

export function getBlueprintExteriorWallUFactor(insulationQuality = "Average") {
  const uFactors: Record<string, number> = {
    Excellent: 0.035,
    Good: 0.045,
    Average: 0.055,
    Poor: 0.075,
  };

  return uFactors[insulationQuality] ?? uFactors.Average;
}

export function getBlueprintOregonDesignDeltaT(
  oregonRegion = "Portland / Beaverton / West Oregon"
): BlueprintOregonDesignDeltaT {
  const indoorHeatingTarget = 70;
  const indoorCoolingTarget = 75;
  const designByRegion: Record<string, { region: string; heatingOutdoor: number; coolingOutdoor: number }> = {
    "Portland / Beaverton / West Oregon": {
      region: "Portland / Beaverton / West Oregon",
      heatingOutdoor: 28,
      coolingOutdoor: 88,
    },
    "Coast / Marine": {
      region: "Coast / Marine",
      heatingOutdoor: 32,
      coolingOutdoor: 80,
    },
    "Central Oregon": {
      region: "Central Oregon",
      heatingOutdoor: 15,
      coolingOutdoor: 93,
    },
    "Eastern Oregon": {
      region: "Eastern Oregon",
      heatingOutdoor: 8,
      coolingOutdoor: 96,
    },
    "Southern Oregon": {
      region: "Southern Oregon",
      heatingOutdoor: 25,
      coolingOutdoor: 95,
    },
  };
  const design = designByRegion[oregonRegion] ?? designByRegion["Portland / Beaverton / West Oregon"];

  return {
    ...design,
    heatingDeltaT: indoorHeatingTarget - design.heatingOutdoor,
    coolingDeltaT: design.coolingOutdoor - indoorCoolingTarget,
  };
}

export function calculateBlueprintBoundaryEdgeLengthFeet(
  points: BlueprintCalibrationPoint[],
  edge: BlueprintRoomBoundaryEdge,
  pixelsPerFoot: number | null,
  overlaySize?: BlueprintExteriorLoadOverlaySize
) {
  if (!pixelsPerFoot || pixelsPerFoot <= 0 || !overlaySize) return null;
  if (overlaySize.widthPx <= 0 || overlaySize.heightPx <= 0) return null;

  const startPoint = getValidPoint(points, edge.startPointIndex);
  const endPoint = getValidPoint(points, edge.endPointIndex);
  if (!startPoint || !endPoint) return null;

  const pixelDistance = calculateBlueprintPixelDistance(
    startPoint,
    endPoint,
    overlaySize.widthPx,
    overlaySize.heightPx
  );

  return pixelDistance / pixelsPerFoot;
}

export function calculateBlueprintExteriorWallLoadPreview({
  room,
  pixelsPerFoot,
  overlaySize,
  insulationQuality = "Average",
  oregonRegion,
}: BlueprintExteriorWallLoadInput): BlueprintExteriorWallLoadPreview | null {
  if (!room.boundaryEdges || room.boundaryEdges.length === 0) return null;

  const ceilingHeightFeet = Math.max(0, Number(room.ceilingHeight) || 0);
  if (ceilingHeightFeet <= 0) return null;

  const exteriorEdgeLengths = room.boundaryEdges
    .filter((edge) => edge.boundaryType === "exterior")
    .map((edge) =>
      calculateBlueprintBoundaryEdgeLengthFeet(room.points, edge, pixelsPerFoot, overlaySize)
    )
    .filter((lengthFeet): lengthFeet is number => lengthFeet !== null && lengthFeet > 0);

  if (exteriorEdgeLengths.length === 0) return null;

  const exteriorLengthFeet = exteriorEdgeLengths.reduce((sum, lengthFeet) => sum + lengthFeet, 0);
  const wallAreaSquareFeet = exteriorLengthFeet * ceilingHeightFeet;
  const uFactor = getBlueprintExteriorWallUFactor(insulationQuality);
  const designDeltaT = getBlueprintOregonDesignDeltaT(oregonRegion);
  const heatingBtu = wallAreaSquareFeet * uFactor * designDeltaT.heatingDeltaT;
  const coolingBtu = wallAreaSquareFeet * uFactor * designDeltaT.coolingDeltaT;

  return {
    exteriorEdgeCount: exteriorEdgeLengths.length,
    exteriorLengthFeet,
    wallAreaSquareFeet,
    uFactor,
    heatingDeltaT: designDeltaT.heatingDeltaT,
    coolingDeltaT: designDeltaT.coolingDeltaT,
    heatingBtu: Math.round(heatingBtu),
    coolingBtu: Math.round(coolingBtu),
    dominantBtu: Math.round(Math.max(heatingBtu, coolingBtu)),
    designRegion: designDeltaT.region,
  };
}

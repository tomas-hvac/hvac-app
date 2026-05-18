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

export type BlueprintBoundaryWindow = {
  id: string;
  edgeIndex: number;
  widthFeet: number;
  heightFeet: number;
  uFactor: number;
  shgc: number;
  orientation?: BlueprintExteriorEdgeOrientation;
};

export type BlueprintWindowLoadInput = {
  window: BlueprintBoundaryWindow;
  edgeOrientation?: BlueprintExteriorEdgeOrientation;
  oregonRegion?: string;
};

export type BlueprintWindowLoadPreview = {
  id: string;
  edgeIndex: number;
  orientation: BlueprintExteriorEdgeOrientation;
  areaSquareFeet: number;
  uFactor: number;
  shgc: number;
  heatingDeltaT: number;
  coolingDeltaT: number;
  heatingConductionBtu: number;
  coolingConductionBtu: number;
  solarGainBtu: number;
  dominantConductionBtu: number;
  designRegion: string;
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

export type BlueprintRoomEnvelopePreviewStatus =
  | "ready"
  | "not-ready"
  | "no-exterior-boundaries";

export type BlueprintRoomEnvelopePreviewInput = {
  room: BlueprintRoomOutline;
  pixelsPerFoot: number | null;
  overlaySize?: BlueprintExteriorLoadOverlaySize;
  insulationQuality?: string;
  oregonRegion?: string;
  windows?: BlueprintBoundaryWindow[];
};

export type BlueprintRoomEnvelopePreview = {
  status: BlueprintRoomEnvelopePreviewStatus;
  exteriorWallLengthFeet: number;
  exteriorWallAreaSquareFeet: number;
  totalWindowAreaSquareFeet: number;
  heatingEnvelopeBtu: number;
  coolingEnvelopeBtu: number;
  solarGainBtu: number;
  dominantEnvelopeBtu: number;
  exteriorWallLoad: BlueprintExteriorWallLoadPreview | null;
  windowLoads: BlueprintWindowLoadPreview[];
};

export type BlueprintEnvelopeContributionSource =
  | "exterior-wall-conduction"
  | "window-conduction"
  | "solar-gain"
  | "none"
  | "not-ready";

export type BlueprintEnvelopeContributionPercentages = {
  exteriorWallConductionPercent: number;
  windowConductionPercent: number;
  solarGainPercent: number;
};

export type BlueprintEnvelopeContributionBreakdown = {
  status: BlueprintRoomEnvelopePreviewStatus;
  dominantHeatingSource: BlueprintEnvelopeContributionSource;
  dominantCoolingSource: BlueprintEnvelopeContributionSource;
  dominantSolarOrientation: BlueprintExteriorEdgeOrientation;
  largestExteriorExposureOrientation: BlueprintExteriorEdgeOrientation;
  heatingContributionPercentages: BlueprintEnvelopeContributionPercentages | null;
  coolingContributionPercentages: BlueprintEnvelopeContributionPercentages | null;
  exteriorWallHeatingBtu: number;
  exteriorWallCoolingBtu: number;
  windowHeatingConductionBtu: number;
  windowCoolingConductionBtu: number;
  solarGainBtu: number;
};

export type BlueprintEnvelopeExplanation = {
  status: BlueprintRoomEnvelopePreviewStatus;
  messages: string[];
};

function getValidPoint(
  points: BlueprintCalibrationPoint[],
  index: number
): BlueprintCalibrationPoint | null {
  return index >= 0 && index < points.length ? points[index] : null;
}

function formatBlueprintOrientationLabel(orientation: BlueprintExteriorEdgeOrientation) {
  const labels: Record<BlueprintExteriorEdgeOrientation, string> = {
    north: "north-facing",
    south: "south-facing",
    east: "east-facing",
    west: "west-facing",
    northeast: "northeast-facing",
    northwest: "northwest-facing",
    southeast: "southeast-facing",
    southwest: "southwest-facing",
    unknown: "unknown-orientation",
  };

  return labels[orientation];
}

function getEnvelopeSourceLabel(source: BlueprintEnvelopeContributionSource) {
  const labels: Record<BlueprintEnvelopeContributionSource, string> = {
    "exterior-wall-conduction": "exterior wall conduction",
    "window-conduction": "window conduction",
    "solar-gain": "solar gain",
    none: "limited envelope load",
    "not-ready": "not-ready",
  };

  return labels[source];
}

function getCoolingSourceMessage(breakdown: BlueprintEnvelopeContributionBreakdown) {
  if (breakdown.dominantCoolingSource === "solar-gain") {
    const orientationLabel = formatBlueprintOrientationLabel(breakdown.dominantSolarOrientation);
    return breakdown.dominantSolarOrientation === "unknown"
      ? "Cooling load is mostly driven by window solar gain."
      : `Cooling load is mostly driven by ${orientationLabel} solar gain.`;
  }

  if (breakdown.dominantCoolingSource === "none") {
    return "Cooling envelope load is limited for this room.";
  }

  return `Cooling load is mostly driven by ${getEnvelopeSourceLabel(
    breakdown.dominantCoolingSource
  )}.`;
}

function getHeatingSourceMessage(breakdown: BlueprintEnvelopeContributionBreakdown) {
  if (breakdown.dominantHeatingSource === "none") {
    return "Heating envelope load is limited for this room.";
  }

  return `Heating load is mostly driven by ${getEnvelopeSourceLabel(
    breakdown.dominantHeatingSource
  )}.`;
}

function getExteriorExposureMessage(breakdown: BlueprintEnvelopeContributionBreakdown) {
  if (
    breakdown.largestExteriorExposureOrientation === "unknown" ||
    breakdown.exteriorWallHeatingBtu <= 0
  ) {
    return "This room has limited exterior exposure.";
  }

  return `Largest exterior exposure is ${formatBlueprintOrientationLabel(
    breakdown.largestExteriorExposureOrientation
  )}.`;
}

function getContributionPercentages(
  exteriorWallConductionBtu: number,
  windowConductionBtu: number,
  solarGainBtu: number
): BlueprintEnvelopeContributionPercentages | null {
  const total = exteriorWallConductionBtu + windowConductionBtu + solarGainBtu;
  if (total <= 0) return null;

  return {
    exteriorWallConductionPercent: Math.round((exteriorWallConductionBtu / total) * 100),
    windowConductionPercent: Math.round((windowConductionBtu / total) * 100),
    solarGainPercent: Math.round((solarGainBtu / total) * 100),
  };
}

function getDominantContributionSource(
  contributions: Array<{ source: BlueprintEnvelopeContributionSource; btu: number }>
): BlueprintEnvelopeContributionSource {
  const dominantContribution = contributions
    .filter((contribution) => contribution.btu > 0)
    .sort((first, second) => second.btu - first.btu)[0];

  return dominantContribution?.source ?? "none";
}

function getDominantSolarOrientation(
  windowLoads: BlueprintWindowLoadPreview[]
): BlueprintExteriorEdgeOrientation {
  const solarByOrientation = windowLoads.reduce(
    (totals, windowLoad) => {
      totals[windowLoad.orientation] += windowLoad.solarGainBtu;
      return totals;
    },
    {
      north: 0,
      south: 0,
      east: 0,
      west: 0,
      northeast: 0,
      northwest: 0,
      southeast: 0,
      southwest: 0,
      unknown: 0,
    } satisfies Record<BlueprintExteriorEdgeOrientation, number>
  );

  return (Object.entries(solarByOrientation) as Array<[BlueprintExteriorEdgeOrientation, number]>)
    .filter(([, solarGainBtu]) => solarGainBtu > 0)
    .sort((first, second) => second[1] - first[1])[0]?.[0] ?? "unknown";
}

function getLargestExteriorExposureOrientation(
  room: BlueprintRoomOutline,
  pixelsPerFoot: number | null,
  overlaySize?: BlueprintExteriorLoadOverlaySize
): BlueprintExteriorEdgeOrientation {
  if (!room.boundaryEdges || room.boundaryEdges.length === 0) return "unknown";

  const exposureByOrientation = room.boundaryEdges
    .map((edge, edgeIndex) => ({ edge, edgeIndex }))
    .filter(({ edge }) => edge.boundaryType === "exterior")
    .reduce(
      (totals, { edge }) => {
        const orientation = calculateBlueprintExteriorEdgeOrientation(room.points, edge);
        const lengthFeet =
          calculateBlueprintBoundaryEdgeLengthFeet(room.points, edge, pixelsPerFoot, overlaySize) ?? 0;
        totals[orientation] += lengthFeet;
        return totals;
      },
      {
        north: 0,
        south: 0,
        east: 0,
        west: 0,
        northeast: 0,
        northwest: 0,
        southeast: 0,
        southwest: 0,
        unknown: 0,
      } satisfies Record<BlueprintExteriorEdgeOrientation, number>
    );

  return (Object.entries(exposureByOrientation) as Array<[BlueprintExteriorEdgeOrientation, number]>)
    .filter(([, lengthFeet]) => lengthFeet > 0)
    .sort((first, second) => second[1] - first[1])[0]?.[0] ?? "unknown";
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

export function calculateBlueprintWindowAreaSquareFeet(
  window: Pick<BlueprintBoundaryWindow, "widthFeet" | "heightFeet">
) {
  const widthFeet = Math.max(0, window.widthFeet);
  const heightFeet = Math.max(0, window.heightFeet);
  if (widthFeet <= 0 || heightFeet <= 0) return null;

  return widthFeet * heightFeet;
}

export function calculateBlueprintWindowConductionBtu(
  areaSquareFeet: number | null,
  uFactor: number,
  deltaT: number
) {
  if (areaSquareFeet === null || areaSquareFeet <= 0) return null;
  if (!Number.isFinite(uFactor) || uFactor <= 0) return null;
  if (!Number.isFinite(deltaT) || deltaT < 0) return null;

  return areaSquareFeet * uFactor * deltaT;
}

export function getBlueprintWindowSolarFactor(
  orientation: BlueprintExteriorEdgeOrientation = "unknown"
) {
  const solarFactors: Record<BlueprintExteriorEdgeOrientation, number> = {
    north: 85,
    northeast: 105,
    east: 125,
    southeast: 145,
    south: 150,
    southwest: 165,
    west: 180,
    northwest: 120,
    unknown: 130,
  };

  return solarFactors[orientation];
}

export function calculateBlueprintWindowSolarGainBtu(
  areaSquareFeet: number | null,
  shgc: number,
  solarFactor: number
) {
  if (areaSquareFeet === null || areaSquareFeet <= 0) return null;
  if (!Number.isFinite(shgc) || shgc < 0) return null;
  if (!Number.isFinite(solarFactor) || solarFactor < 0) return null;

  return areaSquareFeet * shgc * solarFactor;
}

export function calculateBlueprintWindowLoadPreview({
  window,
  edgeOrientation,
  oregonRegion,
}: BlueprintWindowLoadInput): BlueprintWindowLoadPreview | null {
  const areaSquareFeet = calculateBlueprintWindowAreaSquareFeet(window);
  if (areaSquareFeet === null) return null;

  const orientation = window.orientation ?? edgeOrientation ?? "unknown";
  const designDeltaT = getBlueprintOregonDesignDeltaT(oregonRegion);
  const heatingConductionBtu = calculateBlueprintWindowConductionBtu(
    areaSquareFeet,
    window.uFactor,
    designDeltaT.heatingDeltaT
  );
  const coolingConductionBtu = calculateBlueprintWindowConductionBtu(
    areaSquareFeet,
    window.uFactor,
    designDeltaT.coolingDeltaT
  );
  const solarGainBtu = calculateBlueprintWindowSolarGainBtu(
    areaSquareFeet,
    window.shgc,
    getBlueprintWindowSolarFactor(orientation)
  );

  if (
    heatingConductionBtu === null ||
    coolingConductionBtu === null ||
    solarGainBtu === null
  ) {
    return null;
  }

  return {
    id: window.id,
    edgeIndex: window.edgeIndex,
    orientation,
    areaSquareFeet,
    uFactor: window.uFactor,
    shgc: window.shgc,
    heatingDeltaT: designDeltaT.heatingDeltaT,
    coolingDeltaT: designDeltaT.coolingDeltaT,
    heatingConductionBtu: Math.round(heatingConductionBtu),
    coolingConductionBtu: Math.round(coolingConductionBtu),
    solarGainBtu: Math.round(solarGainBtu),
    dominantConductionBtu: Math.round(Math.max(heatingConductionBtu, coolingConductionBtu)),
    designRegion: designDeltaT.region,
  };
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

export function calculateBlueprintRoomEnvelopePreview({
  room,
  pixelsPerFoot,
  overlaySize,
  insulationQuality = "Average",
  oregonRegion,
  windows = [],
}: BlueprintRoomEnvelopePreviewInput): BlueprintRoomEnvelopePreview {
  const exteriorWallLoad = calculateBlueprintExteriorWallLoadPreview({
    room,
    pixelsPerFoot,
    overlaySize,
    insulationQuality,
    oregonRegion,
  });

  if (!room.boundaryEdges || room.boundaryEdges.length === 0) {
    return {
      status: "no-exterior-boundaries",
      exteriorWallLengthFeet: 0,
      exteriorWallAreaSquareFeet: 0,
      totalWindowAreaSquareFeet: 0,
      heatingEnvelopeBtu: 0,
      coolingEnvelopeBtu: 0,
      solarGainBtu: 0,
      dominantEnvelopeBtu: 0,
      exteriorWallLoad: null,
      windowLoads: [],
    };
  }

  if (!exteriorWallLoad) {
    return {
      status: "not-ready",
      exteriorWallLengthFeet: 0,
      exteriorWallAreaSquareFeet: 0,
      totalWindowAreaSquareFeet: 0,
      heatingEnvelopeBtu: 0,
      coolingEnvelopeBtu: 0,
      solarGainBtu: 0,
      dominantEnvelopeBtu: 0,
      exteriorWallLoad: null,
      windowLoads: [],
    };
  }

  const exteriorEdgeOrientationsByIndex = new Map(
    getBlueprintExteriorEdgeOrientationPreviews(room).map((preview) => [
      preview.edgeIndex,
      preview.orientation,
    ])
  );
  const windowLoads = windows
    .map((window) =>
      calculateBlueprintWindowLoadPreview({
        window,
        edgeOrientation: exteriorEdgeOrientationsByIndex.get(window.edgeIndex),
        oregonRegion,
      })
    )
    .filter((windowLoad): windowLoad is BlueprintWindowLoadPreview => windowLoad !== null);

  const totalWindowAreaSquareFeet = windowLoads.reduce(
    (sum, windowLoad) => sum + windowLoad.areaSquareFeet,
    0
  );
  const windowHeatingConductionBtu = windowLoads.reduce(
    (sum, windowLoad) => sum + windowLoad.heatingConductionBtu,
    0
  );
  const windowCoolingConductionBtu = windowLoads.reduce(
    (sum, windowLoad) => sum + windowLoad.coolingConductionBtu,
    0
  );
  const solarGainBtu = windowLoads.reduce(
    (sum, windowLoad) => sum + windowLoad.solarGainBtu,
    0
  );
  const heatingEnvelopeBtu = exteriorWallLoad.heatingBtu + windowHeatingConductionBtu;
  const coolingEnvelopeBtu =
    exteriorWallLoad.coolingBtu + windowCoolingConductionBtu + solarGainBtu;

  return {
    status: "ready",
    exteriorWallLengthFeet: exteriorWallLoad.exteriorLengthFeet,
    exteriorWallAreaSquareFeet: exteriorWallLoad.wallAreaSquareFeet,
    totalWindowAreaSquareFeet,
    heatingEnvelopeBtu,
    coolingEnvelopeBtu,
    solarGainBtu,
    dominantEnvelopeBtu: Math.max(heatingEnvelopeBtu, coolingEnvelopeBtu),
    exteriorWallLoad,
    windowLoads,
  };
}

export function calculateBlueprintEnvelopeContributionBreakdown(
  input: BlueprintRoomEnvelopePreviewInput
): BlueprintEnvelopeContributionBreakdown {
  const envelopePreview = calculateBlueprintRoomEnvelopePreview(input);

  if (envelopePreview.status !== "ready" || !envelopePreview.exteriorWallLoad) {
    return {
      status: envelopePreview.status,
      dominantHeatingSource: "not-ready",
      dominantCoolingSource: "not-ready",
      dominantSolarOrientation: "unknown",
      largestExteriorExposureOrientation: "unknown",
      heatingContributionPercentages: null,
      coolingContributionPercentages: null,
      exteriorWallHeatingBtu: 0,
      exteriorWallCoolingBtu: 0,
      windowHeatingConductionBtu: 0,
      windowCoolingConductionBtu: 0,
      solarGainBtu: 0,
    };
  }

  const exteriorWallHeatingBtu = envelopePreview.exteriorWallLoad.heatingBtu;
  const exteriorWallCoolingBtu = envelopePreview.exteriorWallLoad.coolingBtu;
  const windowHeatingConductionBtu = envelopePreview.windowLoads.reduce(
    (sum, windowLoad) => sum + windowLoad.heatingConductionBtu,
    0
  );
  const windowCoolingConductionBtu = envelopePreview.windowLoads.reduce(
    (sum, windowLoad) => sum + windowLoad.coolingConductionBtu,
    0
  );
  const solarGainBtu = envelopePreview.windowLoads.reduce(
    (sum, windowLoad) => sum + windowLoad.solarGainBtu,
    0
  );

  return {
    status: "ready",
    dominantHeatingSource: getDominantContributionSource([
      { source: "exterior-wall-conduction", btu: exteriorWallHeatingBtu },
      { source: "window-conduction", btu: windowHeatingConductionBtu },
    ]),
    dominantCoolingSource: getDominantContributionSource([
      { source: "exterior-wall-conduction", btu: exteriorWallCoolingBtu },
      { source: "window-conduction", btu: windowCoolingConductionBtu },
      { source: "solar-gain", btu: solarGainBtu },
    ]),
    dominantSolarOrientation: getDominantSolarOrientation(envelopePreview.windowLoads),
    largestExteriorExposureOrientation: getLargestExteriorExposureOrientation(
      input.room,
      input.pixelsPerFoot,
      input.overlaySize
    ),
    heatingContributionPercentages: getContributionPercentages(
      exteriorWallHeatingBtu,
      windowHeatingConductionBtu,
      0
    ),
    coolingContributionPercentages: getContributionPercentages(
      exteriorWallCoolingBtu,
      windowCoolingConductionBtu,
      solarGainBtu
    ),
    exteriorWallHeatingBtu,
    exteriorWallCoolingBtu,
    windowHeatingConductionBtu,
    windowCoolingConductionBtu,
    solarGainBtu,
  };
}

export type BlueprintRoomEnvelopeConfidence = {
  score: "high" | "medium" | "low";
  assumptionsUsed: string[];
  missingInputs: string[];
  warnings: string[];
};

export function calculateBlueprintRoomEnvelopeConfidence(
  input: BlueprintRoomEnvelopePreviewInput
): BlueprintRoomEnvelopeConfidence {
  const assumptionsUsed: string[] = [];
  const missingInputs: string[] = [];
  const warnings: string[] = [];
  let score: "high" | "medium" | "low" = "high";

  // 1. Calibration Check
  if (!input.pixelsPerFoot || input.pixelsPerFoot <= 0) {
    score = "low";
    missingInputs.push("Blueprint calibration/scale");
    warnings.push("Calculations are using unscaled pixel distances.");
  }

  // 2. Boundary Classification Check
  const hasExteriorBoundaries = input.room.boundaryEdges?.some(
    (edge) => edge.boundaryType === "exterior"
  );

  if (!hasExteriorBoundaries) {
    score = "low";
    warnings.push("No exterior boundaries identified; envelope load may be underestimated.");
  }

  const hasUnknownBoundaries = input.room.boundaryEdges?.some(
    (edge) => edge.boundaryType === "unknown"
  );

  if (hasUnknownBoundaries) {
    if (score === "high") score = "medium";
    assumptionsUsed.push("Unknown boundaries treated as interior/non-load");
    warnings.push("Some room boundaries are unclassified.");
  }

  // 3. Orientation Check
  const orientations = getBlueprintExteriorEdgeOrientationPreviews(input.room);
  const hasUnknownOrientation = orientations.some((p) => p.orientation === "unknown");

  if (hasUnknownOrientation && hasExteriorBoundaries) {
    if (score === "high") score = "medium";
    assumptionsUsed.push("Default orientation used for unmapped exterior edges");
    warnings.push("Compass orientation could not be determined for some edges.");
  }

  // 4. Window Data Check
  const exteriorEdgeCount = input.room.boundaryEdges?.filter(
    (edge) => edge.boundaryType === "exterior"
  ).length ?? 0;
  const windows = input.windows ?? [];

  if (exteriorEdgeCount > 0 && windows.length === 0) {
    if (score === "high") score = "medium";
    assumptionsUsed.push("No windows model; assuming 0% window-to-wall ratio");
    warnings.push("No windows have been placed on exterior walls.");
  }

  // 5. Insulation Check
  if (!input.insulationQuality || input.insulationQuality === "Average") {
    assumptionsUsed.push("Standard 'Average' insulation U-factors (0.055)");
  }

  // 6. Region Check
  if (!input.oregonRegion) {
    assumptionsUsed.push("Default 'Portland / Beaverton' design temperatures");
  }

  // Final score adjustments
  if (missingInputs.length > 0 || warnings.length >= 3) {
    score = "low";
  } else if (assumptionsUsed.length >= 3) {
    if (score === "high") score = "medium";
  }

  return {
    score,
    assumptionsUsed,
    missingInputs,
    warnings,
  };
}

export function explainBlueprintEnvelopeContributionBreakdown(
  breakdown: BlueprintEnvelopeContributionBreakdown
): BlueprintEnvelopeExplanation {
  if (breakdown.status === "no-exterior-boundaries") {
    return {
      status: breakdown.status,
      messages: ["This room has limited exterior exposure."],
    };
  }

  if (breakdown.status !== "ready") {
    return {
      status: breakdown.status,
      messages: ["Envelope load preview is not ready yet."],
    };
  }

  return {
    status: breakdown.status,
    messages: [
      getHeatingSourceMessage(breakdown),
      getCoolingSourceMessage(breakdown),
      getExteriorExposureMessage(breakdown),
    ],
  };
}

export function explainBlueprintRoomEnvelopePreview(
  input: BlueprintRoomEnvelopePreviewInput
): BlueprintEnvelopeExplanation {
  return explainBlueprintEnvelopeContributionBreakdown(
    calculateBlueprintEnvelopeContributionBreakdown(input)
  );
}

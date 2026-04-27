type Climate = "marine" | "cold" | "hot";
type Insulation = "poor" | "average" | "good";
type WindowQuality = "single" | "double" | "triple";
type SunExposure = "low" | "moderate" | "high";
type Infiltration = "tight" | "average" | "leaky";
type DuctLocation = "conditioned" | "attic" | "crawl";

export type RoomInput = {
  name: string;
  squareFeet: number;
  ceilingHeight: number;
  windowArea: number;
  exteriorWalls: number;
  sunExposure: SunExposure;
};

type LoadInput = {
  squareFeet: number;
  ceilingHeight: number;
  insulation: Insulation;
  windowQuality: WindowQuality;
  sunExposure: SunExposure;
  infiltration: Infiltration;
  climate: Climate;
  windowArea?: number;
  occupants?: number;
  homeAge?: number;
  ductLocation?: DuctLocation;
  rooms?: RoomInput[];
};

function roundToOne(value: number) {
  return Math.round(value * 10) / 10;
}

function getRecommendedSystem(tons: number) {
  if (tons <= 1.5) return "1.5 Ton System";
  if (tons <= 2) return "2 Ton System";
  if (tons <= 2.5) return "2.5 Ton System";
  if (tons <= 3) return "3 Ton System";
  if (tons <= 3.5) return "3.5 Ton System";
  if (tons <= 4) return "4 Ton System";
  if (tons <= 5) return "5 Ton System";
  return "Custom Review Needed";
}

export function calculateLoad(input: LoadInput) {
  const {
    squareFeet,
    ceilingHeight,
    insulation,
    windowQuality,
    sunExposure,
    infiltration,
    climate,
    windowArea = Math.max(120, squareFeet * 0.15),
    occupants = 4,
    homeAge = 20,
    ductLocation = "attic",
    rooms,
  } = input;

  const coolingBaseByClimate: Record<Climate, number> = {
    marine: 18,
    cold: 22,
    hot: 30,
  };

  const heatingBaseByClimate: Record<Climate, number> = {
    marine: 16,
    cold: 32,
    hot: 12,
  };

  const insulationFactor: Record<Insulation, number> = {
    poor: 1.22,
    average: 1,
    good: 0.86,
  };

  const windowFactor: Record<WindowQuality, number> = {
    single: 1.16,
    double: 1,
    triple: 0.9,
  };

  const sunFactor: Record<SunExposure, number> = {
    low: 0.92,
    moderate: 1,
    high: 1.12,
  };

  const infiltrationFactor: Record<Infiltration, number> = {
    tight: 0.9,
    average: 1,
    leaky: 1.18,
  };

  const ductFactor: Record<DuctLocation, number> = {
    conditioned: 1,
    attic: 1.12,
    crawl: 1.08,
  };

  const heightFactor = Math.max(0.9, ceilingHeight / 8);
  const ageFactor =
    homeAge <= 10 ? 0.95 : homeAge <= 25 ? 1 : homeAge <= 45 ? 1.06 : 1.12;

  const validRooms =
    rooms && rooms.length > 0
      ? rooms
      : [
          {
            name: "Whole Home",
            squareFeet,
            ceilingHeight,
            windowArea,
            exteriorWalls: 4,
            sunExposure,
          },
        ];

  const roomLoads = validRooms.map((room) => {
    const roomHeightFactor = Math.max(0.9, room.ceilingHeight / 8);
    const wallFactor = 1 + Math.max(0, room.exteriorWalls - 1) * 0.04;
    const roomWindowFactor = 1 + room.windowArea / Math.max(room.squareFeet * 8, 1);

    const coolingBtu =
      room.squareFeet *
      coolingBaseByClimate[climate] *
      insulationFactor[insulation] *
      windowFactor[windowQuality] *
      sunFactor[room.sunExposure] *
      infiltrationFactor[infiltration] *
      ductFactor[ductLocation] *
      roomHeightFactor *
      ageFactor *
      wallFactor *
      roomWindowFactor;

    const heatingBtu =
      room.squareFeet *
      heatingBaseByClimate[climate] *
      insulationFactor[insulation] *
      infiltrationFactor[infiltration] *
      ductFactor[ductLocation] *
      roomHeightFactor *
      ageFactor *
      wallFactor;

    const cfm = coolingBtu / 12000 * 400;

    return {
      name: room.name,
      coolingBtu: Math.round(coolingBtu),
      heatingBtu: Math.round(heatingBtu),
      cfm: Math.round(cfm),
    };
  });

  const roomCoolingTotal = roomLoads.reduce((sum, room) => sum + room.coolingBtu, 0);
  const roomHeatingTotal = roomLoads.reduce((sum, room) => sum + room.heatingBtu, 0);

  const occupantCoolingGain = Math.max(0, occupants - 2) * 600;
  const occupantHeatingGain = Math.max(0, occupants - 2) * 150;

  const coolingBtu = Math.round(roomCoolingTotal + occupantCoolingGain);
  const heatingBtu = Math.round(roomHeatingTotal + occupantHeatingGain);

  const sensibleCooling = Math.round(coolingBtu * 0.75);
  const latentCooling = Math.round(coolingBtu * 0.25);

  const tons = roundToOne(coolingBtu / 12000);
  const cfm = Math.round(tons * 400);

  const standardSizes = [1.5, 2, 2.5, 3, 3.5, 4, 5];
  const lowTarget = tons * 0.9;
  const highTarget = tons * 1.1;

  const recommendedLow =
    standardSizes.find((size) => size >= lowTarget) ?? standardSizes[standardSizes.length - 1];

  const recommendedHigh =
    standardSizes.find((size) => size >= highTarget) ?? standardSizes[standardSizes.length - 1];

  const tonnageRange =
    recommendedLow === recommendedHigh
      ? `${recommendedLow} Ton`
      : `${recommendedLow} - ${recommendedHigh} Ton`;

  const warnings: string[] = [];

  if (infiltration === "leaky") warnings.push("High infiltration may increase load significantly.");
  if (ductLocation === "attic") warnings.push("Attic ductwork adds duct loss risk.");
  if (windowQuality === "single") warnings.push("Single-pane windows increase heat gain/loss.");
  if (tons > 5) warnings.push("Load exceeds common residential single-system range.");

  const confidence =
    warnings.length === 0
      ? "High"
      : warnings.length <= 2
      ? "Medium"
      : "Needs Field Review";

  return {
    coolingBtu,
    heatingBtu,
    sensibleCooling,
    latentCooling,
    tons,
    cfm,
    tonnageRange,
    recommendedSystem: getRecommendedSystem(tons),
    confidence,
    warnings,
    roomLoads,
  };
}
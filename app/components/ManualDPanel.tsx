"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Layers, Thermometer, Wind } from "lucide-react";
import {
  ROUND_METAL_DESIGN_BASIS_MESSAGE,
  ROUND_RESIDENTIAL_DUCT_SIZES_INCHES,
  calculateTotalEquivalentLength,
  createRoundDuctSizingCandidate,
  getVelocityStatusWarning,
  recommendRoundDuctSize,
} from "@/lib/hvac/manualD";

export type ManualDBlueprintRoom = {
  id: string;
  name: string;
  squareFeet: number;
  ceilingHeight: string;
  floorLevel: string;
};

export type ManualDPanelSection = "manual-d" | "room-airflow" | "return-air" | "reports" | "hidden";

export type ManualDProjectSettings = {
  systemTons: string;
  totalCfm: string;
  availableStatic: string;
  longestRun: string;
  radiusElbows: string;
  hardElbows: string;
  tees: string;
  boots: string;
  trunkCount: string;
  floorCount: string;
  supplyBranches: string;
  returnBranches: string;
};

export type ManualDProjectState = {
  settings: ManualDProjectSettings;
  rooms: ManualDRoom[];
};

type ManualDPanelProps = {
  squareFeet: string;
  blueprintRooms?: ManualDBlueprintRoom[];
  activeSection?: ManualDPanelSection;
  savedProjectState?: ManualDProjectState | null;
  onProjectStateChange?: (projectState: ManualDProjectState) => void;
};

export type ManualDRoom = {
  id: string;
  name: string;
  squareFeet: number;
  squareFeetInput: string;
  supplyRegisterCount: number;
  windowsCountInput: string;
  exteriorWallsCountInput: string;
  ceilingHeightInput: string;
  floorLevelInput: string;
  insulationLevel: RoomInsulationLevel;
  sunExposure: RoomSunExposure;
};

type RoomInsulationLevel = "poor" | "average" | "good";
type RoomSunExposure = "low" | "medium" | "high";

type ManualDRoomEditableField =
  | "name"
  | "squareFeet"
  | "supplyRegisterCount"
  | "windowsCount"
  | "exteriorWallsCount"
  | "ceilingHeight"
  | "insulationLevel"
  | "sunExposure";

type InputFieldProps = {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
};

type RoundDuctRecommendation = ReturnType<typeof recommendRoundDuctSize>;
type RegisterAirflowStatus = "low" | "acceptable" | "high";
type ManualDValidationWarning = {
  title: string;
  message: string;
};

type ManualDRecommendation = {
  title: string;
  message: string;
};

function printManualDMode() {
  document.body.dataset.printMode = "manualD";

  const clearPrintMode = () => {
    delete document.body.dataset.printMode;
    window.removeEventListener("afterprint", clearPrintMode);
  };

  window.addEventListener("afterprint", clearPrintMode, { once: true });
  window.print();
  window.setTimeout(clearPrintMode, 1000);
}

const RETURN_GRILLE_TARGET_CFM = 300;
const RETURN_GRILLE_RESTRICTIVE_CFM = 450;
const DEFAULT_RETURN_DUCT_DIAMETER_INCHES = 16;
const BRANCH_TARGET_VELOCITY_FPM = 700;
const RETURN_TARGET_VELOCITY_FPM = 700;
const LONG_TEL_BRANCH_TARGET_VELOCITY_FPM = 600;
const LONG_TEL_RETURN_TARGET_VELOCITY_FPM = 600;
const EXCESSIVE_TEL_FEET = 250;
const RADIUS_ELBOW_EQUIVALENT_LENGTH_FEET = 5;
const HARD_ELBOW_EQUIVALENT_LENGTH_FEET = 15;
const TEE_EQUIVALENT_LENGTH_FEET = 20;
const BOOT_EQUIVALENT_LENGTH_FEET = 10;
const MAX_ROUND_DUCT_FOR_14_INCH_TRUSS = 14;
const MAX_BRANCHES_PER_TRUNK = 6;
const MIN_REGISTER_COMFORT_CFM = 50;
const MAX_REGISTER_COMFORT_CFM = 125;
const INSULATION_LOAD_FACTORS: Record<RoomInsulationLevel, number> = {
  poor: 0.18,
  average: 0,
  good: -0.1,
};
const SUN_EXPOSURE_LOAD_FACTORS: Record<RoomSunExposure, number> = {
  low: -0.05,
  medium: 0,
  high: 0.12,
};

const InputField = ({ icon, title, description, children }: InputFieldProps) => (
  <div style={inputFieldStyle}>
    <div style={inputFieldHeaderStyle}>
      <div style={inputFieldIconStyle}>{icon}</div>
      <div>
        <p style={inputFieldTitleStyle}>{title}</p>
        <p style={inputFieldDescriptionStyle}>{description}</p>
      </div>
    </div>
    {children}
  </div>
);

function createReturnRecommendationForDiameter(
  cfm: number,
  diameterInches: number
): RoundDuctRecommendation {
  const candidate = createRoundDuctSizingCandidate(cfm, diameterInches);
  const warning = getVelocityStatusWarning(candidate.velocityFpm, "main");
  const roundedVelocity = Math.round(candidate.velocityFpm);

  return {
    diameterInches: candidate.diameterInches,
    areaSqFt: candidate.areaSquareFeet,
    velocityFpm: candidate.velocityFpm,
    status: warning.status,
    message: `Return duct recommendation is ${candidate.diameterInches}" round metal with ${roundedVelocity} FPM velocity. Return design assumes at least one properly sized return path per floor/level.`,
  };
}

function recommendReturnDuctSize(
  cfm: number,
  supplyTrunkDiameterInches: number,
  supplyTrunkVelocityFpm: number
): RoundDuctRecommendation {
  const baseRecommendation = recommendRoundDuctSize(cfm, "main");
  const minimumReturnDiameter = Math.max(
    DEFAULT_RETURN_DUCT_DIAMETER_INCHES,
    supplyTrunkDiameterInches + 1
  );

  if (
    baseRecommendation.diameterInches >= minimumReturnDiameter &&
    baseRecommendation.velocityFpm < supplyTrunkVelocityFpm
  ) {
    return {
      ...baseRecommendation,
      message: `${baseRecommendation.message} Return design assumes at least one properly sized return path per floor/level.`,
    };
  }

  const lowerVelocityReturn = ROUND_RESIDENTIAL_DUCT_SIZES_INCHES.map((diameterInches) =>
    createRoundDuctSizingCandidate(cfm, diameterInches)
  ).find(
    (candidate) =>
      candidate.diameterInches >= minimumReturnDiameter &&
      candidate.velocityFpm < supplyTrunkVelocityFpm
  );

  if (!lowerVelocityReturn) {
    const fallbackDiameter =
      ROUND_RESIDENTIAL_DUCT_SIZES_INCHES.find(
        (diameterInches) => diameterInches >= minimumReturnDiameter
      ) ?? ROUND_RESIDENTIAL_DUCT_SIZES_INCHES[ROUND_RESIDENTIAL_DUCT_SIZES_INCHES.length - 1];

    return createReturnRecommendationForDiameter(cfm, fallbackDiameter);
  }

  return createReturnRecommendationForDiameter(cfm, lowerVelocityReturn.diameterInches);
}

function calculateRoomLoadFactor(room: ManualDRoom): number {
  const windowsCount = Math.max(0, Number(room.windowsCountInput) || 0);
  const exteriorWallsCount = Math.max(0, Number(room.exteriorWallsCountInput) || 0);
  const ceilingHeight = Math.max(0, Number(room.ceilingHeightInput) || 8);

  // Conservative preliminary room load multiplier:
  // square footage remains the baseline, then field inputs nudge the room share.
  const windowMultiplier = Math.min(0.18, windowsCount * 0.03);
  const exteriorWallMultiplier = Math.min(0.22, exteriorWallsCount * 0.07);
  const ceilingHeightMultiplier = Math.min(0.18, Math.max(0, ceilingHeight - 8) * 0.05);

  const roomLoadMultiplier =
    1 +
    windowMultiplier +
    exteriorWallMultiplier +
    ceilingHeightMultiplier +
    INSULATION_LOAD_FACTORS[room.insulationLevel] +
    SUN_EXPOSURE_LOAD_FACTORS[room.sunExposure];

  return Math.min(1.5, Math.max(0.75, roomLoadMultiplier));
}

function getRegisterAirflowStatus(airflowPerRegister: number): RegisterAirflowStatus {
  if (airflowPerRegister < MIN_REGISTER_COMFORT_CFM) return "low";
  if (airflowPerRegister > MAX_REGISTER_COMFORT_CFM) return "high";
  return "acceptable";
}

function getRegisterSizeGuidance(airflowPerRegister: number): string {
  if (airflowPerRegister < 75) return "Small register";
  if (airflowPerRegister <= 125) return "Standard register";
  if (airflowPerRegister <= 175) return "Large register";
  return "Add another supply register";
}

function getReturnGrilleSizeGuidance(returnCfmPerLevel: number): string {
  if (returnCfmPerLevel < 300) return "Small return grille";
  if (returnCfmPerLevel <= 500) return "Standard return grille";
  if (returnCfmPerLevel <= 700) return "Large return grille";
  return "Use multiple large return grilles";
}

function createDefaultRoom(
  id: string,
  name: string,
  squareFeet: number
): ManualDRoom {
  return {
    id,
    name,
    squareFeet,
    squareFeetInput: String(squareFeet),
    supplyRegisterCount: 1,
    windowsCountInput: "",
    exteriorWallsCountInput: "",
    ceilingHeightInput: "",
    floorLevelInput: "",
    insulationLevel: "average",
    sunExposure: "medium",
  };
}

export default function ManualDPanel({
  squareFeet,
  blueprintRooms = [],
  activeSection = "manual-d",
  savedProjectState = null,
  onProjectStateChange,
}: ManualDPanelProps) {
  const roomIdCounter = useRef(4);
  const processedBlueprintRoomIds = useRef<Set<string>>(new Set());
  const blueprintRoomsRef = useRef(blueprintRooms);
  const [manualDSystemTons, setManualDSystemTons] = useState("3");
  const [manualDTotalCfm, setManualDTotalCfm] = useState("1200");
  const [manualDAvailableStatic, setManualDAvailableStatic] = useState("0.50");
  const [manualDLongestRun, setManualDLongestRun] = useState("100");
  const [manualDRadiusElbows, setManualDRadiusElbows] = useState("4");
  const [manualDHardElbows, setManualDHardElbows] = useState("0");
  const [manualDTees, setManualDTees] = useState("1");
  const [manualDBoots, setManualDBoots] = useState("8");
  const [manualDTrunkCount, setManualDTrunkCount] = useState("2");
  const [manualDFloorCount, setManualDFloorCount] = useState("2");
  const [manualDSupplyBranches, setManualDSupplyBranches] = useState("8");
  const [manualDReturnBranches, setManualDReturnBranches] = useState("2");
  const [rooms, setRooms] = useState<ManualDRoom[]>([
    createDefaultRoom("manual-d-room-1", "Living Room", 420),
    createDefaultRoom("manual-d-room-2", "Kitchen", 220),
    createDefaultRoom("manual-d-room-3", "Primary Bedroom", 180),
  ]);

  const systemTonsValue = Math.max(0, parseFloat(manualDSystemTons) || 0);
  const totalSystemCfm = systemTonsValue * 400;
  const systemCfmPerTon = systemTonsValue > 0 ? totalSystemCfm / systemTonsValue : 0;
  const totalSystemBtu = systemTonsValue * 12000;
  const totalHomeSquareFeet = Math.max(1, parseFloat(squareFeet) || 1);

  useEffect(() => {
    blueprintRoomsRef.current = blueprintRooms;
  }, [blueprintRooms]);

  useEffect(() => {
    if (!savedProjectState) return;

    setManualDSystemTons(savedProjectState.settings.systemTons);
    setManualDTotalCfm(savedProjectState.settings.totalCfm);
    setManualDAvailableStatic(savedProjectState.settings.availableStatic);
    setManualDLongestRun(savedProjectState.settings.longestRun);
    setManualDRadiusElbows(savedProjectState.settings.radiusElbows);
    setManualDHardElbows(savedProjectState.settings.hardElbows);
    setManualDTees(savedProjectState.settings.tees);
    setManualDBoots(savedProjectState.settings.boots);
    setManualDTrunkCount(savedProjectState.settings.trunkCount);
    setManualDFloorCount(savedProjectState.settings.floorCount);
    setManualDSupplyBranches(savedProjectState.settings.supplyBranches);
    setManualDReturnBranches(savedProjectState.settings.returnBranches);
    setRooms(savedProjectState.rooms);
    roomIdCounter.current += savedProjectState.rooms.length + 1;
    processedBlueprintRoomIds.current = new Set(blueprintRoomsRef.current.map((room) => room.id));
  }, [savedProjectState]);

  const currentProjectState = useMemo<ManualDProjectState>(
    () => ({
      settings: {
        systemTons: manualDSystemTons,
        totalCfm: manualDTotalCfm,
        availableStatic: manualDAvailableStatic,
        longestRun: manualDLongestRun,
        radiusElbows: manualDRadiusElbows,
        hardElbows: manualDHardElbows,
        tees: manualDTees,
        boots: manualDBoots,
        trunkCount: manualDTrunkCount,
        floorCount: manualDFloorCount,
        supplyBranches: manualDSupplyBranches,
        returnBranches: manualDReturnBranches,
      },
      rooms,
    }),
    [
      manualDSystemTons,
      manualDTotalCfm,
      manualDAvailableStatic,
      manualDLongestRun,
      manualDRadiusElbows,
      manualDHardElbows,
      manualDTees,
      manualDBoots,
      manualDTrunkCount,
      manualDFloorCount,
      manualDSupplyBranches,
      manualDReturnBranches,
      rooms,
    ]
  );

  useEffect(() => {
    onProjectStateChange?.(currentProjectState);
  }, [currentProjectState, onProjectStateChange]);

  useEffect(() => {
    const newBlueprintRooms = blueprintRooms.filter(
      (room) => !processedBlueprintRoomIds.current.has(room.id)
    );

    if (newBlueprintRooms.length === 0) return;

    setRooms((currentRooms) => [
      ...currentRooms,
      ...newBlueprintRooms.map((room) => ({
        ...createDefaultRoom(
          `manual-d-${room.id}`,
          room.name,
          Math.max(0, Math.round(room.squareFeet))
        ),
        ceilingHeightInput: room.ceilingHeight,
        floorLevelInput: room.floorLevel,
      })),
    ]);

    newBlueprintRooms.forEach((room) => {
      processedBlueprintRoomIds.current.add(room.id);
    });
  }, [blueprintRooms]);

  const roomDuctRecommendations = useMemo(
    () => {
      const roomLoadScores = rooms.map((room) => {
        const roomSquareFeet = Math.max(0, room.squareFeet);
        return roomSquareFeet * calculateRoomLoadFactor(room);
      });
      const totalRoomLoadScore = roomLoadScores.reduce((sum, score) => sum + score, 0);

      return rooms.map((room, index) => {
        const roomSquareFeet = Math.max(0, room.squareFeet);
        const roomLoadFactor = calculateRoomLoadFactor(room);
        const roomLoadScore = roomLoadScores[index] ?? 0;
        const roomShare = totalRoomLoadScore > 0
          ? roomLoadScore / totalRoomLoadScore
          : roomSquareFeet / totalHomeSquareFeet;
        const roomCfm = roomShare * totalSystemCfm;
        const estimatedRoomBtu = roomShare * totalSystemBtu;
        const airflowPerRegister = roomCfm / Math.max(1, room.supplyRegisterCount);
        const registerAirflowStatus = getRegisterAirflowStatus(airflowPerRegister);
        const registerSizeGuidance = getRegisterSizeGuidance(airflowPerRegister);
        const ductRecommendation = recommendRoundDuctSize(roomCfm, "branch");

        return {
          room,
          roomCfm,
          estimatedRoomBtu,
          roomLoadFactor,
          airflowPerRegister,
          registerAirflowStatus,
          registerSizeGuidance,
          ductRecommendation,
        };
      });
    },
    [rooms, totalHomeSquareFeet, totalSystemBtu, totalSystemCfm]
  );

  const updateRoom = (roomId: string, field: ManualDRoomEditableField, value: string | number) => {
    setRooms((currentRooms) =>
      currentRooms.map((room) => {
        if (room.id !== roomId) return room;

        if (field === "name") {
          return { ...room, name: String(value) };
        }

        if (field === "supplyRegisterCount") {
          return {
            ...room,
            supplyRegisterCount: Math.max(1, Number(value) || 1),
          };
        }

        if (field === "windowsCount") {
          return { ...room, windowsCountInput: String(value) };
        }

        if (field === "exteriorWallsCount") {
          return { ...room, exteriorWallsCountInput: String(value) };
        }

        if (field === "ceilingHeight") {
          return { ...room, ceilingHeightInput: String(value) };
        }

        if (field === "insulationLevel") {
          return { ...room, insulationLevel: String(value) as RoomInsulationLevel };
        }

        if (field === "sunExposure") {
          return { ...room, sunExposure: String(value) as RoomSunExposure };
        }

        const squareFeetInput = String(value);

        if (squareFeetInput.trim() === "") {
          return { ...room, squareFeet: 0, squareFeetInput: "" };
        }

        const numericSquareFeet = Number(squareFeetInput);

        if (!Number.isFinite(numericSquareFeet)) {
          return room;
        }

        const normalizedSquareFeet = Math.max(0, numericSquareFeet);

        return {
          ...room,
          squareFeet: normalizedSquareFeet,
          squareFeetInput: String(normalizedSquareFeet),
        };
      })
    );
  };

  const addRoom = () => {
    const nextRoomId = `manual-d-room-${roomIdCounter.current}`;
    roomIdCounter.current += 1;

    setRooms((currentRooms) => [
      ...currentRooms,
      createDefaultRoom(nextRoomId, "New Room", 150),
    ]);
  };

  const removeRoom = (roomId: string) => {
    setRooms((currentRooms) => currentRooms.filter((room) => room.id !== roomId));
  };

  const manualDResult = useMemo(() => {
    const systemTonsValue = Math.max(0, parseFloat(manualDSystemTons) || 0);
    const totalCfmValue = systemTonsValue * 400;
    const availableStaticValue = Math.max(0, parseFloat(manualDAvailableStatic) || 0);
    const longestRunValue = Math.max(1, parseInt(manualDLongestRun, 10) || 1);
    const radiusElbowsValue = Math.max(0, parseInt(manualDRadiusElbows, 10) || 0);
    const hardElbowsValue = Math.max(0, parseInt(manualDHardElbows, 10) || 0);
    const teesValue = Math.max(0, parseInt(manualDTees, 10) || 0);
    const bootsValue = Math.max(0, parseInt(manualDBoots, 10) || 0);
    const trunkCountValue = Math.max(1, parseInt(manualDTrunkCount, 10) || 1);
    const floorCountValue = Math.max(1, parseInt(manualDFloorCount, 10) || 1);
    const supplyBranchesValue = Math.max(1, parseInt(manualDSupplyBranches, 10) || 1);
    const returnBranchesValue = Math.max(1, parseInt(manualDReturnBranches, 10) || 1);
    const minimumReturnCount = floorCountValue;
    const fittingEquivalentLength =
      radiusElbowsValue * RADIUS_ELBOW_EQUIVALENT_LENGTH_FEET +
      hardElbowsValue * HARD_ELBOW_EQUIVALENT_LENGTH_FEET +
      teesValue * TEE_EQUIVALENT_LENGTH_FEET +
      bootsValue * BOOT_EQUIVALENT_LENGTH_FEET;
    const totalEffectiveLength = calculateTotalEquivalentLength(longestRunValue, [
      fittingEquivalentLength,
    ]);
    const frictionRate = availableStaticValue > 0
      ? (availableStaticValue * 100) / totalEffectiveLength
      : 0;
    const branchVelocityTargetFpm = totalEffectiveLength > EXCESSIVE_TEL_FEET
      ? LONG_TEL_BRANCH_TARGET_VELOCITY_FPM
      : BRANCH_TARGET_VELOCITY_FPM;
    const returnVelocityTargetFpm = totalEffectiveLength > EXCESSIVE_TEL_FEET
      ? LONG_TEL_RETURN_TARGET_VELOCITY_FPM
      : RETURN_TARGET_VELOCITY_FPM;
    const averageBranchCfm = totalCfmValue / supplyBranchesValue;
    const cfmPerTon = systemTonsValue > 0 ? totalCfmValue / systemTonsValue : 0;
    const trunkCfm = totalCfmValue / trunkCountValue;
    const returnCfmPerLevel = totalCfmValue / floorCountValue;
    const returnGrillesPerLevel = Math.max(1, Math.ceil(returnCfmPerLevel / RETURN_GRILLE_TARGET_CFM));
    const totalReturnGrilleCount = returnGrillesPerLevel * floorCountValue;
    const returnCfmPerGrille = returnCfmPerLevel / returnGrillesPerLevel;
    const returnGrilleSizeGuidance = getReturnGrilleSizeGuidance(returnCfmPerLevel);
    const isReturnGrilleRestrictive =
      returnCfmPerGrille > RETURN_GRILLE_TARGET_CFM ||
      returnCfmPerLevel > RETURN_GRILLE_RESTRICTIVE_CFM;
    const returnGrilleWarning = isReturnGrilleRestrictive
      ? "Return grille airflow may be noisy or restrictive; use the recommended grille count and confirm grille free area."
      : "Return grille airflow is within a quiet first-pass residential range.";
    const returnCfmPerReturn = returnCfmPerLevel;
    const plannedReturnAirflow = returnBranchesValue * returnCfmPerReturn;
    const supplyTrunkRecommendation = recommendRoundDuctSize(trunkCfm, "main");
    const returnTrunkRecommendation = recommendReturnDuctSize(
      returnCfmPerReturn,
      supplyTrunkRecommendation.diameterInches,
      supplyTrunkRecommendation.velocityFpm
    );
    const branchRecommendation = recommendRoundDuctSize(averageBranchCfm, "branch");
    const branchesPerTrunk = supplyBranchesValue / trunkCountValue;
    const isReturnAirflowUndersized =
      returnTrunkRecommendation.velocityFpm >= supplyTrunkRecommendation.velocityFpm ||
      returnTrunkRecommendation.status === "high";
    const returnAirflowStatus = isReturnAirflowUndersized ? "high" : returnTrunkRecommendation.status;
    const returnAirflowMessage = isReturnAirflowUndersized
      ? "Return airflow may be undersized; return velocity is not lower than the supply trunk velocity or exceeds the target range."
      : "Return airflow is balanced below the supply trunk velocity for this first-pass layout.";
    const trunkDesignMessage = trunkCountValue > 1
      ? `Design assumes ${trunkCountValue} split pressure trunk lines with manual dampers at approximately ${Math.round(trunkCfm).toLocaleString()} CFM per trunk.`
      : "Design assumes a single pressure trunk line.";

    const explanation = totalCfmValue > 0
      ? `First-pass Manual D estimate uses ${totalCfmValue.toLocaleString()} CFM from ${systemTonsValue.toFixed(1)} tons across ${supplyBranchesValue} supply branches and ${returnBranchesValue} return branch${returnBranchesValue === 1 ? "" : "es"}. ${trunkDesignMessage} Return design assumes at least one properly sized return path per floor/level. ${ROUND_METAL_DESIGN_BASIS_MESSAGE} Friction rate is estimated from available static pressure and a total equivalent length of ${Math.round(totalEffectiveLength).toLocaleString()} ft. Confirm fittings, equivalent lengths, grille sizing, and static pressure before final duct selection.`
      : "Enter total system CFM to generate a first-pass duct sizing estimate.";
    const validationWarnings: ManualDValidationWarning[] = [];

    if (branchRecommendation.velocityFpm > branchVelocityTargetFpm) {
      validationWarnings.push({
        title: "Branch velocity exceeds target",
        message: `Average branch velocity is ${Math.round(branchRecommendation.velocityFpm).toLocaleString()} FPM, above the ${branchVelocityTargetFpm.toLocaleString()} FPM branch target for this TEL.`,
      });
    }

    if (returnTrunkRecommendation.velocityFpm > returnVelocityTargetFpm) {
      validationWarnings.push({
        title: "Return velocity exceeds target",
        message: `Return velocity is ${Math.round(returnTrunkRecommendation.velocityFpm).toLocaleString()} FPM, above the ${returnVelocityTargetFpm.toLocaleString()} FPM return target for this TEL.`,
      });
    }

    if (totalEffectiveLength > EXCESSIVE_TEL_FEET) {
      validationWarnings.push({
        title: "Total equivalent length is excessive",
        message: `TEL is ${Math.round(totalEffectiveLength).toLocaleString()} ft. Long equivalent length can increase static pressure and should use lower velocity targets or revised routing.`,
      });
    }

    if (plannedReturnAirflow < totalCfmValue) {
      validationWarnings.push({
        title: "Return airflow below supply airflow",
        message: `Total planned return airflow is ${Math.round(plannedReturnAirflow).toLocaleString()} CFM, below the ${Math.round(totalCfmValue).toLocaleString()} CFM supply airflow; add return capacity before final design.`,
      });
    }

    if (returnTrunkRecommendation.velocityFpm >= supplyTrunkRecommendation.velocityFpm) {
      validationWarnings.push({
        title: "Return airflow may be undersized",
        message: "Return velocity is not lower than supply trunk velocity; increase return area or grille count.",
      });
    }

    if (isReturnGrilleRestrictive) {
      validationWarnings.push({
        title: "Return grille may be noisy or restrictive",
        message: `${Math.round(returnCfmPerLevel).toLocaleString()} CFM per level requires at least ${returnGrillesPerLevel.toLocaleString()} return grille${returnGrillesPerLevel === 1 ? "" : "s"} per level. Confirm grille size and free area.`,
      });
    }

    if (supplyTrunkRecommendation.diameterInches > MAX_ROUND_DUCT_FOR_14_INCH_TRUSS) {
      validationWarnings.push({
        title: "Trunk duct oversized for 14 inch truss",
        message: `${supplyTrunkRecommendation.diameterInches}" round metal may not fit inside a 14" web floor truss. Increase trunk/zone count or adjust routing.`,
      });
    }

    if (branchesPerTrunk > MAX_BRANCHES_PER_TRUNK) {
      validationWarnings.push({
        title: "Too many branches per trunk",
        message: `${branchesPerTrunk.toFixed(1)} supply branches per trunk exceeds the ${MAX_BRANCHES_PER_TRUNK} branch planning target. Add a trunk line or rebalance branches.`,
      });
    }

    return {
      totalSystemCfm: Math.round(totalCfmValue),
      trunkCount: trunkCountValue,
      trunkCfm: Math.round(trunkCfm),
      straightLengthFeet: longestRunValue,
      fittingEquivalentLengthFeet: Math.round(fittingEquivalentLength),
      totalEquivalentLengthFeet: Math.round(totalEffectiveLength),
      branchVelocityTargetFpm,
      returnVelocityTargetFpm,
      floorCount: floorCountValue,
      minimumReturnCount,
      returnCfmPerLevel: Math.round(returnCfmPerLevel),
      returnGrillesPerLevel,
      totalReturnGrilleCount,
      returnCfmPerGrille: Math.round(returnCfmPerGrille),
      returnGrilleSizeGuidance,
      returnGrilleWarning,
      returnCfmPerReturn: Math.round(returnCfmPerReturn),
      estimatedSupplyTrunkSize: `${supplyTrunkRecommendation.diameterInches}" round metal`,
      estimatedReturnTrunkSize: `${returnTrunkRecommendation.diameterInches}" round metal`,
      supplyTrunkVelocityFpm: Math.round(supplyTrunkRecommendation.velocityFpm),
      supplyTrunkStatus: supplyTrunkRecommendation.status,
      supplyTrunkMessage: supplyTrunkRecommendation.message,
      returnVelocityFpm: Math.round(returnTrunkRecommendation.velocityFpm),
      returnStatus: returnTrunkRecommendation.status,
      returnMessage: returnTrunkRecommendation.message,
      returnAirflowStatus,
      returnAirflowMessage,
      trunkDesignMessage,
      validationWarnings,
      averageBranchCfm: Math.round(averageBranchCfm),
      suggestedBranchDuctSize: `${branchRecommendation.diameterInches}" round metal`,
      frictionRateEstimate: frictionRate.toFixed(2),
      cfmPerTon: Math.round(cfmPerTon),
      explanation,
    };
  }, [
    manualDSystemTons,
    manualDAvailableStatic,
    manualDLongestRun,
    manualDRadiusElbows,
    manualDHardElbows,
    manualDTees,
    manualDBoots,
    manualDTrunkCount,
    manualDFloorCount,
    manualDSupplyBranches,
    manualDReturnBranches,
  ]);

  const manualDValidationWarnings = useMemo(() => {
    const roomWarnings = roomDuctRecommendations
      .filter(
        ({ ductRecommendation }) =>
          ductRecommendation.velocityFpm > manualDResult.branchVelocityTargetFpm
      )
      .map(({ room, ductRecommendation }) => ({
        title: "Room branch velocity exceeds target",
        message: `${room.name || "Room"} branch velocity is ${Math.round(ductRecommendation.velocityFpm).toLocaleString()} FPM, above the ${manualDResult.branchVelocityTargetFpm.toLocaleString()} FPM branch target for this TEL.`,
      }));
    const registerWarnings = roomDuctRecommendations
      .filter(({ registerAirflowStatus }) => registerAirflowStatus === "high")
      .map(({ room, airflowPerRegister }) => ({
        title: "Supply register airflow exceeds comfort range",
        message: `${room.name || "Room"} has ${Math.round(airflowPerRegister).toLocaleString()} CFM per supply register, above the ${MAX_REGISTER_COMFORT_CFM.toLocaleString()} CFM residential comfort target. Add a register or rebalance airflow.`,
      }));

    return [...manualDResult.validationWarnings, ...roomWarnings, ...registerWarnings];
  }, [
    manualDResult.branchVelocityTargetFpm,
    manualDResult.validationWarnings,
    roomDuctRecommendations,
  ]);

  const manualDRecommendations = useMemo(() => {
    const notes: ManualDRecommendation[] = [];
    const highRegisterRooms = roomDuctRecommendations.filter(
      ({ registerAirflowStatus }) => registerAirflowStatus === "high"
    );
    const highVelocityRooms = roomDuctRecommendations.filter(
      ({ ductRecommendation }) => ductRecommendation.status === "high"
    );

    if (manualDResult.returnAirflowStatus === "high") {
      notes.push({
        title: "Add return capacity",
        message: "Return airflow is high or restrictive. Add another return path, increase grille free area, or reduce return velocity before final install.",
      });
    }

    if (manualDResult.returnCfmPerGrille > RETURN_GRILLE_TARGET_CFM) {
      notes.push({
        title: "Increase return grille area",
        message: `Return grille airflow is ${manualDResult.returnCfmPerGrille.toLocaleString()} CFM per grille. Use more return grilles or a larger grille to keep the return side quiet.`,
      });
    }

    if (manualDResult.supplyTrunkStatus === "high" || highVelocityRooms.length > 0) {
      notes.push({
        title: "Check noise risk",
        message: "High velocity can create objectionable air noise. Favor smoother radius fittings, larger duct sections, or additional branches where framing allows.",
      });
    }

    if (manualDResult.estimatedSupplyTrunkSize.includes("16") || manualDResult.estimatedSupplyTrunkSize.includes("18")) {
      notes.push({
        title: "Consider another trunk split",
        message: "Supply trunk size may be tight for 14 inch truss space. Split into more pressure trunk lines or reroute before committing to framing paths.",
      });
    }

    highRegisterRooms.forEach(({ room, airflowPerRegister }) => {
      notes.push({
        title: "Add another supply register",
        message: `${room.name || "Room"} is at ${Math.round(airflowPerRegister).toLocaleString()} CFM per register. Add a supply register or rebalance airflow for comfort.`,
      });
    });

    if (notes.length === 0) {
      notes.push({
        title: "Field check",
        message: "Current Manual D inputs look workable. Confirm actual fitting count, grille free area, damper access, and static pressure in the field.",
      });
    }

    return notes;
  }, [
    manualDResult.estimatedSupplyTrunkSize,
    manualDResult.returnAirflowStatus,
    manualDResult.returnCfmPerGrille,
    manualDResult.supplyTrunkStatus,
    roomDuctRecommendations,
  ]);

  const comfortInsights = useMemo(() => {
    const insights: ManualDRecommendation[] = [];
    const highestAirflowRoom = roomDuctRecommendations.reduce<
      (typeof roomDuctRecommendations)[number] | null
    >((highestRoom, currentRoom) => {
      if (!highestRoom || currentRoom.roomCfm > highestRoom.roomCfm) return currentRoom;
      return highestRoom;
    }, null);
    const highVelocityRoom = roomDuctRecommendations.find(
      ({ ductRecommendation }) =>
        ductRecommendation.velocityFpm > manualDResult.branchVelocityTargetFpm
    );
    const lowAirflowRoom = roomDuctRecommendations.find(
      ({ roomCfm, registerAirflowStatus }) =>
        roomCfm < 50 || registerAirflowStatus === "low"
    );
    const highSunExposureRoom = roomDuctRecommendations.find(
      ({ room, roomLoadFactor }) => room.sunExposure === "high" && roomLoadFactor > 1
    );
    const allBranchVelocitiesAcceptable = roomDuctRecommendations.every(
      ({ ductRecommendation }) =>
        ductRecommendation.velocityFpm <= manualDResult.branchVelocityTargetFpm
    );
    const allRegisterAirflowsAcceptable = roomDuctRecommendations.every(
      ({ registerAirflowStatus }) => registerAirflowStatus === "acceptable"
    );

    if (
      highestAirflowRoom &&
      highestAirflowRoom.roomCfm > manualDResult.averageBranchCfm * 1.2
    ) {
      insights.push({
        title: "High airflow room",
        message: `${highestAirflowRoom.room.name || "Room"} carries ${Math.round(highestAirflowRoom.roomCfm).toLocaleString()} CFM. Verify branch path and register throw.`,
      });
    }

    if (highVelocityRoom) {
      insights.push({
        title: "Branch velocity check",
        message: `${highVelocityRoom.room.name || "Room"} is above the ${manualDResult.branchVelocityTargetFpm.toLocaleString()} FPM branch target.`,
      });
    }

    if (lowAirflowRoom) {
      insights.push({
        title: "Low airflow concern",
        message: `${lowAirflowRoom.room.name || "Room"} may need balancing attention if comfort complaints show up.`,
      });
    }

    if (allBranchVelocitiesAcceptable && allRegisterAirflowsAcceptable) {
      insights.push({
        title: "Strong airflow balance",
        message: "Room branch velocities and register airflow are inside the current comfort targets.",
      });
    }

    if (
      manualDResult.returnAirflowStatus === "high" ||
      manualDResult.returnCfmPerGrille > RETURN_GRILLE_TARGET_CFM
    ) {
      insights.push({
        title: "Return air recommendation",
        message: "Increase return grille area or return count to keep return noise down.",
      });
    } else {
      insights.push({
        title: "Return air check",
        message: "Return airflow is tracking below supply velocity for this layout.",
      });
    }

    if (highSunExposureRoom) {
      insights.push({
        title: "Sun exposure impact",
        message: `${highSunExposureRoom.room.name || "Room"} has high sun exposure; confirm shade and glass load in the field.`,
      });
    }

    return insights.slice(0, 6);
  }, [
    manualDResult.averageBranchCfm,
    manualDResult.branchVelocityTargetFpm,
    manualDResult.returnAirflowStatus,
    manualDResult.returnCfmPerGrille,
    roomDuctRecommendations,
  ]);

  const handlePrintManualDReport = () => {
    printManualDMode();
  };

  const showManualDSection = activeSection === "manual-d";
  const showRoomAirflowSection = activeSection === "room-airflow";
  const showReturnAirSection = activeSection === "return-air";
  const showReportsSection = activeSection === "reports";
  const showScreenPanel = activeSection !== "hidden";
  const screenPanelTitle = showReturnAirSection
    ? "Return Air Design"
    : showReportsSection
    ? "Manual D Reports"
    : "Manual D Duct Sizing";
  const screenPanelDescription = showReturnAirSection
    ? "Return paths, grille guidance, and quiet airflow checks."
    : showReportsSection
    ? "Validation warnings, field notes, and printable report."
    : "First-pass airflow and duct planning inputs.";

  return (
    <div className="manual-d-panel-root">
      <style>{manualDPrintStyles}</style>
      <div
        className="manual-d-screen-panel load-section-panel"
        style={{
          ...sectionPanelStyle,
          display: showScreenPanel && !showRoomAirflowSection ? "grid" : "none",
        }}
      >
      <div style={sectionPanelHeaderStyle}>
        <div style={sectionPanelIconStyle}>
          <Wind size={18} strokeWidth={1.8} />
        </div>
        <div>
          <p style={sectionPanelTitleStyle}>{screenPanelTitle}</p>
          <p style={sectionPanelDescriptionStyle}>{screenPanelDescription}</p>
        </div>
      </div>

      {(showManualDSection || showReturnAirSection) ? (
      <div style={inputGridStyle}>
        {showManualDSection ? (
          <>
        <InputField
          icon={<Thermometer size={18} strokeWidth={1.8} />}
          title="System Tons"
          description="Equipment size for airflow planning"
        >
          <input
            className="load-input"
            type="number"
            step="0.5"
            value={manualDSystemTons}
            onChange={(event) => setManualDSystemTons(event.target.value)}
            style={inputControlStyle}
          />
        </InputField>

        <InputField
          icon={<Wind size={18} strokeWidth={1.8} />}
          title="Total CFM"
          description="Planned system airflow"
        >
          <input
            className="load-input"
            type="number"
            value={manualDTotalCfm}
            onChange={(event) => setManualDTotalCfm(event.target.value)}
            style={inputControlStyle}
          />
        </InputField>

        <InputField
          icon={<Wind size={18} strokeWidth={1.8} />}
          title="Available Static Pressure"
          description="Available duct static in. w.c."
        >
          <input
            className="load-input"
            type="number"
            step="0.01"
            value={manualDAvailableStatic}
            onChange={(event) => setManualDAvailableStatic(event.target.value)}
            style={inputControlStyle}
          />
        </InputField>

        <InputField
          icon={<Layers size={18} strokeWidth={1.8} />}
          title="Longest Duct Run Length"
          description="Straight duct length in feet"
        >
          <input
            className="load-input"
            type="number"
            value={manualDLongestRun}
            onChange={(event) => setManualDLongestRun(event.target.value)}
            style={inputControlStyle}
          />
        </InputField>

        <InputField
          icon={<Layers size={18} strokeWidth={1.8} />}
          title="Radius Elbows"
          description={`${RADIUS_ELBOW_EQUIVALENT_LENGTH_FEET} ft equivalent each per trunk/zone`}
        >
          <input
            className="load-input"
            type="number"
            min="0"
            value={manualDRadiusElbows}
            onChange={(event) => setManualDRadiusElbows(event.target.value)}
            style={inputControlStyle}
          />
        </InputField>

        <InputField
          icon={<Layers size={18} strokeWidth={1.8} />}
          title="Hard Elbows"
          description={`${HARD_ELBOW_EQUIVALENT_LENGTH_FEET} ft equivalent each per trunk/zone`}
        >
          <input
            className="load-input"
            type="number"
            min="0"
            value={manualDHardElbows}
            onChange={(event) => setManualDHardElbows(event.target.value)}
            style={inputControlStyle}
          />
        </InputField>

        <InputField
          icon={<Layers size={18} strokeWidth={1.8} />}
          title="Tees"
          description={`${TEE_EQUIVALENT_LENGTH_FEET} ft equivalent each per trunk/zone`}
        >
          <input
            className="load-input"
            type="number"
            min="0"
            value={manualDTees}
            onChange={(event) => setManualDTees(event.target.value)}
            style={inputControlStyle}
          />
        </InputField>

        <InputField
          icon={<Layers size={18} strokeWidth={1.8} />}
          title="Boots"
          description={`${BOOT_EQUIVALENT_LENGTH_FEET} ft equivalent each per trunk/zone`}
        >
          <input
            className="load-input"
            type="number"
            min="0"
            value={manualDBoots}
            onChange={(event) => setManualDBoots(event.target.value)}
            style={inputControlStyle}
          />
        </InputField>

        <InputField
          icon={<Layers size={18} strokeWidth={1.8} />}
          title="Trunk / Zone Count"
          description="Pressure trunk lines with manual dampers"
        >
          <input
            className="load-input"
            type="number"
            min="1"
            value={manualDTrunkCount}
            onChange={(event) => setManualDTrunkCount(event.target.value)}
            style={inputControlStyle}
          />
        </InputField>
          </>
        ) : null}

        {showReturnAirSection ? (
          <>
        <InputField
          icon={<Layers size={18} strokeWidth={1.8} />}
          title="Floors / Levels"
          description="Minimum return paths by level"
        >
          <input
            className="load-input"
            type="number"
            min="1"
            value={manualDFloorCount}
            onChange={(event) => setManualDFloorCount(event.target.value)}
            style={inputControlStyle}
          />
        </InputField>

        <InputField
          icon={<Wind size={18} strokeWidth={1.8} />}
          title="Return Branches Count"
          description="Number of return branch runs"
        >
          <input
            className="load-input"
            type="number"
            value={manualDReturnBranches}
            onChange={(event) => setManualDReturnBranches(event.target.value)}
            style={inputControlStyle}
          />
        </InputField>
          </>
        ) : null}

        {showManualDSection ? (
          <InputField
            icon={<Wind size={18} strokeWidth={1.8} />}
            title="Supply Branches Count"
            description="Number of supply branch runs"
          >
            <input
              className="load-input"
              type="number"
              value={manualDSupplyBranches}
              onChange={(event) => setManualDSupplyBranches(event.target.value)}
              style={inputControlStyle}
            />
          </InputField>
        ) : null}
      </div>
      ) : null}

      {(showManualDSection || showReturnAirSection) ? (
      <div style={manualDResultCardStyle}>
        <div style={manualDResultHeaderStyle}>
          <div style={resultCardIconStyle}>
            <Wind size={18} strokeWidth={1.8} />
          </div>
          <div>
            <p style={resultCardLabelStyle}>Manual D Duct Sizing</p>
            <p style={verificationNotesSubtitleStyle}>First-pass trunk and branch estimate</p>
          </div>
        </div>

        <div className="manual-d-output-grid" style={manualDOutputGridStyle}>
          <div style={manualDOutputItemStyle}>
            <p style={manualDOutputLabelStyle}>Total System CFM</p>
            <p style={manualDOutputValueStyle}>{manualDResult.totalSystemCfm.toLocaleString()} CFM</p>
          </div>
          <div style={manualDOutputItemStyle}>
            <p style={manualDOutputLabelStyle}>Trunk / Zone Count</p>
            <p style={manualDOutputValueStyle}>{manualDResult.trunkCount.toLocaleString()}</p>
          </div>
          <div style={manualDOutputItemStyle}>
            <p style={manualDOutputLabelStyle}>CFM Per Trunk</p>
            <p style={manualDOutputValueStyle}>{manualDResult.trunkCfm.toLocaleString()} CFM</p>
          </div>
          <div style={manualDOutputItemStyle}>
            <p style={manualDOutputLabelStyle}>Round Size Per Trunk</p>
            <p style={manualDOutputValueStyle}>{manualDResult.estimatedSupplyTrunkSize}</p>
          </div>
          <div style={manualDOutputItemStyle}>
            <p style={manualDOutputLabelStyle}>Trunk Velocity</p>
            <p style={manualDOutputValueStyle}>{manualDResult.supplyTrunkVelocityFpm.toLocaleString()} FPM</p>
          </div>
          <div style={manualDOutputItemStyle}>
            <p style={manualDOutputLabelStyle}>Trunk Status</p>
            <p style={manualDOutputValueStyle}>{manualDResult.supplyTrunkStatus.toUpperCase()}</p>
          </div>
          <div style={manualDOutputItemStyle}>
            <p style={manualDOutputLabelStyle}>Straight Length</p>
            <p style={manualDOutputValueStyle}>{manualDResult.straightLengthFeet.toLocaleString()} ft</p>
          </div>
          <div style={manualDOutputItemStyle}>
            <p style={manualDOutputLabelStyle}>Fitting Equivalent Length</p>
            <p style={manualDOutputValueStyle}>
              {manualDResult.fittingEquivalentLengthFeet.toLocaleString()} ft
            </p>
          </div>
          <div style={manualDOutputItemStyle}>
            <p style={manualDOutputLabelStyle}>Total Equivalent Length</p>
            <p style={manualDOutputValueStyle}>
              {manualDResult.totalEquivalentLengthFeet.toLocaleString()} ft
            </p>
          </div>
          <div style={manualDOutputItemStyle}>
            <p style={manualDOutputLabelStyle}>Estimated Return Trunk</p>
            <p style={manualDOutputValueStyle}>{manualDResult.estimatedReturnTrunkSize}</p>
          </div>
          <div style={manualDOutputItemStyle}>
            <p style={manualDOutputLabelStyle}>Floors / Levels</p>
            <p style={manualDOutputValueStyle}>{manualDResult.floorCount.toLocaleString()}</p>
          </div>
          <div style={manualDOutputItemStyle}>
            <p style={manualDOutputLabelStyle}>Minimum Return Count</p>
            <p style={manualDOutputValueStyle}>{manualDResult.minimumReturnCount.toLocaleString()}</p>
          </div>
          <div style={manualDOutputItemStyle}>
            <p style={manualDOutputLabelStyle}>Return CFM Per Level</p>
            <p style={manualDOutputValueStyle}>{manualDResult.returnCfmPerLevel.toLocaleString()} CFM</p>
          </div>
          <div style={manualDOutputItemStyle}>
            <p style={manualDOutputLabelStyle}>Return Grilles / Level</p>
            <p style={manualDOutputValueStyle}>{manualDResult.returnGrillesPerLevel.toLocaleString()}</p>
          </div>
          <div style={manualDOutputItemStyle}>
            <p style={manualDOutputLabelStyle}>Return CFM / Grille</p>
            <p style={manualDOutputValueStyle}>{manualDResult.returnCfmPerGrille.toLocaleString()} CFM</p>
          </div>
          <div style={manualDOutputItemStyle}>
            <p style={manualDOutputLabelStyle}>Return Grille Size</p>
            <p style={manualDOutputValueStyle}>{manualDResult.returnGrilleSizeGuidance}</p>
          </div>
          <div style={manualDOutputItemStyle}>
            <p style={manualDOutputLabelStyle}>Total Return Grilles</p>
            <p style={manualDOutputValueStyle}>{manualDResult.totalReturnGrilleCount.toLocaleString()}</p>
          </div>
          <div style={manualDOutputItemStyle}>
            <p style={manualDOutputLabelStyle}>Return CFM Per Return</p>
            <p style={manualDOutputValueStyle}>{manualDResult.returnCfmPerReturn.toLocaleString()} CFM</p>
          </div>
          <div style={manualDOutputItemStyle}>
            <p style={manualDOutputLabelStyle}>Return Velocity</p>
            <p style={manualDOutputValueStyle}>{manualDResult.returnVelocityFpm.toLocaleString()} FPM</p>
          </div>
          <div style={manualDOutputItemStyle}>
            <p style={manualDOutputLabelStyle}>Return Airflow Status</p>
            <p style={manualDOutputValueStyle}>{manualDResult.returnAirflowStatus.toUpperCase()}</p>
          </div>
          <div style={manualDOutputItemStyle}>
            <p style={manualDOutputLabelStyle}>Average Branch CFM</p>
            <p style={manualDOutputValueStyle}>{manualDResult.averageBranchCfm.toLocaleString()} CFM</p>
          </div>
          <div style={manualDOutputItemStyle}>
            <p style={manualDOutputLabelStyle}>Suggested Branch Size</p>
            <p style={manualDOutputValueStyle}>{manualDResult.suggestedBranchDuctSize}</p>
          </div>
          <div style={manualDOutputItemStyle}>
            <p style={manualDOutputLabelStyle}>Friction Rate Estimate</p>
            <p style={manualDOutputValueStyle}>{manualDResult.frictionRateEstimate} in. w.c. / 100 ft</p>
          </div>
          <div style={manualDOutputItemStyle}>
            <p style={manualDOutputLabelStyle}>CFM Per Ton</p>
            <p style={manualDOutputValueStyle}>{manualDResult.cfmPerTon.toLocaleString()} CFM/ton</p>
          </div>
        </div>

        <p style={resultCardDetailStyle}>{manualDResult.explanation}</p>
        <p style={resultCardDetailStyle}>{manualDResult.supplyTrunkMessage}</p>
        <p style={resultCardDetailStyle}>{manualDResult.returnMessage}</p>
        <p style={resultCardDetailStyle}>{manualDResult.returnAirflowMessage}</p>
        <p style={resultCardDetailStyle}>{manualDResult.returnGrilleWarning}</p>
        <div style={{ ...manualDWarningsSectionStyle, display: "none" }}>
          <p style={resultCardLabelStyle}>Validation Warnings</p>
          {manualDValidationWarnings.length > 0 ? (
            <div style={manualDWarningsListStyle}>
              {manualDValidationWarnings.map((warning, index) => (
                <div key={`manual-d-warning-${warning.title}-${index}`} style={manualDWarningItemStyle}>
                  <p style={manualDWarningTitleStyle}>{warning.title}</p>
                  <p style={manualDWarningMessageStyle}>{warning.message}</p>
                </div>
              ))}
            </div>
          ) : (
            <p style={manualDNoWarningStyle}>No Manual D validation warnings for the current inputs.</p>
          )}
        </div>
        <div style={{ ...manualDRecommendationsSectionStyle, display: "none" }}>
          <p style={resultCardLabelStyle}>Field Notes</p>
          <div style={manualDWarningsListStyle}>
            {manualDRecommendations.map((recommendation, index) => (
              <div
                key={`manual-d-recommendation-${recommendation.title}-${index}`}
                style={manualDRecommendationItemStyle}
              >
                <p style={manualDRecommendationTitleStyle}>{recommendation.title}</p>
                <p style={manualDWarningMessageStyle}>{recommendation.message}</p>
              </div>
            ))}
          </div>
        </div>
        <button
          type="button"
          style={{ ...manualDPrintButtonStyle, display: "none" }}
          onClick={handlePrintManualDReport}
        >
          Print Manual D Report
        </button>
      </div>
      ) : null}

      {showReportsSection ? (
        <div style={manualDResultCardStyle}>
          <div style={manualDResultHeaderStyle}>
            <div style={resultCardIconStyle}>
              <Wind size={18} strokeWidth={1.8} />
            </div>
            <div>
              <p style={resultCardLabelStyle}>Reports</p>
              <p style={verificationNotesSubtitleStyle}>Warnings, field notes, and printable Manual D report.</p>
            </div>
          </div>
          <div style={manualDWarningsSectionStyle}>
            <p style={resultCardLabelStyle}>Validation Warnings</p>
            {manualDValidationWarnings.length > 0 ? (
              <div style={manualDWarningsListStyle}>
                {manualDValidationWarnings.map((warning, index) => (
                  <div key={`manual-d-report-warning-${warning.title}-${index}`} style={manualDWarningItemStyle}>
                    <p style={manualDWarningTitleStyle}>{warning.title}</p>
                    <p style={manualDWarningMessageStyle}>{warning.message}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p style={manualDNoWarningStyle}>No Manual D validation warnings for the current inputs.</p>
            )}
          </div>
          <div style={manualDRecommendationsSectionStyle}>
            <p style={resultCardLabelStyle}>Field Notes</p>
            <div style={manualDWarningsListStyle}>
              {manualDRecommendations.map((recommendation, index) => (
                <div
                  key={`manual-d-report-recommendation-${recommendation.title}-${index}`}
                  style={manualDRecommendationItemStyle}
                >
                  <p style={manualDRecommendationTitleStyle}>{recommendation.title}</p>
                  <p style={manualDWarningMessageStyle}>{recommendation.message}</p>
                </div>
              ))}
            </div>
          </div>
          <div style={manualDRecommendationsSectionStyle}>
            <p style={resultCardLabelStyle}>Comfort Insights</p>
            <div style={manualDWarningsListStyle}>
              {comfortInsights.map((insight, index) => (
                <div
                  key={`manual-d-comfort-insight-${insight.title}-${index}`}
                  style={manualDRecommendationItemStyle}
                >
                  <p style={manualDRecommendationTitleStyle}>{insight.title}</p>
                  <p style={manualDWarningMessageStyle}>{insight.message}</p>
                </div>
              ))}
            </div>
          </div>
          <button
            type="button"
            style={manualDPrintButtonStyle}
            onClick={handlePrintManualDReport}
          >
            Print Manual D Report
          </button>
        </div>
      ) : null}
      </div>

      <div
        style={{
          ...roomSizingSectionStyle,
          display: showRoomAirflowSection ? "grid" : "none",
        }}
      >
        <div style={roomSizingHeaderStyle}>
          <div>
            <p style={resultCardLabelStyle}>Room-by-Room Branch Ducts</p>
            <p style={verificationNotesSubtitleStyle}>
              Uses {Math.round(totalSystemCfm).toLocaleString()} CFM from {systemTonsValue.toLocaleString()} tons.
            </p>
            <p style={verificationNotesSubtitleStyle}>
              Preliminary field estimates only; not a certified Manual J room load calculation.
            </p>
          </div>
          <button type="button" style={roomActionButtonStyle} onClick={addRoom}>
            Add Room
          </button>
        </div>

        <div style={roomCardGridStyle}>
          {roomDuctRecommendations.map(({ room, roomCfm, estimatedRoomBtu, roomLoadFactor, airflowPerRegister, registerAirflowStatus, registerSizeGuidance, ductRecommendation }, index) => (
            <div key={room.id} style={roomCardStyle}>
              <div style={roomCardHeaderStyle}>
                <p style={roomCardTitleStyle}>{room.name || `Room ${index + 1}`}</p>
                <button
                  type="button"
                  style={roomRemoveButtonStyle}
                  onClick={() => removeRoom(room.id)}
                >
                  Remove
                </button>
              </div>

              <div style={roomCardSectionStyle}>
                <p style={roomCardSectionTitleStyle}>Room Info</p>
                <div style={roomInputGridStyle}>
                  <input
                    className="load-input"
                    type="text"
                    aria-label={`Room ${index + 1} name`}
                    value={room.name}
                    onChange={(event) => updateRoom(room.id, "name", event.target.value)}
                    style={inputControlStyle}
                  />
                  <input
                    className="load-input"
                    type="number"
                    min="0"
                    aria-label={`${room.name} square feet`}
                    value={room.squareFeetInput}
                    onChange={(event) =>
                      updateRoom(room.id, "squareFeet", event.target.value)
                    }
                    style={inputControlStyle}
                  />
                  <input
                    className="load-input"
                    type="number"
                    min="1"
                    aria-label={`${room.name} supply register count`}
                    value={room.supplyRegisterCount}
                    onChange={(event) =>
                      updateRoom(room.id, "supplyRegisterCount", event.target.value)
                    }
                    style={inputControlStyle}
                  />
                </div>
              </div>

              <div style={roomCardSectionStyle}>
                <p style={roomCardSectionTitleStyle}>Load Factors</p>
                <div style={roomManualJInputGridStyle}>
                  <input
                    className="load-input"
                    type="number"
                    min="0"
                    aria-label={`${room.name} windows count`}
                    placeholder="Windows"
                    value={room.windowsCountInput}
                    onChange={(event) => updateRoom(room.id, "windowsCount", event.target.value)}
                    style={inputControlStyle}
                  />
                  <input
                    className="load-input"
                    type="number"
                    min="0"
                    aria-label={`${room.name} exterior walls count`}
                    placeholder="Exterior walls"
                    value={room.exteriorWallsCountInput}
                    onChange={(event) =>
                      updateRoom(room.id, "exteriorWallsCount", event.target.value)
                    }
                    style={inputControlStyle}
                  />
                  <input
                    className="load-input"
                    type="number"
                    min="0"
                    step="0.5"
                    aria-label={`${room.name} ceiling height`}
                    placeholder="Ceiling height"
                    value={room.ceilingHeightInput}
                    onChange={(event) => updateRoom(room.id, "ceilingHeight", event.target.value)}
                    style={inputControlStyle}
                  />
                  <select
                    className="load-select"
                    aria-label={`${room.name} insulation level`}
                    value={room.insulationLevel}
                    onChange={(event) =>
                      updateRoom(room.id, "insulationLevel", event.target.value)
                    }
                    style={inputControlStyle}
                  >
                    <option value="poor">Poor insulation</option>
                    <option value="average">Average insulation</option>
                    <option value="good">Good insulation</option>
                  </select>
                  <select
                    className="load-select"
                    aria-label={`${room.name} sun exposure`}
                    value={room.sunExposure}
                    onChange={(event) => updateRoom(room.id, "sunExposure", event.target.value)}
                    style={inputControlStyle}
                  >
                    <option value="low">Low sun</option>
                    <option value="medium">Medium sun</option>
                    <option value="high">High sun</option>
                  </select>
                </div>
              </div>

              <div style={roomCardSectionStyle}>
                <p style={roomCardSectionTitleStyle}>Airflow Results</p>
                <div style={roomOutputGridStyle}>
                  <div style={roomOutputItemStyle}>
                    <p style={manualDOutputLabelStyle}>Room BTU</p>
                    <p style={manualDOutputValueStyle}>
                      {Math.round(estimatedRoomBtu).toLocaleString()} BTU
                    </p>
                  </div>
                  <div style={roomOutputItemStyle}>
                    <p style={manualDOutputLabelStyle}>Room CFM</p>
                    <p style={manualDOutputValueStyle}>{Math.round(roomCfm).toLocaleString()} CFM</p>
                  </div>
                  <div style={roomOutputItemStyle}>
                    <p style={manualDOutputLabelStyle}>Load Multiplier</p>
                    <p style={manualDOutputValueStyle}>{roomLoadFactor.toFixed(2)}x</p>
                  </div>
                  <div style={roomOutputItemStyle}>
                    <p style={manualDOutputLabelStyle}>CFM / Register</p>
                    <p style={manualDOutputValueStyle}>
                      {Math.round(airflowPerRegister).toLocaleString()} CFM
                    </p>
                  </div>
                  <div style={roomOutputItemStyle}>
                    <p style={manualDOutputLabelStyle}>Register Status</p>
                    <p style={roomStatusValueStyle}>{registerAirflowStatus.toUpperCase()}</p>
                  </div>
                  <div style={roomOutputItemStyle}>
                    <p style={manualDOutputLabelStyle}>Register Size</p>
                    <p style={roomStatusValueStyle}>{registerSizeGuidance}</p>
                  </div>
                  <div style={roomOutputItemStyle}>
                    <p style={manualDOutputLabelStyle}>Round Duct</p>
                    <p style={manualDOutputValueStyle}>{ductRecommendation.diameterInches}&quot;</p>
                  </div>
                  <div style={roomOutputItemStyle}>
                    <p style={manualDOutputLabelStyle}>Velocity</p>
                    <p style={manualDOutputValueStyle}>
                      {Math.round(ductRecommendation.velocityFpm).toLocaleString()} FPM
                    </p>
                  </div>
                  <div style={roomOutputItemStyle}>
                    <p style={manualDOutputLabelStyle}>Status</p>
                    <p style={roomStatusValueStyle}>{ductRecommendation.status.toUpperCase()}</p>
                  </div>
                </div>
              </div>

              <p
                style={{
                  ...roomStatusMessageStyle,
                  color:
                    ductRecommendation.status === "high"
                      ? "#fecaca"
                      : ductRecommendation.status === "low"
                      ? "#bfdbfe"
                      : "#bbf7d0",
                }}
              >
                {ductRecommendation.status.toUpperCase()}: {ductRecommendation.message}
              </p>
            </div>
          ))}
        </div>
      </div>
      <section className="manual-d-print-report-only" style={manualDPrintReportStyle}>
        <header style={manualDPrintHeaderStyle}>
          <div>
            <p style={manualDPrintBrandStyle}>Panda Heating & Cooling</p>
            <h1 style={manualDPrintTitleStyle}>Manual D Room Airflow Report</h1>
          </div>
          <div style={manualDPrintMetaStyle}>
            <p style={manualDPrintMetaItemStyle}>Equipment Size: {systemTonsValue.toFixed(1)} Tons</p>
            <p style={manualDPrintMetaItemStyle}>Total Airflow: {Math.round(totalSystemCfm).toLocaleString()} CFM</p>
            <p style={manualDPrintMetaItemStyle}>
              Airflow Rate: {Math.round(systemCfmPerTon).toLocaleString()} CFM per Ton
            </p>
          </div>
        </header>

        <p style={manualDPrintDesignBasisStyle}>
          {ROUND_METAL_DESIGN_BASIS_MESSAGE} {manualDResult.trunkDesignMessage}
          {" "}
          Return design assumes at least one properly sized return path per floor/level.
          {" "}
          {manualDResult.supplyTrunkMessage}
          {" "}
          {manualDResult.returnMessage}
          {" "}
          {manualDResult.returnAirflowMessage}
          {" "}
          {manualDResult.returnGrilleWarning}
        </p>

        <div style={manualDPrintSummaryGridStyle}>
          <div style={manualDPrintSummaryCardStyle}>
            <p style={manualDPrintSummaryLabelStyle}>Total System CFM</p>
            <p style={manualDPrintSummaryValueStyle}>{manualDResult.totalSystemCfm.toLocaleString()} CFM</p>
          </div>
          <div style={manualDPrintSummaryCardStyle}>
            <p style={manualDPrintSummaryLabelStyle}>Trunk / Zone Count</p>
            <p style={manualDPrintSummaryValueStyle}>{manualDResult.trunkCount.toLocaleString()}</p>
          </div>
          <div style={manualDPrintSummaryCardStyle}>
            <p style={manualDPrintSummaryLabelStyle}>CFM Per Trunk</p>
            <p style={manualDPrintSummaryValueStyle}>{manualDResult.trunkCfm.toLocaleString()} CFM</p>
          </div>
          <div style={manualDPrintSummaryCardStyle}>
            <p style={manualDPrintSummaryLabelStyle}>Size Per Trunk</p>
            <p style={manualDPrintSummaryValueStyle}>{manualDResult.estimatedSupplyTrunkSize}</p>
          </div>
          <div style={manualDPrintSummaryCardStyle}>
            <p style={manualDPrintSummaryLabelStyle}>Trunk Velocity</p>
            <p style={manualDPrintSummaryValueStyle}>
              {manualDResult.supplyTrunkVelocityFpm.toLocaleString()} FPM
            </p>
          </div>
          <div style={manualDPrintSummaryCardStyle}>
            <p style={manualDPrintSummaryLabelStyle}>Trunk Status</p>
            <p style={manualDPrintSummaryValueStyle}>{manualDResult.supplyTrunkStatus.toUpperCase()}</p>
          </div>
          <div style={manualDPrintSummaryCardStyle}>
            <p style={manualDPrintSummaryLabelStyle}>Straight Length</p>
            <p style={manualDPrintSummaryValueStyle}>
              {manualDResult.straightLengthFeet.toLocaleString()} ft
            </p>
          </div>
          <div style={manualDPrintSummaryCardStyle}>
            <p style={manualDPrintSummaryLabelStyle}>Fitting Eq. Length</p>
            <p style={manualDPrintSummaryValueStyle}>
              {manualDResult.fittingEquivalentLengthFeet.toLocaleString()} ft
            </p>
          </div>
          <div style={manualDPrintSummaryCardStyle}>
            <p style={manualDPrintSummaryLabelStyle}>Total Eq. Length</p>
            <p style={manualDPrintSummaryValueStyle}>
              {manualDResult.totalEquivalentLengthFeet.toLocaleString()} ft
            </p>
          </div>
          <div style={manualDPrintSummaryCardStyle}>
            <p style={manualDPrintSummaryLabelStyle}>Floors / Levels</p>
            <p style={manualDPrintSummaryValueStyle}>{manualDResult.floorCount.toLocaleString()}</p>
          </div>
          <div style={manualDPrintSummaryCardStyle}>
            <p style={manualDPrintSummaryLabelStyle}>Minimum Returns</p>
            <p style={manualDPrintSummaryValueStyle}>
              {manualDResult.minimumReturnCount.toLocaleString()}
            </p>
          </div>
          <div style={manualDPrintSummaryCardStyle}>
            <p style={manualDPrintSummaryLabelStyle}>Return CFM / Return</p>
            <p style={manualDPrintSummaryValueStyle}>
              {manualDResult.returnCfmPerReturn.toLocaleString()} CFM
            </p>
          </div>
          <div style={manualDPrintSummaryCardStyle}>
            <p style={manualDPrintSummaryLabelStyle}>Return CFM / Level</p>
            <p style={manualDPrintSummaryValueStyle}>
              {manualDResult.returnCfmPerLevel.toLocaleString()} CFM
            </p>
          </div>
          <div style={manualDPrintSummaryCardStyle}>
            <p style={manualDPrintSummaryLabelStyle}>Return Grilles / Level</p>
            <p style={manualDPrintSummaryValueStyle}>
              {manualDResult.returnGrillesPerLevel.toLocaleString()}
            </p>
          </div>
          <div style={manualDPrintSummaryCardStyle}>
            <p style={manualDPrintSummaryLabelStyle}>Return CFM / Grille</p>
            <p style={manualDPrintSummaryValueStyle}>
              {manualDResult.returnCfmPerGrille.toLocaleString()} CFM
            </p>
          </div>
          <div style={manualDPrintSummaryCardStyle}>
            <p style={manualDPrintSummaryLabelStyle}>Return Grille Size</p>
            <p style={manualDPrintSummaryValueStyle}>
              {manualDResult.returnGrilleSizeGuidance}
            </p>
          </div>
          <div style={manualDPrintSummaryCardStyle}>
            <p style={manualDPrintSummaryLabelStyle}>Total Return Grilles</p>
            <p style={manualDPrintSummaryValueStyle}>
              {manualDResult.totalReturnGrilleCount.toLocaleString()}
            </p>
          </div>
          <div style={manualDPrintSummaryCardStyle}>
            <p style={manualDPrintSummaryLabelStyle}>Friction Rate</p>
            <p style={manualDPrintSummaryValueStyle}>{manualDResult.frictionRateEstimate} in. w.c. / 100 ft</p>
          </div>
          <div style={manualDPrintSummaryCardStyle}>
            <p style={manualDPrintSummaryLabelStyle}>Main Trunk</p>
            <p style={manualDPrintSummaryValueStyle}>{manualDResult.estimatedSupplyTrunkSize}</p>
          </div>
          <div style={manualDPrintSummaryCardStyle}>
            <p style={manualDPrintSummaryLabelStyle}>Return Trunk</p>
            <p style={manualDPrintSummaryValueStyle}>{manualDResult.estimatedReturnTrunkSize}</p>
          </div>
          <div style={manualDPrintSummaryCardStyle}>
            <p style={manualDPrintSummaryLabelStyle}>Return Velocity</p>
            <p style={manualDPrintSummaryValueStyle}>{manualDResult.returnVelocityFpm.toLocaleString()} FPM</p>
          </div>
          <div style={manualDPrintSummaryCardStyle}>
            <p style={manualDPrintSummaryLabelStyle}>Return Airflow</p>
            <p style={manualDPrintSummaryValueStyle}>{manualDResult.returnAirflowStatus.toUpperCase()}</p>
          </div>
          <div style={manualDPrintSummaryCardStyle}>
            <p style={manualDPrintSummaryLabelStyle}>Average Branch</p>
            <p style={manualDPrintSummaryValueStyle}>{manualDResult.averageBranchCfm.toLocaleString()} CFM</p>
          </div>
        </div>

        <div style={manualDPrintWarningsStyle}>
          <p style={manualDPrintSummaryLabelStyle}>Validation Warnings</p>
          {manualDValidationWarnings.length > 0 ? (
            manualDValidationWarnings.map((warning, index) => (
              <p key={`manual-d-print-validation-${warning.title}-${index}`} style={manualDPrintWarningTextStyle}>
                {warning.title}: {warning.message}
              </p>
            ))
          ) : (
            <p style={manualDPrintWarningTextStyle}>No Manual D validation warnings for the current inputs.</p>
          )}
        </div>

        <div style={manualDPrintWarningsStyle}>
          <p style={manualDPrintSummaryLabelStyle}>Field Notes</p>
          {manualDRecommendations.map((recommendation, index) => (
            <p
              key={`manual-d-print-recommendation-${recommendation.title}-${index}`}
              style={manualDPrintWarningTextStyle}
            >
              {recommendation.title}: {recommendation.message}
            </p>
          ))}
        </div>

        <table className="manual-d-print-room-table" style={manualDPrintTableStyle}>
          <thead>
            <tr>
              <th style={manualDPrintThStyle}>Room</th>
              <th style={manualDPrintThStyle}>Sq. Ft.</th>
              <th style={manualDPrintThStyle}>Room CFM</th>
              <th style={manualDPrintThStyle}>Duct Size</th>
              <th style={manualDPrintThStyle}>Velocity</th>
              <th style={manualDPrintThStyle}>Status</th>
              <th style={manualDPrintThStyle}>Message</th>
            </tr>
          </thead>
          <tbody>
            {roomDuctRecommendations.map(({ room, roomCfm, ductRecommendation }, index) => (
              <tr className="manual-d-print-room-row" key={`manual-d-print-${room.id}`}>
                <td style={manualDPrintTdStyle}>{room.name || `Room ${index + 1}`}</td>
                <td style={manualDPrintTdStyle}>{Math.round(room.squareFeet).toLocaleString()}</td>
                <td style={manualDPrintTdStyle}>{Math.round(roomCfm).toLocaleString()} CFM</td>
                <td style={manualDPrintTdStyle}>{ductRecommendation.diameterInches}&quot; round</td>
                <td style={manualDPrintTdStyle}>
                  {Math.round(ductRecommendation.velocityFpm).toLocaleString()} FPM
                </td>
                <td style={manualDPrintTdStyle}>{ductRecommendation.status.toUpperCase()}</td>
                <td style={manualDPrintMessageTdStyle}>{ductRecommendation.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

const sectionPanelStyle: React.CSSProperties = {
  background: "rgba(15, 23, 42, 0.94)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "28px",
  padding: "22px",
  boxShadow: "0 28px 70px rgba(0,0,0,0.22)",
  display: "grid",
  gap: "18px",
};

const sectionPanelHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "14px",
};

const sectionPanelIconStyle: React.CSSProperties = {
  width: "42px",
  height: "42px",
  borderRadius: "16px",
  display: "grid",
  placeItems: "center",
  background: "rgba(212,175,55,0.14)",
  color: "#d4af37",
};

const sectionPanelTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "15px",
  fontWeight: 900,
  color: "#f8fafc",
};

const sectionPanelDescriptionStyle: React.CSSProperties = {
  margin: "6px 0 0",
  color: "#94a3b8",
  fontSize: "13px",
};

const inputGridStyle: React.CSSProperties = {
  display: "grid",
  gap: "14px",
};

const inputFieldStyle: React.CSSProperties = {
  display: "grid",
  gap: "10px",
  padding: "16px",
  borderRadius: "22px",
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.08)",
};

const inputFieldHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
};

const inputFieldIconStyle: React.CSSProperties = {
  width: "34px",
  height: "34px",
  borderRadius: "14px",
  display: "grid",
  placeItems: "center",
  background: "rgba(212,175,55,0.14)",
  color: "#d4af37",
};

const inputFieldTitleStyle: React.CSSProperties = {
  margin: 0,
  fontWeight: 900,
  fontSize: "14px",
  color: "#f8fafc",
};

const inputFieldDescriptionStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "12px",
  color: "#94a3b8",
};

const inputControlStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: "14px",
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(10, 13, 24, 0.96)",
  color: "#f8fafc",
  fontSize: "14px",
};

const manualDResultCardStyle: React.CSSProperties = {
  padding: "18px",
  borderRadius: "20px",
  background: "rgba(10, 13, 24, 0.96)",
  border: "1px solid rgba(255,255,255,0.08)",
  boxShadow: "0 18px 42px rgba(0,0,0,0.18)",
  display: "grid",
  gap: "12px",
};

const manualDResultHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
};

const resultCardIconStyle: React.CSSProperties = {
  width: "40px",
  height: "40px",
  borderRadius: "14px",
  display: "grid",
  placeItems: "center",
  background: "rgba(212,175,55,0.14)",
  color: "#d4af37",
};

const resultCardLabelStyle: React.CSSProperties = {
  margin: 0,
  color: "#94a3b8",
  fontSize: "13px",
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.12em",
};

const verificationNotesSubtitleStyle: React.CSSProperties = {
  margin: "6px 0 0",
  color: "#cbd5e1",
  fontSize: "13px",
};

const resultCardDetailStyle: React.CSSProperties = {
  margin: "10px 0 0",
  color: "#cbd5e1",
  fontSize: "13px",
  lineHeight: 1.5,
};

const manualDOutputGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "10px",
};

const manualDOutputItemStyle: React.CSSProperties = {
  padding: "14px",
  borderRadius: "16px",
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.08)",
};

const manualDOutputLabelStyle: React.CSSProperties = {
  margin: 0,
  color: "#94a3b8",
  fontSize: "11px",
  fontWeight: 800,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
};

const manualDOutputValueStyle: React.CSSProperties = {
  margin: "8px 0 0",
  color: "#f8fafc",
  fontSize: "15px",
  fontWeight: 900,
  lineHeight: 1.25,
};

const manualDPrintButtonStyle: React.CSSProperties = {
  width: "100%",
  minHeight: "48px",
  marginTop: "14px",
  padding: "14px 18px",
  borderRadius: "999px",
  border: "1px solid rgba(212,175,55,0.26)",
  background: "linear-gradient(90deg, rgba(212,175,55,0.22), rgba(212,175,55,0.1))",
  color: "#f8fafc",
  fontSize: "14px",
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "0 14px 28px rgba(0,0,0,0.22)",
  touchAction: "manipulation",
  WebkitTapHighlightColor: "rgba(212,175,55,0.22)",
};

const manualDWarningsSectionStyle: React.CSSProperties = {
  display: "grid",
  gap: "10px",
  marginTop: "8px",
  padding: "14px",
  borderRadius: "16px",
  background: "rgba(15, 23, 42, 0.64)",
  border: "1px solid rgba(251,191,36,0.22)",
};

const manualDWarningsListStyle: React.CSSProperties = {
  display: "grid",
  gap: "8px",
};

const manualDWarningItemStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: "14px",
  background: "rgba(251,191,36,0.08)",
  border: "1px solid rgba(251,191,36,0.18)",
};

const manualDWarningTitleStyle: React.CSSProperties = {
  margin: 0,
  color: "#fde68a",
  fontSize: "12px",
  fontWeight: 900,
};

const manualDWarningMessageStyle: React.CSSProperties = {
  margin: "4px 0 0",
  color: "#e5e7eb",
  fontSize: "12px",
  lineHeight: 1.45,
};

const manualDNoWarningStyle: React.CSSProperties = {
  margin: 0,
  color: "#bbf7d0",
  fontSize: "12px",
  fontWeight: 800,
};

const manualDRecommendationsSectionStyle: React.CSSProperties = {
  ...manualDWarningsSectionStyle,
  border: "1px solid rgba(212,175,55,0.2)",
  background: "rgba(212,175,55,0.06)",
};

const manualDRecommendationItemStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: "14px",
  background: "rgba(212,175,55,0.08)",
  border: "1px solid rgba(212,175,55,0.16)",
};

const manualDRecommendationTitleStyle: React.CSSProperties = {
  margin: 0,
  color: "#f8fafc",
  fontSize: "12px",
  fontWeight: 900,
};

const roomSizingSectionStyle: React.CSSProperties = {
  display: "grid",
  gap: "14px",
  padding: "18px",
  borderRadius: "20px",
  background: "rgba(10, 13, 24, 0.72)",
  border: "1px solid rgba(255,255,255,0.08)",
};

const roomSizingHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  flexWrap: "wrap",
};

const roomActionButtonStyle: React.CSSProperties = {
  minHeight: "44px",
  padding: "12px 16px",
  borderRadius: "999px",
  border: "1px solid rgba(212,175,55,0.26)",
  background: "rgba(212,175,55,0.14)",
  color: "#f8fafc",
  fontSize: "13px",
  fontWeight: 900,
  cursor: "pointer",
  touchAction: "manipulation",
  WebkitTapHighlightColor: "rgba(212,175,55,0.22)",
};

const roomCardGridStyle: React.CSSProperties = {
  display: "grid",
  gap: "12px",
};

const roomCardStyle: React.CSSProperties = {
  display: "grid",
  gap: "14px",
  padding: "14px",
  borderRadius: "16px",
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.08)",
};

const roomCardHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "10px",
};

const roomCardTitleStyle: React.CSSProperties = {
  margin: 0,
  color: "#f8fafc",
  fontSize: "13px",
  fontWeight: 900,
};

const roomCardSectionStyle: React.CSSProperties = {
  display: "grid",
  gap: "9px",
  padding: "12px",
  borderRadius: "14px",
  background: "rgba(15, 23, 42, 0.38)",
  border: "1px solid rgba(255,255,255,0.06)",
};

const roomCardSectionTitleStyle: React.CSSProperties = {
  margin: 0,
  color: "#d4af37",
  fontSize: "11px",
  fontWeight: 900,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
};

const roomRemoveButtonStyle: React.CSSProperties = {
  minHeight: "40px",
  padding: "10px 14px",
  borderRadius: "999px",
  border: "1px solid rgba(248,113,113,0.26)",
  background: "rgba(248,113,113,0.1)",
  color: "#fecaca",
  fontSize: "12px",
  fontWeight: 900,
  cursor: "pointer",
  touchAction: "manipulation",
  WebkitTapHighlightColor: "rgba(248,113,113,0.18)",
};

const roomInputGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(180px, 1.4fr) repeat(2, minmax(120px, 0.8fr))",
  gap: "10px",
};

const roomManualJInputGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(120px, 1fr))",
  gap: "10px",
};

const roomOutputGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
  gap: "10px",
};

const roomOutputItemStyle: React.CSSProperties = {
  padding: "12px",
  borderRadius: "14px",
  background: "rgba(15, 23, 42, 0.7)",
  border: "1px solid rgba(255,255,255,0.07)",
};

const roomStatusValueStyle: React.CSSProperties = {
  ...manualDOutputValueStyle,
  fontSize: "12px",
  lineHeight: 1.2,
  overflowWrap: "anywhere",
};

const roomStatusMessageStyle: React.CSSProperties = {
  margin: 0,
  padding: "10px 12px",
  borderRadius: "14px",
  background: "rgba(15, 23, 42, 0.62)",
  border: "1px solid rgba(255,255,255,0.08)",
  fontSize: "12px",
  fontWeight: 800,
  lineHeight: 1.5,
};

const manualDPrintStyles = `
  .manual-d-print-report-only {
    display: none;
  }

  @media print {
    @page {
      margin: 0.45in;
    }

    body {
      background: #ffffff !important;
    }

    .manual-d-print-only-report {
      display: none !important;
    }

    body[data-print-mode="manualD"] .panda-app-main,
    body[data-print-mode="manualD"] .load-calculator-page,
    body[data-print-mode="manualD"] .load-calculator-grid,
    body[data-print-mode="manualD"] .load-calculator-left,
    body[data-print-mode="combined"] .panda-app-main,
    body[data-print-mode="combined"] .load-calculator-page,
    body[data-print-mode="combined"] .load-calculator-grid,
    body[data-print-mode="combined"] .load-calculator-left {
      display: block !important;
      width: 100% !important;
      max-width: none !important;
      height: auto !important;
      min-height: 0 !important;
      overflow: visible !important;
      color: #111827 !important;
      background: #ffffff !important;
    }

    body[data-print-mode="manualD"] .load-calculator-header,
    body[data-print-mode="manualD"] .load-calculator-right,
    body[data-print-mode="manualD"] .load-calculator-left > :not(.manual-d-panel-root),
    body[data-print-mode="manualD"] .manual-d-screen-panel,
    body[data-print-mode="combined"] .load-calculator-header,
    body[data-print-mode="combined"] .load-calculator-right,
    body[data-print-mode="combined"] .load-calculator-left > :not(.manual-d-panel-root),
    body[data-print-mode="combined"] .manual-d-screen-panel {
      display: none !important;
    }

    body[data-print-mode="manualD"] .manual-d-panel-root,
    body[data-print-mode="combined"] .manual-d-panel-root {
      display: block !important;
      width: 100% !important;
      max-width: none !important;
      height: auto !important;
      overflow: visible !important;
      color: #111827 !important;
      background: #ffffff !important;
    }

    body[data-print-mode="manualD"] .manual-d-print-report-only,
    body[data-print-mode="combined"] .manual-d-print-report-only {
      display: block !important;
      width: 100% !important;
      min-height: auto !important;
      height: auto !important;
      overflow: visible !important;
      background: #ffffff !important;
      color: #111827 !important;
      font-family: Arial, Helvetica, sans-serif !important;
    }

    .manual-d-screen-panel {
      display: none !important;
    }

    .manual-d-print-room-table {
      width: 100% !important;
      border-collapse: collapse !important;
      table-layout: fixed !important;
      page-break-inside: auto !important;
      break-inside: auto !important;
    }

    .manual-d-print-room-table tbody {
      page-break-inside: auto !important;
      break-inside: auto !important;
    }

    .manual-d-print-room-table thead {
      display: table-header-group !important;
    }

    .manual-d-print-room-row {
      break-inside: avoid !important;
      page-break-inside: avoid !important;
    }

    .manual-d-print-room-table th,
    .manual-d-print-room-table td {
      overflow-wrap: anywhere !important;
    }
  }
`;

const manualDPrintReportStyle: React.CSSProperties = {
  display: "none",
  padding: "0",
};

const manualDPrintHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "18px",
  paddingBottom: "12px",
  borderBottom: "2px solid #111827",
  marginBottom: "12px",
};

const manualDPrintBrandStyle: React.CSSProperties = {
  margin: 0,
  color: "#111827",
  fontSize: "12px",
  fontWeight: 900,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
};

const manualDPrintTitleStyle: React.CSSProperties = {
  margin: "4px 0 0",
  color: "#111827",
  fontSize: "22px",
  lineHeight: 1.15,
};

const manualDPrintMetaStyle: React.CSSProperties = {
  display: "grid",
  gap: "4px",
  textAlign: "right",
  color: "#111827",
  fontSize: "11px",
  fontWeight: 800,
};

const manualDPrintMetaItemStyle: React.CSSProperties = {
  margin: 0,
};

const manualDPrintDesignBasisStyle: React.CSSProperties = {
  margin: "0 0 10px",
  padding: "7px 8px",
  border: "1px solid #d1d5db",
  background: "#f9fafb",
  color: "#374151",
  fontSize: "9px",
  lineHeight: 1.35,
};

const manualDPrintSummaryGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: "8px",
  marginBottom: "12px",
};

const manualDPrintSummaryCardStyle: React.CSSProperties = {
  border: "1px solid #d1d5db",
  padding: "7px 8px",
  background: "#f9fafb",
};

const manualDPrintSummaryLabelStyle: React.CSSProperties = {
  margin: 0,
  color: "#4b5563",
  fontSize: "8px",
  fontWeight: 900,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const manualDPrintSummaryValueStyle: React.CSSProperties = {
  margin: "3px 0 0",
  color: "#111827",
  fontSize: "11px",
  fontWeight: 900,
};

const manualDPrintWarningsStyle: React.CSSProperties = {
  margin: "0 0 12px",
  padding: "7px 8px",
  border: "1px solid #d1d5db",
  background: "#ffffff",
};

const manualDPrintWarningTextStyle: React.CSSProperties = {
  margin: "4px 0 0",
  color: "#111827",
  fontSize: "8.5px",
  lineHeight: 1.25,
};

const manualDPrintTableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  tableLayout: "fixed",
};

const manualDPrintThStyle: React.CSSProperties = {
  border: "1px solid #9ca3af",
  background: "#e5e7eb",
  color: "#111827",
  padding: "5px 6px",
  fontSize: "8px",
  fontWeight: 900,
  letterSpacing: "0.04em",
  textAlign: "left",
  textTransform: "uppercase",
};

const manualDPrintTdStyle: React.CSSProperties = {
  border: "1px solid #d1d5db",
  color: "#111827",
  padding: "5px 6px",
  fontSize: "9px",
  lineHeight: 1.25,
  verticalAlign: "top",
};

const manualDPrintMessageTdStyle: React.CSSProperties = {
  ...manualDPrintTdStyle,
  fontSize: "8px",
  lineHeight: 1.2,
};

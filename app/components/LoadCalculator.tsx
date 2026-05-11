"use client";

import { useEffect, useMemo, useState } from "react";
import { Calculator, Home, Thermometer, Wind, Layers, Users, Droplet, Sparkles, SunMedium } from "lucide-react";
import { calculateManualJLoad } from "../lib/manualJCalculations";
import type { ManualJInputs } from "../lib/manualJCalculations";
import ManualDPanel from "./ManualDPanel";
import type { ManualDBlueprintRoom, ManualDPanelSection, ManualDProjectState } from "./ManualDPanel";

type LoadCalculatorView = "customer" | "technician";
type TechnicianSection = ManualDPanelSection | "manual-room-takeoff";

type SavedProposalSnapshot = {
  customerName: string;
  jobAddress: string;
  phone: string;
  systemType: string;
  selectedOptionName: string | null;
  proposalConfirmed: boolean;
};

type SavedLoadCalculatorState = {
  squareFeet: string;
  ceilingHeight: string;
  insulationQuality: string;
  windowCount: string;
  windowArea: string;
  windowEfficiency: string;
  windowOrientation: string;
  climateZone: string;
  oregonRegion: string;
  numberOfRooms: string;
  homeAge: string;
  ductLocation: string;
  ductCondition: string;
  infiltrationTightness: string;
  existingSystemSize: string;
  comfortPriority: string;
  occupancy: string;
  blueprintRoomName: string;
  blueprintLength: string;
  blueprintWidth: string;
  blueprintCeilingHeight: string;
  blueprintFloorLevel: string;
  blueprintRoomsForManualD: ManualDBlueprintRoom[];
};

type SavedProject = {
  id: string;
  name: string;
  savedAt: string;
  customerInfo: SavedProposalSnapshot | null;
  proposalSelection: SavedProposalSnapshot | null;
  loadCalculator: SavedLoadCalculatorState;
  manualD: ManualDProjectState | null;
};

const SAVED_PROJECTS_STORAGE_KEY = "panda-hvac-saved-projects";
const CURRENT_PROPOSAL_STORAGE_KEY = "panda-hvac-current-proposal";

type InputFieldProps = {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
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

export default function LoadCalculator() {
  const [activeLoadView, setActiveLoadView] = useState<LoadCalculatorView>("customer");
  const [activeTechnicianSection, setActiveTechnicianSection] = useState<TechnicianSection>("manual-d");
  const [squareFeet, setSquareFeet] = useState("2200");
  const [ceilingHeight, setCeilingHeight] = useState("9");
  const [insulationQuality, setInsulationQuality] = useState("Average");
  const [windowCount, setWindowCount] = useState("15");
  const [windowArea, setWindowArea] = useState("");
  const [windowEfficiency, setWindowEfficiency] = useState("Standard");
  const [windowOrientation, setWindowOrientation] = useState("Mixed / Average Exposure");
  const [climateZone, setClimateZone] = useState("Zone 4");
  const [oregonRegion, setOregonRegion] = useState("Portland / Beaverton / West Oregon");
  const [numberOfRooms, setNumberOfRooms] = useState("6");
  const [homeAge, setHomeAge] = useState("Modern");
  const [ductLocation, setDuctLocation] = useState("Attic");
  const [ductCondition, setDuctCondition] = useState("Average");
  const [infiltrationTightness, setInfiltrationTightness] = useState("Average");
  const [existingSystemSize, setExistingSystemSize] = useState("Unknown");
  const [comfortPriority, setComfortPriority] = useState("Balanced Comfort");
  const [occupancy, setOccupancy] = useState("3 People");
  const [isCalculating, setIsCalculating] = useState(false);
  const [animateResults, setAnimateResults] = useState(false);
  const [blueprintRoomName, setBlueprintRoomName] = useState("New Room");
  const [blueprintLength, setBlueprintLength] = useState("12");
  const [blueprintWidth, setBlueprintWidth] = useState("12");
  const [blueprintCeilingHeight, setBlueprintCeilingHeight] = useState("8");
  const [blueprintFloorLevel, setBlueprintFloorLevel] = useState("1");
  const [blueprintRoomsForManualD, setBlueprintRoomsForManualD] = useState<ManualDBlueprintRoom[]>([]);
  const [savedProjects, setSavedProjects] = useState<SavedProject[]>([]);
  const [manualDProjectState, setManualDProjectState] = useState<ManualDProjectState | null>(null);
  const [loadedManualDProjectState, setLoadedManualDProjectState] = useState<ManualDProjectState | null>(null);

  const options = {
    insulation: [
      { label: "Poor", value: "Poor" },
      { label: "Average", value: "Average" },
      { label: "Good", value: "Good" },
      { label: "Excellent", value: "Excellent" },
    ],
    windowEfficiency: [
      { label: "Drafty", value: "Drafty" },
      { label: "Standard", value: "Standard" },
      { label: "Low-E", value: "Low-E" },
      { label: "Passive", value: "Passive" },
    ],
    windowOrientation: [
      { label: "North / Low Solar Gain", value: "North / Low Solar Gain" },
      { label: "East / Morning Sun", value: "East / Morning Sun" },
      { label: "South / Moderate Solar Gain", value: "South / Moderate Solar Gain" },
      { label: "West / High Afternoon Sun", value: "West / High Afternoon Sun" },
      { label: "Mixed / Average Exposure", value: "Mixed / Average Exposure" },
    ],
    climateZones: [
      { label: "Zone 1", value: "Zone 1" },
      { label: "Zone 2", value: "Zone 2" },
      { label: "Zone 3", value: "Zone 3" },
      { label: "Zone 4", value: "Zone 4" },
      { label: "Zone 5", value: "Zone 5" },
    ],
    oregonRegion: [
      { label: "Portland / Beaverton / West Oregon", value: "Portland / Beaverton / West Oregon" },
      { label: "Coast / Marine", value: "Coast / Marine" },
      { label: "Central Oregon", value: "Central Oregon" },
      { label: "Eastern Oregon", value: "Eastern Oregon" },
      { label: "Southern Oregon", value: "Southern Oregon" },
    ],
    homeAge: [
      { label: "New", value: "New" },
      { label: "Modern", value: "Modern" },
      { label: "Old", value: "Old" },
    ],
    ductLocation: [
      { label: "Attic", value: "Attic" },
      { label: "Crawl Space", value: "Crawl Space" },
      { label: "Conditioned", value: "Conditioned" },
    ],
    ductCondition: [
      { label: "Excellent / Sealed", value: "Excellent / Sealed" },
      { label: "Average", value: "Average" },
      { label: "Poor / Leaking", value: "Poor / Leaking" },
    ],
    infiltrationTightness: [
      { label: "Tight / Air Sealed", value: "Tight / Air Sealed" },
      { label: "Average", value: "Average" },
      { label: "Leaky / Older Home", value: "Leaky / Older Home" },
    ],
    existingSystemSize: [
      { label: "Unknown", value: "Unknown" },
      { label: "2 Ton", value: "2 Ton" },
      { label: "2.5 Ton", value: "2.5 Ton" },
      { label: "3 Ton", value: "3 Ton" },
      { label: "3.5 Ton", value: "3.5 Ton" },
      { label: "4 Ton", value: "4 Ton" },
      { label: "5 Ton", value: "5 Ton" },
    ],
    comfortPriority: [
      { label: "Maximum Efficiency", value: "Maximum Efficiency" },
      { label: "Balanced Comfort", value: "Balanced Comfort" },
      { label: "Maximum Comfort / Humidity Control", value: "Maximum Comfort / Humidity Control" },
    ],
    occupancy: [
      { label: "1-2 People", value: "1-2 People" },
      { label: "3 People", value: "3 People" },
      { label: "4-5 People", value: "4-5 People" },
      { label: "6+ People", value: "6+ People" },
    ],
  };

  const blueprintSquareFeet =
    Math.max(0, Number(blueprintLength) || 0) * Math.max(0, Number(blueprintWidth) || 0);

  useEffect(() => {
    const savedProjectJson = window.localStorage.getItem(SAVED_PROJECTS_STORAGE_KEY);
    if (!savedProjectJson) return;

    try {
      const parsedProjects = JSON.parse(savedProjectJson) as SavedProject[];
      if (Array.isArray(parsedProjects)) {
        setSavedProjects(parsedProjects);
      }
    } catch {
      setSavedProjects([]);
    }
  }, []);

  const persistSavedProjects = (projects: SavedProject[]) => {
    setSavedProjects(projects);
    window.localStorage.setItem(SAVED_PROJECTS_STORAGE_KEY, JSON.stringify(projects));
  };

  const getCurrentProposalSnapshot = (): SavedProposalSnapshot | null => {
    const proposalJson = window.localStorage.getItem(CURRENT_PROPOSAL_STORAGE_KEY);
    if (!proposalJson) return null;

    try {
      return JSON.parse(proposalJson) as SavedProposalSnapshot;
    } catch {
      return null;
    }
  };

  const getLoadCalculatorSnapshot = (): SavedLoadCalculatorState => ({
    squareFeet,
    ceilingHeight,
    insulationQuality,
    windowCount,
    windowArea,
    windowEfficiency,
    windowOrientation,
    climateZone,
    oregonRegion,
    numberOfRooms,
    homeAge,
    ductLocation,
    ductCondition,
    infiltrationTightness,
    existingSystemSize,
    comfortPriority,
    occupancy,
    blueprintRoomName,
    blueprintLength,
    blueprintWidth,
    blueprintCeilingHeight,
    blueprintFloorLevel,
    blueprintRoomsForManualD,
  });

  const handleSaveProject = () => {
    const proposalSnapshot = getCurrentProposalSnapshot();
    const projectName =
      proposalSnapshot?.customerName ||
      proposalSnapshot?.jobAddress ||
      `Project ${new Date().toLocaleDateString()}`;
    const nextProject: SavedProject = {
      id: `project-${Date.now()}`,
      name: projectName,
      savedAt: new Date().toISOString(),
      customerInfo: proposalSnapshot,
      proposalSelection: proposalSnapshot,
      loadCalculator: getLoadCalculatorSnapshot(),
      manualD: manualDProjectState,
    };
    const nextProjects = [nextProject, ...savedProjects];
    persistSavedProjects(nextProjects);
  };

  const handleLoadProject = (project: SavedProject) => {
    setSquareFeet(project.loadCalculator.squareFeet);
    setCeilingHeight(project.loadCalculator.ceilingHeight);
    setInsulationQuality(project.loadCalculator.insulationQuality);
    setWindowCount(project.loadCalculator.windowCount);
    setWindowArea(project.loadCalculator.windowArea);
    setWindowEfficiency(project.loadCalculator.windowEfficiency);
    setWindowOrientation(project.loadCalculator.windowOrientation);
    setClimateZone(project.loadCalculator.climateZone);
    setOregonRegion(project.loadCalculator.oregonRegion);
    setNumberOfRooms(project.loadCalculator.numberOfRooms);
    setHomeAge(project.loadCalculator.homeAge);
    setDuctLocation(project.loadCalculator.ductLocation);
    setDuctCondition(project.loadCalculator.ductCondition);
    setInfiltrationTightness(project.loadCalculator.infiltrationTightness);
    setExistingSystemSize(project.loadCalculator.existingSystemSize);
    setComfortPriority(project.loadCalculator.comfortPriority);
    setOccupancy(project.loadCalculator.occupancy);
    setBlueprintRoomName(project.loadCalculator.blueprintRoomName);
    setBlueprintLength(project.loadCalculator.blueprintLength);
    setBlueprintWidth(project.loadCalculator.blueprintWidth);
    setBlueprintCeilingHeight(project.loadCalculator.blueprintCeilingHeight);
    setBlueprintFloorLevel(project.loadCalculator.blueprintFloorLevel);
    setBlueprintRoomsForManualD(project.loadCalculator.blueprintRoomsForManualD.map((room) => ({ ...room })));
    setLoadedManualDProjectState(
      project.manualD
        ? {
            settings: { ...project.manualD.settings },
            rooms: project.manualD.rooms.map((room) => ({ ...room })),
          }
        : null
    );

    if (project.proposalSelection) {
      window.localStorage.setItem(CURRENT_PROPOSAL_STORAGE_KEY, JSON.stringify(project.proposalSelection));
    }
  };

  const addBlueprintRoomToManualD = () => {
    const calculatedSquareFeet = Math.round(blueprintSquareFeet);
    if (calculatedSquareFeet <= 0) return;

    setBlueprintRoomsForManualD((currentRooms) => [
      ...currentRooms,
      {
        id: `blueprint-room-${Date.now()}-${currentRooms.length + 1}`,
        name: blueprintRoomName.trim() || "New Room",
        squareFeet: calculatedSquareFeet,
        ceilingHeight: blueprintCeilingHeight,
        floorLevel: blueprintFloorLevel,
      },
    ]);
  };

  const result = useMemo(() => {
    const inputs: ManualJInputs = {
      squareFeet: Math.max(0, parseInt(squareFeet, 10) || 0),
      ceilingHeight: Math.max(6, parseInt(ceilingHeight, 10) || 6),
      insulationQuality,
      windowCount: Math.max(0, parseInt(windowCount, 10) || 0),
      windowArea: Math.max(0, parseFloat(windowArea) || 0),
      windowEfficiency,
      windowOrientation,
      climateZone,
      oregonRegion,
      numberOfRooms: Math.max(1, parseInt(numberOfRooms, 10) || 1),
      homeAge,
      ductLocation,
      ductCondition,
      infiltrationTightness,
      existingSystemSize,
      comfortPriority,
      occupancy,
    };

    return calculateManualJLoad(inputs);
  }, [squareFeet, ceilingHeight, insulationQuality, windowCount, windowArea, windowEfficiency, windowOrientation, climateZone, oregonRegion, numberOfRooms, homeAge, ductLocation, ductCondition, infiltrationTightness, existingSystemSize, comfortPriority, occupancy]);

  const [displayedResult, setDisplayedResult] = useState(result);

  const snapshotSummary = useMemo(() => {
    const sqft = Math.max(0, parseInt(squareFeet, 10) || 0);
    const windows = Math.max(0, parseInt(windowCount, 10) || 0);
    const glassArea = Math.max(0, parseFloat(windowArea) || 0);
    const [minTon, maxTon] = result.recommendedTonnage
  .split("–")
  .map((value) => parseFloat(value.replace(/[^\d.]/g, "")) || 0);

const averageTonnage = (minTon + maxTon) / 2;

    const recommendationTone = averageTonnage >= 4.0
      ? "High"
      : averageTonnage <= 2.2
      ? "Conservative"
      : "Balanced";

    const sizePhrase = sqft >= 3000
      ? "large conditioned area"
      : sqft >= 2000
      ? "mid-size home"
      : "smaller footprint";

    const insulationPhrase = insulationQuality === "Excellent"
      ? "Excellent insulation keeps demand down"
      : insulationQuality === "Good"
      ? "Good insulation helps control load"
      : insulationQuality === "Average"
      ? "Average insulation keeps demand moderate"
      : "Poor insulation increases load";

    const windowPhrase = windowEfficiency === "Drafty"
      ? "Drafty windows increase heat transfer"
      : windowEfficiency === "Standard"
      ? "Standard glazing adds moderate load"
      : `High-performance ${windowEfficiency.toLowerCase()} windows help reduce gain`;

    const orientationPhrase = windowOrientation === "North / Low Solar Gain"
      ? "north-facing exposure slightly reduces solar gain"
      : windowOrientation === "East / Morning Sun"
      ? "east-facing exposure adds mild morning solar gain"
      : windowOrientation === "South / Moderate Solar Gain"
      ? "south-facing exposure adds moderate solar gain"
      : windowOrientation === "West / High Afternoon Sun"
      ? "west-facing exposure increases afternoon solar gain"
      : "mixed exposure keeps solar gain neutral";

    const regionPhrase = `${oregonRegion} design temperatures set heating and cooling delta-T`;

    const countPhrase = windows > 12
      ? "window count raises demand"
      : "window count is controlled";

    const areaPhrase = glassArea > 0
      ? `${glassArea.toLocaleString()} sq.ft. of window area refines glass loads`
      : "window area is estimated from window count";

    const ductPhrase = ductLocation === "Conditioned"
      ? "Conditioned ducts reduce distribution losses"
      : `Verify ${ductLocation.toLowerCase()} ducts to avoid additional system loss`;

    const ductConditionPhrase = ductCondition === "Excellent / Sealed"
      ? "sealed duct condition reduces distribution losses"
      : ductCondition === "Poor / Leaking"
      ? "existing duct condition may reduce system efficiency and should be verified before final equipment selection"
      : "average duct condition keeps distribution losses neutral";

    const infiltrationPhrase = infiltrationTightness === "Tight / Air Sealed"
      ? "air-sealed construction reduces infiltration load"
      : infiltrationTightness === "Leaky / Older Home"
      ? "leaky older-home conditions increase infiltration load"
      : "average infiltration keeps air leakage neutral";

    const existingSystemPhrase = existingSystemSize === "Unknown"
      ? ""
      : `Existing ${existingSystemSize.toLowerCase()} equipment is compared to the calculated range.`;

    const comfortPriorityPhrase = comfortPriority === "Maximum Efficiency"
      ? "maximum efficiency favors a tighter sizing range and energy savings"
      : comfortPriority === "Maximum Comfort / Humidity Control"
      ? "comfort-focused settings favor inverter-style modulation and improved humidity control"
      : "balanced comfort keeps sizing behavior neutral";

    const loadPhrase = recommendationTone === "High"
      ? `High recommendation for a ${homeAge.toLowerCase()} home with ${sizePhrase}`
      : recommendationTone === "Conservative"
      ? `Conservative recommendation for a ${homeAge.toLowerCase()} home with ${sizePhrase}`
      : `Balanced recommendation for a ${homeAge.toLowerCase()} home with ${sizePhrase}`;

    return `${loadPhrase}. ${insulationPhrase}, ${windowPhrase}, ${countPhrase}, ${areaPhrase}, ${orientationPhrase}, ${regionPhrase}, ${infiltrationPhrase}, ${ductConditionPhrase}, ${comfortPriorityPhrase}, and ${sqft > 2200 ? "square footage increases demand" : "square footage keeps the load moderate"}. ${ductPhrase}. ${existingSystemPhrase ? `${existingSystemPhrase} ` : ""}${result.confidenceExplanation}`;
  }, [squareFeet, windowCount, windowArea, insulationQuality, windowEfficiency, windowOrientation, oregonRegion, ductLocation, ductCondition, infiltrationTightness, existingSystemSize, comfortPriority, homeAge, result]);

  useEffect(() => {
    setDisplayedResult(result);
  }, [result]);

  const handleCalculate = () => {
    setIsCalculating(true);
    setAnimateResults(false);
    window.setTimeout(() => {
      setDisplayedResult(result);
      setIsCalculating(false);
      setAnimateResults(true);
      window.setTimeout(() => setAnimateResults(false), 500);
    }, 520);
  };

  const handlePointerCalculate = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === "mouse") return;
    event.preventDefault();
    handleCalculate();
  };

  const technicianSections: Array<{
    id: TechnicianSection;
    title: string;
    description: string;
  }> = [
    {
      id: "manual-d",
      title: "Manual D",
      description: "System airflow, trunk sizing, and fitting equivalent length.",
    },
    {
      id: "room-airflow",
      title: "Room-by-Room Airflow",
      description: "Room loads, branch ducts, register airflow, and status messages.",
    },
    {
      id: "return-air",
      title: "Return Air Design",
      description: "Return paths, grille guidance, and quiet airflow checks.",
    },
    {
      id: "manual-room-takeoff",
      title: "Manual Room Takeoff",
      description: "Measure length and width, then add rooms into Manual D.",
    },
    {
      id: "reports",
      title: "Reports",
      description: "Validation warnings, field notes, and print-ready Manual D report.",
    },
  ];

  return (
    <div className="load-calculator-page" style={calcPageStyle}>
      <div className="load-calculator-header" style={calcHeaderStyle}>
        <div className="load-calculator-title-wrapper" style={calcTitleWrapperStyle}>
          <div style={calcIconStyle}>
            <Calculator size={20} strokeWidth={1.8} />
          </div>
          <div>
            <p style={calcEyebrowStyle}>Load Calculation</p>
            <h2 style={calcTitleStyle}>HVAC Manual J workflow</h2>
            <p style={calcSubtitleStyle}>Enter project details and get a premium load estimate for every job.</p>
          </div>
        </div>
        <button
          type="button"
          className="calc-action-button"
          style={calcActionButtonStyle}
          onClick={handleCalculate}
          onTouchEnd={(e) => {
            e.preventDefault();
            handleCalculate();
          }}
          onPointerUp={handlePointerCalculate}
        >
          {isCalculating ? "Calculating..." : "Calculate Load"}
        </button>
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
          .load-input, .load-select {
            transition: border-color 0.25s ease, box-shadow 0.25s ease, background 0.25s ease;
            pointer-events: auto;
            position: relative;
            z-index: 10;
          }

          .load-calculator-page,
          .load-calculator-grid,
          .load-calculator-left,
          .load-calculator-right,
          .load-section-panel,
          .load-result-grid {
            min-width: 0;
          }

          .load-input:focus,
          .load-select:focus {
            outline: none;
            border-color: rgba(212,175,55,0.5);
            box-shadow: 0 0 0 4px rgba(212,175,55,0.12);
            background: rgba(255,255,255,0.06);
          }

          .calc-action-button {
            transition: transform 0.25s ease, box-shadow 0.25s ease, background 0.25s ease;
          }

          .calc-action-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 18px 35px rgba(212,175,55,0.18);
            background: rgba(212,175,55,0.2);
          }

          @media (hover: none), (pointer: coarse) {
            .calc-action-button:hover,
            .result-card-active {
              transform: none !important;
            }
          }

          .result-card {
            transition: transform 0.3s ease, opacity 0.35s ease, box-shadow 0.3s ease;
            opacity: 0.92;
            transform: translateY(0px);
          }

          .result-card-active {
            opacity: 1;
            transform: translateY(-3px);
            box-shadow: 0 24px 60px rgba(0,0,0,0.22);
          }

          .result-card-loading {
            position: relative;
            overflow: hidden;
          }

          .result-card-loading::after {
            content: "";
            position: absolute;
            inset: 0;
            background: linear-gradient(110deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.03) 100%);
            animation: shimmer 1.1s ease-in-out infinite;
            pointer-events: none;
          }

          @keyframes shimmer {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
          }

          @media (max-width: 1024px) {
            .load-calculator-grid {
              grid-template-columns: 1fr !important;
            }

            .load-calculator-header {
              align-items: flex-start !important;
            }
          }

          @media (max-width: 640px) {
            .load-calculator-page {
              gap: 14px !important;
              width: 100% !important;
              max-width: 100% !important;
              overflow-x: hidden !important;
              position: relative !important;
              z-index: 10 !important;
              pointer-events: auto !important;
            }

            .load-calculator-header {
              display: grid !important;
              grid-template-columns: 1fr !important;
              padding: 18px !important;
              border-radius: 24px !important;
            }

            .load-calculator-title-wrapper {
              align-items: flex-start !important;
            }

            .load-calculator-header h2 {
              font-size: 21px !important;
              line-height: 1.2 !important;
            }

            .calc-action-button {
              width: 100% !important;
              min-height: 48px !important;
              padding: 14px 18px !important;
              pointer-events: auto !important;
              position: relative !important;
              z-index: 30 !important;
              touch-action: manipulation !important;
            }

            .load-view-tabs {
              grid-template-columns: 1fr !important;
            }

            .load-section-panel,
            .result-card,
            .load-verification-card {
              border-radius: 22px !important;
              padding: 16px !important;
            }

            .load-input,
            .load-select {
              min-height: 52px !important;
              font-size: 16px !important;
              line-height: 1.25 !important;
              padding: 14px 16px !important;
              width: 100% !important;
              max-width: 100% !important;
              -webkit-appearance: none !important;
              appearance: none !important;
              touch-action: manipulation !important;
              user-select: text !important;
              -webkit-user-select: text !important;
              pointer-events: auto !important;
              position: relative !important;
              z-index: 30 !important;
            }

            .load-result-header {
              display: grid !important;
              grid-template-columns: 1fr !important;
              padding: 18px !important;
              border-radius: 22px !important;
            }

            .manual-d-output-grid {
              grid-template-columns: 1fr !important;
            }

            .load-result-value {
              font-size: 22px !important;
              line-height: 1.2 !important;
              overflow-wrap: anywhere !important;
            }

            .load-calculator-grid,
            .load-calculator-left,
            .load-calculator-right,
            .load-section-panel,
            .load-result-grid,
            .manual-d-output-grid {
              width: 100% !important;
              max-width: 100% !important;
              overflow-x: hidden !important;
              pointer-events: auto !important;
            }

            .load-section-panel {
              position: relative !important;
              z-index: 1 !important;
              isolation: isolate !important;
            }

            .load-calculator-page input,
            .load-calculator-page select,
            .load-calculator-page button,
            .load-calculator-page textarea {
              pointer-events: auto !important;
              position: relative !important;
              z-index: 30 !important;
              touch-action: manipulation !important;
            }

            .load-calculator-page svg,
            .load-calculator-page .result-card::before,
            .load-calculator-page .result-card::after {
              pointer-events: none !important;
            }

            .load-input:focus,
            .load-select:focus {
              box-shadow: 0 0 0 3px rgba(212,175,55,0.14) !important;
            }
          }
        `
      }} />

      <div className="load-view-tabs" style={loadViewTabsStyle}>
        <button
          type="button"
          style={activeLoadView === "customer" ? loadViewTabActiveStyle : loadViewTabStyle}
          onClick={() => setActiveLoadView("customer")}
        >
          Customer View
        </button>
        <button
          type="button"
          style={activeLoadView === "technician" ? loadViewTabActiveStyle : loadViewTabStyle}
          onClick={() => setActiveLoadView("technician")}
        >
          Technician View
        </button>
      </div>

      <div className="load-calculator-grid" style={calcGridStyle}>
        <div className="load-calculator-left" style={leftColumnStyle}>
          {activeLoadView === "customer" ? (
            <div className="load-section-panel" style={sectionPanelStyle}>
              <div style={sectionPanelHeaderStyle}>
                <div style={sectionPanelIconStyle}>
                  <Home size={18} strokeWidth={1.8} />
                </div>
                <div>
                  <p style={sectionPanelTitleStyle}>Customer Estimate Inputs</p>
                  <p style={sectionPanelDescriptionStyle}>Simple project details for homeowner review.</p>
                </div>
              </div>

              <div style={inputGridStyle}>
                <InputField
                  icon={<Thermometer size={18} strokeWidth={1.8} />}
                  title="Square Footage"
                  description="Total heated area"
                >
                  <input
                    className="load-input"
                    type="number"
                    value={squareFeet}
                    onChange={(e) => setSquareFeet(e.target.value)}
                    style={inputControlStyle}
                  />
                </InputField>

                <InputField
                  icon={<SunMedium size={18} strokeWidth={1.8} />}
                  title="Home Type"
                  description="Construction era"
                >
                  <select className="load-select" value={homeAge} onChange={(e) => setHomeAge(e.target.value)} style={selectControlStyle}>
                    {options.homeAge.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </InputField>
              </div>
            </div>
          ) : (
            <>
          <div style={technicianAccordionStyle}>
            {technicianSections.map((section) => {
              const isActive = activeTechnicianSection === section.id;

              return (
                <button
                  key={section.id}
                  type="button"
                  style={isActive ? technicianAccordionButtonActiveStyle : technicianAccordionButtonStyle}
                  onClick={() => setActiveTechnicianSection(section.id)}
                  aria-expanded={isActive}
                >
                  <span style={technicianAccordionTitleStyle}>{section.title}</span>
                  <span style={technicianAccordionDescriptionStyle}>{section.description}</span>
                </button>
              );
            })}
          </div>

          <div className="load-section-panel" style={projectSavePanelStyle}>
            <div style={projectSaveHeaderStyle}>
              <div>
                <p style={sectionPanelTitleStyle}>Saved Projects</p>
                <p style={sectionPanelDescriptionStyle}>Save and reload local project snapshots.</p>
              </div>
              <button type="button" style={calcActionButtonStyle} onClick={handleSaveProject}>
                Save Project
              </button>
            </div>

            {savedProjects.length > 0 ? (
              <div style={projectListStyle}>
                {savedProjects.map((project) => (
                  <div key={project.id} style={projectListItemStyle}>
                    <div>
                      <p style={projectListTitleStyle}>{project.name}</p>
                      <p style={projectListMetaStyle}>
                        Saved {new Date(project.savedAt).toLocaleString()}
                      </p>
                    </div>
                    <button
                      type="button"
                      style={projectLoadButtonStyle}
                      onClick={() => handleLoadProject(project)}
                    >
                      Load Project
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p style={projectListMetaStyle}>No saved projects yet.</p>
            )}
          </div>

          <div className="load-section-panel" style={{ ...sectionPanelStyle, display: "none" }}>
            <div style={sectionPanelHeaderStyle}>
              <div style={sectionPanelIconStyle}>
                <Home size={18} strokeWidth={1.8} />
              </div>
              <div>
                <p style={sectionPanelTitleStyle}>Project Details</p>
                <p style={sectionPanelDescriptionStyle}>Basic building inputs for load sizing.</p>
              </div>
            </div>

            <div style={inputGridStyle}>
              <InputField
                icon={<Thermometer size={18} strokeWidth={1.8} />}
                title="Square Footage"
                description="Total heated area"
              >
                <input
                  className="load-input"
                  type="number"
                  value={squareFeet}
                  onChange={(e) => setSquareFeet(e.target.value)}
                  style={inputControlStyle}
                />
              </InputField>

              <InputField
                icon={<Wind size={18} strokeWidth={1.8} />}
                title="Ceiling Height"
                description="Average ceiling height"
              >
                <input
                  className="load-input"
                  type="number"
                  step="0.5"
                  value={ceilingHeight}
                  onChange={(e) => setCeilingHeight(e.target.value)}
                  style={inputControlStyle}
                />
              </InputField>

              <InputField
                icon={<Layers size={18} strokeWidth={1.8} />}
                title="Number of Rooms"
                description="Total conditioned rooms"
              >
                <input
                  className="load-input"
                  type="number"
                  value={numberOfRooms}
                  onChange={(e) => setNumberOfRooms(e.target.value)}
                  style={inputControlStyle}
                />
              </InputField>

              <InputField
                icon={<SunMedium size={18} strokeWidth={1.8} />}
                title="Home Age"
                description="Construction era"
              >
                <select className="load-select" value={homeAge} onChange={(e) => setHomeAge(e.target.value)} style={selectControlStyle}>
                  {options.homeAge.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </InputField>
            </div>
          </div>

          <div className="load-section-panel" style={{ ...sectionPanelStyle, display: "none" }}>
            <div style={sectionPanelHeaderStyle}>
              <div style={sectionPanelIconStyle}>
                <Droplet size={18} strokeWidth={1.8} />
              </div>
              <div>
                <p style={sectionPanelTitleStyle}>Thermal Envelope</p>
                <p style={sectionPanelDescriptionStyle}>Insulation, windows and climate inputs.</p>
              </div>
            </div>

            <div style={inputGridStyle}>
              <InputField
                icon={<Layers size={18} strokeWidth={1.8} />}
                title="Insulation Quality"
                description="Thermal resistance"
              >
                <select className="load-select" value={insulationQuality} onChange={(e) => setInsulationQuality(e.target.value)} style={selectControlStyle}>
                  {options.insulation.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </InputField>

              <InputField
                icon={<Home size={18} strokeWidth={1.8} />}
                title="Window Count"
                description="Total glazed openings"
              >
                <input
                  className="load-input"
                  type="number"
                  value={windowCount}
                  onChange={(e) => setWindowCount(e.target.value)}
                  style={inputControlStyle}
                />
              </InputField>

              <InputField
                icon={<Home size={18} strokeWidth={1.8} />}
                title="Window Area"
                description="Total window area in sq.ft."
              >
                <input
                  className="load-input"
                  type="number"
                  value={windowArea}
                  onChange={(e) => setWindowArea(e.target.value)}
                  style={inputControlStyle}
                />
              </InputField>

              <InputField
                icon={<Sparkles size={18} strokeWidth={1.8} />}
                title="Window Efficiency"
                description="Frame and glazing quality"
              >
                <select className="load-select" value={windowEfficiency} onChange={(e) => setWindowEfficiency(e.target.value)} style={selectControlStyle}>
                  {options.windowEfficiency.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </InputField>

              <InputField
                icon={<SunMedium size={18} strokeWidth={1.8} />}
                title="Window Orientation / Sun Exposure"
                description="Primary solar exposure"
              >
                <select className="load-select" value={windowOrientation} onChange={(e) => setWindowOrientation(e.target.value)} style={selectControlStyle}>
                  {options.windowOrientation.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </InputField>

              <InputField
                icon={<SunMedium size={18} strokeWidth={1.8} />}
                title="Climate Zone"
                description="Regional heating/cooling demand"
              >
                <select className="load-select" value={climateZone} onChange={(e) => setClimateZone(e.target.value)} style={selectControlStyle}>
                  {options.climateZones.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </InputField>

              <InputField
                icon={<SunMedium size={18} strokeWidth={1.8} />}
                title="Oregon Region"
                description="Local design temperatures"
              >
                <select className="load-select" value={oregonRegion} onChange={(e) => setOregonRegion(e.target.value)} style={selectControlStyle}>
                  {options.oregonRegion.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </InputField>
            </div>
          </div>

          <div className="load-section-panel" style={{ ...sectionPanelStyle, display: "none" }}>
            <div style={sectionPanelHeaderStyle}>
              <div style={sectionPanelIconStyle}>
                <Users size={18} strokeWidth={1.8} />
              </div>
              <div>
                <p style={sectionPanelTitleStyle}>Operating Conditions</p>
                <p style={sectionPanelDescriptionStyle}>Occupancy and duct strategy.</p>
              </div>
            </div>

            <div style={inputGridStyle}>
              <InputField
                icon={<Wind size={18} strokeWidth={1.8} />}
                title="Duct Location"
                description="Where ducts are installed"
              >
                <select className="load-select" value={ductLocation} onChange={(e) => setDuctLocation(e.target.value)} style={selectControlStyle}>
                  {options.ductLocation.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </InputField>

              <InputField
                icon={<Wind size={18} strokeWidth={1.8} />}
                title="Duct Condition"
                description="Duct sealing quality"
              >
                <select className="load-select" value={ductCondition} onChange={(e) => setDuctCondition(e.target.value)} style={selectControlStyle}>
                  {options.ductCondition.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </InputField>

              <InputField
                icon={<Users size={18} strokeWidth={1.8} />}
                title="Occupancy"
                description="Average house occupancy"
              >
                <select className="load-select" value={occupancy} onChange={(e) => setOccupancy(e.target.value)} style={selectControlStyle}>
                  {options.occupancy.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </InputField>

              <InputField
                icon={<Wind size={18} strokeWidth={1.8} />}
                title="Home Tightness / Infiltration"
                description="Air leakage condition"
              >
                <select className="load-select" value={infiltrationTightness} onChange={(e) => setInfiltrationTightness(e.target.value)} style={selectControlStyle}>
                  {options.infiltrationTightness.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </InputField>

              <InputField
                icon={<Thermometer size={18} strokeWidth={1.8} />}
                title="Existing System Size"
                description="Current installed capacity"
              >
                <select className="load-select" value={existingSystemSize} onChange={(e) => setExistingSystemSize(e.target.value)} style={selectControlStyle}>
                  {options.existingSystemSize.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </InputField>

              <InputField
                icon={<Sparkles size={18} strokeWidth={1.8} />}
                title="Comfort Priority"
                description="Sizing preference"
              >
                <select className="load-select" value={comfortPriority} onChange={(e) => setComfortPriority(e.target.value)} style={selectControlStyle}>
                  {options.comfortPriority.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </InputField>
            </div>
          </div>

          <div
            className="load-section-panel"
            style={{
              ...sectionPanelStyle,
              display: activeTechnicianSection === "manual-room-takeoff" ? "grid" : "none",
            }}
          >
            <div style={sectionPanelHeaderStyle}>
              <div style={sectionPanelIconStyle}>
                <Layers size={18} strokeWidth={1.8} />
              </div>
              <div>
                <p style={sectionPanelTitleStyle}>Manual Room Takeoff</p>
                <p style={sectionPanelDescriptionStyle}>Measure rooms and send them into Manual D.</p>
              </div>
            </div>

            <p style={blueprintTakeoffNoteStyle}>
              Future upgrade: upload blueprint PDF or image and auto-detect rooms.
            </p>

            <div style={blueprintTakeoffGridStyle}>
              <label style={blueprintTakeoffInputGroupStyle}>
                <span style={blueprintTakeoffInputLabelStyle}>Room Name</span>
                <input
                  className="load-input"
                  type="text"
                  aria-label="Blueprint takeoff room name"
                  value={blueprintRoomName}
                  onChange={(event) => setBlueprintRoomName(event.target.value)}
                  style={inputControlStyle}
                />
              </label>
              <label style={blueprintTakeoffInputGroupStyle}>
                <span style={blueprintTakeoffInputLabelStyle}>Length</span>
                <input
                  className="load-input"
                  type="number"
                  min="0"
                  step="0.1"
                  aria-label="Blueprint takeoff room length"
                  value={blueprintLength}
                  onChange={(event) => setBlueprintLength(event.target.value)}
                  style={inputControlStyle}
                />
              </label>
              <label style={blueprintTakeoffInputGroupStyle}>
                <span style={blueprintTakeoffInputLabelStyle}>Width</span>
                <input
                  className="load-input"
                  type="number"
                  min="0"
                  step="0.1"
                  aria-label="Blueprint takeoff room width"
                  value={blueprintWidth}
                  onChange={(event) => setBlueprintWidth(event.target.value)}
                  style={inputControlStyle}
                />
              </label>
              <label style={blueprintTakeoffInputGroupStyle}>
                <span style={blueprintTakeoffInputLabelStyle}>Ceiling Height</span>
                <input
                  className="load-input"
                  type="number"
                  min="0"
                  step="0.5"
                  aria-label="Blueprint takeoff ceiling height"
                  value={blueprintCeilingHeight}
                  onChange={(event) => setBlueprintCeilingHeight(event.target.value)}
                  style={inputControlStyle}
                />
              </label>
              <label style={blueprintTakeoffInputGroupStyle}>
                <span style={blueprintTakeoffInputLabelStyle}>Floor / Level</span>
                <input
                  className="load-input"
                  type="number"
                  min="1"
                  aria-label="Blueprint takeoff floor or level"
                  value={blueprintFloorLevel}
                  onChange={(event) => setBlueprintFloorLevel(event.target.value)}
                  style={inputControlStyle}
                />
              </label>
            </div>

            <div style={blueprintTakeoffFooterStyle}>
              <div style={blueprintTakeoffResultStyle}>
                <p style={blueprintTakeoffLabelStyle}>Calculated Sq. Ft.</p>
                <p style={blueprintTakeoffValueStyle}>
                  {Math.round(blueprintSquareFeet).toLocaleString()} sq ft
                </p>
              </div>
              <button
                type="button"
                style={calcActionButtonStyle}
                onClick={addBlueprintRoomToManualD}
              >
                Add to Manual D
              </button>
            </div>
          </div>

          <ManualDPanel
            squareFeet={squareFeet}
            blueprintRooms={blueprintRoomsForManualD}
            savedProjectState={loadedManualDProjectState}
            onProjectStateChange={setManualDProjectState}
            activeSection={
              activeTechnicianSection === "manual-room-takeoff"
                ? "hidden"
                : activeTechnicianSection
            }
          />
            </>
          )}
        </div>

        <div className="load-calculator-right" style={rightColumnStyle}>
          {activeLoadView === "customer" ? (
            <>
              <div className="load-result-header" style={resultHeaderCardStyle}>
                <div>
                  <p style={resultHeaderLabelStyle}>Customer Estimate</p>
                  <h3 style={resultHeaderTitleStyle}>Recommended system size</h3>
                  <p style={resultHeaderTextStyle}>
                    A clean homeowner-facing summary based on the current square footage and home type.
                  </p>
                </div>
                <div style={resultScoreBadgeStyle}>Panda</div>
              </div>

              <div className="load-result-grid" style={resultGridStyle}>
                {[
                  {
                    icon: <Thermometer size={18} strokeWidth={1.8} />,
                    label: "Recommended System Size",
                    value: isCalculating ? "Loading..." : displayedResult.recommendedTonnage,
                    detail: isCalculating ? "" : displayedResult.whyText,
                  },
                  {
                    icon: <Sparkles size={18} strokeWidth={1.8} />,
                    label: "Proposal / Pricing",
                    value: "Ready for proposal",
                    detail: "Pricing is handled by the existing proposal workflow and has not been changed.",
                  },
                ].map((card) => (
                  <div
                    key={card.label}
                    className={`result-card ${animateResults ? "result-card-active" : ""} ${isCalculating ? "result-card-loading" : ""}`}
                    style={resultCardStyle}
                  >
                    <div style={resultCardIconStyle}>{card.icon}</div>
                    <p style={resultCardLabelStyle}>{card.label}</p>
                    <p className="load-result-value" style={resultCardValueStyle}>{card.value}</p>
                    {card.detail ? <p style={resultCardDetailStyle}>{card.detail}</p> : null}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
          <div className="load-result-header" style={resultHeaderCardStyle}>
            <div>
              <p style={resultHeaderLabelStyle}>Estimate Snapshot</p>
              <h3 style={resultHeaderTitleStyle}>Instant recommendations</h3>
             <p style={resultHeaderTextStyle}>
  Review the load estimate and refine inputs as needed for each job.
</p>

<p style={resultSummaryStyle}>
  {snapshotSummary}
</p>
            </div>
            <div style={resultScoreBadgeStyle}>Premium</div>
          </div>

          <div className="load-result-grid" style={resultGridStyle}>
            {[
              {
                icon: <Calculator size={18} strokeWidth={1.8} />,
                label: "Estimated BTU Load",
                value: isCalculating ? "Loading..." : displayedResult.estimatedBTU.toLocaleString(),
              },
              {
                icon: <Thermometer size={18} strokeWidth={1.8} />,
                label: "Estimated Heating BTU",
                value: isCalculating ? "Loading..." : displayedResult.estimatedHeatingBTU.toLocaleString(),
              },
              {
                icon: <SunMedium size={18} strokeWidth={1.8} />,
                label: "Estimated Cooling BTU",
                value: isCalculating ? "Loading..." : displayedResult.estimatedCoolingBTU.toLocaleString(),
              },
              {
                icon: <Thermometer size={18} strokeWidth={1.8} />,
                label: "Recommended Tonnage",
                value: isCalculating ? "Loading..." : displayedResult.recommendedTonnage,
              },
              {
                icon: <Sparkles size={18} strokeWidth={1.8} />,
                label: "Recommended Equipment Type",
                value: isCalculating ? "Loading..." : displayedResult.recommendedEquipmentType,
                detail: isCalculating ? "" : displayedResult.equipmentRecommendationExplanation,
              },
              {
                icon: <Sparkles size={18} strokeWidth={1.8} />,
                label: "Equipment Match Confidence",
                value: isCalculating ? "Loading..." : displayedResult.equipmentMatchConfidence,
                detail: isCalculating ? "" : displayedResult.equipmentMatchExplanation,
              },
              {
                icon: <Wind size={18} strokeWidth={1.8} />,
                label: "Retrofit Complexity Score",
                value: isCalculating ? "Loading..." : displayedResult.retrofitComplexityScore,
                detail: isCalculating ? "" : displayedResult.retrofitComplexityExplanation,
              },
              {
                icon: <Wind size={18} strokeWidth={1.8} />,
                label: "Airflow Range",
                value: isCalculating ? "Loading..." : displayedResult.airflow,
              },
              {
                icon: <Sparkles size={18} strokeWidth={1.8} />,
                label: "Confidence Score",
                value: isCalculating ? "Loading..." : displayedResult.confidence,
                detail: isCalculating ? "" : displayedResult.confidenceExplanation,
              },
              {
                icon: <SunMedium size={18} strokeWidth={1.8} />,
                label: "Why this system size",
                value: isCalculating ? "Loading..." : "See summary below",
                detail: isCalculating ? "" : displayedResult.whyText,
              },
            ].map((card) => (
              <div
                key={card.label}
                className={`result-card ${animateResults ? "result-card-active" : ""} ${isCalculating ? "result-card-loading" : ""}`}
                style={resultCardStyle}
              >
                <div style={resultCardIconStyle}>{card.icon}</div>
                <p style={resultCardLabelStyle}>{card.label}</p>
                <p className="load-result-value" style={resultCardValueStyle}>{card.value}</p>
                {card.detail ? <p style={resultCardDetailStyle}>{card.detail}</p> : null}
              </div>
            ))}
          </div>

          <div className="load-verification-card" style={verificationNotesCardStyle}>
            <div style={verificationNotesHeaderStyle}>
              <div style={resultCardIconStyle}>
                <Wind size={18} strokeWidth={1.8} />
              </div>
              <div>
                <p style={resultCardLabelStyle}>System Verification Notes</p>
                <p style={verificationNotesSubtitleStyle}>Retrofit duct and airflow checks</p>
              </div>
            </div>
            <div style={verificationNotesListStyle}>
              {displayedResult.systemVerificationNotes.map((note) => (
                <p key={note} style={verificationNoteStyle}>{note}</p>
              ))}
            </div>
          </div>

          <div className="load-verification-card" style={verificationNotesCardStyle}>
            <div style={verificationNotesHeaderStyle}>
              <div style={resultCardIconStyle}>
                <Sparkles size={18} strokeWidth={1.8} />
              </div>
              <div>
                <p style={resultCardLabelStyle}>Oversizing Risk Analysis</p>
                <p style={verificationNotesSubtitleStyle}>Capacity and comfort considerations</p>
              </div>
            </div>
            <div style={verificationNotesListStyle}>
              {displayedResult.oversizingRiskNotes.map((note) => (
                <p key={note} style={verificationNoteStyle}>{note}</p>
              ))}
            </div>
          </div>

          <div className="load-verification-card" style={verificationNotesCardStyle}>
            <div style={verificationNotesHeaderStyle}>
              <div style={resultCardIconStyle}>
                <Thermometer size={18} strokeWidth={1.8} />
              </div>
              <div>
                <p style={resultCardLabelStyle}>Comfort Risk Areas</p>
                <p style={verificationNotesSubtitleStyle}>Potential room comfort considerations</p>
              </div>
            </div>
            <div style={verificationNotesListStyle}>
              {displayedResult.comfortRiskAreas.map((note) => (
                <p key={note} style={verificationNoteStyle}>{note}</p>
              ))}
            </div>
          </div>

          <div className="load-verification-card" style={verificationNotesCardStyle}>
            <div style={verificationNotesHeaderStyle}>
              <div style={resultCardIconStyle}>
                <Wind size={18} strokeWidth={1.8} />
              </div>
              <div>
                <p style={resultCardLabelStyle}>System Longevity Outlook</p>
                <p style={verificationNotesSubtitleStyle}>Long-term operation and comfort stability</p>
              </div>
            </div>
            <div style={verificationNotesListStyle}>
              <p style={verificationNoteStyle}>{displayedResult.systemLongevityOutlook}</p>
              <p style={verificationNoteStyle}>{displayedResult.systemLongevityExplanation}</p>
            </div>
          </div>

          <div className="load-verification-card" style={verificationNotesCardStyle}>
            <div style={verificationNotesHeaderStyle}>
              <div style={resultCardIconStyle}>
                <Sparkles size={18} strokeWidth={1.8} />
              </div>
              <div>
                <p style={resultCardLabelStyle}>Homeowner Recommendation Summary</p>
                <p style={verificationNotesSubtitleStyle}>Clear next-step guidance</p>
              </div>
            </div>
            <div style={verificationNotesListStyle}>
              {displayedResult.homeownerRecommendationSummary.map((note) => (
                <p key={note} style={verificationNoteStyle}>{note}</p>
              ))}
            </div>
          </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const calcPageStyle: React.CSSProperties = {
  display: "grid",
  gap: "24px",
};

const calcHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "20px",
  padding: "26px 28px",
  background: "rgba(15, 23, 42, 0.96)",
  borderRadius: "28px",
  border: "1px solid rgba(255,255,255,0.08)",
  boxShadow: "0 24px 60px rgba(0,0,0,0.22)",
};

const calcTitleWrapperStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "16px",
};

const calcIconStyle: React.CSSProperties = {
  width: "50px",
  height: "50px",
  borderRadius: "18px",
  display: "grid",
  placeItems: "center",
  background: "rgba(212,175,55,0.12)",
  border: "1px solid rgba(212,175,55,0.2)",
  color: "#d4af37",
};

const calcEyebrowStyle: React.CSSProperties = {
  margin: 0,
  color: "#d4af37",
  fontSize: "12px",
  letterSpacing: "0.2em",
  textTransform: "uppercase",
  fontWeight: 900,
};

const calcTitleStyle: React.CSSProperties = {
  margin: "8px 0 0",
  fontSize: "24px",
  fontWeight: 900,
  color: "#f8fafc",
};

const calcSubtitleStyle: React.CSSProperties = {
  margin: "8px 0 0",
  color: "#cbd5e1",
  fontSize: "14px",
  maxWidth: "560px",
};

const calcActionButtonStyle: React.CSSProperties = {
  padding: "14px 22px",
  borderRadius: "18px",
  border: "1px solid rgba(212,175,55,0.28)",
  background: "rgba(212,175,55,0.16)",
  color: "#f8fafc",
  fontWeight: 900,
  cursor: "pointer",
  transition: "all 0.2s ease",
  touchAction: "manipulation",
  WebkitTapHighlightColor: "transparent",
};

const loadViewTabsStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "12px",
  padding: "10px",
  borderRadius: "24px",
  background: "rgba(15, 23, 42, 0.94)",
  border: "1px solid rgba(255,255,255,0.08)",
  boxShadow: "0 18px 45px rgba(0,0,0,0.18)",
};

const loadViewTabStyle: React.CSSProperties = {
  minHeight: "48px",
  padding: "13px 16px",
  borderRadius: "16px",
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.04)",
  color: "#cbd5e1",
  fontSize: "13px",
  fontWeight: 900,
  cursor: "pointer",
  touchAction: "manipulation",
};

const loadViewTabActiveStyle: React.CSSProperties = {
  ...loadViewTabStyle,
  border: "1px solid rgba(212,175,55,0.34)",
  background: "rgba(212,175,55,0.18)",
  color: "#f8fafc",
  boxShadow: "0 12px 28px rgba(212,175,55,0.12)",
};

const technicianAccordionStyle: React.CSSProperties = {
  display: "grid",
  gap: "10px",
};

const technicianAccordionButtonStyle: React.CSSProperties = {
  width: "100%",
  minHeight: "66px",
  padding: "15px 18px",
  borderRadius: "20px",
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(15, 23, 42, 0.92)",
  color: "#f8fafc",
  cursor: "pointer",
  display: "grid",
  gap: "5px",
  textAlign: "left",
  boxShadow: "0 18px 44px rgba(0,0,0,0.18)",
  touchAction: "manipulation",
};

const technicianAccordionButtonActiveStyle: React.CSSProperties = {
  ...technicianAccordionButtonStyle,
  border: "1px solid rgba(212,175,55,0.34)",
  background: "rgba(212,175,55,0.16)",
  boxShadow: "0 20px 52px rgba(212,175,55,0.12)",
};

const technicianAccordionTitleStyle: React.CSSProperties = {
  color: "#f8fafc",
  fontSize: "14px",
  fontWeight: 900,
};

const technicianAccordionDescriptionStyle: React.CSSProperties = {
  color: "#cbd5e1",
  fontSize: "12px",
  lineHeight: 1.4,
};

const projectSavePanelStyle: React.CSSProperties = {
  background: "rgba(15, 23, 42, 0.94)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "28px",
  padding: "22px",
  boxShadow: "0 28px 70px rgba(0,0,0,0.22)",
  display: "grid",
  gap: "14px",
};

const projectSaveHeaderStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  alignItems: "center",
  gap: "12px",
};

const projectListStyle: React.CSSProperties = {
  display: "grid",
  gap: "10px",
};

const projectListItemStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  alignItems: "center",
  gap: "12px",
  padding: "12px",
  borderRadius: "16px",
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.08)",
};

const projectListTitleStyle: React.CSSProperties = {
  margin: 0,
  color: "#f8fafc",
  fontSize: "13px",
  fontWeight: 900,
};

const projectListMetaStyle: React.CSSProperties = {
  margin: "5px 0 0",
  color: "#94a3b8",
  fontSize: "12px",
  lineHeight: 1.4,
};

const projectLoadButtonStyle: React.CSSProperties = {
  ...calcActionButtonStyle,
  minHeight: "42px",
  padding: "11px 14px",
  borderRadius: "14px",
  fontSize: "12px",
};

const calcGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.35fr 0.85fr",
  gap: "24px",
};

const leftColumnStyle: React.CSSProperties = {
  display: "grid",
  gap: "20px",
};

const rightColumnStyle: React.CSSProperties = {
  display: "grid",
  gap: "20px",
};

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

const blueprintTakeoffGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(160px, 1.4fr) repeat(4, minmax(90px, 0.75fr))",
  gap: "10px",
};

const blueprintTakeoffNoteStyle: React.CSSProperties = {
  margin: 0,
  color: "#cbd5e1",
  fontSize: "12px",
  lineHeight: 1.5,
};

const blueprintTakeoffInputGroupStyle: React.CSSProperties = {
  display: "grid",
  gap: "7px",
};

const blueprintTakeoffInputLabelStyle: React.CSSProperties = {
  color: "#cbd5e1",
  fontSize: "11px",
  fontWeight: 900,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const blueprintTakeoffFooterStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  alignItems: "center",
  gap: "12px",
};

const blueprintTakeoffResultStyle: React.CSSProperties = {
  padding: "14px",
  borderRadius: "16px",
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.08)",
};

const blueprintTakeoffLabelStyle: React.CSSProperties = {
  margin: 0,
  color: "#94a3b8",
  fontSize: "11px",
  fontWeight: 800,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
};

const blueprintTakeoffValueStyle: React.CSSProperties = {
  margin: "8px 0 0",
  color: "#f8fafc",
  fontSize: "15px",
  fontWeight: 900,
};

const selectControlStyle: React.CSSProperties = {
  ...inputControlStyle,
  appearance: "none",
};

const resultHeaderCardStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "16px",
  padding: "22px",
  borderRadius: "28px",
  background: "rgba(15, 23, 42, 0.94)",
  border: "1px solid rgba(255,255,255,0.08)",
  boxShadow: "0 28px 70px rgba(0,0,0,0.22)",
};

const resultHeaderLabelStyle: React.CSSProperties = {
  margin: 0,
  color: "#d4af37",
  fontSize: "12px",
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  fontWeight: 900,
};

const resultHeaderTitleStyle: React.CSSProperties = {
  margin: "8px 0 0",
  fontSize: "20px",
  fontWeight: 900,
  color: "#f8fafc",
};

const resultHeaderTextStyle: React.CSSProperties = {
  margin: "10px 0 0",
  color: "#cbd5e1",
  fontSize: "13px",
  maxWidth: "420px",
};

const resultSummaryStyle: React.CSSProperties = {
  margin: "12px 0 0",
  color: "#cbd5e1",
  fontSize: "13px",
  lineHeight: 1.6,
  maxWidth: "420px",
};

const resultScoreBadgeStyle: React.CSSProperties = {
  marginTop: "4px",
  padding: "10px 16px",
  borderRadius: "999px",
  background: "rgba(212,175,55,0.12)",
  color: "#d4af37",
  fontWeight: 900,
  fontSize: "12px",
};

const resultGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: "16px",
};

const resultCardStyle: React.CSSProperties = {
  padding: "22px",
  borderRadius: "24px",
  background: "rgba(10, 13, 24, 0.96)",
  border: "1px solid rgba(255,255,255,0.08)",
  boxShadow: "0 20px 50px rgba(0,0,0,0.22)",
  display: "grid",
  gap: "10px",
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

const resultCardValueStyle: React.CSSProperties = {
  margin: 0,
  color: "#f8fafc",
  fontSize: "26px",
  fontWeight: 900,
};

const resultCardDetailStyle: React.CSSProperties = {
  margin: "10px 0 0",
  color: "#cbd5e1",
  fontSize: "13px",
  lineHeight: 1.5,
};

const verificationNotesCardStyle: React.CSSProperties = {
  ...resultCardStyle,
};

const verificationNotesHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
};

const verificationNotesSubtitleStyle: React.CSSProperties = {
  margin: "6px 0 0",
  color: "#cbd5e1",
  fontSize: "13px",
};

const verificationNotesListStyle: React.CSSProperties = {
  display: "grid",
  gap: "8px",
};

const verificationNoteStyle: React.CSSProperties = {
  margin: 0,
  color: "#f8fafc",
  fontSize: "13px",
  lineHeight: 1.5,
};

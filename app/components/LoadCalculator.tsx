"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, MutableRefObject } from "react";
import { Calculator, Home, Thermometer, Wind, Layers, Users, Droplet, Sparkles, SunMedium, FileText, X, ClipboardCheck, ShieldCheck, Activity, Printer, AlertTriangle, CheckCircle2, Circle, PlayCircle, UploadCloud, Zap, MousePointer2, Plus, Trash2, PanelLeftOpen, PanelLeftClose, PanelRightOpen, PanelRightClose, ChevronLeft, ChevronRight, Maximize2, Minimize2, Target, Square, RotateCcw } from "lucide-react";
import { calculateManualJLoad, type ManualJResults } from "../lib/manualJCalculations";
import type { ManualJInputs } from "../lib/manualJCalculations";
import {
  calculateBlueprintMeasuredFeet,
  calculateBlueprintPixelDistance,
  calculateBlueprintPixelsPerFoot,
  calculateBlueprintVerificationError,
  confirmBlueprintCalibration,
  createDefaultBlueprintCalibrationState,
  getConfirmedBlueprintPixelsPerFoot,
  parseFieldMeasurementToFeet,
  selectBlueprintCalibrationPoint,
  selectBlueprintVerificationPoint,
  updateBlueprintCalibrationKnownLength,
  updateBlueprintVerificationKnownLength,
} from "@/lib/hvac/blueprintCalibration";
import { detectRoomsFromBlueprint } from "@/lib/hvac/blueprintDetection";
import type { DetectedBlueprintRoom, DetectedRoomWorkflowStatus } from "@/lib/hvac/blueprintDetection";
import { findSnapPoint } from "@/lib/hvac/blueprintSnapping";
import {
  addBlueprintRoomTracePoint,
  cancelBlueprintRoomTrace,
  createDefaultBlueprintRoomBoundaryEdges,
  createDefaultBlueprintRoomTraceState,
  editBlueprintRoomOutline,
  finishBlueprintRoomTrace,
  markBlueprintRoomOutlinesNeedRecalculation,
  removeBlueprintRoomOutline,
  renameBlueprintRoomOutline,
  startBlueprintRoomTrace,
  startBlueprintRoomTraceFromPoints,
  undoBlueprintRoomTracePoint,
  updateBlueprintRoomBoundaryEdgeType,
  updateBlueprintRoomTracePoint,
  type BlueprintRoomBoundaryType,
  type BlueprintRoomOutline,
  type BlueprintOpeningType,
  type BlueprintWallOpening,
} from "@/lib/hvac/blueprintRoomTracing";
import {
  adaptDetectedRoomToManualDBlueprintRoom,
  adaptManualFallbackRoomToManualDBlueprintRoom,
  adaptTracedRoomToManualDBlueprintRoom,
} from "@/lib/hvac/roomCalculationPipeline";
import {
  calculateBlueprintRoomBoundaryCompleteness,
  calculateBlueprintRoomEnvelopeConfidence,
  explainBlueprintRoomEnvelopePreview,
} from "@/lib/hvac/blueprintExteriorLoad";
import {
  BlueprintProject,
  BlueprintEnvelopeSuggestions,
  EnvelopeSuggestion,
  createBlueprintProjectSnapshot,
  updateBlueprintProjectSnapshot,
  ensureBlueprintDocument,
  type BlueprintDocument,
  type BlueprintPage,
} from "@/lib/hvac/blueprintProject";
import {
  saveBlueprintProjectToLocalStorage,
  loadBlueprintProjectFromLocalStorage,
  listBlueprintProjectsFromLocalStorage,
} from "@/lib/hvac/blueprintPersistence";
import {
  createBlueprintTechnicianReport,
  type BlueprintTechnicianReport,
} from "@/lib/hvac/blueprintReport";
import { saveBlueprintAsset, getBlueprintAsset } from "@/lib/hvac/blueprintAssetStorage";
import { loadPDFDocument, renderPDFPageToDataURL } from "@/lib/hvac/pdfRenderingService";
import { calculateResidentialAirflow, recommendRoundDuctSize } from "@/lib/hvac/manualD";
import ManualDPanel from "./ManualDPanel";
import type { ManualDBlueprintRoom, ManualDPanelSection, ManualDProjectState } from "./ManualDPanel";
import { ProjectEngineProvider } from "./project/ProjectEngineProvider";
import { useProjectEngine } from "./project/useProjectEngine";
import { prepareEngineStateForSave } from "@/lib/hvac/engine/projectEnginePersistence";
import type { ProjectAction, ProjectEngineMetadata, ProjectEngineState, ProjectTimelineEventType } from "@/lib/hvac/engine/projectEngineTypes";
import { ProjectNextStepBanner } from "./project/ProjectNextStepBanner";
import { ProjectCommandCenter } from "./project/ProjectCommandCenter";
import { ProjectIssuesDrawer } from "./project/ProjectIssuesDrawer";

/**
 * ProjectEngineSync helper:
 * Keeps the ProjectEngine in sync with the legacy LoadCalculator state 
 * during the migration phase.
 */
const ProjectEngineSync = ({ 
  project, 
  activeTechnicianSection, 
  setActiveTechnicianSection 
}: { 
  project: BlueprintProject;
  activeTechnicianSection: TechnicianSection;
  setActiveTechnicianSection: (section: TechnicianSection) => void;
}) => {
  const { engineState, dispatchEngineAction } = useProjectEngine();
  const lastProjectRef = useRef<BlueprintProject | null>(null);

  // Sync stage to UI section
  useEffect(() => {
    const stage = engineState.workflowStage;
    if (stage === "CALIBRATION" || stage === "TAKEOFF" || stage === "SETUP") {
      if (activeTechnicianSection !== "manual-room-takeoff") setActiveTechnicianSection("manual-room-takeoff");
    } else if (stage === "ENVELOPE") {
      if (activeTechnicianSection !== "envelope-verification") setActiveTechnicianSection("envelope-verification");
    } else if (stage === "LOAD_CALC") {
      if (activeTechnicianSection !== "room-airflow") setActiveTechnicianSection("room-airflow");
    } else if (stage === "DUCT_DESIGN") {
      if (activeTechnicianSection !== "manual-d" && activeTechnicianSection !== "return-air" && activeTechnicianSection !== "room-airflow") {
        setActiveTechnicianSection("manual-d");
      }
    } else if (stage === "REPORT" || stage === "EXPORT") {
      if (activeTechnicianSection !== "reports") setActiveTechnicianSection("reports");
    }
  }, [engineState.workflowStage, setActiveTechnicianSection]);

  // Sync legacy project state to engine
  useEffect(() => {
    const lastProject = lastProjectRef.current;
    
    // Initial sync or major project swap
    if (!lastProject || lastProject.id !== project.id) {
      dispatchEngineAction({ type: "SET_PROJECT", project });
      lastProjectRef.current = project;
      return;
    }

    // Detect specific changes to trigger invalidation
    const calibrationChanged = lastProject.calibration.status !== project.calibration.status || 
                               lastProject.calibration.pixelsPerFoot !== project.calibration.pixelsPerFoot;
    
    const roomsChanged = JSON.stringify(lastProject.tracedRooms) !== JSON.stringify(project.tracedRooms);
    
    const envelopeChanged = JSON.stringify(lastProject.envelopeSettings) !== JSON.stringify(project.envelopeSettings);

    const manualDChanged = JSON.stringify(lastProject.manualDProjectState) !== JSON.stringify(project.manualDProjectState);

    if (calibrationChanged) {
      dispatchEngineAction({ type: "SET_PROJECT", project });
      dispatchEngineAction({ type: "UPDATE_CALIBRATION" });
    } else if (roomsChanged) {
      dispatchEngineAction({ type: "SET_PROJECT", project });
      dispatchEngineAction({ type: "UPDATE_ROOM_TRACE" });
    } else if (envelopeChanged) {
      dispatchEngineAction({ type: "SET_PROJECT", project });
      dispatchEngineAction({ type: "UPDATE_ENVELOPE" });
    } else if (manualDChanged) {
      dispatchEngineAction({ type: "SET_PROJECT", project });
      dispatchEngineAction({ type: "UPDATE_MANUAL_D" });
    } else {
      // General update if something else changed
      dispatchEngineAction({ type: "SET_PROJECT", project });
    }

    lastProjectRef.current = project;
  }, [project, dispatchEngineAction]);

  return null;
};

/**
 * CalculationLifecycleSync:
 * Listens to the legacy isCalculating state and dispatches 
 * lifecycle actions to the ProjectEngine.
 */
const CalculationLifecycleSync = ({ isCalculating }: { isCalculating: boolean }) => {
  const { dispatchEngineAction } = useProjectEngine();
  const lastIsCalculating = useRef(isCalculating);

  useEffect(() => {
    if (isCalculating && !lastIsCalculating.current) {
      dispatchEngineAction({ type: "START_RECALCULATION" });
    } else if (!isCalculating && lastIsCalculating.current) {
      // For now, we assume all load-related flags are cleared on any calculate click
      dispatchEngineAction({ 
        type: "COMPLETE_RECALCULATION", 
        clearedFlags: ["MANUAL_J", "MANUAL_D", "ROOM_AREAS", "PROPOSAL", "REPORT"] 
      });
    }
    lastIsCalculating.current = isCalculating;
  }, [isCalculating, dispatchEngineAction]);

  return null;
};

type LoadCalculatorView = "customer" | "technician";
type TechnicianSection = ManualDPanelSection | "manual-room-takeoff" | "envelope-verification";
type BlueprintWorkspaceMode = "review-detected" | "manual-trace";
type DetectedRoomEditableField =
  | "name"
  | "squareFeet"
  | "floorLevel"
  | "windowsCount"
  | "exteriorWallsCount";
type SelectedBlueprintBoundaryEdge = {
  outlineId: string;
  edgeIndex: number;
};

const BLUEPRINT_BOUNDARY_TYPE_OPTIONS: Array<{ label: string; value: BlueprintRoomBoundaryType }> = [
  { label: "Unknown", value: "unknown" },
  { label: "Exterior", value: "exterior" },
  { label: "Interior", value: "interior" },
  { label: "Adjacent / Conditioned", value: "adjacent" },
  { label: "Garage", value: "garage" },
  { label: "Attic", value: "attic" },
  { label: "Crawlspace", value: "crawlspace" },
];

const BOUNDARY_TYPE_COLORS: Record<string, string> = {
  exterior: "#f87171", // High-contrast Red/Orange
  interior: "#38bdf8", // Light Blue
  garage: "#c084fc",   // Purple
  adjacent: "#4ade80", // Emerald Green
  attic: "#fb923c",    // Orange
  crawlspace: "#94a3b8", // Gray
  unknown: "rgba(255, 255, 255, 0.4)", // Muted White
};

const FRACTION_OPTIONS = [
  { label: "0", value: "0" },
  { label: "1/16", value: "0.0625" },
  { label: "1/8", value: "0.125" },
  { label: "3/16", value: "0.1875" },
  { label: "1/4", value: "0.25" },
  { label: "5/16", value: "0.3125" },
  { label: "3/8", value: "0.375" },
  { label: "7/16", value: "0.4375" },
  { label: "1/2", value: "0.5" },
  { label: "9/16", value: "0.5625" },
  { label: "5/8", value: "0.625" },
  { label: "11/16", value: "0.6875" },
  { label: "3/4", value: "0.75" },
  { label: "13/16", value: "0.8125" },
  { label: "7/8", value: "0.875" },
  { label: "15/16", value: "0.9375" },
];

type BlueprintDetectionPipeline = {
  mode: "preview";
  status: "mock";
  sourceFileName: string;
  rooms: DetectedBlueprintRoom[];
};

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
  blueprintFileName: string;
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
  engineMetadata?: ProjectEngineMetadata;
};

const SAVED_PROJECTS_STORAGE_KEY = "panda-hvac-saved-projects";
const CURRENT_PROPOSAL_STORAGE_KEY = "panda-hvac-current-proposal";

const readCurrentProposalSnapshot = (): SavedProposalSnapshot | null => {
  if (typeof window === "undefined") return null;

  const proposalJson = window.localStorage.getItem(CURRENT_PROPOSAL_STORAGE_KEY);
  if (!proposalJson) return null;

  try {
    return JSON.parse(proposalJson) as SavedProposalSnapshot;
  } catch {
    return null;
  }
};

const ProjectMilestoneSync = ({
  reportPreview,
  reportExportCount,
}: {
  reportPreview: BlueprintTechnicianReport | null;
  reportExportCount: number;
}) => {
  const { dispatchEngineAction } = useProjectEngine();

  useEffect(() => {
    if (!reportPreview) return;
    dispatchEngineAction({ type: "MARK_REPORT_GENERATED" });
  }, [reportPreview?.generatedAt, dispatchEngineAction]);

  useEffect(() => {
    if (reportExportCount <= 0) return;
    dispatchEngineAction({ type: "MARK_REPORT_EXPORTED" });
  }, [reportExportCount, dispatchEngineAction]);

  useEffect(() => {
    const markConfirmedProposal = () => {
      const proposalSnapshot = readCurrentProposalSnapshot();
      if (!proposalSnapshot?.proposalConfirmed) return;
      dispatchEngineAction({ type: "MARK_PROPOSAL_GENERATED" });
    };

    markConfirmedProposal();
    window.addEventListener("focus", markConfirmedProposal);
    window.addEventListener("storage", markConfirmedProposal);
    return () => {
      window.removeEventListener("focus", markConfirmedProposal);
      window.removeEventListener("storage", markConfirmedProposal);
    };
  }, [dispatchEngineAction]);

  return null;
};

const ProjectEnginePersistenceBridge = ({
  engineStateRef,
  dispatchRef,
  pendingEvent,
  onPendingEventHandled,
}: {
  engineStateRef: MutableRefObject<ProjectEngineState | null>;
  dispatchRef: MutableRefObject<Dispatch<ProjectAction> | null>;
  pendingEvent: ProjectAction | null;
  onPendingEventHandled: () => void;
}) => {
  const { engineState, dispatchEngineAction } = useProjectEngine();

  useEffect(() => {
    engineStateRef.current = engineState;
    dispatchRef.current = dispatchEngineAction;
  }, [engineState, dispatchEngineAction, engineStateRef, dispatchRef]);

  useEffect(() => {
    if (!pendingEvent) return;
    dispatchEngineAction(pendingEvent);
    onPendingEventHandled();
  }, [pendingEvent, dispatchEngineAction, onPendingEventHandled]);

  return null;
};

const getSavedProjectDedupeKey = (project: SavedProject) =>
  `${project.name.trim().toLowerCase()}-${new Date(project.savedAt).toLocaleDateString()}`;

const dedupeSavedProjects = (projects: SavedProject[]) => {
  const newestProjectsByKey = new Map<string, SavedProject>();

  projects
    .slice()
    .sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime())
    .forEach((project) => {
      const projectKey = getSavedProjectDedupeKey(project);
      if (!newestProjectsByKey.has(projectKey)) {
        newestProjectsByKey.set(projectKey, project);
      }
    });

  return Array.from(newestProjectsByKey.values());
};

function getDetectedRoomStatusLabel(status: DetectedRoomWorkflowStatus) {
  if (status === "sent-to-manual-d") return "Sent to Manual D";
  if (status === "converted-to-trace") return "Converted to Trace";
  if (status === "confirmed") return "Confirmed";
  return "Needs Review";
}

function getDetectedRoomStatusStyle(status: DetectedRoomWorkflowStatus): React.CSSProperties {
  if (status === "sent-to-manual-d") {
    return { ...detectedRoomWorkflowBadgeStyle, ...detectedRoomSentBadgeStyle };
  }

  if (status === "confirmed" || status === "converted-to-trace") {
    return { ...detectedRoomWorkflowBadgeStyle, ...detectedRoomConfirmedBadgeStyle };
  }

  return { ...detectedRoomWorkflowBadgeStyle, ...detectedRoomReviewBadgeStyle };
}

const calculateBlueprintPolygonSquareFeet = (
  points: Array<{ xPercent: number; yPercent: number }>,
  pixelsPerFoot: number | null,
  overlaySize?: { widthPx: number; heightPx: number }
) => {
  if (points.length < 3 || !pixelsPerFoot || pixelsPerFoot <= 0 || !overlaySize) return null;

  const pixelPoints = points.map((point) => ({
    x: (point.xPercent / 100) * overlaySize.widthPx,
    y: (point.yPercent / 100) * overlaySize.heightPx,
  }));

  const pixelArea = Math.abs(
    pixelPoints.reduce((sum, point, index) => {
      const nextPoint = pixelPoints[(index + 1) % pixelPoints.length];
      return sum + point.x * nextPoint.y - nextPoint.x * point.y;
    }, 0) / 2
  );

  return pixelArea / pixelsPerFoot ** 2;
};

const getBlueprintTraceCalibrationStatusText = (
  calibrationStatus: "uncalibrated" | "calibrating" | "ready" | "calibrated"
) => {
  if (calibrationStatus === "calibrated") return "Confirmed calibration";
  if (calibrationStatus === "ready") return "Ready but not confirmed calibration";
  return "No calibration";
};

const formatFieldMeasurementFeet = (feetValue: number) => {
  const wholeFeet = Math.floor(feetValue);
  let inches = Math.round((feetValue - wholeFeet) * 12);
  const adjustedFeet = inches === 12 ? wholeFeet + 1 : wholeFeet;
  inches = inches === 12 ? 0 : inches;

  return inches > 0 ? `${adjustedFeet}' ${inches}"` : `${adjustedFeet}'`;
};

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

/**
 * ProjectIssuesBadge:
 * Fixed-position contextual badge for workflow issues.
 */
const mockEnvelopeSuggestions: BlueprintEnvelopeSuggestions = {
  atticRValue: { value: 49, confidence: 0.92, sourceNote: "Table 4.1 in blueprint notes" },
  wallRValue: { value: 21, confidence: 0.85, sourceNote: "Exterior wall section detail" },
  floorRValue: { value: 30, confidence: 0.88, sourceNote: "Crawlspace insulation specs" },
  windowUFactor: { value: 0.28, confidence: 0.95, sourceNote: "Window schedule page 3" },
  windowSHGC: { value: 0.25, confidence: 0.95, sourceNote: "Window schedule page 3" },
  infiltrationACH50: { value: 3.5, confidence: 0.75, sourceNote: "Construction notes - blower door target" },
  constructionNotes: ["Advanced framing used", "Low-E coatings specified", "Continuous exterior insulation"],
};

const ProjectIssuesBadge = ({ onClick }: { onClick: () => void }) => {
  const { engineState, readiness } = useProjectEngine();
  const { blockers, warnings } = readiness;
  const { dirtyFlags, project } = engineState;

  const issueCount = blockers.length + warnings.length + (dirtyFlags.length > 0 ? 1 : 0);
  
  if (issueCount === 0 && project.calibration.status === "calibrated" && project.tracedRooms.length > 0) {
    return null;
  }

  let label = `${issueCount} Workflow Issues`;
  let color = "#fbbf24"; // warning gold
  let bg = "rgba(212, 175, 55, 0.12)";
  let border = "1px solid rgba(212, 175, 55, 0.25)";

  if (blockers.length > 0) {
    label = blockers[0].length > 25 ? "Workflow Blocked" : blockers[0];
    color = "#f87171"; // critical red
    bg = "rgba(127, 29, 29, 0.2)";
    border = "1px solid rgba(248, 113, 113, 0.3)";
  } else if (project.calibration.status === "uncalibrated") {
    label = "Calibration Required";
    color = "#f87171";
    bg = "rgba(127, 29, 29, 0.2)";
    border = "1px solid rgba(248, 113, 113, 0.3)";
  } else if (dirtyFlags.length > 0) {
    if (dirtyFlags.includes("MANUAL_J")) label = "Manual J Outdated";
    else if (dirtyFlags.includes("REPORT")) label = "Export Requires Refresh";
    else label = "Calculations Stale";
  }

  return (
    <button
      onClick={onClick}
      style={{
        position: "fixed",
        bottom: "24px",
        left: "24px",
        zIndex: 9998,
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "10px 16px",
        borderRadius: "12px",
        background: bg,
        backdropFilter: "blur(12px)",
        border: border,
        color: color,
        fontSize: "12px",
        fontWeight: 900,
        letterSpacing: "0.02em",
        cursor: "pointer",
        boxShadow: "0 12px 30px rgba(0,0,0,0.4)",
        transition: "all 0.2s ease"
      }}
    >
      <AlertTriangle size={16} color={color} />
      {label}
    </button>
  );
};

export default function LoadCalculator({ onResultChange }: { onResultChange?: (result: ManualJResults) => void }) {
  const blueprintFileInputRef = useRef<HTMLInputElement | null>(null);
  const blueprintPreviewRef = useRef<HTMLDivElement | null>(null);
  const blueprintViewportRef = useRef<HTMLDivElement | null>(null);
  const blueprintOverlayRef = useRef<HTMLDivElement | null>(null);
  const blueprintImageRef = useRef<HTMLImageElement | null>(null);

  const detectedRoomsRef = useRef<HTMLDivElement | null>(null);
  const manualTakeoffRef = useRef<HTMLDivElement | null>(null);
  const suppressNextBlueprintOverlayClickRef = useRef(false);
  const isBlueprintTraceFocusForcedRef = useRef(false);
  const draftTracePointRefs = useRef<Array<HTMLSpanElement | null>>([]);

  const [activeLoadView, setActiveLoadView] = useState<LoadCalculatorView>("customer");
  const [activeTechnicianSection, setActiveTechnicianSection] = useState<TechnicianSection>("manual-d");
  const [squareFeet, setSquareFeet] = useState("0");
  const [ceilingHeight, setCeilingHeight] = useState("9");
  const [insulationQuality, setInsulationQuality] = useState("Average");
  const [isEnvelopeVerified, setIsEnvelopeVerified] = useState(false);
  const [atticRValue, setAtticRValue] = useState("38");
  const [wallRValue, setWallRValue] = useState("13");
  const [floorRValue, setFloorRValue] = useState("19");
  const [windowUFactor, setWindowUFactor] = useState("0.30");
  const [windowSHGC, setWindowSHGC] = useState("0.30");
  const [infiltrationACH50, setInfiltrationACH50] = useState("5.0");
  const [envelopeSuggestions, setEnvelopeSuggestions] = useState<BlueprintEnvelopeSuggestions | undefined>(undefined);
  const [windowCount, setWindowCount] = useState("0");
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
  const [blueprintFileName, setBlueprintFileName] = useState("");
  const [blueprintFile, setBlueprintFile] = useState<File | null>(null);
  const [blueprintDocument, setBlueprintDocument] = useState<BlueprintDocument | null>(null);
  const [blueprintPreviewUrl, setBlueprintPreviewUrl] = useState("");
  const [blueprintZoom, setBlueprintZoom] = useState(1);
  const [blueprintOverlaySize, setBlueprintOverlaySize] = useState({ widthPx: 0, heightPx: 0 });
  const [blueprintCalibration, setBlueprintCalibration] = useState(createDefaultBlueprintCalibrationState);
  const [blueprintRoomTrace, setBlueprintRoomTrace] = useState(createDefaultBlueprintRoomTraceState);
  const [draggingTracePointIndex, setDraggingTracePointIndex] = useState<number | null>(null);
  const [selectedTracePointIndex, setSelectedTracePointIndex] = useState<number | null>(null);
  const [lastNudgeTime, setLastNudgeTime] = useState<number>(0);
  const [blueprintWorkspaceMode, setBlueprintWorkspaceMode] =
    useState<BlueprintWorkspaceMode>("manual-trace");
  const [isVerificationMode, setIsVerificationMode] = useState(false);
  const [blueprintDetectionPipeline, setBlueprintDetectionPipeline] =
    useState<BlueprintDetectionPipeline>({
      mode: "preview",
      status: "mock",
      sourceFileName: "",
      rooms: [],
    });
  const [selectedDetectedRoomId, setSelectedDetectedRoomId] = useState<string | null>(null);
  const [selectedBlueprintBoundaryEdge, setSelectedBlueprintBoundaryEdge] =
    useState<SelectedBlueprintBoundaryEdge | null>(null);
  const [detectedRoomActionMessage, setDetectedRoomActionMessage] = useState("");
  const [blueprintRoomsForManualD, setBlueprintRoomsForManualD] = useState<ManualDBlueprintRoom[]>([]);
  const [savedProjects, setSavedProjects] = useState<SavedProject[]>([]);
  const [manualDProjectState, setManualDProjectState] = useState<ManualDProjectState | null>(null);
  const [loadedManualDProjectState, setLoadedManualDProjectState] = useState<ManualDProjectState | null>(null);
  const [projectActionMessage, setProjectActionMessage] = useState("");
  const [v3ProjectName, setV3ProjectName] = useState("New Blueprint Project");
  const [v3SaveStatus, setV3SaveStatus] = useState("");
  const [v3RecentProjects, setV3RecentProjects] = useState<BlueprintProject[]>([]);
  const [activeV3ProjectId, setActiveV3ProjectId] = useState<string | null>(null);
  const [activeViewLabel, setActiveViewLabel] = useState<"full" | "focus">("full");
  const [calibrationFeet, setCalibrationFeet] = useState("12");
  const [calibrationInches, setCalibrationInches] = useState("0");
  const [calibrationFraction, setCalibrationFraction] = useState("0");
  const [isBlueprintFocusMode, setIsBlueprintFocusMode] = useState(false);
  const [isFocusAreaMode, setIsFocusAreaMode] = useState(false);
  const [activeFocusArea, setActiveFocusArea] = useState<{ x: number, y: number, width: number, height: number } | null>(null);
  const [focusAreaStartPoint, setFocusAreaStartPoint] = useState<{ x: number, y: number } | null>(null);
  const [isBlueprintRestoring, setIsBlueprintRestoring] = useState(false);
  const [pendingV3Rooms, setPendingV3Rooms] = useState<BlueprintRoomOutline[] | null>(null);
  const [v3ReportPreview, setV3ReportPreview] = useState<BlueprintTechnicianReport | null>(null);
  const [reportExportCount, setReportExportCount] = useState(0);
  const [isIssuesDrawerOpen, setIsIssuesDrawerOpen] = useState(false);
  const [isLeftPanelExpanded, setIsLeftPanelExpanded] = useState(false);
  const [isRightPanelExpanded, setIsRightPanelExpanded] = useState(false);
  const [loadedEngineMetadata, setLoadedEngineMetadata] = useState<ProjectEngineMetadata | undefined>(undefined);
  const [pendingEngineEvent, setPendingEngineEvent] = useState<ProjectAction | null>(null);
  const projectEngineStateRef = useRef<ProjectEngineState | null>(null);
  const dispatchProjectEngineActionRef = useRef<Dispatch<ProjectAction> | null>(null);

  const prepareCurrentEngineMetadataForSave = (
    eventType: Extract<ProjectTimelineEventType, "PROJECT_SAVED" | "AUTOSAVE_COMPLETED">
  ) => {
    const engineState = projectEngineStateRef.current;
    if (!engineState) {
      return { metadata: undefined };
    }

    const prepared = prepareEngineStateForSave(engineState, eventType);
    projectEngineStateRef.current = prepared.engineState;
    return prepared;
  };

  const syncPreparedEngineSaveEvent = (
    prepared: ReturnType<typeof prepareCurrentEngineMetadataForSave>
  ) => {
    if (!("appendedEvent" in prepared) || !prepared.appendedEvent) return;
    dispatchProjectEngineActionRef.current?.({
      type: "ADD_TIMELINE_EVENT",
      event: prepared.appendedEvent,
    });
  };

  useEffect(() => {
    if (selectedTracePointIndex === null) return;
    const el = draftTracePointRefs.current[selectedTracePointIndex];
    if (el && document.activeElement !== el) {
      el.focus({ preventScroll: true });
    }
  }, [selectedTracePointIndex, blueprintRoomTrace.draftPoints]);

  useEffect(() => {
    setV3RecentProjects(listBlueprintProjectsFromLocalStorage());
  }, []);

  const handlePreviewV3Report = () => {
    const project = createBlueprintProjectSnapshot({
      name: v3ProjectName,
      blueprintImage: blueprintFile ? {
        name: blueprintFile.name,
        size: blueprintFile.size,
        type: blueprintFile.type,
        lastModified: blueprintFile.lastModified,
      } : null,
      calibration: blueprintCalibration,
      tracedRooms: blueprintRoomTrace.roomOutlines,
      envelopeSettings: {
        insulationQuality,
        oregonRegion,
        isVerified: isEnvelopeVerified,
        verifiedInsulation: {
          atticRValue: parseFloat(atticRValue),
          wallRValue: parseFloat(wallRValue),
          floorRValue: parseFloat(floorRValue),
        },
        verifiedWindows: {
          uFactor: parseFloat(windowUFactor),
          shgc: parseFloat(windowSHGC),
        },
        verifiedInfiltration: {
          ach50: parseFloat(infiltrationACH50),
        },
      },
      envelopeSuggestions: envelopeSuggestions,
      manualDProjectState,
    });

    const report = createBlueprintTechnicianReport(project);
    setV3ReportPreview(report);
  };

  const handlePrintReport = () => {
    setReportExportCount((count) => count + 1);
    window.print();
  };

  const isBlueprintWorkspaceActive =
    activeLoadView === "technician" && activeTechnicianSection === "manual-room-takeoff";

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
  const detectedBlueprintRooms = blueprintDetectionPipeline.rooms;

  useEffect(() => {
    const savedProjectJson = window.localStorage.getItem(SAVED_PROJECTS_STORAGE_KEY);
    if (!savedProjectJson) return;

    try {
      const parsedProjects = JSON.parse(savedProjectJson) as SavedProject[];
      if (Array.isArray(parsedProjects)) {
        const dedupedProjects = dedupeSavedProjects(parsedProjects);
        setSavedProjects(dedupedProjects);
        window.localStorage.setItem(SAVED_PROJECTS_STORAGE_KEY, JSON.stringify(dedupedProjects));
      }
    } catch {
      setSavedProjects([]);
    }
  }, []);

  useEffect(() => {
    if (!blueprintFile || !blueprintFile.type.startsWith("image/")) {
      // Do not clear previewUrl if it's a PDF (processed async)
      const isPdf = blueprintFile?.type === "application/pdf" || blueprintFile?.name.toLowerCase().endsWith(".pdf");
      if (!isPdf) {
        setBlueprintPreviewUrl("");
      }
      return;
    }

    const previewUrl = window.URL.createObjectURL(blueprintFile);
    setBlueprintPreviewUrl(previewUrl);

    return () => {
      window.URL.revokeObjectURL(previewUrl);
    };
  }, [blueprintFile]);

  useEffect(() => {
    const overlay = blueprintOverlayRef.current;
    if (!overlay) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setBlueprintOverlaySize({
          widthPx: entry.contentRect.width,
          heightPx: entry.contentRect.height,
        });
      }
    });

    observer.observe(overlay);
    return () => observer.disconnect();
  }, [blueprintFile]);

  const getCurrentProposalSnapshot = (): SavedProposalSnapshot | null => {
    return readCurrentProposalSnapshot();
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
      blueprintFileName,
      blueprintRoomsForManualD,
    });

  const handleSaveProject = () => {
    try {
      const preparedEngineSave = prepareCurrentEngineMetadataForSave("PROJECT_SAVED");
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
        engineMetadata: preparedEngineSave.metadata,
      };

      setSavedProjects((currentProjects) => {
        const nextProjects = dedupeSavedProjects([nextProject, ...currentProjects]);
        window.localStorage.setItem(SAVED_PROJECTS_STORAGE_KEY, JSON.stringify(nextProjects));
        console.log("Project saved", nextProject);
        return nextProjects;
      });
      syncPreparedEngineSaveEvent(preparedEngineSave);
      setProjectActionMessage("Project saved");
    } catch (error) {
      console.error("Project save failed", error);
      setProjectActionMessage("Project save failed");
    }
  };

  const handleV3SaveProject = () => {
    try {
      const preparedEngineSave = prepareCurrentEngineMetadataForSave("PROJECT_SAVED");
      
      // Sync current active root-level state into the multi-page document container
      let updatedDocument = blueprintDocument;
      if (updatedDocument && updatedDocument.activePageId) {
        updatedDocument = {
          ...updatedDocument,
          pages: updatedDocument.pages.map(page => 
            page.id === updatedDocument?.activePageId 
              ? { 
                  ...page, 
                  calibration: blueprintCalibration, 
                  tracedRooms: blueprintRoomTrace.roomOutlines,
                  focusArea: activeFocusArea || undefined,
                }
              : page
          )
        };
      }

      const input = {
        name: v3ProjectName,
        blueprintImage: blueprintFile
          ? {
              name: blueprintFile.name,
              size: blueprintFile.size,
              type: blueprintFile.type,
              lastModified: blueprintFile.lastModified,
              dataUrl: blueprintPreviewUrl,
            }
          : null,
        blueprintDocument: updatedDocument,
        blueprintOverlaySize: blueprintOverlaySize,
        calibration: blueprintCalibration,
        tracedRooms: blueprintRoomTrace.roomOutlines,
        envelopeSettings: {
          insulationQuality,
          oregonRegion,
          isVerified: isEnvelopeVerified,
          verifiedInsulation: {
            atticRValue: parseFloat(atticRValue),
            wallRValue: parseFloat(wallRValue),
            floorRValue: parseFloat(floorRValue),
          },
          verifiedWindows: {
            uFactor: parseFloat(windowUFactor),
            shgc: parseFloat(windowSHGC),
          },
          verifiedInfiltration: {
            ach50: parseFloat(infiltrationACH50),
          },
        },
        envelopeSuggestions: envelopeSuggestions,
        manualDProjectState,
        engineMetadata: preparedEngineSave.metadata,
      };

      let snapshot: BlueprintProject;
      if (activeV3ProjectId) {
        const existing = loadBlueprintProjectFromLocalStorage(activeV3ProjectId);
        if (existing) {
          snapshot = updateBlueprintProjectSnapshot(existing, input);
        } else {
          snapshot = createBlueprintProjectSnapshot(input);
        }
      } else {
        snapshot = createBlueprintProjectSnapshot(input);
      }

      saveBlueprintProjectToLocalStorage(snapshot);
      syncPreparedEngineSaveEvent(preparedEngineSave);
      setActiveV3ProjectId(snapshot.id);
      setLoadedEngineMetadata(snapshot.engineMetadata);
      setV3RecentProjects(listBlueprintProjectsFromLocalStorage());
      setV3SaveStatus("Project saved locally");
      window.setTimeout(() => setV3SaveStatus(""), 3000);
    } catch (error) {
      console.error("V3 Project save failed", error);
      setV3SaveStatus("Save failed");
    }
  };

  const handleLoadV3Project = async (projectId: string) => {
    try {
      let project = loadBlueprintProjectFromLocalStorage(projectId);
      if (!project) {
        setV3SaveStatus("Project not found");
        return;
      }

      // Promote legacy projects to BlueprintDocument model
      project = ensureBlueprintDocument(project);

      setActiveV3ProjectId(project.id);
      setLoadedEngineMetadata(project.engineMetadata);
      setV3ProjectName(project.name);

      // Load document container
      setBlueprintDocument(project.blueprintDocument || null);

      // Hydrate overlay size for area calculation stability
      if (project.blueprintOverlaySize) {
        setBlueprintOverlaySize(project.blueprintOverlaySize);
      }

      // Hydrate root-level active state from the active page (or fall back to root)
      const activePage = project.blueprintDocument?.pages.find(p => p.id === project.blueprintDocument?.activePageId);

      setBlueprintCalibration(activePage?.calibration || project.calibration);
      setActiveFocusArea(activePage?.focusArea || null);
      if (project.blueprintDocument?.assetId) {
        // PDF-backed project: Hydrate visually from IndexedDB
        try {
          setProjectActionMessage("Loading PDF asset...");
          const asset = await getBlueprintAsset(project.blueprintDocument.assetId);
          if (asset) {
            const pdf = await loadPDFDocument(asset.blob);
            const pageIndex = project.blueprintDocument.pages.findIndex(p => p.id === project.blueprintDocument?.activePageId);
            // Render the saved active page
            const dataUrl = await renderPDFPageToDataURL(pdf, Math.max(1, pageIndex + 1));

            setIsBlueprintRestoring(true);
            setPendingV3Rooms(activePage?.tracedRooms || project.tracedRooms);
            setBlueprintPreviewUrl(dataUrl);
            setBlueprintFileName(project.blueprintImage?.name || project.name);
            setProjectActionMessage(`PDF project loaded (page ${pageIndex + 1})`);
          } else {
            setProjectActionMessage("PDF source file is missing. Re-upload the blueprint set.");
          }
        } catch (e) {
          console.error("Failed to hydrate PDF project:", e);
          setProjectActionMessage("Failed to load PDF blueprint.");
        }
      } else if (project.blueprintImage?.dataUrl) {
        // Standard image-backed project
        setIsBlueprintRestoring(true);
        setPendingV3Rooms(activePage?.tracedRooms || project.tracedRooms);
        setBlueprintPreviewUrl(project.blueprintImage.dataUrl);
        setBlueprintFileName(project.blueprintImage.name);
      } else {
        setBlueprintRoomTrace((currentTrace) => ({
          ...currentTrace,
          roomOutlines: activePage?.tracedRooms || project.tracedRooms,
        }));
      }

      setInsulationQuality(project.envelopeSettings.insulationQuality);
      setOregonRegion(project.envelopeSettings.oregonRegion);

      if (project.manualDProjectState) {
        setLoadedManualDProjectState(project.manualDProjectState);
      }

      setV3SaveStatus("Project loaded");
      setPendingEngineEvent({ type: "MARK_PROJECT_LOADED" });
      window.setTimeout(() => setV3SaveStatus(""), 3000);
    } catch (error) {
      console.error("V3 Project load failed", error);
      setV3SaveStatus("Load failed");
    }
  };
  useEffect(() => {
    if (!activeV3ProjectId) return;

    const timer = window.setTimeout(() => {
      try {
        const existing = loadBlueprintProjectFromLocalStorage(activeV3ProjectId);
        if (!existing) return;
        const preparedEngineSave = prepareCurrentEngineMetadataForSave("AUTOSAVE_COMPLETED");

        // Sync current active root-level state into the multi-page document container
        let updatedDocument = blueprintDocument;
        if (updatedDocument && updatedDocument.activePageId) {
          updatedDocument = {
            ...updatedDocument,
            pages: updatedDocument.pages.map(page => 
              page.id === updatedDocument?.activePageId 
                ? { 
                    ...page, 
                    calibration: blueprintCalibration, 
                    tracedRooms: blueprintRoomTrace.roomOutlines,
                    focusArea: activeFocusArea || undefined,
                  }
                : page
            )
          };
        }

        const snapshot = updateBlueprintProjectSnapshot(existing, {
          name: v3ProjectName,
          blueprintImage: blueprintFile
            ? {
                name: blueprintFile.name,
                size: blueprintFile.size,
                type: blueprintFile.type,
                lastModified: blueprintFile.lastModified,
                dataUrl: blueprintPreviewUrl,
              }
            : null,
          blueprintDocument: updatedDocument,
          blueprintOverlaySize: blueprintOverlaySize,
          calibration: blueprintCalibration,
          tracedRooms: blueprintRoomTrace.roomOutlines,
          envelopeSettings: {
            insulationQuality,
            oregonRegion,
            isVerified: isEnvelopeVerified,
            verifiedInsulation: {
              atticRValue: parseFloat(atticRValue),
              wallRValue: parseFloat(wallRValue),
              floorRValue: parseFloat(floorRValue),
            },
            verifiedWindows: {
              uFactor: parseFloat(windowUFactor),
              shgc: parseFloat(windowSHGC),
            },
            verifiedInfiltration: {
              ach50: parseFloat(infiltrationACH50),
            },
          },
          envelopeSuggestions: envelopeSuggestions,
          manualDProjectState,
          engineMetadata: preparedEngineSave.metadata,
        });

        saveBlueprintProjectToLocalStorage(snapshot);
        syncPreparedEngineSaveEvent(preparedEngineSave);
        setV3RecentProjects(listBlueprintProjectsFromLocalStorage());
        setV3SaveStatus("Autosaved");
        window.setTimeout(() => setV3SaveStatus(""), 2000);
      } catch (error) {
        console.error("Autosave failed", error);
      }
    }, 2000);

    return () => window.clearTimeout(timer);
  }, [
    activeV3ProjectId,
    v3ProjectName,
    blueprintFile,
    blueprintPreviewUrl,
    blueprintCalibration,
    blueprintRoomTrace.roomOutlines,
    insulationQuality,
    oregonRegion,
    manualDProjectState,
  ]);

  const handleLoadProject = (project: SavedProject) => {
    try {
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
      setBlueprintFileName(project.loadCalculator.blueprintFileName ?? "");
      setBlueprintFile(null);
      setBlueprintZoom(1);
      setBlueprintRoomsForManualD(
        project.loadCalculator.blueprintRoomsForManualD.map((room) => ({ ...room }))
      );

      const restoredManualDProjectState = project.manualD
        ? {
            settings: { ...project.manualD.settings },
            rooms: project.manualD.rooms.map((room) => ({ ...room })),
          }
        : null;

      setLoadedManualDProjectState(restoredManualDProjectState);
      setManualDProjectState(restoredManualDProjectState);

      if (project.proposalSelection) {
        window.localStorage.setItem(CURRENT_PROPOSAL_STORAGE_KEY, JSON.stringify(project.proposalSelection));
      } else {
        window.localStorage.removeItem(CURRENT_PROPOSAL_STORAGE_KEY);
      }

      console.log("Project loaded", project);
      setProjectActionMessage("Project loaded");
    } catch (error) {
      console.error("Project load failed", error);
      setProjectActionMessage("Project load failed");
    }
  };

  const handleDeleteProject = (projectId: string) => {
    const projectToDelete = savedProjects.find((p) => p.id === projectId);
    const projectName = projectToDelete?.name || "this project";

    if (
      !window.confirm(
        `Are you sure you want to permanently delete project "${projectName}"? This action cannot be undone.`
      )
    ) {
      return;
    }

    setSavedProjects((currentProjects) => {
      const nextProjects = currentProjects.filter((project) => project.id !== projectId);
      window.localStorage.setItem(SAVED_PROJECTS_STORAGE_KEY, JSON.stringify(nextProjects));
      return nextProjects;
    });
    setProjectActionMessage("Project deleted");
  };

  const addBlueprintRoomToManualD = () => {
    const calculatedSquareFeet = Math.round(blueprintSquareFeet);
    if (calculatedSquareFeet <= 0) return;

    setBlueprintRoomsForManualD((currentRooms) => [
      ...currentRooms,
      adaptManualFallbackRoomToManualDBlueprintRoom({
        id: `blueprint-room-${Date.now()}-${currentRooms.length + 1}`,
        name: blueprintRoomName,
        squareFeet: calculatedSquareFeet,
        ceilingHeight: blueprintCeilingHeight,
        floorLevel: blueprintFloorLevel,
      }),
    ]);
  };

  const handleBlueprintFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    const isPdf = selectedFile.type === "application/pdf" || selectedFile.name.toLowerCase().endsWith(".pdf");

    const hasWork = blueprintCalibration.status !== "uncalibrated" || blueprintRoomTrace.roomOutlines.length > 0;
    if (
      hasWork &&
      !window.confirm(
        "Uploading a new blueprint will clear the current calibration and all verified room traces for this project. Do you want to continue?"
      )
    ) {
      event.target.value = "";
      return;
    }

    setBlueprintFile(selectedFile ?? null);
    setBlueprintFileName(selectedFile?.name ?? "");
    setBlueprintZoom(1);
    setBlueprintCalibration(createDefaultBlueprintCalibrationState());
    setBlueprintRoomTrace(createDefaultBlueprintRoomTraceState());
    setBlueprintWorkspaceMode("manual-trace");
    setSelectedDetectedRoomId(null);
    setSelectedBlueprintBoundaryEdge(null);
    setBlueprintDetectionPipeline({
      mode: "preview",
      status: "mock",
      sourceFileName: selectedFile?.name ?? "",
      rooms: [],
    });
    
    if (isPdf) {
      try {
        setProjectActionMessage("Processing PDF plan set...");
        const assetId = `pdf-${Date.now()}`;
        
        await saveBlueprintAsset(assetId, selectedFile, {
          name: selectedFile.name,
          type: selectedFile.type,
          size: selectedFile.size,
          createdAt: new Date().toISOString(),
        });

        const pdf = await loadPDFDocument(selectedFile);
        const totalPages = pdf.numPages;
        
        const pages: BlueprintPage[] = [];
        for (let i = 1; i <= totalPages; i++) {
          pages.push({
            id: `page-${Date.now()}-${i}`,
            pageNumber: i,
            label: `Page ${i}`,
            sheetType: "unknown",
            calibration: createDefaultBlueprintCalibrationState(),
            tracedRooms: [],
          });
        }

        const doc: BlueprintDocument = {
          id: `doc-${Date.now()}`,
          name: selectedFile.name,
          assetId,
          pages,
          activePageId: pages[0].id,
        };

        setBlueprintDocument(doc);
        
        // Render Page 1
        const dataUrl = await renderPDFPageToDataURL(pdf, 1);
        setBlueprintPreviewUrl(dataUrl);
        setProjectActionMessage(`PDF blueprint set loaded: ${totalPages} pages, viewing page 1`);
        setDetectedRoomActionMessage("PDF uploaded. Viewing Page 1. Trace manually or run auto-detect preview.");
      } catch (error) {
        console.error("PDF processing failed:", error);
        setProjectActionMessage("Failed to process PDF blueprint.");
      }
    } else {
      // Initialize one-page BlueprintDocument for single-image uploads
      const newPage: BlueprintPage = {
        id: `page-${Date.now()}-0`,
        pageNumber: 1,
        label: "Sheet 1",
        sheetType: "floor-plan",
        image: {
          name: selectedFile.name,
          mimeType: selectedFile.type,
        },
        calibration: createDefaultBlueprintCalibrationState(),
        tracedRooms: [],
      };

      setBlueprintDocument({
        id: `doc-${Date.now()}`,
        name: selectedFile.name,
        pages: [newPage],
        activePageId: newPage.id,
      });
      setProjectActionMessage("Image blueprint loaded.");
      setDetectedRoomActionMessage("Blueprint uploaded. Trace manually or run auto-detect preview.");
    }
  };

  const runBlueprintAutoDetectPreview = () => {
    const detectedRooms = detectRoomsFromBlueprint(blueprintFile ?? undefined);

    setBlueprintWorkspaceMode("review-detected");
    setSelectedDetectedRoomId(null);
    setSelectedBlueprintBoundaryEdge(null);
    setBlueprintRoomTrace((currentTrace) => cancelBlueprintRoomTrace(currentTrace));
    setBlueprintDetectionPipeline({
      mode: "preview",
      status: "mock",
      sourceFileName: blueprintFileName,
      rooms: detectedRooms,
    });
    setDetectedRoomActionMessage("Auto-detect preview loaded. Trace and confirm rooms manually for field accuracy.");
  };

  const renameDetectedRoom = (roomId: string, name: string) => {
    setSelectedDetectedRoomId(roomId);
    setBlueprintDetectionPipeline((currentPipeline) => ({
      ...currentPipeline,
      rooms: currentPipeline.rooms.map((room) =>
        room.id === roomId ? { ...room, name } : room
      ),
    }));
  };

  const updateDetectedRoom = (
    roomId: string,
    field: DetectedRoomEditableField,
    value: string
  ) => {
    setSelectedDetectedRoomId(roomId);
    setBlueprintDetectionPipeline((currentPipeline) => ({
      ...currentPipeline,
      rooms: currentPipeline.rooms.map((room) => {
        if (room.id !== roomId) return room;

        if (field === "squareFeet") {
          return {
            ...room,
            squareFeet: Math.max(0, Math.round(Number(value) || 0)),
          };
        }

        return { ...room, [field]: value };
      }),
    }));
  };

  const confirmDetectedRoom = (roomId: string) => {
    setSelectedDetectedRoomId(roomId);
    setBlueprintDetectionPipeline((currentPipeline) => ({
      ...currentPipeline,
      rooms: currentPipeline.rooms.map((room) =>
        room.id === roomId
          ? { ...room, confirmed: true, workflowStatus: "confirmed" }
          : room
      ),
    }));
    setDetectedRoomActionMessage("Room confirmed");
  };

  const removeDetectedRoom = (roomId: string) => {
    setSelectedDetectedRoomId((currentRoomId) => (currentRoomId === roomId ? null : currentRoomId));
    setBlueprintDetectionPipeline((currentPipeline) => ({
      ...currentPipeline,
      rooms: currentPipeline.rooms.filter((room) => room.id !== roomId),
    }));
    setDetectedRoomActionMessage("Room removed");
  };

  const useDetectedRoomAsTrace = (room: DetectedBlueprintRoom) => {
    const leftPercent = room.overlay.leftPercent;
    const topPercent = room.overlay.topPercent;
    const rightPercent = Math.min(100, leftPercent + room.overlay.widthPercent);
    const bottomPercent = Math.min(100, topPercent + room.overlay.heightPercent);

    setBlueprintWorkspaceMode("manual-trace");
    setSelectedDetectedRoomId(room.id);
    setBlueprintRoomTrace((currentTrace) =>
      startBlueprintRoomTraceFromPoints(currentTrace, [
        { xPercent: leftPercent, yPercent: topPercent },
        { xPercent: rightPercent, yPercent: topPercent },
        { xPercent: rightPercent, yPercent: bottomPercent },
        { xPercent: leftPercent, yPercent: bottomPercent },
      ])
    );
    setBlueprintDetectionPipeline((currentPipeline) => ({
      ...currentPipeline,
      rooms: currentPipeline.rooms.map((currentRoom) =>
        currentRoom.id === room.id
          ? { ...currentRoom, confirmed: true, workflowStatus: "converted-to-trace" }
          : currentRoom
      ),
    }));
    setDetectedRoomActionMessage("Detected room converted to editable trace. Adjust points, then finish the outline.");
  };

  const sendDetectedRoomToManualD = (room: DetectedBlueprintRoom) => {
    setBlueprintRoomsForManualD((currentRooms) => [
      ...currentRooms,
      adaptDetectedRoomToManualDBlueprintRoom({
        detectedRoom: room,
        outputId: `detected-${room.id}-${Date.now()}`,
        defaultCeilingHeight: blueprintCeilingHeight,
        defaultFloorLevel: blueprintFloorLevel,
      }),
    ]);
    setSelectedDetectedRoomId(room.id);
    setBlueprintDetectionPipeline((currentPipeline) => ({
      ...currentPipeline,
      rooms: currentPipeline.rooms.map((currentRoom) =>
        currentRoom.id === room.id
          ? { ...currentRoom, confirmed: true, workflowStatus: "sent-to-manual-d" }
          : currentRoom
      ),
    }));
    setDetectedRoomActionMessage("Added to Manual D");
  };

  const focusDetectedRoomName = (roomId: string) => {
    setSelectedDetectedRoomId(roomId);
    const roomNameInput = document.getElementById(`detected-room-name-${roomId}`);
    roomNameInput?.focus();
  };

  const selectDetectedRoomFromOverlay = (roomId: string) => {
    if (isTracingLock) {
      setProjectActionMessage("Selection locked during active trace.");
      return;
    }
    setSelectedDetectedRoomId(roomId);
    document
      .getElementById(`detected-room-card-${roomId}`)
      ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  const handlePageSwitch = async (targetPageIndex: number) => {
    if (isTracingLock) {
      setProjectActionMessage("Page navigation locked during active trace.");
      return;
    }
    if (!blueprintDocument) return;
    if (targetPageIndex < 0 || targetPageIndex >= blueprintDocument.pages.length) return;

    const currentPageId = blueprintDocument.activePageId;
    const targetPage = blueprintDocument.pages[targetPageIndex];

    // 1. Flush current active root state into the active page in the document container
    setBlueprintDocument((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        pages: prev.pages.map((page) =>
          page.id === currentPageId
            ? {
                ...page,
                calibration: blueprintCalibration,
                tracedRooms: blueprintRoomTrace.roomOutlines,
                focusArea: activeFocusArea || undefined,
              }
            : page
        ),
        activePageId: targetPage.id,
      };
    });

    // 2. Hydrate root-level state from the target page
    setBlueprintCalibration(targetPage.calibration || createDefaultBlueprintCalibrationState());
    setActiveFocusArea(targetPage.focusArea || null);
    setBlueprintRoomTrace((prev) => ({
      ...prev,
      roomOutlines: targetPage.tracedRooms || [],
      isTracing: false,
      draftPoints: [],
    }));

    // 3. Handle PDF rendering if applicable
    if (blueprintDocument.assetId) {
      try {
        setProjectActionMessage(`Rendering PDF page ${targetPageIndex + 1} of ${blueprintDocument.pages.length}...`);
        
        const asset = await getBlueprintAsset(blueprintDocument.assetId);
        if (!asset) {
          setProjectActionMessage("PDF source file is missing. Re-upload the blueprint set.");
          return;
        }

        const pdf = await loadPDFDocument(asset.blob);
        const dataUrl = await renderPDFPageToDataURL(pdf, targetPageIndex + 1);

        setBlueprintPreviewUrl(dataUrl);

        setProjectActionMessage(`PDF page ${targetPageIndex + 1} loaded.`);
        } catch (error) {
        console.error("Failed to render PDF page:", error);
        setProjectActionMessage("Failed to render PDF page.");
      }
    }

    setDetectedRoomActionMessage(`Switched to ${targetPage.label}`);
  };

  const handlePrevPage = () => {
    if (!blueprintDocument) return;
    const currentIndex = blueprintDocument.pages.findIndex((p) => p.id === blueprintDocument.activePageId);
    handlePageSwitch(currentIndex - 1);
  };

  const handleNextPage = () => {
    if (!blueprintDocument) return;
    const currentIndex = blueprintDocument.pages.findIndex((p) => p.id === blueprintDocument.activePageId);
    handlePageSwitch(currentIndex + 1);
  };

  const getCurrentBlueprintTraceFinishOptions = (
    draftPoints: Array<{ xPercent: number; yPercent: number }>
  ) => {
    return {
      squareFeet: calculateBlueprintPolygonSquareFeet(
        draftPoints,
        confirmedBlueprintPixelsPerFoot,
        blueprintOverlaySize.widthPx > 0 ? blueprintOverlaySize : undefined
      ),
      ceilingHeight: blueprintCeilingHeight,
      floorLevel: blueprintFloorLevel,
    };
  };

  const getBlueprintOverlayPointFromPointer = (
    event: React.PointerEvent<HTMLDivElement | HTMLSpanElement>
  ) => {
    const overlayElement = blueprintOverlayRef.current;
    const overlayBounds = overlayElement?.getBoundingClientRect();
    if (!overlayBounds) return null;

    return {
      xPercent: Math.min(
        100,
        Math.max(0, ((event.clientX - overlayBounds.left) / overlayBounds.width) * 100)
      ),
      yPercent: Math.min(
        100,
        Math.max(0, ((event.clientY - overlayBounds.top) / overlayBounds.height) * 100)
      ),
    };
  };

  const handleFocusAreaPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isFocusAreaMode) return;
    const point = getBlueprintOverlayPointFromPointer(event);
    if (!point) return;
    
    setFocusAreaStartPoint({ x: point.xPercent, y: point.yPercent });
    setActiveFocusArea({ x: point.xPercent, y: point.yPercent, width: 0, height: 0 });
    suppressNextBlueprintOverlayClickRef.current = true;
  };

  const handleFocusAreaPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isFocusAreaMode || !focusAreaStartPoint) return;
    const point = getBlueprintOverlayPointFromPointer(event);
    if (!point) return;

    const x = Math.min(focusAreaStartPoint.x, point.xPercent);
    const y = Math.min(focusAreaStartPoint.y, point.yPercent);
    const width = Math.abs(point.xPercent - focusAreaStartPoint.x);
    const height = Math.abs(point.yPercent - focusAreaStartPoint.y);

    setActiveFocusArea({ x, y, width, height });
  };

  const handleFocusAreaPointerUp = () => {
    if (!isFocusAreaMode || !focusAreaStartPoint) return;
    
    setFocusAreaStartPoint(null);
    setIsFocusAreaMode(false);
    setProjectActionMessage("Focus area saved.");
  };

  const moveDraggedBlueprintTracePoint = (event: React.PointerEvent<HTMLDivElement>) => {
    if (draggingTracePointIndex !== null) {
      const nextPoint = getBlueprintOverlayPointFromPointer(event);
      if (!nextPoint) return;

      setBlueprintRoomTrace((currentTrace) =>
        updateBlueprintRoomTracePoint(currentTrace, draggingTracePointIndex, nextPoint)
      );
    } else if (isFocusAreaMode && focusAreaStartPoint) {
      handleFocusAreaPointerMove(event);
    }
  };

  const finishDraggingBlueprintTracePoint = () => {
    if (isFocusAreaMode && focusAreaStartPoint) {
      handleFocusAreaPointerUp();
    }
    setDraggingTracePointIndex(null);
  };

  const selectBlueprintCalibrationPointFromPreview = (event: React.MouseEvent<HTMLDivElement>) => {
    if (suppressNextBlueprintOverlayClickRef.current) {
      suppressNextBlueprintOverlayClickRef.current = false;
      return;
    }

    if (draggingTracePointIndex !== null) return;
    if (isFocusAreaMode) return;

    const overlayBounds = event.currentTarget.getBoundingClientRect();
    let xPercent = Math.min(
      100,
      Math.max(0, ((event.clientX - overlayBounds.left) / overlayBounds.width) * 100)
    );
    let yPercent = Math.min(
      100,
      Math.max(0, ((event.clientY - overlayBounds.top) / overlayBounds.height) * 100)
    );

    if (blueprintRoomTrace.isTracing) {
      let tracePoint = { xPercent, yPercent };

      if (blueprintImageRef.current) {
        try {
          const img = blueprintImageRef.current;
          const naturalX = (xPercent / 100) * img.naturalWidth;
          const naturalY = (yPercent / 100) * img.naturalHeight;
          const existingPolygons = [
            ...blueprintRoomTrace.roomOutlines.map((o) => o.points),
          ];
          const snapRadius = (5 / overlayBounds.width) * img.naturalWidth;
          const snapped = findSnapPoint(img, naturalX, naturalY, snapRadius, existingPolygons);

          tracePoint = {
            xPercent: Math.min(100, Math.max(0, (snapped.x / img.naturalWidth) * 100)),
            yPercent: Math.min(100, Math.max(0, (snapped.y / img.naturalHeight) * 100)),
          };
        } catch {
          tracePoint = { xPercent, yPercent };
        }
      }

      setBlueprintRoomTrace((currentTrace) =>
        addBlueprintRoomTracePoint(
          currentTrace,
          tracePoint,
          {
            straightLineAssist: event.shiftKey,
            finishOptions: getCurrentBlueprintTraceFinishOptions([
              ...currentTrace.draftPoints,
              tracePoint,
            ]),
          }
        )
      );
      return;
    }

    if (isVerificationMode) {
      setBlueprintCalibration((currentCalibration) =>
        selectBlueprintVerificationPoint(currentCalibration, { xPercent, yPercent }, {
          widthPx: overlayBounds.width / blueprintZoom,
          heightPx: overlayBounds.height / blueprintZoom,
        })
      );
      return;
    }

    setBlueprintCalibration((currentCalibration) =>
      selectBlueprintCalibrationPoint(currentCalibration, { xPercent, yPercent }, {
        widthPx: overlayBounds.width / blueprintZoom,
        heightPx: overlayBounds.height / blueprintZoom,
      })
    );
    setBlueprintRoomTrace((currentTrace) => markBlueprintRoomOutlinesNeedRecalculation(currentTrace));
  };

  const startBlueprintRoomOutlineTrace = () => {
    setBlueprintWorkspaceMode("manual-trace");
    setSelectedBlueprintBoundaryEdge(null);
    setSelectedTracePointIndex(null);
    setBlueprintRoomTrace((currentTrace) => startBlueprintRoomTrace(currentTrace));
    
    // Only force focus mode if it's not already enabled, and track that we did it
    if (!isBlueprintFocusMode) {
      setIsBlueprintFocusMode(true);
      isBlueprintTraceFocusForcedRef.current = true;
    }
  };

  const finishBlueprintRoomOutlineTrace = () => {
    setSelectedTracePointIndex(null);
    setBlueprintRoomTrace((currentTrace) =>
      finishBlueprintRoomTrace(currentTrace, getCurrentBlueprintTraceFinishOptions(currentTrace.draftPoints))
    );
    
    // Only restore panels if we were the one who collapsed them
    if (isBlueprintTraceFocusForcedRef.current) {
      setIsBlueprintFocusMode(false);
      isBlueprintTraceFocusForcedRef.current = false;
    }
  };

  const undoLastBlueprintRoomTracePoint = () => {
    setBlueprintRoomTrace((currentTrace) => {
      const nextTrace = undoBlueprintRoomTracePoint(currentTrace);
      if (selectedTracePointIndex !== null && selectedTracePointIndex >= nextTrace.draftPoints.length) {
        setSelectedTracePointIndex(null);
      }
      return nextTrace;
    });
  };

  const cancelBlueprintRoomOutlineTrace = () => {
    setSelectedTracePointIndex(null);
    setBlueprintRoomTrace((currentTrace) => cancelBlueprintRoomTrace(currentTrace));
    
    // Only restore panels if we were the one who collapsed them
    if (isBlueprintTraceFocusForcedRef.current) {
      setIsBlueprintFocusMode(false);
      isBlueprintTraceFocusForcedRef.current = false;
    }
  };

  const recalibrateBlueprintScale = () => {
    const roomCount = blueprintRoomTrace.roomOutlines.length;
    const warningMessage = roomCount > 0
      ? `Are you sure you want to reset the blueprint scale? This will clear the calculated square footage for all ${roomCount} traced rooms. The room outlines and names will be preserved, but you must complete a new calibration to restore their areas.`
      : "Are you sure you want to reset the blueprint scale?";

    if (!window.confirm(warningMessage)) {
      return;
    }

    setBlueprintCalibration(createDefaultBlueprintCalibrationState());
    setIsVerificationMode(false);
    setBlueprintRoomTrace((currentTrace) => markBlueprintRoomOutlinesNeedRecalculation(currentTrace));
  };

  const confirmCurrentBlueprintCalibration = () => {
    setBlueprintCalibration((currentCalibration) => confirmBlueprintCalibration(currentCalibration));
  };

  const renameTracedRoom = (outlineId: string) => {
    const currentOutline = blueprintRoomTrace.roomOutlines.find((outline) => outline.id === outlineId);
    const nextName = window.prompt("Room name", currentOutline?.name ?? "Traced Room");
    if (nextName === null) return;

    setBlueprintRoomTrace((currentTrace) =>
      renameBlueprintRoomOutline(currentTrace, outlineId, nextName.trim() || currentOutline?.name || "Traced Room")
    );
  };

  const editTracedRoomOutline = (outlineId: string) => {
    setBlueprintWorkspaceMode("manual-trace");
    setSelectedBlueprintBoundaryEdge(null);
    setBlueprintRoomTrace((currentTrace) => editBlueprintRoomOutline(currentTrace, outlineId));
  };

  const removeTracedRoom = (outlineId: string) => {
    const roomToRemove = tracedRoomsWithSqft.find((r) => r.id === outlineId);
    if (
      roomToRemove &&
      !window.confirm(
        `Are you sure you want to delete the verified trace for "${
          roomToRemove.name || "this room"
        }"?`
      )
    ) {
      return;
    }
    setSelectedBlueprintBoundaryEdge((currentEdge) =>
      currentEdge?.outlineId === outlineId ? null : currentEdge
    );
    setBlueprintRoomTrace((currentTrace) => removeBlueprintRoomOutline(currentTrace, outlineId));
  };

  const selectTracedRoomBoundaryEdge = (outlineId: string, edgeIndex: number) => {
    setSelectedDetectedRoomId(outlineId);
    setSelectedBlueprintBoundaryEdge({ outlineId, edgeIndex });
  };

  const updateSelectedBoundaryType = (boundaryType: BlueprintRoomBoundaryType) => {
    if (!selectedBlueprintBoundaryEdge) return;

    setBlueprintRoomTrace((currentTrace) =>
      updateBlueprintRoomBoundaryEdgeType(
        currentTrace,
        selectedBlueprintBoundaryEdge.outlineId,
        selectedBlueprintBoundaryEdge.edgeIndex,
        boundaryType
      )
    );
  };

  const addOpeningToSelectedEdge = (type: BlueprintOpeningType) => {
    if (!selectedBlueprintBoundaryEdge) return;
    const { outlineId, edgeIndex } = selectedBlueprintBoundaryEdge;

    setBlueprintRoomTrace((currentTrace) => ({
      ...currentTrace,
      roomOutlines: currentTrace.roomOutlines.map((outline) => {
        if (outline.id !== outlineId) return outline;
        const boundaryEdges = outline.boundaryEdges ?? createDefaultBlueprintRoomBoundaryEdges(outline.points);
        return {
          ...outline,
          boundaryEdges: boundaryEdges.map((edge, idx) => {
            if (idx !== edgeIndex) return edge;
            const newOpening: BlueprintWallOpening = {
              id: `opening-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              type,
              widthFeet: 3,
              heightFeet: type === "window" ? 4 : 6.67,
              isVerified: true,
            };
            return {
              ...edge,
              openings: [...(edge.openings ?? []), newOpening],
            };
          }),
        };
      }),
    }));
  };

  const removeOpeningFromSelectedEdge = (openingId: string) => {
    if (!selectedBlueprintBoundaryEdge) return;
    const { outlineId, edgeIndex } = selectedBlueprintBoundaryEdge;

    if (!window.confirm("Are you sure you want to remove this opening?")) return;

    setBlueprintRoomTrace((currentTrace) => ({
      ...currentTrace,
      roomOutlines: currentTrace.roomOutlines.map((outline) => {
        if (outline.id !== outlineId) return outline;
        const boundaryEdges = outline.boundaryEdges;
        if (!boundaryEdges) return outline;

        return {
          ...outline,
          boundaryEdges: boundaryEdges.map((edge, idx) => {
            if (idx !== edgeIndex) return edge;
            return {
              ...edge,
              openings: edge.openings?.filter((op) => op.id !== openingId),
            };
          }),
        };
      }),
    }));
  };

  const updateOpeningInSelectedEdge = (openingId: string, field: "widthFeet" | "heightFeet", value: string) => {
    if (!selectedBlueprintBoundaryEdge) return;
    const { outlineId, edgeIndex } = selectedBlueprintBoundaryEdge;
    
    // Clamp to minimum 0.1 to avoid zero-dimension errors in Manual J
    const numericValue = Math.max(0.1, parseFloat(value) || 0.1);

    setBlueprintRoomTrace((currentTrace) => ({
      ...currentTrace,
      roomOutlines: currentTrace.roomOutlines.map((outline) => {
        if (outline.id !== outlineId) return outline;
        const boundaryEdges = outline.boundaryEdges;
        if (!boundaryEdges) return outline;

        return {
          ...outline,
          boundaryEdges: boundaryEdges.map((edge, idx) => {
            if (idx !== edgeIndex) return edge;
            return {
              ...edge,
              openings: edge.openings?.map((op) => 
                op.id === openingId ? { ...op, [field]: numericValue } : op
              ),
            };
          }),
        };
      }),
    }));
  };

  const sendTracedRoomToManualD = (outlineId: string) => {
    const tracedRoom = tracedRoomsWithSqft.find((outline) => outline.id === outlineId);
    const tracedSquareFeet = tracedRoom?.squareFeet;

    if (blueprintCalibration.status !== "calibrated") {
      setDetectedRoomActionMessage("Please confirm calibration before sending to Manual D.");
      return;
    }

    if (
      !tracedRoom ||
      tracedSquareFeet === null ||
      tracedSquareFeet === undefined ||
      tracedSquareFeet <= 0 ||
      !Number.isFinite(tracedSquareFeet)
    ) {
      setDetectedRoomActionMessage("Invalid room square footage. Recalculate or re-trace.");
      return;
    }

    setBlueprintRoomsForManualD((currentRooms) => {
      if (currentRooms.some((r) => r.sourceBlueprintRoomId === outlineId)) {
        setTimeout(() => setDetectedRoomActionMessage(`${tracedRoom.name} is already in Manual D`), 0);
        return currentRooms;
      }
      setTimeout(() => setDetectedRoomActionMessage(`Added ${tracedRoom.name} to Manual D`), 0);
      return [
        ...currentRooms,
        adaptTracedRoomToManualDBlueprintRoom({
          tracedRoom,
          outputId: `traced-${tracedRoom.id}-${Date.now()}`,
        }),
      ];
    });
  };

  const sendAllVerifiedRoomsToManualJ = () => {
    if (blueprintCalibration.status !== "calibrated") {
      setDetectedRoomActionMessage("Please confirm calibration before sending to Manual J.");
      return;
    }

    if (tracedRoomsWithSqft.length === 0) {
      setDetectedRoomActionMessage("No verified rooms to send. Please trace rooms first.");
      return;
    }

    setBlueprintRoomsForManualD((currentRooms) => {
      const takeoffLookup = new Map(tracedRoomsWithSqft.map(tr => [tr.id, tr]));

      let updatedCount = 0;
      const updatedExisting = currentRooms.map((manualRoom) => {
        const latestTakeoff = manualRoom.sourceBlueprintRoomId ? takeoffLookup.get(manualRoom.sourceBlueprintRoomId) : null;
        if (!latestTakeoff) return manualRoom;

        updatedCount++;
        return adaptTracedRoomToManualDBlueprintRoom({
          tracedRoom: latestTakeoff,
          outputId: manualRoom.id
        });
      });

      const existingSourceIds = new Set(currentRooms.map(r => r.sourceBlueprintRoomId).filter(Boolean));
      const newRooms = tracedRoomsWithSqft
        .filter(tr => !existingSourceIds.has(tr.id))
        .map(tr => adaptTracedRoomToManualDBlueprintRoom({
          tracedRoom: tr,
          outputId: `traced-${tr.id}-${Date.now()}`
        }));

      if (newRooms.length === 0 && updatedCount === 0) {
        setTimeout(() => setDetectedRoomActionMessage("All verified rooms are up to date in Manual J."), 0);
      } else {
        setTimeout(() => setDetectedRoomActionMessage(`Synced verified rooms to Manual J (${newRooms.length} new, ${updatedCount} updated).`), 0);
      }

      return [...updatedExisting, ...newRooms];
    });

    setActiveTechnicianSection("room-airflow");
  };

  const getBoundaryEdgeStyle = (type: string, isSelected: boolean): React.CSSProperties => {
    const base = isSelected 
      ? { ...blueprintRoomBoundaryLineStyle, ...blueprintRoomBoundaryLineSelectedStyle }
      : { ...blueprintRoomBoundaryLineStyle };
    
    if (isSelected) return base;

    return {
      ...base,
      stroke: BOUNDARY_TYPE_COLORS[type] || BOUNDARY_TYPE_COLORS.unknown,
      strokeDasharray: type === "unknown" ? "2 2" : "none",
      // Thin out interior lines to reduce visual noise
      strokeWidth: type === "interior" ? 0.8 : 1.2,
    };
  };

  const updateBlueprintCalibrationRealWorldDistance = (value: string) => {
    const overlayElement = document.getElementById("blueprint-calibration-overlay");
    const overlayBounds = overlayElement?.getBoundingClientRect();

    if (isVerificationMode) {
      setBlueprintCalibration((currentCalibration) =>
        updateBlueprintVerificationKnownLength(
          currentCalibration,
          value,
          overlayBounds
            ? {
                widthPx: overlayBounds.width / blueprintZoom,
                heightPx: overlayBounds.height / blueprintZoom,
              }
            : undefined
        )
      );
      return;
    }

    setBlueprintCalibration((currentCalibration) =>
      updateBlueprintCalibrationKnownLength(
        currentCalibration,
        value,
        overlayBounds
          ? {
              widthPx: overlayBounds.width / blueprintZoom,
              heightPx: overlayBounds.height / blueprintZoom,
            }
          : undefined
      )
    );
    setBlueprintRoomTrace((currentTrace) => markBlueprintRoomOutlinesNeedRecalculation(currentTrace));
  };

  const updateBlueprintCalibrationKnownLengthInput = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    updateBlueprintCalibrationRealWorldDistance(event.target.value);
  };

  const updateStructuredCalibration = (f: string, i: string, fr: string) => {
    setCalibrationFeet(f);
    setCalibrationInches(i);
    setCalibrationFraction(fr);
    
    const feet = parseFloat(f) || 0;
    const inches = parseFloat(i) || 0;
    const fractionVal = parseFloat(fr) || 0;
    
    // Convert to decimal feet for the engine
    const totalDecimalFeet = feet + (inches + fractionVal) / 12;
    updateBlueprintCalibrationRealWorldDistance(String(totalDecimalFeet));
  };

  const scrollToTakeoffElement = (element: HTMLElement | null) => {
    element?.scrollIntoView({ behavior: "smooth", block: "center" });
    element?.focus?.();
  };

  const handleBlueprintWorkflowStep = (stepIndex: number) => {
    if (isTracingLock) {
      setProjectActionMessage("Navigation locked during active trace.");
      return;
    }

    if (stepIndex === 0) {
      blueprintFileInputRef.current?.click();
      return;
    }

    if (stepIndex === 1) {
      if (blueprintFile) {
        scrollToTakeoffElement(blueprintPreviewRef.current);
      } else {
        blueprintFileInputRef.current?.click();
      }
      return;
    }

    if (stepIndex === 3) {
      scrollToTakeoffElement(detectedRoomsRef.current);
      return;
    }

    if (stepIndex === 4) {
      scrollToTakeoffElement(manualTakeoffRef.current);
    }
  };

  const zoomBlueprintIn = () => {
    if (blueprintRoomTrace.isTracing || blueprintRoomTrace.draftPoints.length > 0) {
      setProjectActionMessage("View changes locked during active trace.");
      return;
    }
    setBlueprintZoom((currentZoom) => Math.min(5.0, Number((currentZoom + 0.10).toFixed(2))));
  };

  const zoomBlueprintOut = () => {
    if (blueprintRoomTrace.isTracing || blueprintRoomTrace.draftPoints.length > 0) {
      setProjectActionMessage("View changes locked during active trace.");
      return;
    }
    setBlueprintZoom((currentZoom) => Math.max(0.2, Number((currentZoom - 0.10).toFixed(2))));
  };

  const fitBlueprintToWidth = () => {
    if (blueprintRoomTrace.isTracing || blueprintRoomTrace.draftPoints.length > 0) {
      setProjectActionMessage("View changes locked during active trace.");
      return;
    }
    const viewport = blueprintViewportRef.current;
    if (!viewport || !blueprintOverlaySize.widthPx) return;
    
    // Calculate zoom to fit width with a 5% margin
    const targetZoom = (viewport.clientWidth * 0.95) / blueprintOverlaySize.widthPx;
    setBlueprintZoom(Math.max(0.2, Math.min(5.0, Number(targetZoom.toFixed(2)))));
  };

  const showFullSheet = () => {
    if (blueprintRoomTrace.isTracing || blueprintRoomTrace.draftPoints.length > 0) {
      setProjectActionMessage("View changes locked during active trace.");
      return;
    }
    setBlueprintZoom(1.0);
    setActiveViewLabel("full");
    blueprintViewportRef.current?.scrollTo({ left: 0, top: 0, behavior: "smooth" });
  };

  const jumpToBuilding = () => {
    if (blueprintRoomTrace.isTracing || blueprintRoomTrace.draftPoints.length > 0) {
      setProjectActionMessage("View changes locked during active trace.");
      return;
    }
    if (!activeFocusArea) {
      setProjectActionMessage("Set a focus area first.");
      return;
    }

    const viewport = blueprintViewportRef.current;
    if (!viewport || !blueprintOverlaySize.widthPx) return;

    // 1. Calculate optimal zoom
    // focusArea is in normalized percentages (0-100)
    // We want to fit focus region into viewport at ~85% of its size
    const focusWidthPx = (activeFocusArea.width / 100) * blueprintOverlaySize.widthPx;
    const focusHeightPx = (activeFocusArea.height / 100) * blueprintOverlaySize.heightPx;

    const zoomToFitWidth = (viewport.clientWidth * 0.85) / focusWidthPx;
    const zoomToFitHeight = (viewport.clientHeight * 0.85) / focusHeightPx;
    
    // Choose the smaller zoom to ensure entire area fits
    const targetZoom = Math.min(zoomToFitWidth, zoomToFitHeight);
    const clampedZoom = Math.max(0.2, Math.min(5.0, Number(targetZoom.toFixed(2))));
    
    setBlueprintZoom(clampedZoom);
    setActiveViewLabel("focus");

    // 2. Calculate center position and scroll
    // Center point in base image pixels:
    const centerX = ((activeFocusArea.x + activeFocusArea.width / 2) / 100) * blueprintOverlaySize.widthPx;
    const centerY = ((activeFocusArea.y + activeFocusArea.height / 2) / 100) * blueprintOverlaySize.heightPx;

    // Center point in scaled display pixels:
    const scaledCenterX = centerX * clampedZoom;
    const scaledCenterY = centerY * clampedZoom;

    // Scroll position to center that point:
    const scrollLeft = scaledCenterX - viewport.clientWidth / 2;
    const scrollTop = scaledCenterY - viewport.clientHeight / 2;

    // Use a small timeout to ensure state update has propagated to the DOM transform
    setTimeout(() => {
      viewport.scrollTo({
        left: Math.max(0, scrollLeft),
        top: Math.max(0, scrollTop),
        behavior: "smooth"
      });
    }, 100);

    setProjectActionMessage("Jumped to building footprint.");
  };

  const confirmedBlueprintPixelsPerFoot = getConfirmedBlueprintPixelsPerFoot(blueprintCalibration);

  const tracedRoomsWithSqft = useMemo(() => {
    return blueprintRoomTrace.roomOutlines.map((outline) => ({
      ...outline,
      squareFeet: calculateBlueprintPolygonSquareFeet(
        outline.points,
        confirmedBlueprintPixelsPerFoot,
        blueprintOverlaySize.widthPx > 0 ? blueprintOverlaySize : undefined
      ),
    }));
  }, [blueprintRoomTrace.roomOutlines, confirmedBlueprintPixelsPerFoot, blueprintOverlaySize]);

  const verifiedOpeningsMetrics = useMemo(() => {
    let windowCount = 0;
    let windowArea = 0;
    let doorCount = 0;
    let doorArea = 0;
    let allEdgesClassified = tracedRoomsWithSqft.length > 0;

    tracedRoomsWithSqft.forEach((room) => {
      const edges =
        room.boundaryEdges ?? createDefaultBlueprintRoomBoundaryEdges(room.points);
      if (edges.length === 0) allEdgesClassified = false;

      edges.forEach((edge) => {
        if (edge.boundaryType === "unknown") {
          allEdgesClassified = false;
        }

        if (edge.boundaryType === "exterior") {
          (edge.openings ?? []).forEach((opening) => {
            if (opening.isVerified) {
              const area = opening.widthFeet * opening.heightFeet;
              if (opening.type === "window") {
                windowCount++;
                windowArea += area;
              } else if (opening.type === "door") {
                doorCount++;
                doorArea += area;
              }
            }
          });
        }
      });
    });

    return {
      windowCount,
      windowArea,
      doorCount,
      doorArea,
      allEdgesClassified,
    };
  }, [tracedRoomsWithSqft]);

  const totalTracedSqft = useMemo(() => {
    return tracedRoomsWithSqft.reduce((sum, room) => sum + (room.squareFeet || 0), 0);
  }, [tracedRoomsWithSqft]);

  const isAreaVerified = tracedRoomsWithSqft.length > 0 && blueprintCalibration.status === "calibrated";

  const activeConditionedArea = useMemo(() => {
    return isAreaVerified ? totalTracedSqft : (parseFloat(squareFeet) || 0);
  }, [isAreaVerified, totalTracedSqft, squareFeet]);

  const result = useMemo(() => {
    // Use verified window data if takeoff is complete (all edges classified)
    const useVerifiedWindows = verifiedOpeningsMetrics.allEdgesClassified;

    const inputs: ManualJInputs = {
      squareFeet: Math.max(0, Math.round(activeConditionedArea)),
      ceilingHeight: Math.max(6, parseInt(ceilingHeight, 10) || 6),
      insulationQuality,
      windowCount: useVerifiedWindows
        ? verifiedOpeningsMetrics.windowCount
        : Math.max(0, parseInt(windowCount, 10) || 0),
      windowArea: useVerifiedWindows
        ? verifiedOpeningsMetrics.windowArea
        : Math.max(0, parseFloat(windowArea) || 0),
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
      // Pass professional overrides if verified
      ...(isEnvelopeVerified ? {
        verifiedWindowUFactor: parseFloat(windowUFactor),
        verifiedWindowSHGC: parseFloat(windowSHGC),
      } : {})
    };

    return calculateManualJLoad(inputs);
  }, [
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
    isEnvelopeVerified, 
    windowUFactor, 
    windowSHGC,
    verifiedOpeningsMetrics
  ]);


  // Sync professional result to parent
  useEffect(() => {
    if (onResultChange) {
      onResultChange(result);
    }
  }, [result, onResultChange]);

  const [displayedResult, setDisplayedResult] = useState(result);

  const selectedDetectedRoom = useMemo(
    () => detectedBlueprintRooms.find((room) => room.id === selectedDetectedRoomId) ?? null,
    [detectedBlueprintRooms, selectedDetectedRoomId]
  );

  const selectedDetectedRoomAirflow = useMemo(() => {
    if (!selectedDetectedRoom) return null;

    const tonValues = result.recommendedTonnage
      .match(/\d+(\.\d+)?/g)
      ?.map((value) => parseFloat(value)) ?? [];
    const averageTonnage =
      tonValues.length >= 2
        ? (tonValues[0] + tonValues[1]) / 2
        : tonValues[0] ?? 0;
    const totalSystemCfm = calculateResidentialAirflow(averageTonnage);
    const totalSquareFeet = Math.max(1, parseInt(squareFeet, 10) || 1);
    const estimatedCfm = (selectedDetectedRoom.squareFeet / totalSquareFeet) * totalSystemCfm;
    const ductRecommendation = recommendRoundDuctSize(estimatedCfm, "branch");

    return {
      estimatedCfm,
      ductRecommendation,
    };
  }, [result.recommendedTonnage, selectedDetectedRoom, squareFeet]);

  const activePixelsDistance = useMemo(() => {
    if (
      !blueprintCalibration.startPoint ||
      !blueprintCalibration.endPoint ||
      blueprintOverlaySize.widthPx <= 0
    ) {
      return null;
    }
    return calculateBlueprintPixelDistance(
      blueprintCalibration.startPoint,
      blueprintCalibration.endPoint,
      blueprintOverlaySize.widthPx,
      blueprintOverlaySize.heightPx
    );
  }, [blueprintCalibration.startPoint, blueprintCalibration.endPoint, blueprintOverlaySize]);

  const activePixelsPerFoot = useMemo(() => {
    if (activePixelsDistance === null) return null;

    return calculateBlueprintPixelsPerFoot(
      activePixelsDistance,
      blueprintCalibration.realWorldDistance,
      blueprintCalibration.realWorldUnit
    );
  }, [activePixelsDistance, blueprintCalibration.realWorldDistance, blueprintCalibration.realWorldUnit]);

  const verificationErrorPercentage = useMemo(() => {
    if (
      !blueprintCalibration.verification?.startPoint ||
      !blueprintCalibration.verification?.endPoint ||
      !activePixelsPerFoot ||
      !blueprintCalibration.verification?.realWorldDistance
    ) {
      return null;
    }

    const pixelsDistance = calculateBlueprintPixelDistance(
      blueprintCalibration.verification.startPoint,
      blueprintCalibration.verification.endPoint,
      blueprintOverlaySize.widthPx,
      blueprintOverlaySize.heightPx
    );

    const measuredFeet = calculateBlueprintMeasuredFeet(pixelsDistance, activePixelsPerFoot);

    return calculateBlueprintVerificationError(
      measuredFeet,
      blueprintCalibration.verification.realWorldDistance,
      blueprintCalibration.realWorldUnit
    );
  }, [
    blueprintCalibration.verification,
    activePixelsPerFoot,
    blueprintCalibration.realWorldUnit,
    blueprintOverlaySize,
  ]);

  const blueprintCalibrationStatusText =
    blueprintCalibration.status === "calibrated"
      ? "Calibration confirmed"
      : blueprintCalibration.status === "ready"
      ? "Ready to confirm"
      : "Not calibrated";
  const blueprintCalibrationScaleText =
    activePixelsPerFoot === null
      ? "Select two points and enter a known length"
      : blueprintCalibration.status === "ready"
      ? `Scale ready - ${activePixelsPerFoot.toFixed(2)} px / ft`
      : `${activePixelsPerFoot.toFixed(2)} px / ft`;
  const blueprintCalibrationMeasurementText = useMemo(() => {
    if (blueprintCalibration.realWorldDistance.trim() === "" || !Number.isFinite(parseFloat(blueprintCalibration.realWorldDistance))) {
      return null;
    }

    const totalFeet = parseFloat(blueprintCalibration.realWorldDistance);
    
    // Build architectural string from structured state for maximum precision
    const fractionLabel = FRACTION_OPTIONS.find(opt => opt.value === calibrationFraction)?.label || "0";
    const archStr = `${calibrationFeet}' ${calibrationInches}${fractionLabel !== "0" ? ` ${fractionLabel}` : ""}"`;
    const decimalStr = `${totalFeet.toFixed(3)} ft`;

    return { arch: archStr, decimal: decimalStr };
  }, [blueprintCalibration.realWorldDistance, calibrationFeet, calibrationInches, calibrationFraction]);

  const canConfirmBlueprintCalibration =
    blueprintCalibration.status === "ready" && activePixelsPerFoot !== null;
  const blueprintTraceCalibrationStatusText = getBlueprintTraceCalibrationStatusText(blueprintCalibration.status);
  const blueprintMeasuredFeet = calculateBlueprintMeasuredFeet(
    activePixelsDistance,
    activePixelsPerFoot
  );

  const isTracingLock = blueprintRoomTrace.isTracing || blueprintRoomTrace.draftPoints.length > 0;

  const blueprintCalibrationUI = useMemo(() => {
    if (!blueprintFile) {
      return {
        actionText: "Upload Blueprint First",
        statusText: "Scale not verified",
        statusColor: "#64748b",
        canConfirm: false,
        isDisabled: true
      };
    }

    if (blueprintCalibration.status === "uncalibrated" || blueprintCalibration.status === "calibrating") {
      const isPlacingPoints = blueprintCalibration.startPoint || blueprintCalibration.endPoint;
      return {
        actionText: isPlacingPoints ? "Calibrating..." : "Begin Calibration",
        statusText: isPlacingPoints ? "Select two points and enter known distance" : "Scale not verified",
        statusColor: isPlacingPoints ? "#fbbf24" : "#64748b",
        canConfirm: false,
        isDisabled: false
      };
    }

    if (blueprintCalibration.status === "ready") {
      return {
        actionText: "Confirm Scale",
        statusText: "Scale ready for confirmation",
        statusColor: "#fbbf24",
        canConfirm: true,
        isDisabled: false
      };
    }

    if (blueprintCalibration.status === "calibrated") {
      return {
        actionText: "Verified Scale",
        statusText: "Scale confirmed and used for sqft calculations",
        statusColor: "#22c55e",
        canConfirm: true, // Internal state allows re-confirmation if needed, but UI will handle locking
        isDisabled: false
      };
    }

    return {
      actionText: "Begin Calibration",
      statusText: "Scale not verified",
      statusColor: "#64748b",
      canConfirm: false,
      isDisabled: false
    };
  }, [blueprintFile, blueprintCalibration.status, blueprintCalibration.startPoint, blueprintCalibration.endPoint]);

  const selectedTracedRoom = useMemo(
    () => tracedRoomsWithSqft.find((outline) => outline.id === selectedDetectedRoomId) ?? null,
    [tracedRoomsWithSqft, selectedDetectedRoomId]
  );
  const selectedBoundaryEdgeMetadata =
    selectedTracedRoom && selectedBlueprintBoundaryEdge?.outlineId === selectedTracedRoom.id
      ? (selectedTracedRoom.boundaryEdges ??
          createDefaultBlueprintRoomBoundaryEdges(selectedTracedRoom.points))[
          selectedBlueprintBoundaryEdge.edgeIndex
        ] ?? null
      : null;

  const blueprintRoomTraceStatusText = blueprintRoomTrace.isTracing
    ? `${blueprintRoomTrace.draftPoints.length} vertices placed. Click start point to close.`
    : `${tracedRoomsWithSqft.length} outline${tracedRoomsWithSqft.length === 1 ? "" : "s"} saved`;

  const snapshotSummary = useMemo(() => {
    const sqft = Math.max(0, Math.round(activeConditionedArea));
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
    event.preventDefault();
    handleCalculate();
  };

  const technicianSections: Array<{
    id: TechnicianSection;
    title: string;
    description: string;
  }> = [
    {
      id: "manual-room-takeoff",
      title: "Manual Room Takeoff",
      description: "Measure length and width, then add rooms into Manual D.",
    },
    {
      id: "envelope-verification",
      title: "Envelope Verification",
      description: "Verify insulation R-values, window factors, and infiltration.",
    },
    {
      id: "room-airflow",
      title: "Room-by-Room Airflow",
      description: "Room loads, branch ducts, register airflow, and status messages.",
    },
    {
      id: "manual-d",
      title: "Manual D",
      description: "System airflow, trunk sizing, and fitting equivalent length.",
    },
    {
      id: "return-air",
      title: "Return Air Design",
      description: "Return paths, grille guidance, and quiet airflow checks.",
    },
    {
      id: "reports",
      title: "Reports",
      description: "Validation warnings, field notes, and print-ready Manual D report.",
    },
  ];
  const activeWorkflowStep =
    activeTechnicianSection === "manual-room-takeoff"
      ? 1
      : activeTechnicianSection === "envelope-verification"
      ? 2
      : activeTechnicianSection === "room-airflow"
      ? 3
      : activeTechnicianSection === "manual-d" || activeTechnicianSection === "return-air"
      ? 4
      : activeTechnicianSection === "reports"
      ? 5
      : 3;
  const technicianWorkflowSteps = [
    "1. Takeoff",
    "2. Verify Envelope",
    "3. Manual J",
    "4. Manual D",
    "5. Reports",
  ];

  const projectSnapshot = useMemo(() => {
    const snapshot = createBlueprintProjectSnapshot({
      name: v3ProjectName,
      blueprintImage: blueprintFile ? {
        name: blueprintFile.name,
        size: blueprintFile.size,
        type: blueprintFile.type,
        lastModified: blueprintFile.lastModified,
      } : null,
      calibration: blueprintCalibration,
      tracedRooms: tracedRoomsWithSqft,
      envelopeSettings: {
        insulationQuality,
        oregonRegion,
        isVerified: isEnvelopeVerified,
        verifiedInsulation: {
          atticRValue: parseFloat(atticRValue),
          wallRValue: parseFloat(wallRValue),
          floorRValue: parseFloat(floorRValue),
        },
        verifiedWindows: {
          uFactor: parseFloat(windowUFactor),
          shgc: parseFloat(windowSHGC),
        },
        verifiedInfiltration: {
          ach50: parseFloat(infiltrationACH50),
        },
      },
      envelopeSuggestions: envelopeSuggestions,
      manualDProjectState,
      engineMetadata: loadedEngineMetadata,
    });

    return activeV3ProjectId
      ? { ...snapshot, id: activeV3ProjectId }
      : snapshot;
  }, [v3ProjectName, activeV3ProjectId, blueprintFile, blueprintCalibration, tracedRoomsWithSqft, insulationQuality, oregonRegion, manualDProjectState, loadedEngineMetadata]);

  const isCalibrating = blueprintCalibration.status === "calibrating" || blueprintCalibration.status === "ready";
  const activeInspectorWidth = isCalibrating ? "240px" : "140px";

  return (
    <ProjectEngineProvider key={activeV3ProjectId ?? "draft-project-engine"} initialProject={projectSnapshot}>
      <ProjectEnginePersistenceBridge
        engineStateRef={projectEngineStateRef}
        dispatchRef={dispatchProjectEngineActionRef}
        pendingEvent={pendingEngineEvent}
        onPendingEventHandled={() => setPendingEngineEvent(null)}
      />
      <ProjectEngineSync 
        project={projectSnapshot} 
        activeTechnicianSection={activeTechnicianSection}
        setActiveTechnicianSection={setActiveTechnicianSection}
      />
      <CalculationLifecycleSync isCalculating={isCalculating} />
      <ProjectMilestoneSync
        reportPreview={v3ReportPreview}
        reportExportCount={reportExportCount}
      />
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
          onPointerUp={handlePointerCalculate}
          onClick={(e) => {
            if (e.detail === 0) handleCalculate();
          }}
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

          /* Hide number spinners */
          .load-input[type=number]::-webkit-inner-spin-button, 
          .load-input[type=number]::-webkit-outer-spin-button { 
            -webkit-appearance: none; 
            margin: 0; 
          }
          .load-input[type=number] {
            -moz-appearance: textfield;
          }

          .calc-action-button {
            transition: transform 0.25s ease, box-shadow 0.25s ease, background 0.25s ease;
          }

          .tablet-only-toggle {
            display: none !important;
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

          .blueprint-takeoff-panel {
            align-self: start !important;
            align-items: stretch !important;
            height: fit-content !important;
            min-height: auto !important;
            max-height: none !important;
            overflow: visible !important;
            box-sizing: border-box !important;
          }

          .blueprint-takeoff-grid {
            display: flex !important;
            flex-wrap: wrap !important;
            align-items: flex-end !important;
            gap: 10px !important;
            width: 100% !important;
            min-height: 0 !important;
          }

          .blueprint-takeoff-control {
            box-sizing: border-box !important;
            height: 38px !important;
            min-height: 38px !important;
            max-height: 38px !important;
            padding: 8px 10px !important;
            line-height: 20px !important;
          }

          .blueprint-takeoff-result,
          .blueprint-takeoff-button {
            box-sizing: border-box !important;
            height: 38px !important;
            min-height: 38px !important;
            max-height: 38px !important;
            padding: 7px 10px !important;
          }

          @keyframes shimmer {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
          }

          @keyframes nudgePulse {
            0% { transform: scale(0.6); opacity: 1; }
            100% { transform: scale(1.6); opacity: 0; }
          }

          /* Blueprint Focus Mode - Reuses responsive logic for intentional focus */
          .blueprint-drafting-workspace.focus-mode {
            display: flex !important;
            position: relative !important;
            min-height: 70vh !important;
            overflow: hidden !important;
            border-radius: 22px !important;
          }

          .blueprint-drafting-workspace.focus-mode .blueprint-workspace-main {
            flex: 1 !important;
            width: 100% !important;
          }

          .blueprint-drafting-workspace.focus-mode .blueprint-workspace-sidebar,
          .blueprint-drafting-workspace.focus-mode .blueprint-workspace-inspector {
            position: absolute !important;
            top: 0 !important;
            height: 100% !important;
            z-index: 40 !important;
            width: 60px !important;
            overflow: hidden !important;
            transition: width 0.3s ease !important;
            background: rgba(15, 23, 42, 0.95) !important;
            backdrop-filter: blur(8px) !important;
            border: 1px solid rgba(255,255,255,0.1) !important;
            border-radius: 12px !important;
          }

          .blueprint-drafting-workspace.focus-mode .blueprint-workspace-sidebar {
            left: 0 !important;
          }

          .blueprint-drafting-workspace.focus-mode .blueprint-workspace-inspector {
            right: 0 !important;
          }

          .blueprint-drafting-workspace.focus-mode .blueprint-workspace-sidebar:hover,
          .blueprint-drafting-workspace.focus-mode .blueprint-workspace-sidebar:focus-within,
          .blueprint-drafting-workspace.focus-mode .blueprint-workspace-sidebar.expanded,
          .blueprint-drafting-workspace.focus-mode .blueprint-workspace-inspector:hover,
          .blueprint-drafting-workspace.focus-mode .blueprint-workspace-inspector:focus-within,
          .blueprint-drafting-workspace.focus-mode .blueprint-workspace-inspector.expanded {
            width: 320px !important;
            z-index: 50 !important;
            box-shadow: 0 4px 20px rgba(0,0,0,0.5) !important;
            overflow-y: auto !important;
          }

          .blueprint-drafting-workspace.focus-mode .tablet-only-toggle {
            display: flex !important;
          }

          @media (max-width: 1024px) {
            .load-calculator-grid {
              grid-template-columns: 1fr !important;
              align-items: start !important;
            }

            .technician-command-grid .load-calculator-right {
              order: -1 !important;
            }

            .load-calculator-header {
              align-items: flex-start !important;
            }

            .blueprint-takeoff-grid {
              align-items: flex-end !important;
            }

            .blueprint-drafting-workspace {
              display: flex !important;
              position: relative !important;
              min-height: 60vh !important;
              overflow: hidden !important;
              border-radius: 22px !important;
            }

            .blueprint-workspace-main {
              flex: 1 !important;
              width: 100% !important;
            }

            .blueprint-workspace-sidebar,
            .blueprint-workspace-inspector {
              position: absolute !important;
              top: 0 !important;
              height: 100% !important;
              z-index: 40 !important;
              width: 60px !important;
              overflow: hidden !important;
              transition: width 0.3s ease !important;
              background: rgba(15, 23, 42, 0.95) !important;
              backdrop-filter: blur(8px) !important;
              border: 1px solid rgba(255,255,255,0.1) !important;
              border-radius: 12px !important;
            }

            .blueprint-workspace-sidebar {
              left: 0 !important;
            }

            .blueprint-workspace-inspector {
              right: 0 !important;
            }

            .blueprint-workspace-sidebar:hover,
            .blueprint-workspace-sidebar:focus-within,
            .blueprint-workspace-sidebar.expanded,
            .blueprint-workspace-inspector:hover,
            .blueprint-workspace-inspector:focus-within,
            .blueprint-workspace-inspector.expanded {
              width: 320px !important;
              z-index: 50 !important;
              box-shadow: 0 4px 20px rgba(0,0,0,0.5) !important;
              overflow-y: auto !important;
            }

            button, input, select, .calc-action-button, .blueprint-takeoff-button {
              min-height: 44px !important;
              min-width: 44px !important;
              display: flex !important;
              align-items: center !important;
              justify-content: center !important;
            }

            .tablet-only-toggle {
              display: flex !important;
            }

            /* Ensure square buttons are also large enough */
            [style*="width: 34px"], [style*="height: 34px"], [style*="minHeight: 30px"] {
              min-width: 44px !important;
              min-height: 44px !important;
            }
          }

          @media (max-width: 640px) {
            html, body {
              overflow-x: hidden !important;
              max-width: 100vw !important;
            }

            .load-calculator-page {
              gap: 14px !important;
              width: 100% !important;
              max-width: 100% !important;
              overflow-x: hidden !important;
              position: relative !important;
              z-index: 10 !important;
              pointer-events: auto !important;
              padding-bottom: 90px !important;
            }

            button, input, select, .calc-action-button, .blueprint-takeoff-button {
              min-height: 44px !important;
              min-width: 44px !important;
              display: flex !important;
              align-items: center !important;
              justify-content: center !important;
            }

            .technician-accordion {
              position: fixed !important;
              bottom: 0 !important;
              left: 0 !important;
              right: 0 !important;
              background: rgba(15, 23, 42, 0.98) !important;
              backdrop-filter: blur(10px) !important;
              z-index: 100 !important;
              display: flex !important;
              flex-wrap: nowrap !important;
              overflow-x: auto !important;
              padding: 10px !important;
              border-top: 1px solid rgba(255,255,255,0.1) !important;
              border-radius: 0 !important;
              gap: 8px !important;
            }

            .technician-accordion > button {
              flex: 0 0 auto !important;
              width: auto !important;
              flex-direction: column !important;
              justify-content: center !important;
              padding: 8px 12px !important;
              height: auto !important;
              min-height: 50px !important;
            }

            .technician-accordion > button span:last-child {
              display: none !important;
            }

            .blueprint-drafting-workspace {
              display: grid !important;
              grid-template-columns: 1fr !important;
            }

            .blueprint-workspace-sidebar,
            .blueprint-workspace-inspector {
              position: static !important;
              width: 100% !important;
              height: auto !important;
              opacity: 1 !important;
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

            .blueprint-takeoff-panel {
              padding: 16px !important;
              gap: 12px !important;
            }

            .blueprint-drafting-workspace {
              gap: 12px !important;
            }

            .blueprint-takeoff-grid {
              display: grid !important;
              grid-template-columns: 1fr 1fr !important;
              gap: 10px !important;
            }

            .blueprint-takeoff-grid > :first-child,
            .blueprint-takeoff-grid > :last-child {
              grid-column: 1 / -1 !important;
            }

            .blueprint-takeoff-control,
            .blueprint-takeoff-button {
              min-height: 44px !important;
              height: 44px !important;
              max-height: 44px !important;
              padding: 10px 12px !important;
            }

            .blueprint-takeoff-result {
              min-height: 44px !important;
              height: auto !important;
              max-height: none !important;
              padding: 10px 12px !important;
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

      <div
        className={`load-calculator-grid ${activeLoadView === "technician" ? "technician-command-grid" : ""}`}
        style={isBlueprintWorkspaceActive ? { ...calcGridStyle, gridTemplateColumns: "1fr" } : calcGridStyle}
      >
        <div className="load-calculator-left" style={leftColumnStyle}>
          {activeLoadView === "customer" ? (
            <div className="load-section-panel" style={sectionPanelStyle}>              <div style={sectionPanelHeaderStyle}>
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
          <ProjectNextStepBanner />

          <div style={persistentSummaryCardStyle}>
            <div style={persistentSummaryItemStyle}>
              <p style={persistentSummaryLabelStyle}>Calibration</p>
              <p style={persistentSummaryValueStyle}>
                {blueprintCalibration.status === 'calibrated' ? (
                  <><CheckCircle2 size={14} color="#22c55e" /> Confirmed</>
                ) : (
                  <><Circle size={14} color="#f87171" /> Required</>
                )}
              </p>
            </div>
            <div style={persistentSummaryItemStyle}>
              <p style={persistentSummaryLabelStyle}>Verified Takeoff</p>
              <p style={persistentSummaryValueStyle}>
                <Layers size={14} color="#d4af37" />
                {tracedRoomsWithSqft.length} Rooms · {Math.round(totalTracedSqft).toLocaleString()} Sqft
              </p>
            </div>
            <div style={persistentSummaryItemStyle}>
              <p style={persistentSummaryLabelStyle}>Envelope</p>
              <p style={persistentSummaryValueStyle}>
                {isEnvelopeVerified ? (
                  <><CheckCircle2 size={14} color="#22c55e" /> Verified</>
                ) : (
                  <><Circle size={14} color="#fbbf24" /> Review Required</>
                )}
              </p>
            </div>
            <div style={persistentSummaryItemStyle}>
              <p style={persistentSummaryLabelStyle}>Data Source</p>
              <p style={persistentSummaryValueStyle}>
                <FileText size={14} color="#94a3b8" />
                {blueprintFile ? 'Blueprint' : 'Manual Entry'}
              </p>
            </div>
            <div style={persistentSummaryItemStyle}>
              <p style={persistentSummaryLabelStyle}>Manual J Ready</p>
              <p style={{ ...persistentSummaryValueStyle, color: (blueprintCalibration.status === 'calibrated' && tracedRoomsWithSqft.length > 0) ? '#22c55e' : (blueprintFile ? '#64748b' : '#fde68a') }}>
                {(blueprintCalibration.status === 'calibrated' && tracedRoomsWithSqft.length > 0) ? (
                  <><ShieldCheck size={14} color="#22c55e" /> Ready</>
                ) : (
                  blueprintFile ? 'Pending Verification' : 'Manual Mode'
                )}
              </p>
            </div>
          </div>

          <div style={technicianWorkflowStyle}>
            {technicianWorkflowSteps.map((step, index) => {
              const stepNumber = index + 1;
              const isActiveStep = activeWorkflowStep === stepNumber;

              return (
                <div
                  key={step}
                  style={isActiveStep ? technicianWorkflowStepActiveStyle : technicianWorkflowStepStyle}
                >
                  {step}
                </div>
              );
            })}
          </div>

          <div className="technician-accordion" style={technicianAccordionStyle}>
            {technicianSections.map((section) => {              const isActive = activeTechnicianSection === section.id;

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
              <div style={{ flex: 1 }}>
                <p style={sectionPanelTitleStyle}>Project Management</p>
                <p style={sectionPanelDescriptionStyle}>Save and reload local engineering designs.</p>
                <div style={{ display: "flex", gap: "10px", marginTop: "12px", alignItems: "center" }}>
                  <input
                    type="text"
                    className="load-input"
                    value={v3ProjectName}
                    onChange={(e) => setV3ProjectName(e.target.value)}
                    placeholder="Project Name"
                    style={{ ...inputControlStyle, maxWidth: "260px" }}
                  />
                  <button
                    type="button"
                    className="calc-action-button"
                    style={{ ...calcActionButtonStyle, marginTop: 0, width: "auto" }}
                    onClick={handleV3SaveProject}
                  >
                    Save Project
                  </button>
                  {v3SaveStatus ? (
                    <p style={{ ...projectActionMessageStyle, margin: 0, color: "#4ade80" }}>{v3SaveStatus}</p>
                  ) : projectActionMessage ? (
                    <p style={projectActionMessageStyle}>{projectActionMessage}</p>
                  ) : null}
                </div>
              </div>
            </div>

            {v3RecentProjects.length > 0 ? (
              <div style={projectListStyle}>
                {v3RecentProjects.map((project) => (
                  <div key={project.id} style={projectListItemStyle}>
                    <div>
                      <p style={projectListTitleStyle}>{project.name}</p>
                      <p style={projectListMetaStyle}>
                        Updated {new Date(project.updatedAt).toLocaleString()}
                      </p>
                    </div>
                    <div style={projectListActionsStyle}>
                      <button
                        type="button"
                        className="calc-action-button"
                        style={{
                          ...calcActionButtonStyle,
                          marginTop: 0,
                          width: "auto",
                          padding: "6px 12px",
                          background: "rgba(212,175,55,0.15)",
                          color: "#fde68a",
                          border: "1px solid rgba(212,175,55,0.2)",
                        }}
                        onClick={() => handleLoadV3Project(project.id)}
                      >
                        Load Project
                      </button>
                      <button
                        type="button"
                        style={projectDeleteButtonStyle}
                        onClick={() => handleDeleteProject(project.id)}
                        onPointerUp={(event) => {
                          if (event.pointerType === "mouse") return;
                          event.preventDefault();
                          handleDeleteProject(project.id);
                        }}
                      >
                        Delete
                      </button>
                    </div>
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
              display: activeTechnicianSection === "envelope-verification" ? "grid" : "none",
            }}
          >
            <div style={sectionPanelHeaderStyle}>
              <div style={sectionPanelIconStyle}>
                <ShieldCheck size={18} strokeWidth={1.8} />
              </div>
              <div>
                <p style={sectionPanelTitleStyle}>Envelope Verification</p>
                <p style={sectionPanelDescriptionStyle}>Professional verification of building thermal properties.</p>
              </div>
            </div>

            <div style={inputGridStyle}>
              <InputField
                icon={<Home size={18} strokeWidth={1.8} />}
                title="Attic R-value"
                description="Ceiling insulation level"
              >
                <input
                  className="load-input"
                  type="number"
                  value={atticRValue}
                  onChange={(e) => setAtticRValue(e.target.value)}
                  style={inputControlStyle}
                />
                {envelopeSuggestions?.atticRValue && (
                  <div style={envelopeSuggestionBadgeStyle}>
                    <p style={envelopeSuggestionTextStyle}>AI Suggested: R-{envelopeSuggestions.atticRValue.value}</p>
                    <button 
                      type="button" 
                      style={envelopeSuggestionActionStyle}
                      onClick={() => setAtticRValue(String(envelopeSuggestions.atticRValue!.value))}
                    >
                      Accept
                    </button>
                  </div>
                )}
              </InputField>

              <InputField
                icon={<Home size={18} strokeWidth={1.8} />}
                title="Wall R-value"
                description="Exterior wall insulation"
              >
                <input
                  className="load-input"
                  type="number"
                  value={wallRValue}
                  onChange={(e) => setWallRValue(e.target.value)}
                  style={inputControlStyle}
                />
                {envelopeSuggestions?.wallRValue && (
                  <div style={envelopeSuggestionBadgeStyle}>
                    <p style={envelopeSuggestionTextStyle}>AI Suggested: R-{envelopeSuggestions.wallRValue.value}</p>
                    <button 
                      type="button" 
                      style={envelopeSuggestionActionStyle}
                      onClick={() => setWallRValue(String(envelopeSuggestions.wallRValue!.value))}
                    >
                      Accept
                    </button>
                  </div>
                )}
              </InputField>

              <InputField
                icon={<Home size={18} strokeWidth={1.8} />}
                title="Floor R-value"
                description="Foundation/floor insulation"
              >
                <input
                  className="load-input"
                  type="number"
                  value={floorRValue}
                  onChange={(e) => setFloorRValue(e.target.value)}
                  style={inputControlStyle}
                />
                {envelopeSuggestions?.floorRValue && (
                  <div style={envelopeSuggestionBadgeStyle}>
                    <p style={envelopeSuggestionTextStyle}>AI Suggested: R-{envelopeSuggestions.floorRValue.value}</p>
                    <button 
                      type="button" 
                      style={envelopeSuggestionActionStyle}
                      onClick={() => setFloorRValue(String(envelopeSuggestions.floorRValue!.value))}
                    >
                      Accept
                    </button>
                  </div>
                )}
              </InputField>

              <InputField
                icon={<Sparkles size={18} strokeWidth={1.8} />}
                title="Window U-factor"
                description="Thermal transmittance"
              >
                <input
                  className="load-input"
                  type="number"
                  step="0.01"
                  value={windowUFactor}
                  onChange={(e) => setWindowUFactor(e.target.value)}
                  style={inputControlStyle}
                />
                {envelopeSuggestions?.windowUFactor && (
                  <div style={envelopeSuggestionBadgeStyle}>
                    <p style={envelopeSuggestionTextStyle}>AI Suggested: {envelopeSuggestions.windowUFactor.value}</p>
                    <button 
                      type="button" 
                      style={envelopeSuggestionActionStyle}
                      onClick={() => setWindowUFactor(String(envelopeSuggestions.windowUFactor!.value))}
                    >
                      Accept
                    </button>
                  </div>
                )}
              </InputField>

              <InputField
                icon={<SunMedium size={18} strokeWidth={1.8} />}
                title="Window SHGC"
                description="Solar Heat Gain Coefficient"
              >
                <input
                  className="load-input"
                  type="number"
                  step="0.01"
                  value={windowSHGC}
                  onChange={(e) => setWindowSHGC(e.target.value)}
                  style={inputControlStyle}
                />
                {envelopeSuggestions?.windowSHGC && (
                  <div style={envelopeSuggestionBadgeStyle}>
                    <p style={envelopeSuggestionTextStyle}>AI Suggested: {envelopeSuggestions.windowSHGC.value}</p>
                    <button 
                      type="button" 
                      style={envelopeSuggestionActionStyle}
                      onClick={() => setWindowSHGC(String(envelopeSuggestions.windowSHGC!.value))}
                    >
                      Accept
                    </button>
                  </div>
                )}
              </InputField>

              <InputField
                icon={<Wind size={18} strokeWidth={1.8} />}
                title="Infiltration ACH50"
                description="Blower door test result"
              >
                <input
                  className="load-input"
                  type="number"
                  step="0.1"
                  value={infiltrationACH50}
                  onChange={(e) => setInfiltrationACH50(e.target.value)}
                  style={inputControlStyle}
                />
                {envelopeSuggestions?.infiltrationACH50 && (
                  <div style={envelopeSuggestionBadgeStyle}>
                    <p style={envelopeSuggestionTextStyle}>AI Suggested: {envelopeSuggestions.infiltrationACH50.value}</p>
                    <button 
                      type="button" 
                      style={envelopeSuggestionActionStyle}
                      onClick={() => setInfiltrationACH50(String(envelopeSuggestions.infiltrationACH50!.value))}
                    >
                      Accept
                    </button>
                  </div>
                )}
              </InputField>
            </div>

            {envelopeSuggestions?.constructionNotes && envelopeSuggestions.constructionNotes.length > 0 && (
              <div style={constructionNotesListStyle}>
                <p style={{ ...sectionPanelTitleStyle, fontSize: "11px", marginBottom: "8px" }}>AI Extracted Construction Notes</p>
                {envelopeSuggestions.constructionNotes.map((note: string, idx: number) => (
                  <div key={idx} style={constructionNoteItemStyle}>
                    <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#d4af37" }} />
                    {note}
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginTop: "24px", padding: "16px", borderRadius: "16px", background: isEnvelopeVerified ? "rgba(34,197,94,0.08)" : "rgba(212,175,55,0.08)", border: `1px solid ${isEnvelopeVerified ? "rgba(34,197,94,0.2)" : "rgba(212,175,55,0.2)"}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <p style={{ ...sectionPanelTitleStyle, fontSize: "14px", margin: 0 }}>
                  Status: {isEnvelopeVerified ? "Verified Envelope" : (tracedRoomsWithSqft.length > 0 ? "Needs Review" : "Not Verified")}
                </p>
                <p style={{ ...sectionPanelDescriptionStyle, margin: 0 }}>
                  {isEnvelopeVerified ? "Verified data will be used for Manual J." : "Confirm material properties to proceed."}
                </p>
              </div>
              <button
                type="button"
                className="calc-action-button"
                style={{ 
                  marginTop: 0, 
                  width: "auto", 
                  background: isEnvelopeVerified ? "rgba(34,197,94,0.2)" : "rgba(212,175,55,0.2)",
                  color: isEnvelopeVerified ? "#4ade80" : "#fde68a",
                  border: `1px solid ${isEnvelopeVerified ? "rgba(34,197,94,0.4)" : "rgba(212,175,55,0.4)"}`
                }}
                onClick={() => setIsEnvelopeVerified(!isEnvelopeVerified)}
              >
                {isEnvelopeVerified ? "Reset Verification" : "Mark Envelope Verified"}
              </button>
            </div>
          </div>

          <div
            className="blueprint-takeoff-panel"
            style={{
              ...blueprintTakeoffPanelStyle,
              display: activeTechnicianSection === "manual-room-takeoff" ? "flex" : "none",
            }}
          >
            <div className={`blueprint-drafting-workspace ${isBlueprintFocusMode ? 'focus-mode' : ''}`} style={{ ...blueprintDraftingWorkspaceStyle, gridTemplateColumns: `260px minmax(520px, 1fr) ${activeInspectorWidth}` }}>
              <aside 
                className={`blueprint-workspace-sidebar ${isLeftPanelExpanded ? 'expanded' : ''}`} 
                style={blueprintWorkspaceSidebarStyle}
              >
                <button 
                  type="button" 
                  className="tablet-only-toggle"
                  onClick={() => setIsLeftPanelExpanded(!isLeftPanelExpanded)}
                  style={tabletToggleButtonStyle}
                  title={isLeftPanelExpanded ? "Collapse Sidebar" : "Expand Sidebar"}
                >
                  {isLeftPanelExpanded ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
                </button>

                <div style={sectionPanelHeaderStyle}>
                  <div style={sectionPanelIconStyle}>
                    <Layers size={18} strokeWidth={1.8} />
                  </div>
                  <div>
                    <p style={sectionPanelTitleStyle}>Manual Room Takeoff</p>
                    <p style={sectionPanelDescriptionStyle}>Trace rooms from a calibrated blueprint for field-ready takeoff.</p>
                  </div>
                </div>

                <p style={blueprintTakeoffNoteStyle}>
                  Detected rooms are preview suggestions only. Use calibrated tracing as the source of truth.
                </p>

                <div style={blueprintSidebarSectionHeaderStyle}>
                  <Activity size={12} /> Workflow Status
                </div>
                <div style={blueprintWorkflowStyle}>
                  {[
                    { label: "Blueprint Uploaded", status: blueprintFile ? 'done' : 'inactive' },
                    { label: "Preview Generated", status: blueprintPreviewUrl ? 'done' : 'inactive' },
                    { label: "Verified Takeoff Complete", status: (tracedRoomsWithSqft.length > 0 && blueprintCalibration.status === 'calibrated') ? 'done' : 'inactive' },
                    { label: "Sent to Manual J", status: blueprintRoomsForManualD.length > 0 ? 'done' : 'inactive' },
                    { label: "Sent to Manual D", status: blueprintRoomsForManualD.length > 0 ? 'done' : 'inactive' },
                  ].map((step) => {
                    const isDone = step.status === 'done';
                    const iconColor = isDone ? "#22c55e" : "#475569";
                    const labelStyle = isDone ? blueprintWorkflowStepIndicatorLabelDoneStyle : blueprintWorkflowStepIndicatorLabelStyle;

                    return (
                      <div key={step.label} style={isDone ? blueprintWorkflowStepIndicatorDoneStyle : blueprintWorkflowStepIndicatorStyle}>
                        {isDone ? <CheckCircle2 size={16} color={iconColor} /> : <Circle size={16} color={iconColor} />}
                        <p style={labelStyle}>{step.label}</p>
                      </div>
                    );
                  })}
                </div>

                <div style={blueprintSidebarSectionHeaderStyle}>
                  <PlayCircle size={12} /> Available Actions
                </div>
                <div style={{ display: 'grid', gap: '10px' }}>
                  {!blueprintFile && (
                    <label style={blueprintPrimaryActionButtonStyle}>
                      <UploadCloud size={18} /> Upload Blueprint
                      <input
                        ref={blueprintFileInputRef}
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                        onChange={handleBlueprintFileChange}
                        style={blueprintUploadInputStyle}
                      />
                    </label>
                  )}
                  
                  {blueprintFile && blueprintDetectionPipeline.rooms.length === 0 && (
                    <button type="button" style={blueprintPrimaryActionButtonStyle} onClick={runBlueprintAutoDetectPreview}>
                      <Zap size={18} /> Run AI Auto Detect
                    </button>
                  )}

                  {blueprintPreviewUrl && (
                    <button type="button" style={blueprintPrimaryActionButtonStyle} onClick={startBlueprintRoomOutlineTrace}>
                      <MousePointer2 size={18} /> {blueprintRoomTrace.isTracing ? "Continue Verified Trace" : "Start Verified Trace"}
                    </button>
                  )}

                  {blueprintDetectionPipeline.rooms.length > 0 && (
                    <button type="button" style={blueprintActionButtonStyle} onClick={() => {
                      scrollToTakeoffElement(detectedRoomsRef.current);
                    }}>
                      <ClipboardCheck size={18} /> Review AI Suggestions
                    </button>
                  )}

                  {tracedRoomsWithSqft.length > 0 && blueprintCalibration.status === 'calibrated' && (
                    <button type="button" style={blueprintActionButtonStyle} onClick={sendAllVerifiedRoomsToManualJ}>
                      <Wind size={18} /> Send Verified Takeoff to Manual J
                    </button>
                  )}

                  {blueprintFile && (
                    <button 
                      type="button"
                      onClick={() => {
                        if (
                          window.confirm(
                            "Removing this blueprint will clear the current calibration and traced room outlines. Rooms already sent to Manual J will remain. Continue?"
                          )
                        ) {
                          setBlueprintFile(null);
                          setBlueprintFileName("");
                          setBlueprintPreviewUrl("");
                          setBlueprintCalibration(createDefaultBlueprintCalibrationState());
                          setBlueprintRoomTrace(createDefaultBlueprintRoomTraceState());
                          setBlueprintDetectionPipeline({
                            mode: "preview",
                            status: "mock",
                            sourceFileName: "",
                            rooms: [],
                          });
                        }
                      }}
                      style={{ ...blueprintActionButtonStyle, border: '1px solid rgba(248,113,113,0.2)', background: 'rgba(248,113,113,0.05)', color: '#f87171' }}
                    >
                      <X size={18} /> Remove Blueprint
                    </button>
                  )}
                </div>

                <div style={blueprintSidebarSectionHeaderStyle}>
                  <ShieldCheck size={12} /> Project Summary
                </div>
                <div style={blueprintSummaryBlockStyle}>
                  <div style={blueprintSummaryItemStyle}>
                    <p style={blueprintSummaryLabelStyle}>Calibration</p>
                    <p style={{ ...blueprintSummaryValueStyle, color: blueprintCalibration.status === 'calibrated' ? '#22c55e' : '#f87171' }}>
                      {blueprintCalibration.status === 'calibrated' ? 'Confirmed' : 'Required'}
                    </p>
                  </div>
                  <div style={blueprintSummaryItemStyle}>
                    <p style={blueprintSummaryLabelStyle}>Verified Rooms</p>
                    <p style={blueprintSummaryValueStyle}>{tracedRoomsWithSqft.length}</p>
                  </div>
                  <div style={blueprintSummaryItemStyle}>
                   <p style={blueprintSummaryLabelStyle}>Verified Area</p>
                   <p style={blueprintSummaryValueStyle}>
                     {Math.round(totalTracedSqft).toLocaleString()} Sqft
                   </p>
                  </div>

                  <div style={blueprintSummaryItemStyle}>
                    <p style={blueprintSummaryLabelStyle}>Verified for Manual J</p>
                    <p style={{ ...blueprintSummaryValueStyle, color: (blueprintCalibration.status === 'calibrated' && tracedRoomsWithSqft.length > 0) ? '#22c55e' : '#64748b' }}>
                      {(blueprintCalibration.status === 'calibrated' && tracedRoomsWithSqft.length > 0) ? 'Ready' : 'Pending Verification'}
                    </p>
                  </div>

                  <div style={blueprintSummaryItemStyle}>
                    <p style={blueprintSummaryLabelStyle}>Focus Area Saved</p>
                    <p style={{ ...blueprintSummaryValueStyle, color: activeFocusArea ? '#22c55e' : '#64748b' }}>
                      {activeFocusArea ? 'Saved' : 'Not Set'}
                    </p>
                  </div>
                </div>

              </aside>

              <section className="blueprint-workspace-main" style={blueprintWorkspaceMainStyle}>
                {blueprintFile ? (
                  <div ref={blueprintPreviewRef} tabIndex={-1} style={{ ...blueprintWorkspaceStyle, gap: 0, padding: 0 }}>
                    {/* Professional Command Bar */}
                    <div style={{ ...blueprintCommandBarStyle, opacity: isTracingLock ? 0.4 : 1, pointerEvents: isTracingLock ? "none" : "auto" }}>
                      <div style={commandBarGroupStyle}>
                        <label style={commandBarButtonStyle}>
                          <UploadCloud size={16} />
                          Update Plan Sheet
                          <input
                            ref={blueprintFileInputRef}
                            type="file"
                            accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                            onChange={handleBlueprintFileChange}
                            style={blueprintUploadInputStyle}
                          />
                        </label>

                        {blueprintDocument && blueprintDocument.pages.length > 1 && (
                          <div style={{ ...commandBarGroupStyle, marginLeft: "8px", background: "rgba(255,255,255,0.03)", padding: "0 4px", borderRadius: "10px" }}>
                            <button
                              type="button"
                              style={{
                                ...commandBarButtonStyle,
                                background: "transparent",
                                border: "none",
                                padding: "0 8px",
                                opacity: blueprintDocument.pages.findIndex(p => p.id === blueprintDocument.activePageId) === 0 ? 0.3 : 1
                              }}
                              disabled={blueprintDocument.pages.findIndex(p => p.id === blueprintDocument.activePageId) === 0}
                              onClick={handlePrevPage}
                            >
                              <ChevronLeft size={18} />
                            </button>
                            <span style={blueprintNavigationPageLabelStyle}>
                              Page {blueprintDocument.pages.findIndex(p => p.id === blueprintDocument.activePageId) + 1} of {blueprintDocument.pages.length}
                            </span>
                            <button
                              type="button"
                              style={{
                                ...commandBarButtonStyle,
                                background: "transparent",
                                border: "none",
                                padding: "0 8px",
                                opacity: blueprintDocument.pages.findIndex(p => p.id === blueprintDocument.activePageId) === blueprintDocument.pages.length - 1 ? 0.3 : 1
                              }}
                              disabled={blueprintDocument.pages.findIndex(p => p.id === blueprintDocument.activePageId) === blueprintDocument.pages.length - 1}
                              onClick={handleNextPage}
                            >
                              <ChevronRight size={18} />
                            </button>
                          </div>
                        )}
                      </div>

                      <div style={commandBarGroupStyle}>
                        <button 
                          type="button" 
                          style={isFocusAreaMode ? commandBarButtonActiveStyle : commandBarButtonStyle} 
                          onClick={() => {
                            setIsFocusAreaMode(!isFocusAreaMode);
                            setBlueprintWorkspaceMode("manual-trace"); // Ensure we can click the overlay
                          }}
                          title={isFocusAreaMode ? "Cancel Building Focus" : "Set Building Focus Area"}
                        >
                          <Target size={16} /> {isFocusAreaMode ? "Cancel Focus" : "Set Building Focus"}
                        </button>
                        {activeFocusArea && (
                          <>
                            <button 
                              type="button" 
                              style={activeViewLabel === "focus" ? commandBarButtonActiveStyle : commandBarButtonStyle} 
                              onClick={jumpToBuilding}
                              title="Zoom and center on building footprint"
                            >
                              <Square size={16} /> Jump to Building
                            </button>
                            <button 
                              type="button" 
                              style={commandBarButtonStyle} 
                              onClick={() => {
                                setActiveFocusArea(null);
                                setActiveViewLabel("full");
                                setProjectActionMessage("Focus area cleared.");
                              }}
                              title="Clear Focus Area"
                            >
                              <X size={16} /> Clear
                            </button>
                          </>
                        )}
                      </div>

                      <div style={commandBarGroupStyle}>
                        <button 
                          type="button" 
                          style={isBlueprintFocusMode ? commandBarButtonActiveStyle : commandBarButtonStyle} 
                          onClick={() => setIsBlueprintFocusMode(!isBlueprintFocusMode)}
                          title={isBlueprintFocusMode ? "Show Sidebar Panels" : "Maximize Workspace"}
                        >
                          {isBlueprintFocusMode ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                          {isBlueprintFocusMode ? "Show Panels" : "Maximize Workspace"}
                        </button>
                        <button type="button" style={commandBarButtonStyle} onClick={fitBlueprintToWidth}>
                          <Maximize2 size={16} /> Fit Width
                        </button>
                        <button type="button" style={activeViewLabel === "full" ? commandBarButtonActiveStyle : commandBarButtonStyle} onClick={showFullSheet}>
                          <RotateCcw size={16} /> View Full Sheet
                        </button>
                        <div style={{ ...commandBarGroupStyle, marginLeft: "4px" }}>
                          <button type="button" style={{ ...commandBarButtonStyle, padding: "0 12px" }} onClick={zoomBlueprintOut}>-</button>
                          <span style={blueprintZoomLabelStyle}>{Math.round(blueprintZoom * 100)}%</span>
                          <button type="button" style={{ ...commandBarButtonStyle, padding: "0 12px" }} onClick={zoomBlueprintIn}>+</button>
                          <div style={blueprintViewBadgeStyle}>
                            {!activeFocusArea ? "Focus Area Not Set" : activeViewLabel === "focus" ? "Viewing Building Focus" : "Viewing Full Sheet"}
                          </div>
                        </div>
                      </div>
                    </div>

                    {isTracingLock && (
                      <div style={{ background: "rgba(212,175,55,0.12)", borderBottom: "1px solid rgba(212,175,55,0.3)", padding: "6px 16px", color: "#fde68a", fontSize: "11px", fontWeight: 700, textAlign: "center" }}>
                        {selectedTracePointIndex !== null 
                          ? `Point ${selectedTracePointIndex + 1} selected — use arrow keys to nudge. Shift = faster.`
                          : "Tracing room — pan to move view. Finish or cancel to unlock tools."}
                      </div>
                    )}

                    <div style={{ ...blueprintWorkspaceToolbarStyle, padding: "8px 12px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <div>
                        <p style={blueprintWorkspaceLabelStyle}>Blueprint Workspace</p>
                        <p style={blueprintWorkspaceMetaStyle}>
                          {blueprintCalibrationStatusText} · {blueprintTraceCalibrationStatusText}
                        </p>
                      </div>

                      <div style={blueprintTraceInlineStyle}>
                        <div>
                          <p style={blueprintCalibrationStatusStyle}>
                            {blueprintRoomTrace.isTracing
                              ? `Tracing: ${selectedDetectedRoomId ? (detectedBlueprintRooms.find(r => r.id === selectedDetectedRoomId)?.name || "New Room") : "New Room"}`
                              : "Verified Takeoff"}
                          </p>
                          <p style={blueprintCalibrationHelperStyle}>{blueprintRoomTraceStatusText}</p>
                        </div>
                        {!blueprintRoomTrace.isTracing && (
                          <button
                            type="button"
                            style={blueprintTraceButtonStyle}
                            onClick={startBlueprintRoomOutlineTrace}
                          >
                            Start Trace
                          </button>
                        )}
                        {blueprintRoomTrace.isTracing && blueprintRoomTrace.draftPoints.length > 0 ? (
                          <button
                            type="button"
                            style={blueprintTraceButtonStyle}
                            onClick={undoLastBlueprintRoomTracePoint}
                          >
                            Undo
                          </button>
                        ) : null}
                        {blueprintRoomTrace.isTracing ? (
                          <button
                            type="button"
                            style={blueprintTraceSecondaryButtonStyle}
                            onClick={cancelBlueprintRoomOutlineTrace}
                          >
                            Cancel
                          </button>
                        ) : null}
                        {blueprintRoomTrace.draftPoints.length >= 3 ? (
                          <button
                            type="button"
                            style={blueprintTraceButtonStyle}
                            onClick={finishBlueprintRoomOutlineTrace}
                          >
                            Finish
                          </button>
                        ) : null}
                      </div>
                    </div>

                    <div ref={blueprintViewportRef} style={{
                    ...blueprintViewportStyle,
                    ...(isTracingLock ? {
                    border: "2px solid rgba(212,175,55,0.8)",
                    boxShadow: "0 0 20px rgba(212,175,55,0.2) inset",
                    overflow: "auto",
                    touchAction: "pan-x pan-y",
                    } : {})
                    }}>
                  <div
                    style={{
                      ...blueprintCanvasStyle,
                      transform: `scale(${blueprintZoom})`,
                    }}
                  >
                    {isBlueprintRestoring && (
                      <div style={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "rgba(15, 23, 42, 0.8)",
                        zIndex: 20,
                        borderRadius: "16px",
                      }}>
                        <p style={{ color: "#fde68a", fontSize: "12px", fontWeight: 800 }}>Restoring Blueprint...</p>
                      </div>
                    )}
                    {blueprintPreviewUrl ? (
                      <img
                        ref={blueprintImageRef}
                        src={blueprintPreviewUrl}
                        alt={`${blueprintFileName} preview`}
                        style={{
                          ...blueprintImagePreviewStyle,
                          opacity: isBlueprintRestoring ? 0 : 1,
                          transition: "opacity 0.2s ease",
                        }}
                        onLoad={() => {
                          if (isBlueprintRestoring && pendingV3Rooms) {
                            setBlueprintRoomTrace((currentTrace) => ({
                              ...currentTrace,
                              roomOutlines: pendingV3Rooms,
                            }));
                            setPendingV3Rooms(null);
                            setIsBlueprintRestoring(false);
                          }
                        }}
                        onError={() => {
                          if (isBlueprintRestoring && pendingV3Rooms) {
                            setBlueprintRoomTrace((currentTrace) => ({
                              ...currentTrace,
                              roomOutlines: pendingV3Rooms,
                            }));
                            setPendingV3Rooms(null);
                            setIsBlueprintRestoring(false);
                          }
                        }}
                      />
                    ) : (
                      <div style={blueprintPdfPreviewStyle}>
                        <p style={blueprintPdfPreviewTitleStyle}>PDF Blueprint</p>
                        <p style={blueprintPdfPreviewTextStyle}>{blueprintFileName}</p>
                      </div>
                    )}
                    <div
                      ref={blueprintOverlayRef}
                      id="blueprint-calibration-overlay"
                      style={{
                        ...blueprintCalibrationOverlayStyle,
                        visibility: isBlueprintRestoring ? "hidden" : "visible",
                      }}
                      aria-label="Blueprint calibration point selection overlay"
                      onClick={selectBlueprintCalibrationPointFromPreview}
                      onPointerDown={handleFocusAreaPointerDown}
                      onPointerMove={moveDraggedBlueprintTracePoint}
                      onPointerUp={finishDraggingBlueprintTracePoint}
                      onPointerLeave={finishDraggingBlueprintTracePoint}
                    >
                      {/* Active Focus Area Visual */}
                      {activeFocusArea && (
                        <div
                          style={{
                            ...blueprintFocusAreaStyle,
                            left: `${activeFocusArea.x}%`,
                            top: `${activeFocusArea.y}%`,
                            width: `${activeFocusArea.width}%`,
                            height: `${activeFocusArea.height}%`,
                            // During drawing, make it more obvious
                            background: isFocusAreaMode ? "rgba(212,175,55,0.15)" : "rgba(212,175,55,0.05)",
                          }}
                        >
                          <span style={blueprintFocusAreaLabelStyle}>Building Focus Area</span>
                        </div>
                      )}

                      {tracedRoomsWithSqft.map((outline) => (
                        <svg
                          key={outline.id}
                          viewBox="0 0 100 100"
                          preserveAspectRatio="none"
                          style={{ ...blueprintRoomOutlineSvgStyle, pointerEvents: "auto" }}
                          aria-label={`${outline.name} boundary edges`}
                        >
                          <polygon
                            points={outline.points.map((point) => `${point.xPercent},${point.yPercent}`).join(" ")}
                            style={blueprintRoomOutlinePolygonStyle}
                          />
                          {(outline.boundaryEdges ?? createDefaultBlueprintRoomBoundaryEdges(outline.points)).map(
                            (edge, edgeIndex) => {
                              const startPoint = outline.points[edge.startPointIndex];
                              const endPoint = outline.points[edge.endPointIndex];
                              const isSelectedEdge =
                                selectedBlueprintBoundaryEdge?.outlineId === outline.id &&
                                selectedBlueprintBoundaryEdge.edgeIndex === edgeIndex;

                              if (!startPoint || !endPoint) return null;

                              return (
                                <line
                                  key={`${outline.id}-boundary-${edgeIndex}`}
                                  x1={startPoint.xPercent}
                                  y1={startPoint.yPercent}
                                  x2={endPoint.xPercent}
                                  y2={endPoint.yPercent}
                                  role="button"
                                  tabIndex={0}
                                  aria-label={`Select ${outline.name} boundary edge ${edgeIndex + 1}`}
                                  style={getBoundaryEdgeStyle(edge.boundaryType, isSelectedEdge)}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    selectTracedRoomBoundaryEdge(outline.id, edgeIndex);
                                  }}
                                  onKeyDown={(event) => {
                                    if (event.key !== "Enter" && event.key !== " ") return;
                                    event.preventDefault();
                                    selectTracedRoomBoundaryEdge(outline.id, edgeIndex);
                                  }}
                                />
                              );
                            }
                          )}
                        </svg>
                      ))}
                      {blueprintRoomTrace.draftPoints.length > 0 ? (
                        <svg
                          viewBox="0 0 100 100"
                          preserveAspectRatio="none"
                          style={blueprintRoomOutlineSvgStyle}
                          aria-hidden="true"
                        >
                          <polyline
                            points={blueprintRoomTrace.draftPoints.map((point) => `${point.xPercent},${point.yPercent}`).join(" ")}
                            style={blueprintRoomDraftLineStyle}
                          />
                          {blueprintRoomTrace.draftPoints.length >= 3 ? (
                            <polygon
                              points={blueprintRoomTrace.draftPoints.map((point) => `${point.xPercent},${point.yPercent}`).join(" ")}
                              style={blueprintRoomDraftPolygonStyle}
                            />
                          ) : null}
                        </svg>
                      ) : null}
                      {blueprintRoomTrace.draftPoints.map((point, index) => (
                        <span
                          key={`blueprint-room-draft-point-${index}-${point.xPercent}-${point.yPercent}`}
                          ref={(el) => { draftTracePointRefs.current[index] = el; }}
                          tabIndex={0}
                          style={{
                            ...(index === 0 ? blueprintRoomTracePointStartStyle : blueprintRoomTracePointStyle),
                            ...(draggingTracePointIndex === index ? blueprintRoomTracePointDraggingStyle : null),
                            ...(selectedTracePointIndex === index ? blueprintRoomTracePointSelectedStyle : null),
                            left: `${point.xPercent}%`,
                            top: `${point.yPercent}%`,
                          }}
                          onFocus={() => setSelectedTracePointIndex(index)}
                          onPointerDown={(event) => {
                            event.stopPropagation();
                            suppressNextBlueprintOverlayClickRef.current = true;
                            setDraggingTracePointIndex(index);
                            setSelectedTracePointIndex(index);
                          }}
                          onKeyDown={(event) => {
                            const isInput = ["INPUT", "TEXTAREA", "SELECT"].includes((event.target as HTMLElement).tagName) || 
                                           (event.target as HTMLElement).isContentEditable;
                            
                            if (isInput && event.target !== event.currentTarget) return;

                            const isArrow = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key);
                            if (!isArrow) return;

                            event.preventDefault();
                            event.stopPropagation();

                            const step = event.shiftKey ? 0.25 : 0.05;
                            let nextX = point.xPercent;
                            let nextY = point.yPercent;

                            if (event.key === "ArrowLeft") nextX -= step;
                            if (event.key === "ArrowRight") nextX += step;
                            if (event.key === "ArrowUp") nextY -= step;
                            if (event.key === "ArrowDown") nextY += step;

                            const clampedX = Math.min(100, Math.max(0, nextX));
                            const clampedY = Math.min(100, Math.max(0, nextY));

                            if (clampedX !== point.xPercent || clampedY !== point.yPercent) {
                              setLastNudgeTime(Date.now());
                            }

                            setBlueprintRoomTrace((currentTrace) =>
                              updateBlueprintRoomTracePoint(currentTrace, index, {
                                xPercent: clampedX,
                                yPercent: clampedY,
                              })
                            );
                          }}
                          onClick={(event) => event.stopPropagation()}
                        >
                          <div style={{ 
                            ...blueprintRoomTraceCrosshairLineHStyle, 
                            width: (index === 0 || draggingTracePointIndex === index || selectedTracePointIndex === index) ? "11px" : "9px" 
                          }} />
                          <div style={{ 
                            ...blueprintRoomTraceCrosshairLineVStyle, 
                            height: (index === 0 || draggingTracePointIndex === index || selectedTracePointIndex === index) ? "11px" : "9px" 
                          }} />
                          <div style={blueprintRoomTraceCrosshairDotStyle} />
                          <span style={blueprintRoomTraceNumberLabelStyle}>{index + 1}</span>
                          {selectedTracePointIndex === index && <div style={{ ...blueprintRoomTracePointFocusStyle, position: "absolute", inset: "-4px", borderRadius: "50%", pointerEvents: "none" }} />}
                          {selectedTracePointIndex === index && Date.now() - lastNudgeTime < 400 && (
                            <div key={`nudge-pulse-${lastNudgeTime}`} style={blueprintRoomTraceNudgePulseStyle} />
                          )}
                        </span>
                      ))}
                      {blueprintCalibration.startPoint && blueprintCalibration.endPoint ? (
                        <>
                          <svg
                            viewBox="0 0 100 100"
                            preserveAspectRatio="none"
                            style={blueprintCalibrationLineSvgStyle}
                            aria-hidden="true"
                          >
                            <line
                              x1={blueprintCalibration.startPoint.xPercent}
                              y1={blueprintCalibration.startPoint.yPercent}
                              x2={blueprintCalibration.endPoint.xPercent}
                              y2={blueprintCalibration.endPoint.yPercent}
                              style={
                                blueprintCalibration.status === "calibrated"
                                  ? blueprintCalibrationLineConfirmedStyle
                                  : blueprintCalibrationLineStyle
                              }
                            />
                          </svg>
                          {blueprintMeasuredFeet !== null ? (
                            <span
                              style={{
                                ...blueprintMeasurementLabelStyle,
                                left: `${(blueprintCalibration.startPoint.xPercent + blueprintCalibration.endPoint.xPercent) / 2}%`,
                                top: `${(blueprintCalibration.startPoint.yPercent + blueprintCalibration.endPoint.yPercent) / 2}%`,
                              }}
                            >
                              {blueprintMeasuredFeet.toFixed(2)} ft
                            </span>
                          ) : null}
                        </>
                      ) : null}
                      {blueprintCalibration.startPoint ? (
                        <span
                          style={{
                            ...blueprintCalibrationPointStyle,
                            left: `${blueprintCalibration.startPoint.xPercent}%`,
                            top: `${blueprintCalibration.startPoint.yPercent}%`,
                          }}
                        >
                          <div style={blueprintCalibrationCrosshairLineHStyle} />
                          <div style={blueprintCalibrationCrosshairLineVStyle} />
                          <div style={blueprintCalibrationCrosshairDotStyle} />
                          <span style={blueprintCalibrationNumberLabelStyle}>A</span>
                        </span>
                      ) : null}
                      {blueprintCalibration.endPoint ? (
                        <span
                          style={{
                            ...blueprintCalibrationPointStyle,
                            left: `${blueprintCalibration.endPoint.xPercent}%`,
                            top: `${blueprintCalibration.endPoint.yPercent}%`,
                          }}
                        >
                          <div style={blueprintCalibrationCrosshairLineHStyle} />
                          <div style={blueprintCalibrationCrosshairLineVStyle} />
                          <div style={blueprintCalibrationCrosshairDotStyle} />
                          <span style={blueprintCalibrationNumberLabelStyle}>B</span>
                        </span>
                      ) : null}

                      {/* Verification Overlay */}
                      {blueprintCalibration.verification?.startPoint && (
                        <span
                          style={{
                            ...blueprintVerificationPointStyle,
                            left: `${blueprintCalibration.verification.startPoint.xPercent}%`,
                            top: `${blueprintCalibration.verification.startPoint.yPercent}%`,
                          }}
                        >
                          <div style={blueprintCalibrationCrosshairLineHStyle} />
                          <div style={blueprintCalibrationCrosshairLineVStyle} />
                          <div style={blueprintCalibrationCrosshairDotStyle} />
                          <span style={blueprintCalibrationNumberLabelStyle}>V1</span>
                        </span>
                      )}
                      {blueprintCalibration.verification?.endPoint && (
                        <>
                          <svg
                            viewBox="0 0 100 100"
                            preserveAspectRatio="none"
                            style={blueprintCalibrationLineSvgStyle}
                            aria-hidden="true"
                          >
                            <line
                              x1={blueprintCalibration.verification.startPoint?.xPercent || 0}
                              y1={blueprintCalibration.verification.startPoint?.yPercent || 0}
                              x2={blueprintCalibration.verification.endPoint.xPercent}
                              y2={blueprintCalibration.verification.endPoint.yPercent}
                              style={blueprintVerificationLineStyle}
                            />
                          </svg>
                          <span
                            style={{
                              ...blueprintVerificationPointStyle,
                              left: `${blueprintCalibration.verification.endPoint.xPercent}%`,
                              top: `${blueprintCalibration.verification.endPoint.yPercent}%`,
                            }}
                          >
                            <div style={blueprintCalibrationCrosshairLineHStyle} />
                            <div style={blueprintCalibrationCrosshairLineVStyle} />
                            <div style={blueprintCalibrationCrosshairDotStyle} />
                            <span style={blueprintCalibrationNumberLabelStyle}>V2</span>
                          </span>
                        </>
                      )}
                    </div>
                    {blueprintWorkspaceMode === "review-detected" && detectedBlueprintRooms.length > 0 ? (
                      <div style={blueprintOverlayLayerStyle} aria-label="Detected room preview overlay">
                        {detectedBlueprintRooms.map((room) => {
                          const isSelectedRoom = selectedDetectedRoomId === room.id;

                          return (
                            <button
                              type="button"
                              key={`blueprint-overlay-${room.id}`}
                              aria-label={`Highlight ${room.name || "detected room"}`}
                              style={{
                                ...blueprintOverlayMarkerStyle,
                                ...(isSelectedRoom ? blueprintOverlayMarkerActiveStyle : null),
                                left: `${room.overlay.leftPercent}%`,
                                top: `${room.overlay.topPercent}%`,
                                width: `${room.overlay.widthPercent}%`,
                                height: `${room.overlay.heightPercent}%`,
                              }}
                              onClick={() => selectDetectedRoomFromOverlay(room.id)}
                            >
                              <span style={blueprintOverlayLabelStyle}>{room.name || "Room"}</span>
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                </div>

                  </div>
                ) : (
                  <div style={blueprintWorkspaceEmptyStyle}>
                    <p style={blueprintWorkspaceLabelStyle}>No blueprint selected</p>
                    <p style={blueprintWorkspaceMetaStyle}>Upload a PDF or image from the workflow rail to begin drafting.</p>
                  </div>
                )}
              </section>

              <aside 
                className={`blueprint-workspace-inspector ${isRightPanelExpanded ? 'expanded' : ''}`} 
                style={{
                  ...blueprintWorkspaceInspectorStyle,
                  width: activeInspectorWidth,
                  transition: "width 0.2s ease-in-out",
                  ...(isTracingLock ? { display: "none" } : {}),
                }}
              >
                <button 
                  type="button" 
                  className="tablet-only-toggle"
                  onClick={() => setIsRightPanelExpanded(!isRightPanelExpanded)}
                  style={tabletToggleButtonStyle}
                  title={isRightPanelExpanded ? "Collapse Inspector" : "Expand Inspector"}
                >
                  {isRightPanelExpanded ? <PanelRightClose size={20} /> : <PanelRightOpen size={20} />}
                </button>

                {/* Compact Calibration Section */}
                <div style={{ ...blueprintInspectorCardStyle, padding: "8px" }} title="Blueprint Calibration">
                  <p style={{ ...blueprintCalibrationStatusStyle, color: blueprintCalibrationUI.statusColor, fontSize: "10px", textAlign: "center" }}>
                    {blueprintCalibrationUI.statusText === "Scale not verified" ? "UNVERIFIED" : "CALIBRATED"}
                  </p>
                  
                  <div style={{ display: "grid", gap: "10px", marginTop: "10px" }}>
                    <div style={structuredCalibrationGridStyle}>
                      <label style={roomCardInputWrapperStyle}>
                        <span style={roomCardInputLabelStyle}>FT</span>
                        <input
                          className="load-input blueprint-takeoff-control"
                          type="number"
                          min="0"
                          value={calibrationFeet}
                          onChange={(e) => updateStructuredCalibration(e.target.value, calibrationInches, calibrationFraction)}
                          style={{ ...blueprintCalibrationInputStyle, width: "100%", height: "32px", fontSize: "11px" }}
                        />
                      </label>
                      <label style={roomCardInputWrapperStyle}>
                        <span style={roomCardInputLabelStyle}>IN</span>
                        <input
                          className="load-input blueprint-takeoff-control"
                          type="number"
                          min="0"
                          max="11"
                          value={calibrationInches}
                          onChange={(e) => updateStructuredCalibration(calibrationFeet, e.target.value, calibrationFraction)}
                          style={{ ...blueprintCalibrationInputStyle, width: "100%", height: "32px", fontSize: "11px" }}
                        />
                      </label>
                      <label style={roomCardInputWrapperStyle}>
                        <span style={roomCardInputLabelStyle}>1/16</span>
                        <select
                          className="load-select blueprint-takeoff-control"
                          value={calibrationFraction}
                          onChange={(e) => updateStructuredCalibration(calibrationFeet, calibrationInches, e.target.value)}
                          style={{ ...blueprintCalibrationInputStyle, width: "100%", height: "32px", fontSize: "10px", padding: "0 4px" }}
                        >
                          {FRACTION_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </label>
                    </div>

                    {blueprintCalibrationMeasurementText && (
                      <div style={{ ...blueprintCalibrationHelperStyle, display: "grid", gap: "2px", marginTop: "6px", textAlign: "center" }}>
                        <span style={{ fontSize: "11px", fontWeight: 900, color: "#fde68a" }}>
                          Known Length: {blueprintCalibrationMeasurementText.arch}
                        </span>
                        <span style={{ fontSize: "10px", fontWeight: 800, color: "#94a3b8" }}>
                          = {blueprintCalibrationMeasurementText.decimal}
                        </span>
                      </div>
                    )}

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                      <button
                        type="button"
                        style={{ ...blueprintCalibrationButtonStyle, width: "100%", minHeight: "28px", fontSize: "10px" }}
                        onClick={recalibrateBlueprintScale}
                      >
                        Reset
                      </button>
                      <button
                        type="button"
                        disabled={blueprintCalibrationUI.isDisabled || (blueprintCalibrationUI.actionText === "Verified Scale")}
                        style={{ 
                          ...(blueprintCalibrationUI.actionText === "Confirm Scale" ? blueprintCalibrationConfirmButtonStyle : blueprintCalibrationButtonStyle), 
                          width: "100%",
                          minHeight: "28px",
                          fontSize: "10px",
                          ...(blueprintCalibrationUI.actionText === "Verified Scale" ? { background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)", color: "#4ade80", cursor: "default" } : {}),
                          ...(blueprintCalibrationUI.isDisabled ? { opacity: 0.5, cursor: "not-allowed" } : {})
                        }}
                        onClick={blueprintCalibrationUI.canConfirm && blueprintCalibrationUI.actionText !== "Verified Scale" ? confirmCurrentBlueprintCalibration : undefined}
                      >
                        {blueprintCalibrationUI.actionText === "Confirm Scale" ? "CONFIRM" : "CALIBRATE"}
                      </button>
                    </div>
                  </div>

                  {blueprintCalibration.status === "calibrated" && (
                    <button
                      type="button"
                      onClick={() => setIsVerificationMode(!isVerificationMode)}
                      style={{
                        ...blueprintTraceButtonStyle,
                        marginTop: "8px",
                        padding: "4px",
                        fontSize: "9px",
                        background: isVerificationMode ? "rgba(168,85,247,0.24)" : "rgba(15,23,42,0.64)",
                        minHeight: "24px",
                        width: "100%",
                      }}
                    >
                      {isVerificationMode ? "EXIT VERIF" : "VERIFY"}
                    </button>
                  )}
                </div>

                {/* Compact Drafting Section */}
                <div style={{ ...blueprintInspectorCardStyle, padding: "8px" }} title="Drafting Status">
                  <p style={{ ...blueprintCalibrationStatusStyle, fontSize: "10px", textAlign: "center" }}>DRAFTING</p>
                  <div style={{ display: "grid", gap: "4px", marginTop: "6px" }}>
                    <div style={{ ...blueprintAirflowPreviewMetricStyle, padding: "4px", flexDirection: "column", gap: "2px" }}>
                      <span style={{ ...blueprintAirflowPreviewMetricLabelStyle, fontSize: "8px" }}>DETECTED</span>
                      <strong style={{ fontSize: "11px" }}>{detectedBlueprintRooms.length}</strong>
                    </div>
                    <div style={{ ...blueprintAirflowPreviewMetricStyle, padding: "4px", flexDirection: "column", gap: "2px" }}>
                      <span style={{ ...blueprintAirflowPreviewMetricLabelStyle, fontSize: "8px" }}>TRACED</span>
                      <strong style={{ fontSize: "11px" }}>{tracedRoomsWithSqft.length}</strong>
                    </div>
                  </div>
                </div>

                {/* Compact Contextual Inspector */}
                {selectedTracedRoom && selectedBoundaryEdgeMetadata && selectedBlueprintBoundaryEdge ? (
                  <div style={{ ...blueprintInspectorCardStyle, padding: "8px" }} title="Edge Inspector">
                    <p style={{ ...blueprintCalibrationStatusStyle, fontSize: "10px", textAlign: "center" }}>EDGE</p>
                    <p style={{ ...blueprintCalibrationHelperStyle, fontSize: "9px", textAlign: "center" }}>
                      {selectedTracedRoom.name.substring(0, 8)}..
                    </p>
                    <select
                      className="load-input blueprint-takeoff-control"
                      value={selectedBoundaryEdgeMetadata.boundaryType}
                      onChange={(event) =>
                        updateSelectedBoundaryType(event.target.value as BlueprintRoomBoundaryType)
                      }
                      style={{ ...blueprintCalibrationInputStyle, padding: "4px", fontSize: "10px", height: "28px", marginTop: "4px", width: "100%" }}
                    >
                      {BLUEPRINT_BOUNDARY_TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>

                    {/* Openings Editor */}
                    <div style={{ marginTop: "12px", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "8px" }}>
                      <p style={{ ...blueprintCalibrationStatusStyle, fontSize: "9px", opacity: 0.8 }}>OPENINGS</p>
                      
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginTop: "6px" }}>
                        <button
                          type="button"
                          style={{ ...blueprintCalibrationButtonStyle, padding: "4px", fontSize: "9px", minHeight: "26px" }}
                          onClick={() => addOpeningToSelectedEdge("window")}
                        >
                          + Window
                        </button>
                        <button
                          type="button"
                          style={{ ...blueprintCalibrationButtonStyle, padding: "4px", fontSize: "9px", minHeight: "26px" }}
                          onClick={() => addOpeningToSelectedEdge("door")}
                        >
                          + Door
                        </button>
                      </div>

                      <div style={{ maxHeight: "180px", overflowY: "auto", marginTop: "4px" }}>
                        {(selectedBoundaryEdgeMetadata.openings ?? []).map((opening) => (
                          <div key={opening.id} style={inspectorOpeningItemStyle}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <span style={{ fontSize: "10px", fontWeight: 900, color: "#fde68a" }}>
                                {opening.type.toUpperCase()}
                              </span>
                              <button
                                type="button"
                                style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", padding: 0 }}
                                onClick={() => removeOpeningFromSelectedEdge(opening.id)}
                              >
                                <X size={12} />
                              </button>
                            </div>
                            
                            <div style={inspectorOpeningInputGridStyle}>
                              <label style={roomCardInputWrapperStyle}>
                                <span style={roomCardInputLabelStyle}>W (FT)</span>
                                <input
                                  className="load-input blueprint-takeoff-control"
                                  type="number"
                                  step="0.1"
                                  value={opening.widthFeet}
                                  onChange={(e) => updateOpeningInSelectedEdge(opening.id, "widthFeet", e.target.value)}
                                  style={{ ...blueprintCalibrationInputStyle, width: "100%", height: "24px", fontSize: "10px", padding: "0 4px" }}
                                />
                              </label>
                              <label style={roomCardInputWrapperStyle}>
                                <span style={roomCardInputLabelStyle}>H (FT)</span>
                                <input
                                  className="load-input blueprint-takeoff-control"
                                  type="number"
                                  step="0.1"
                                  value={opening.heightFeet}
                                  onChange={(e) => updateOpeningInSelectedEdge(opening.id, "heightFeet", e.target.value)}
                                  style={{ ...blueprintCalibrationInputStyle, width: "100%", height: "24px", fontSize: "10px", padding: "0 4px" }}
                                />
                              </label>
                            </div>
                            <div style={{ textAlign: "right", fontSize: "9px", fontWeight: 800, color: "#94a3b8" }}>
                              {(opening.widthFeet * opening.heightFeet).toFixed(1)} SQFT
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : selectedDetectedRoom && selectedDetectedRoomAirflow ? (
                  <div style={{ ...blueprintInspectorCardStyle, padding: "8px" }} title="Room Airflow">
                    <p style={{ ...blueprintCalibrationStatusStyle, fontSize: "10px", textAlign: "center" }}>AIRFLOW</p>
                    <div style={{ display: "grid", gap: "4px", marginTop: "6px" }}>
                      <div style={{ ...blueprintAirflowPreviewMetricStyle, padding: "4px", flexDirection: "column", gap: "2px" }}>
                        <span style={{ ...blueprintAirflowPreviewMetricLabelStyle, fontSize: "8px" }}>CFM</span>
                        <strong style={{ fontSize: "11px" }}>{Math.round(selectedDetectedRoomAirflow.estimatedCfm)}</strong>
                      </div>
                      <div style={{ ...blueprintAirflowPreviewMetricStyle, padding: "4px", flexDirection: "column", gap: "2px" }}>
                        <span style={{ ...blueprintAirflowPreviewMetricLabelStyle, fontSize: "8px" }}>DUCT</span>
                        <strong style={{ fontSize: "11px" }}>{selectedDetectedRoomAirflow.ductRecommendation.diameterInches}"</strong>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ ...blueprintInspectorCardStyle, padding: "8px" }}>
                    <p style={{ ...blueprintCalibrationStatusStyle, fontSize: "10px", textAlign: "center", opacity: 0.6 }}>IDLE</p>
                  </div>
                )}
              </aside>
            </div>

            <details style={blueprintDrawerStyle}>
              <summary style={blueprintDrawerSummaryStyle}>
                Detected Rooms · {detectedBlueprintRooms.length}
              </summary>
              <div ref={detectedRoomsRef} tabIndex={-1} style={detectedRoomsSectionStyle}>
              <div>
                <p style={blueprintManualFallbackLabelStyle}>Detected Rooms</p>
                <p style={detectedRoomsNoteStyle}>
                  Detected rooms are preview suggestions only. Trace and confirm rooms manually for accuracy.
                  AI will assist later, but calibrated tracing remains the source of truth.
                </p>
                {detectedRoomActionMessage ? (
                  <p style={detectedRoomActionMessageStyle}>{detectedRoomActionMessage}</p>
                ) : null}
              </div>
              <div style={detectedRoomsGridStyle}>
                {detectedBlueprintRooms.map((room) => {
                  const isSelectedRoom = selectedDetectedRoomId === room.id;

                  return (
                    <div
                      id={`detected-room-card-${room.id}`}
                      key={room.id}
                      style={isSelectedRoom ? { ...detectedRoomCardStyle, ...detectedRoomCardActiveStyle } : detectedRoomCardStyle}
                      onClick={() => setSelectedDetectedRoomId(room.id)}
                    >
                      <div style={detectedRoomHeaderStyle}>
                        <input
                          id={`detected-room-name-${room.id}`}
                          className="load-input blueprint-takeoff-control"
                          aria-label={`${room.name} detected room name`}
                          value={room.name}
                          onChange={(event) => updateDetectedRoom(room.id, "name", event.target.value)}
                          style={detectedRoomInputStyle}
                        />
                        <div style={detectedRoomBadgeGroupStyle}>
                          <span style={detectedRoomConfidenceBadgeStyle}>
                            {room.confidencePercent}% confidence
                          </span>
                          <span style={getDetectedRoomStatusStyle(room.workflowStatus)}>
                            {getDetectedRoomStatusLabel(room.workflowStatus)}
                          </span>
                        </div>
                      </div>
                      <div style={detectedRoomFactsStyle}>
                        <span>{room.name || "Unnamed room"}</span>
                        <span>{room.squareFeet.toLocaleString()} sq ft</span>
                        <span>Level {room.floorLevel || "1"}</span>
                        <span>{room.confidencePercent}% mock AI match</span>
                      </div>
                      <div style={detectedRoomEditGridStyle}>
                        <label style={detectedRoomEditFieldStyle}>
                          <span style={detectedRoomEditLabelStyle}>Sq. Ft.</span>
                          <input
                            className="load-input blueprint-takeoff-control"
                            type="number"
                            min="0"
                            value={room.squareFeet}
                            onChange={(event) => updateDetectedRoom(room.id, "squareFeet", event.target.value)}
                            style={detectedRoomCompactInputStyle}
                          />
                        </label>
                        <label style={detectedRoomEditFieldStyle}>
                          <span style={detectedRoomEditLabelStyle}>Floor</span>
                          <input
                            className="load-input blueprint-takeoff-control"
                            value={room.floorLevel}
                            onChange={(event) => updateDetectedRoom(room.id, "floorLevel", event.target.value)}
                            style={detectedRoomCompactInputStyle}
                          />
                        </label>
                        <label style={detectedRoomEditFieldStyle}>
                          <span style={detectedRoomEditLabelStyle}>Windows</span>
                          <input
                            className="load-input blueprint-takeoff-control"
                            type="number"
                            min="0"
                            value={room.windowsCount}
                            onChange={(event) => updateDetectedRoom(room.id, "windowsCount", event.target.value)}
                            style={detectedRoomCompactInputStyle}
                          />
                        </label>
                        <label style={detectedRoomEditFieldStyle}>
                          <span style={detectedRoomEditLabelStyle}>Ext. Walls</span>
                          <input
                            className="load-input blueprint-takeoff-control"
                            type="number"
                            min="0"
                            value={room.exteriorWallsCount}
                            onChange={(event) => updateDetectedRoom(room.id, "exteriorWallsCount", event.target.value)}
                            style={detectedRoomCompactInputStyle}
                          />
                        </label>
                      </div>
                      <div style={detectedRoomActionsStyle}>
                        <button
                          type="button"
                          style={detectedRoomButtonStyle}
                          onClick={() => focusDetectedRoomName(room.id)}
                        >
                          Rename
                        </button>
                        <button
                          type="button"
                          style={detectedRoomButtonStyle}
                          onClick={() => confirmDetectedRoom(room.id)}
                          onPointerUp={(event) => {
                            if (event.pointerType === "mouse") return;
                            event.preventDefault();
                            confirmDetectedRoom(room.id);
                          }}
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          style={detectedRoomButtonStyle}
                          onClick={() => useDetectedRoomAsTrace(room)}
                          onPointerUp={(event) => {
                            if (event.pointerType === "mouse") return;
                            event.preventDefault();
                            useDetectedRoomAsTrace(room);
                          }}
                        >
                          Use as Trace
                        </button>
                        <button
                          type="button"
                          style={detectedRoomRemoveButtonStyle}
                          onClick={() => removeDetectedRoom(room.id)}
                          onPointerUp={(event) => {
                            if (event.pointerType === "mouse") return;
                            event.preventDefault();
                            removeDetectedRoom(room.id);
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              </div>
            </details>

            <details open style={blueprintDrawerStyle}>
              <summary style={blueprintDrawerSummaryStyle}>
                Traced Rooms · {tracedRoomsWithSqft.length}
              </summary>
              <div style={detectedRoomsSectionStyle}>
                <div>
                  <p style={blueprintManualFallbackLabelStyle}>Traced Rooms / Manual Rooms</p>
                  <p style={detectedRoomsNoteStyle}>
                    Traced rooms are the source of truth for takeoff. Area calculations use:{" "}
                    {blueprintTraceCalibrationStatusText}.
                  </p>
                  {detectedRoomActionMessage ? (
                    <p style={detectedRoomActionMessageStyle}>{detectedRoomActionMessage}</p>
                  ) : null}
                </div>
                {tracedRoomsWithSqft.length > 0 ? (
                  <div style={detectedRoomsGridStyle}>
                    {tracedRoomsWithSqft.map((outline) => {
                      const selectedCardEdge =
                        selectedBlueprintBoundaryEdge?.outlineId === outline.id
                          ? (outline.boundaryEdges ?? createDefaultBlueprintRoomBoundaryEdges(outline.points))[
                              selectedBlueprintBoundaryEdge.edgeIndex
                            ] ?? null
                          : null;
                      const envelopeInput = {
                        room: outline,
                        pixelsPerFoot: activePixelsPerFoot,
                        overlaySize: blueprintOverlaySize.widthPx > 0 ? blueprintOverlaySize : undefined,
                        insulationQuality,
                        oregonRegion,
                      };
                      const envelopeInsight = explainBlueprintRoomEnvelopePreview(envelopeInput);
                      const envelopeConfidence = calculateBlueprintRoomEnvelopeConfidence(envelopeInput);
                      const boundaryCompleteness = calculateBlueprintRoomBoundaryCompleteness(outline);
                      const envelopeInsightMessages =
                        envelopeInsight.status === "ready"
                          ? envelopeInsight.messages.slice(0, 3)
                          : ["Envelope insight not ready."];

                      return (
                      <div
                        key={outline.id}
                        style={
                          selectedDetectedRoomId === outline.id
                            ? { ...detectedRoomCardStyle, ...detectedRoomCardActiveStyle }
                            : detectedRoomCardStyle
                        }
                      >
                        <div style={detectedRoomHeaderStyle}>
                          <p style={tracedRoomTitleStyle}>{outline.name}</p>
                          <span style={detectedRoomConfirmedBadgeStyle}>Traced</span>
                        </div>
                        <div style={detectedRoomFactsStyle}>
                          <span>
                            {outline.squareFeet === null
                              ? "Calibration required"
                              : `${Math.round(outline.squareFeet).toLocaleString()} sq ft`}
                          </span>
                          <span>{outline.squareFeet === null ? blueprintTraceCalibrationStatusText : "Confirmed scale"}</span>
                          <span>Level {outline.floorLevel || "1"}</span>
                          <span>{outline.ceilingHeight || "8"} ft ceiling</span>
                          <span>{outline.points.length} points</span>
                          <span style={{ color: boundaryCompleteness.isFullyClassified ? "#4ade80" : "#94a3b8" }}>
                            {boundaryCompleteness.completionPercent}% classified ({boundaryCompleteness.classifiedEdges}/{boundaryCompleteness.totalEdges} edges)
                          </span>
                        </div>
                        {selectedCardEdge ? (
                          <div style={{ ...detectedRoomEditFieldStyle, flexDirection: "column", alignItems: "flex-start", gap: "12px" }}>
                            <div>
                              <span style={{ ...detectedRoomEditLabelStyle, marginBottom: "8px", display: "block" }}>
                                Edge {selectedBlueprintBoundaryEdge!.edgeIndex + 1} Exposure Verification
                              </span>
                              <div style={edgeTypeSelectorStyle}>
                                {[
                                  { label: "Exterior", value: "exterior" },
                                  { label: "Interior", value: "interior" },
                                  { label: "Adjacent", value: "adjacent" },
                                  { label: "Garage", value: "garage" },
                                  { label: "Unknown", value: "unknown" },
                                ].map((option) => (
                                  <button
                                    key={option.value}
                                    type="button"
                                    style={selectedCardEdge.boundaryType === option.value ? edgeTypeButtonActiveStyle : edgeTypeButtonStyle}
                                    onClick={() => updateSelectedBoundaryType(option.value as BlueprintRoomBoundaryType)}
                                  >
                                    {option.label}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {selectedCardEdge.boundaryType === "exterior" ? (
                              <div style={{ width: "100%", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "12px" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                                  <span style={detectedRoomEditLabelStyle}>Opening Verification</span>
                                  <div style={{ display: "flex", gap: "6px" }}>
                                    <button 
                                      type="button" 
                                      style={openingAddButtonStyle}
                                      onClick={() => addOpeningToSelectedEdge("window")}
                                    >
                                      <Plus size={12} /> Window
                                    </button>
                                    <button 
                                      type="button" 
                                      style={openingAddButtonStyle}
                                      onClick={() => addOpeningToSelectedEdge("door")}
                                    >
                                      <Plus size={12} /> Door
                                    </button>
                                  </div>
                                </div>

                                {selectedCardEdge.openings && selectedCardEdge.openings.length > 0 ? (
                                  <div style={openingListStyle}>
                                    {selectedCardEdge.openings.map((opening) => (
                                      <div key={opening.id} style={openingItemStyle}>
                                        <div style={openingInfoStyle}>
                                          <p style={openingTitleStyle}>
                                            {opening.isVerified ? <CheckCircle2 size={10} color="#22c55e" style={{ marginRight: '4px', display: 'inline' }} /> : null}
                                            {opening.type}
                                          </p>
                                          <p style={openingMetaStyle}>{opening.widthFeet}&apos; x {opening.heightFeet}&apos;</p>
                                        </div>
                                        <button 
                                          type="button" 
                                          style={openingDeleteButtonStyle}
                                          onClick={() => removeOpeningFromSelectedEdge(opening.id)}
                                        >
                                          <Trash2 size={12} />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p style={{ ...openingMetaStyle, fontStyle: "italic", opacity: 0.6 }}>No verified openings on this wall.</p>
                                )}
                              </div>
                            ) : (selectedCardEdge.openings && selectedCardEdge.openings.length > 0) ? (
                              <div style={{ width: "100%", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "12px" }}>
                                <div style={{ 
                                  padding: "8px 12px", 
                                  borderRadius: "10px", 
                                  background: "rgba(248,113,113,0.05)", 
                                  border: "1px solid rgba(248,113,113,0.15)",
                                  display: "flex",
                                  gap: "8px",
                                  alignItems: "center"
                                }}>
                                  <AlertTriangle size={14} color="#f87171" />
                                  <p style={{ ...openingMetaStyle, color: "#fca5a5", fontSize: "9px" }}>
                                    Openings only affect calculations when wall is Exterior.
                                  </p>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                        <div style={tracedRoomEnvelopeInsightStyle}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                            <p style={tracedRoomEnvelopeInsightTitleStyle}>Envelope Insight</p>
                            <p style={{
                              ...tracedRoomEnvelopeInsightTitleStyle,
                              color: envelopeConfidence.score === "high" ? "#4ade80" : envelopeConfidence.score === "medium" ? "#fbbf24" : "#f87171",
                              fontSize: "9px"
                            }}>
                              Confidence: {envelopeConfidence.score.toUpperCase()}
                            </p>
                          </div>
                          <div style={tracedRoomEnvelopeInsightMessagesStyle}>
                            {envelopeInsightMessages.map((message) => (
                              <p key={message} style={tracedRoomEnvelopeInsightMessageStyle}>
                                {message}
                              </p>
                            ))}
                            {envelopeConfidence.assumptionsUsed.length > 0 && (
                              <p style={{ ...tracedRoomEnvelopeInsightMessageStyle, color: "#94a3b8", fontSize: "10px", marginTop: "2px" }}>
                                Assumptions: {envelopeConfidence.assumptionsUsed.join(", ")}
                              </p>
                            )}
                            {envelopeConfidence.warnings.length > 0 && envelopeConfidence.score === "low" && (
                              <p style={{ ...tracedRoomEnvelopeInsightMessageStyle, color: "#fca5a5", fontSize: "10px" }}>
                                Warning: {envelopeConfidence.warnings[0]}
                              </p>
                            )}
                          </div>
                        </div>
                        <div style={detectedRoomActionsStyle}>
                          <button
                            type="button"
                            style={detectedRoomButtonStyle}
                            onClick={() => renameTracedRoom(outline.id)}
                          >
                            Rename
                          </button>
                          <button
                            type="button"
                            style={detectedRoomButtonStyle}
                            onClick={() => editTracedRoomOutline(outline.id)}
                          >
                            Edit Outline
                          </button>
                          <button
                            type="button"
                            style={
                              blueprintCalibration.status !== "calibrated" ||
                              outline.squareFeet === null ||
                              outline.squareFeet <= 0 ||
                              !Number.isFinite(outline.squareFeet)
                                ? { ...detectedRoomButtonStyle, ...tracedRoomButtonDisabledStyle }
                                : detectedRoomButtonStyle
                            }
                            disabled={
                              blueprintCalibration.status !== "calibrated" ||
                              outline.squareFeet === null ||
                              outline.squareFeet <= 0 ||
                              !Number.isFinite(outline.squareFeet)
                            }
                            onClick={() => sendTracedRoomToManualD(outline.id)}
                          >
                            Send to Manual D
                          </button>
                          <button
                            type="button"
                            style={detectedRoomRemoveButtonStyle}
                            onClick={() => removeTracedRoom(outline.id)}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                ) : (
                  <p style={detectedRoomsNoteStyle}>No traced rooms yet.</p>
                )}
              </div>
            </details>

            <p style={blueprintManualFallbackLabelStyle}>Manual room takeoff fallback</p>
            <div ref={manualTakeoffRef} tabIndex={-1} className="blueprint-takeoff-grid" style={blueprintTakeoffGridStyle}>
              <label style={blueprintTakeoffRoomNameGroupStyle}>
                <span style={blueprintTakeoffInputLabelStyle}>Room Name</span>
                <input
                  className="load-input blueprint-takeoff-control"
                  type="text"
                  aria-label="Blueprint takeoff room name"
                  value={blueprintRoomName}
                  onChange={(event) => setBlueprintRoomName(event.target.value)}
                  style={blueprintTakeoffInputStyle}
                />
              </label>
              <label style={blueprintTakeoffInputGroupStyle}>
                <span style={blueprintTakeoffInputLabelStyle}>Width</span>
                <input
                  className="load-input blueprint-takeoff-control"
                  type="number"
                  min="0"
                  step="0.1"
                  aria-label="Blueprint takeoff room width"
                  value={blueprintWidth}
                  onChange={(event) => setBlueprintWidth(event.target.value)}
                  style={blueprintTakeoffInputStyle}
                />
              </label>
              <label style={blueprintTakeoffInputGroupStyle}>
                <span style={blueprintTakeoffInputLabelStyle}>Length</span>
                <input
                  className="load-input blueprint-takeoff-control"
                  type="number"
                  min="0"
                  step="0.1"
                  aria-label="Blueprint takeoff room length"
                  value={blueprintLength}
                  onChange={(event) => setBlueprintLength(event.target.value)}
                  style={blueprintTakeoffInputStyle}
                />
              </label>
              <label style={blueprintTakeoffInputGroupStyle}>
                <span style={blueprintTakeoffInputLabelStyle}>Ceiling Height</span>
                <input
                  className="load-input blueprint-takeoff-control"
                  type="number"
                  min="0"
                  step="0.5"
                  aria-label="Blueprint takeoff ceiling height"
                  value={blueprintCeilingHeight}
                  onChange={(event) => setBlueprintCeilingHeight(event.target.value)}
                  style={blueprintTakeoffInputStyle}
                />
              </label>
              <label style={blueprintTakeoffInputGroupStyle}>
                <span style={blueprintTakeoffInputLabelStyle}>Floor / Level</span>
                <input
                  className="load-input blueprint-takeoff-control"
                  type="number"
                  min="1"
                  aria-label="Blueprint takeoff floor or level"
                  value={blueprintFloorLevel}
                  onChange={(event) => setBlueprintFloorLevel(event.target.value)}
                  style={blueprintTakeoffInputStyle}
                />
              </label>
              <div className="blueprint-takeoff-result" style={blueprintTakeoffResultStyle}>
                <p style={blueprintTakeoffLabelStyle}>Calculated Sq. Ft.</p>
                <p style={blueprintTakeoffValueStyle}>
                  {Math.round(blueprintSquareFeet).toLocaleString()} sq ft
                </p>
              </div>
              <button
                type="button"
                className="blueprint-takeoff-button"
                style={blueprintTakeoffButtonStyle}
                onClick={addBlueprintRoomToManualD}
              >
                Add to Manual D
              </button>
            </div>
          </div>

          <ManualDPanel
            squareFeet={String(Math.round(activeConditionedArea))}
            blueprintRooms={blueprintRoomsForManualD}
            selectedBlueprintRoomId={selectedDetectedRoomId}
            onBlueprintRoomSelect={setSelectedDetectedRoomId}
            savedProjectState={loadedManualDProjectState}
            onProjectStateChange={setManualDProjectState}
            activeSection={
              activeTechnicianSection === "manual-room-takeoff" || activeTechnicianSection === "envelope-verification"
                ? "hidden"
                : activeTechnicianSection
            }
          />
            </>
          )}
        </div>

        <div
          className="load-calculator-right"
          style={isBlueprintWorkspaceActive ? { ...rightColumnStyle, display: "none" } : rightColumnStyle}
        >
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
          <ProjectCommandCenter
            onRecalculate={handleCalculate}
            onGenerateReport={handlePreviewV3Report}
            onExport={handlePrintReport}
          />
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

          {/* Manual J Engineering Audit Panel */}
          <div className="manual-j-engineering-audit" style={auditPanelStyle}>
            <div>
              <h4 style={auditTitleStyle}>Engineering Audit</h4>
              <p style={auditSubtitleStyle}>Verified and assumed inputs used for this Manual J result.</p>
            </div>

            {(() => {
              // 1. Engineering Confidence Logic
              const isCeilingVerified = false; // Always assumed for now
              const isMaterialsVerified = isEnvelopeVerified;
              const hasWindowData = parseInt(windowCount, 10) > 0;
              const hasEnvelopeVerification = isEnvelopeVerified;

              // Opening Verification Logic for Audit
              const hasExteriorWalls = tracedRoomsWithSqft.some(outline => 
                (outline.boundaryEdges ?? []).some(edge => edge.boundaryType === "exterior")
              );
              const exteriorOpenings = tracedRoomsWithSqft.flatMap(outline => 
                (outline.boundaryEdges ?? [])
                  .filter(edge => edge.boundaryType === "exterior")
                  .flatMap(edge => edge.openings ?? [])
              );
              const hasVerifiedOpenings = exteriorOpenings.some(op => op.isVerified);
              const hasUnverifiedOpenings = exteriorOpenings.some(op => !op.isVerified);

              const assumedRows = [
                !isAreaVerified, // Area
                true, // Ceiling Height
                !isAreaVerified || !isCeilingVerified, // Volume
                !isEnvelopeVerified || !atticRValue, // Attic
                !isEnvelopeVerified || !wallRValue, // Wall
                !isEnvelopeVerified || !floorRValue, // Floor
                !isEnvelopeVerified || !windowUFactor, // Window U
                !isEnvelopeVerified || !windowSHGC, // Window SHGC
                !isEnvelopeVerified || !infiltrationACH50, // Infiltration
                true, // Climate Region
              ].filter(Boolean).length;

              const missingCriticalRows = [
                activeConditionedArea <= 0,
                parseFloat(ceilingHeight) <= 6,
                parseInt(windowCount, 10) <= 0,
                !hasEnvelopeVerification,
              ].filter(Boolean).length;

              const confidenceScore = Math.max(0, Math.min(100, 100 - (assumedRows * 10) - (missingCriticalRows * 20)));

              return (
                <>
                  <div style={auditGridStyle}>
                    <p style={auditSectionTitleStyle}>Engineering Confidence</p>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "12px" }}>
                      <div style={resultCardStyle}>
                        <p style={auditSectionTitleStyle}>Confidence</p>
                        <p style={{ ...resultCardValueStyle, color: confidenceScore > 80 ? "#4ade80" : confidenceScore > 50 ? "#fde68a" : "#f87171" }}>
                          {confidenceScore}%
                        </p>
                      </div>
                      <div style={resultCardStyle}>
                        <p style={auditSectionTitleStyle}>Verified</p>
                        <p style={resultCardValueStyle}>{10 - assumedRows}</p>
                      </div>
                      <div style={resultCardStyle}>
                        <p style={auditSectionTitleStyle}>Assumed</p>
                        <p style={resultCardValueStyle}>{assumedRows}</p>
                      </div>
                      <div style={resultCardStyle}>
                        <p style={auditSectionTitleStyle}>Missing</p>
                        <p style={resultCardValueStyle}>{missingCriticalRows}</p>
                      </div>
                    </div>
                  </div>

                  <div style={auditGridStyle}>
                    <p style={auditSectionTitleStyle}>Geometry Audit</p>
                    <div style={auditRowStyle}>
                      <p style={auditLabelStyle}>Conditioned Area</p>
                      <p style={auditValueStyle}>{Math.round(activeConditionedArea).toLocaleString()} sqft</p>
                      <p style={auditSourceStyle}>{isAreaVerified ? "Blueprint Takeoff" : "Manual Entry"}</p>
                      <div style={isAreaVerified ? auditBadgeVerifiedStyle : auditBadgeAssumedStyle}>
                        {isAreaVerified ? "Verified" : "Assumed"}
                      </div>
                    </div>
                    <div style={auditRowStyle}>
                      <p style={auditLabelStyle}>Ceiling Height</p>
                      <p style={auditValueStyle}>{ceilingHeight} ft</p>
                      <p style={auditSourceStyle}>Manual Entry</p>
                      <div style={auditBadgeAssumedStyle}>Assumed</div>
                    </div>
                    <div style={auditRowStyle}>
                      <p style={auditLabelStyle}>Calculated Volume</p>
                      <p style={auditValueStyle}>{(Math.round(activeConditionedArea) * parseFloat(ceilingHeight)).toLocaleString()} cuft</p>
                      <p style={auditSourceStyle}>Derived</p>
                      <div style={isAreaVerified ? auditBadgeVerifiedStyle : auditBadgeAssumedStyle}>
                        {isAreaVerified ? "Verified" : "Assumed"}
                      </div>
                    </div>
                    <div style={auditRowStyle}>
                      <p style={auditLabelStyle}>Verified traced area source</p>
                      <p style={auditValueStyle}>{Math.round(totalTracedSqft).toLocaleString()} sqft from {tracedRoomsWithSqft.length} rooms</p>
                      <p style={auditSourceStyle}>Diagnostic</p>
                      <div style={isAreaVerified ? auditBadgeVerifiedStyle : auditBadgeAssumedStyle}>
                        {isAreaVerified ? "Active" : "Bypassed"}
                      </div>
                    </div>
                    <div style={auditRowStyle}>
                      <p style={auditLabelStyle}>Blueprint Set</p>
                      <p style={auditValueStyle}>
                        {blueprintDocument ? `${blueprintDocument.pages.length} page${blueprintDocument.pages.length === 1 ? "" : "s"} active` : "No blueprint"}
                        {blueprintDocument && blueprintDocument.pages.length > 0 && (
                          ` (page ${blueprintDocument.pages.findIndex(p => p.id === blueprintDocument.activePageId) + 1} of ${blueprintDocument.pages.length})`
                        )}
                        {blueprintDocument?.assetId?.startsWith('pdf-') && " [PDF source]"}
                      </p>
                      <p style={auditSourceStyle}>Document Container</p>
                      <div style={blueprintDocument ? auditBadgeVerifiedStyle : auditBadgeAssumedStyle}>
                        {blueprintDocument ? "Verified" : "Missing"}
                      </div>
                    </div>
                    <div style={auditRowStyle}>
                      <p style={auditLabelStyle}>Reference Dimensions</p>
                      <p style={auditValueStyle}>
                        {blueprintOverlaySize.widthPx > 0 ? `${Math.round(blueprintOverlaySize.widthPx)} x ${Math.round(blueprintOverlaySize.heightPx)} px` : "Pending render"}
                      </p>
                      <p style={auditSourceStyle}>Viewport Persistence</p>
                      <div style={blueprintOverlaySize.widthPx > 0 ? auditBadgeVerifiedStyle : auditBadgeAssumedStyle}>
                        {blueprintOverlaySize.widthPx > 0 ? "Restored" : "Waiting"}
                      </div>
                    </div>
                  </div>

                  <div style={auditGridStyle}>
                    <p style={auditSectionTitleStyle}>Thermal Envelope Audit</p>
                    {[
                      { label: "Attic Insulation", val: isEnvelopeVerified && atticRValue ? `R-${atticRValue}` : insulationQuality, verified: isEnvelopeVerified && !!atticRValue },
                      { label: "Wall Insulation", val: isEnvelopeVerified && wallRValue ? `R-${wallRValue}` : insulationQuality, verified: isEnvelopeVerified && !!wallRValue },
                      { label: "Floor Insulation", val: isEnvelopeVerified && floorRValue ? `R-${floorRValue}` : insulationQuality, verified: isEnvelopeVerified && !!floorRValue },
                      { label: "Window U-Factor", val: isEnvelopeVerified && windowUFactor ? windowUFactor : windowEfficiency, verified: isEnvelopeVerified && !!windowUFactor },
                      { label: "Window SHGC", val: isEnvelopeVerified && windowSHGC ? windowSHGC : windowEfficiency, verified: isEnvelopeVerified && !!windowSHGC },
                    ].map((row) => (
                      <div key={row.label} style={auditRowStyle}>
                        <p style={auditLabelStyle}>{row.label}</p>
                        <p style={auditValueStyle}>{row.val}</p>
                        <p style={auditSourceStyle}>{row.verified ? "Envelope Verification" : "Manual J Assumption"}</p>
                        <div style={row.verified ? auditBadgeVerifiedStyle : auditBadgeAssumedStyle}>
                          {row.verified ? "Verified" : "Assumed"}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={auditGridStyle}>
                    <p style={auditSectionTitleStyle}>Takeoff Verification Audit</p>
                    <div style={auditRowStyle}>
                      <p style={auditLabelStyle}>Wall Exposure Verification</p>
                      <p style={auditValueStyle}>{verifiedOpeningsMetrics.allEdgesClassified ? "Complete" : "Incomplete"}</p>
                      <p style={auditSourceStyle}>Verified Takeoff</p>
                      <div style={verifiedOpeningsMetrics.allEdgesClassified ? auditBadgeVerifiedStyle : auditBadgeAssumedStyle}>
                        {verifiedOpeningsMetrics.allEdgesClassified ? "Verified" : "Pending"}
                      </div>
                    </div>
                    <div style={auditRowStyle}>
                      <p style={auditLabelStyle}>Opening Verification</p>
                      <p style={auditValueStyle}>
                        {!hasVerifiedOpenings && !hasUnverifiedOpenings ? "Not Documented" : (hasUnverifiedOpenings ? "Incomplete" : "Complete")}
                      </p>
                      <p style={auditSourceStyle}>Verified Takeoff</p>
                      <div style={hasVerifiedOpenings && !hasUnverifiedOpenings ? auditBadgeVerifiedStyle : (hasUnverifiedOpenings ? auditBadgeAssumedStyle : auditBadgeMissingStyle)}>
                        {hasVerifiedOpenings && !hasUnverifiedOpenings ? "Verified" : (hasUnverifiedOpenings ? "Partial" : "Missing")}
                      </div>
                    </div>
                    {verifiedOpeningsMetrics.windowCount > 0 && (
                      <div style={auditRowStyle}>
                        <p style={auditLabelStyle}>Verified Window Data</p>
                        <p style={auditValueStyle}>{verifiedOpeningsMetrics.windowArea} sqft ({verifiedOpeningsMetrics.windowCount} units)</p>
                        <p style={auditSourceStyle}>Takeoff Openings</p>
                        <div style={auditBadgeVerifiedStyle}>Verified</div>
                      </div>
                    )}
                    {verifiedOpeningsMetrics.doorCount > 0 && (
                      <div style={auditRowStyle}>
                        <p style={auditLabelStyle}>Verified Door Data</p>
                        <p style={auditValueStyle}>{verifiedOpeningsMetrics.doorArea} sqft ({verifiedOpeningsMetrics.doorCount} units)</p>
                        <p style={auditSourceStyle}>Takeoff Openings</p>
                        <div style={auditBadgeVerifiedStyle}>Verified</div>
                      </div>
                    )}
                  </div>

                  <div style={auditGridStyle}>
                    <p style={auditSectionTitleStyle}>Air Leakage / Environment Audit</p>
                    <div style={auditRowStyle}>
                      <p style={auditLabelStyle}>Infiltration</p>
                      <p style={auditValueStyle}>{isEnvelopeVerified && infiltrationACH50 ? `${infiltrationACH50} ACH50` : infiltrationTightness}</p>
                      <p style={auditSourceStyle}>{isEnvelopeVerified && infiltrationACH50 ? "Envelope Verification" : "Manual J Assumption"}</p>
                      <div style={isEnvelopeVerified && infiltrationACH50 ? auditBadgeVerifiedStyle : auditBadgeAssumedStyle}>
                        {isEnvelopeVerified && infiltrationACH50 ? "Verified" : "Assumed"}
                      </div>
                    </div>
                    <div style={auditRowStyle}>
                      <p style={auditLabelStyle}>Climate Region</p>
                      <p style={auditValueStyle}>{oregonRegion}</p>
                      <p style={auditSourceStyle}>Manual Entry</p>
                      <div style={auditBadgeAssumedStyle}>Assumed</div>
                    </div>
                  </div>

                  {(assumedRows > 0 || missingCriticalRows > 0) && (
                    <div style={auditGridStyle}>
                      <p style={auditSectionTitleStyle}>Active Engine Assumptions</p>
                      <div style={constructionNotesListStyle}>
                        {!isAreaVerified && (
                          <div style={auditAssumptionItemStyle}>
                            <AlertTriangle size={12} color="#fde68a" />
                            Conditioned area is manually entered and not verified by blueprint takeoff.
                          </div>
                        )}
                        {!blueprintFile && blueprintRoomsForManualD.some((room) => !!room.sourceBlueprintRoomId) && (
                          <div style={auditAssumptionItemStyle}>
                            <AlertTriangle size={12} color="#fde68a" />
                            Manual J contains rooms from a removed blueprint. Calculations are using legacy takeoff data.
                          </div>
                        )}
                        {!isCeilingVerified && (
                          <div style={auditAssumptionItemStyle}>
                            <AlertTriangle size={12} color="#fde68a" />
                            Ceiling height is manually entered and not independently verified.
                          </div>
                        )}
                        {!isEnvelopeVerified && (
                          <>
                            <div style={auditAssumptionItemStyle}>
                              <AlertTriangle size={12} color="#fde68a" />
                              Insulation is using shorthand quality settings.
                            </div>
                            <div style={auditAssumptionItemStyle}>
                              <AlertTriangle size={12} color="#fde68a" />
                              Infiltration is using shorthand tightness settings.
                            </div>
                            <div style={auditAssumptionItemStyle}>
                              <AlertTriangle size={12} color="#fde68a" />
                              Window values are using fallback efficiency labels.
                            </div>
                          </>
                        )}
                        <div style={auditAssumptionItemStyle}>
                          <AlertTriangle size={12} color="#fde68a" />
                          Wall exposure is still based on current engine assumptions (70% perimeter).
                        </div>
                        {tracedRoomsWithSqft.some(outline => 
                          (outline.boundaryEdges ?? []).some(edge => edge.boundaryType === "unknown")
                        ) && (
                          <div style={auditAssumptionItemStyle}>
                            <AlertTriangle size={12} color="#fde68a" />
                            Some traced rooms have unclassified wall exposures (Unknown).
                          </div>
                        )}
                        {hasExteriorWalls && !hasVerifiedOpenings && (
                          <div style={auditAssumptionItemStyle}>
                            <AlertTriangle size={12} color="#fde68a" />
                            Exterior walls verified, but no window or door openings are documented. Calculations currently assume 0% opening area.
                          </div>
                        )}
                        {hasUnverifiedOpenings && (
                          <div style={auditAssumptionItemStyle}>
                            <AlertTriangle size={12} color="#fde68a" />
                            Some window or door openings are unverified.
                          </div>
                        )}
                        {verifiedOpeningsMetrics.allEdgesClassified && (
                          <div style={{ ...auditAssumptionItemStyle, color: "#4ade80" }}>
                            <CheckCircle2 size={12} color="#22c55e" />
                            Verified Window Area: {verifiedOpeningsMetrics.windowArea} sqft ({verifiedOpeningsMetrics.windowCount} units)
                          </div>
                        )}
                        {verifiedOpeningsMetrics.allEdgesClassified && verifiedOpeningsMetrics.doorCount > 0 && (
                          <div style={{ ...auditAssumptionItemStyle, color: "#4ade80" }}>
                            <CheckCircle2 size={12} color="#22c55e" />
                            Verified Door Area: {verifiedOpeningsMetrics.doorArea} sqft ({verifiedOpeningsMetrics.doorCount} units)
                          </div>
                        )}
                        {verifiedOpeningsMetrics.allEdgesClassified && (
                          <div style={{ ...auditAssumptionItemStyle, color: "#4ade80", fontSize: "10px", marginLeft: "20px" }}>
                            Source: Verified Takeoff
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
            </>
          )}
        </div>
      </div>

      {v3ReportPreview && (
        <div style={{
          position: "fixed",
          inset: 0,
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px",
          background: "rgba(15, 23, 42, 0.9)",
          backdropFilter: "blur(8px)"
        }}>
          <style>{`
            @media print {
              body * { visibility: hidden; }
              .report-print-container, .report-print-container * { visibility: visible; }
              .report-print-container {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                max-width: none !important;
                height: auto !important;
                max-height: none !important;
                background: white !important;
                color: black !important;
                padding: 0 !important;
                margin: 0 !important;
                border: none !important;
                box-shadow: none !important;
                border-radius: 0 !important;
                overflow: visible !important;
              }
              .no-print { display: none !important; }
              .report-print-header { border-bottom: 2px solid #e2e8f0 !important; background: #f8fafc !important; color: black !important; }
              .report-print-content { background: white !important; color: black !important; padding: 40px !important; }
              .report-print-section { background: #fff !important; color: black !important; border: 1px solid #e2e8f0 !important; }
              .report-print-text-primary { color: #000 !important; }
              .report-print-text-muted { color: #64748b !important; }
              .report-print-insight { background: #f8fafc !important; border: 1px solid #e2e8f0 !important; }
              .report-print-badge { background: #f1f5f9 !important; color: black !important; border: 1px solid #cbd5e1 !important; }
              .report-print-manual-d { background: #fffbeb !important; border: 1px solid #fde68a !important; color: #92400e !important; }
              * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            }
          `}</style>
          <div className="report-print-container" style={{
            width: "100%",
            maxWidth: "800px",
            maxHeight: "90vh",
            background: "#1e293b",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "24px",
            display: "flex",
            flexDirection: "column",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
            overflow: "hidden"
          }}>
            {/* Header */}
            <div className="report-print-header" style={{
              padding: "24px",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "rgba(30, 41, 59, 0.8)"
            }}>
              <div>
                <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 800, color: "#f8fafc", display: "flex", alignItems: "center", gap: "10px" }} className="report-print-text-primary">
                  <ClipboardCheck size={24} color="#d4af37" />
                  Technician Report Preview
                </h2>
                <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#94a3b8" }} className="report-print-text-muted">
                  {v3ReportPreview.projectName} • Generated {new Date(v3ReportPreview.generatedAt).toLocaleString()}
                </p>
              </div>
              <button
                className="no-print"
                onClick={() => setV3ReportPreview(null)}
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "none",
                  borderRadius: "50%",
                  width: "36px",
                  height: "36px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: "#94a3b8"
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="report-print-content" style={{ padding: "24px", overflowY: "auto", flex: 1 }}>
              {/* Metadata */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "24px" }}>
                <div className="report-print-section" style={{ padding: "16px", background: "rgba(255,255,255,0.02)", borderRadius: "16px", border: "1px solid rgba(255,255,255,0.04)" }}>
                  <p style={{ margin: "0 0 8px 0", fontSize: "11px", fontWeight: 800, color: "#64748b", textTransform: "uppercase" }} className="report-print-text-muted">Blueprint Status</p>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <Activity size={16} color="#4ade80" />
                    <span style={{ fontSize: "14px", color: "#f1f5f9", fontWeight: 600 }} className="report-print-text-primary">{v3ReportPreview.blueprintMetadata.calibrationStatus}</span>
                  </div>
                </div>
                <div className="report-print-section" style={{ padding: "16px", background: "rgba(255,255,255,0.02)", borderRadius: "16px", border: "1px solid rgba(255,255,255,0.04)" }}>
                  <p style={{ margin: "0 0 8px 0", fontSize: "11px", fontWeight: 800, color: "#64748b", textTransform: "uppercase" }} className="report-print-text-muted">Calibration Confidence</p>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <ShieldCheck size={16} color="#d4af37" />
                    <span style={{ fontSize: "14px", color: "#f1f5f9", fontWeight: 600 }} className="report-print-text-primary">{v3ReportPreview.blueprintMetadata.calibrationConfidence}</span>
                  </div>
                </div>
              </div>

              {/* Room Summaries */}
              <div style={{ marginBottom: "24px" }}>
                <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: 800, color: "#cbd5e1", textTransform: "uppercase", letterSpacing: "0.05em" }} className="report-print-text-primary">Room Takeoff Summaries</h3>
                <div style={{ display: "grid", gap: "10px" }}>
                  {v3ReportPreview.rooms.map((room) => (
                    <div key={room.id} className="report-print-section" style={{ padding: "14px", background: "rgba(255,255,255,0.02)", borderRadius: "16px", border: "1px solid rgba(255,255,255,0.04)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                        <p style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#f8fafc" }} className="report-print-text-primary">{room.name}</p>
                        <span className="report-print-badge" style={{ fontSize: "12px", padding: "2px 8px", borderRadius: "6px", background: "rgba(212,175,55,0.15)", color: "#fde68a", border: "1px solid rgba(212,175,55,0.2)" }}>
                          Confidence: {room.confidence.score}%
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: "20px", marginBottom: "12px" }}>
                        <div>
                          <p style={{ margin: 0, fontSize: "10px", color: "#64748b", textTransform: "uppercase" }} className="report-print-text-muted">Area</p>
                          <p style={{ margin: 0, fontSize: "13px", color: "#e2e8f0", fontWeight: 600 }} className="report-print-text-primary">{room.squareFeet ? `${Math.round(room.squareFeet)} sqft` : 'TBD'}</p>
                        </div>
                        <div>
                          <p style={{ margin: 0, fontSize: "10px", color: "#64748b", textTransform: "uppercase" }} className="report-print-text-muted">Level</p>
                          <p style={{ margin: 0, fontSize: "13px", color: "#e2e8f0", fontWeight: 600 }} className="report-print-text-primary">Floor {room.floorLevel}</p>
                        </div>
                      </div>
                      {room.envelopeInsight.messages.length > 0 && (
                        <div className="report-print-insight" style={{ padding: "8px 12px", background: "rgba(0,0,0,0.2)", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.03)" }}>
                          {room.envelopeInsight.messages.map((msg, i) => (
                            <p key={i} style={{ margin: 0, fontSize: "11px", color: "#94a3b8", display: "flex", alignItems: "center", gap: "6px" }} className="report-print-text-muted">
                              <span style={{ width: "4px", height: "4px", borderRadius: "50%", background: "#d4af37", display: "inline-block" }} className="no-print" />
                              {msg}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Manual D Summary */}
              {v3ReportPreview.manualDSummary && (
                <div>
                  <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: 800, color: "#cbd5e1", textTransform: "uppercase", letterSpacing: "0.05em" }} className="report-print-text-primary">Manual D Airflow Design</h3>
                  <div className="report-print-manual-d" style={{ padding: "16px", background: "rgba(212,175,55,0.05)", borderRadius: "20px", border: "1px solid rgba(212,175,55,0.15)" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px" }}>
                      <div>
                        <p style={{ margin: 0, fontSize: "10px", color: "#94a3b8", textTransform: "uppercase" }} className="report-print-text-muted">System Size</p>
                        <p style={{ margin: 0, fontSize: "16px", color: "#fde68a", fontWeight: 800 }} className="report-print-text-primary">{v3ReportPreview.manualDSummary.systemTons} Tons</p>
                      </div>
                      <div>
                        <p style={{ margin: 0, fontSize: "10px", color: "#94a3b8", textTransform: "uppercase" }} className="report-print-text-muted">Total CFM</p>
                        <p style={{ margin: 0, fontSize: "16px", color: "#fde68a", fontWeight: 800 }} className="report-print-text-primary">{v3ReportPreview.manualDSummary.totalCfm} CFM</p>
                      </div>
                      <div>
                        <p style={{ margin: 0, fontSize: "10px", color: "#94a3b8", textTransform: "uppercase" }} className="report-print-text-muted">Static Target</p>
                        <p style={{ margin: 0, fontSize: "16px", color: "#fde68a", fontWeight: 800 }} className="report-print-text-primary">{v3ReportPreview.manualDSummary.availableStatic} inwc</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="no-print" style={{ padding: "20px 24px", borderTop: "1px solid rgba(255,255,255,0.06)", background: "rgba(30, 41, 59, 0.4)", display: "flex", justifyContent: "flex-end", gap: "12px" }}>
              <button
                onClick={handlePrintReport}
                style={{
                  padding: "10px 24px",
                  borderRadius: "12px",
                  background: "rgba(255,255,255,0.1)",
                  color: "#f8fafc",
                  border: "1px solid rgba(255,255,255,0.1)",
                  fontWeight: 800,
                  fontSize: "14px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px"
                }}
              >
                <Printer size={18} />
                Print / Save PDF
              </button>
              <button
                onClick={() => setV3ReportPreview(null)}
                style={{
                  padding: "10px 24px",
                  borderRadius: "12px",
                  background: "#d4af37",
                  color: "#1e293b",
                  border: "none",
                  fontWeight: 800,
                  fontSize: "14px",
                  cursor: "pointer"
                }}
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    <ProjectIssuesBadge onClick={() => setIsIssuesDrawerOpen(true)} />
    <ProjectIssuesDrawer 
      open={isIssuesDrawerOpen} 
      onClose={() => setIsIssuesDrawerOpen(false)} 
    />
    </div>
    </ProjectEngineProvider>
    );
    }
const calcPageStyle: React.CSSProperties = {
  display: "grid",
  gap: "12px",
};

const calcHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
  padding: "12px 20px",
  background: "rgba(15, 23, 42, 0.98)",
  borderRadius: "16px",
  border: "1px solid rgba(255,255,255,0.08)",
  boxShadow: "0 14px 40px rgba(0,0,0,0.22)",
};

const calcTitleWrapperStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
};

const calcIconStyle: React.CSSProperties = {
  width: "36px",
  height: "36px",
  borderRadius: "10px",
  display: "grid",
  placeItems: "center",
  background: "rgba(212,175,55,0.12)",
  border: "1px solid rgba(212,175,55,0.2)",
  color: "#d4af37",
};

const calcEyebrowStyle: React.CSSProperties = {
  margin: 0,
  color: "#d4af37",
  fontSize: "10px",
  letterSpacing: "0.15em",
  textTransform: "uppercase",
  fontWeight: 900,
};

const calcTitleStyle: React.CSSProperties = {
  margin: "2px 0 0",
  fontSize: "18px",
  fontWeight: 900,
  color: "#f8fafc",
};

const calcSubtitleStyle: React.CSSProperties = {
  margin: "0",
  color: "#94a3b8",
  fontSize: "12px",
  maxWidth: "480px",
};

const calcActionButtonStyle: React.CSSProperties = {
  minHeight: "44px",
  padding: "10px 18px",
  borderRadius: "12px",
  border: "1px solid rgba(212,175,55,0.28)",
  background: "rgba(212,175,55,0.16)",
  color: "#f8fafc",
  fontWeight: 900,
  fontSize: "13px",
  cursor: "pointer",
  transition: "all 0.2s ease",
  touchAction: "manipulation",
  WebkitTapHighlightColor: "transparent",
};

const loadViewTabsStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "8px",
  padding: "6px",
  borderRadius: "16px",
  background: "rgba(15, 23, 42, 0.94)",
  border: "1px solid rgba(255,255,255,0.08)",
  boxShadow: "0 12px 30px rgba(0,0,0,0.18)",
};

const loadViewTabStyle: React.CSSProperties = {
  minHeight: "44px",
  padding: "8px 12px",
  borderRadius: "10px",
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.04)",
  color: "#cbd5e1",
  fontSize: "12px",
  fontWeight: 900,
  cursor: "pointer",
  touchAction: "manipulation",
};

const loadViewTabActiveStyle: React.CSSProperties = {
  ...loadViewTabStyle,
  border: "1px solid rgba(212,175,55,0.34)",
  background: "rgba(212,175,55,0.18)",
  color: "#f8fafc",
  boxShadow: "0 8px 18px rgba(212,175,55,0.12)",
};

const technicianWorkflowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
  gap: "6px",
  padding: "6px",
  borderRadius: "16px",
  background: "rgba(15, 23, 42, 0.96)",
  border: "1px solid rgba(255,255,255,0.08)",
  boxShadow: "0 12px 30px rgba(0,0,0,0.16)",
};

const technicianWorkflowStepStyle: React.CSSProperties = {
  minHeight: "32px",
  padding: "4px 8px",
  borderRadius: "10px",
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.035)",
  color: "#94a3b8",
  fontSize: "10px",
  fontWeight: 900,
  lineHeight: 1.2,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
};

const technicianWorkflowStepActiveStyle: React.CSSProperties = {
  ...technicianWorkflowStepStyle,
  border: "1px solid rgba(212,175,55,0.34)",
  background: "rgba(212,175,55,0.16)",
  color: "#f8fafc",
  boxShadow: "0 8px 16px rgba(212,175,55,0.10)",
};

const technicianAccordionStyle: React.CSSProperties = {
  display: "grid",
  gap: "6px",
};

const technicianAccordionButtonStyle: React.CSSProperties = {
  width: "100%",
  minHeight: "36px",
  paddingTop: "8px",
  paddingBottom: "8px",
  paddingLeft: "14px",
  paddingRight: "14px",
  borderRadius: "10px",
  border: "1px solid rgba(255,255,255,0.05)",
  background: "rgba(15, 23, 42, 0.45)",
  color: "#f8fafc",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "8px",
  textAlign: "left",
  boxShadow: "none",
  transition: "all 0.2s ease",
  touchAction: "manipulation",
};

const technicianAccordionButtonActiveStyle: React.CSSProperties = {
  ...technicianAccordionButtonStyle,
  background: "rgba(212, 175, 55, 0.04)",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  borderLeft: "3px solid #d4af37",
  paddingLeft: "11px", // Adjust for 3px border to keep alignment
  boxShadow: "none",
};

const technicianAccordionTitleStyle: React.CSSProperties = {
  color: "#f8fafc",
  fontSize: "12px",
  fontWeight: 900,
  letterSpacing: "0.02em",
};

const technicianAccordionDescriptionStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: "10px",
  lineHeight: 1.1,
  fontWeight: 600,
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

const projectActionMessageStyle: React.CSSProperties = {
  margin: "8px 0 0",
  color: "#d4af37",
  fontSize: "12px",
  fontWeight: 900,
};

const projectListActionsStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  flexWrap: "wrap",
  justifyContent: "flex-end",
};

const projectLoadButtonStyle: React.CSSProperties = {
  ...calcActionButtonStyle,
  minHeight: "42px",
  padding: "11px 14px",
  borderRadius: "14px",
  fontSize: "12px",
};

const projectDeleteButtonStyle: React.CSSProperties = {
  minHeight: "42px",
  padding: "11px 14px",
  borderRadius: "14px",
  border: "1px solid rgba(248,113,113,0.25)",
  background: "rgba(127,29,29,0.24)",
  color: "#fecaca",
  fontSize: "12px",
  fontWeight: 900,
  cursor: "pointer",
  touchAction: "manipulation",
};

const calcGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.35fr 0.85fr",
  alignItems: "start",
  gap: "24px",
};

const leftColumnStyle: React.CSSProperties = {
  display: "grid",
  alignContent: "start",
  gap: "20px",
};

const rightColumnStyle: React.CSSProperties = {
  display: "grid",
  alignContent: "start",
  gap: "14px",
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

const blueprintTakeoffPanelStyle: React.CSSProperties = {
  alignSelf: "start",
  alignItems: "stretch",
  flexDirection: "column",
  gap: "10px",
  padding: "16px",
  height: "fit-content",
  minHeight: "auto",
  width: "100%",
  background: "rgba(15, 23, 42, 0.94)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "24px",
  boxShadow: "0 22px 54px rgba(0,0,0,0.20)",
  overflow: "visible",
};

const blueprintTakeoffGridStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "flex-end",
  gap: "10px",
};

const blueprintDraftingWorkspaceStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "260px minmax(520px, 1fr) 140px",
  alignItems: "start",
  gap: "14px",
  minWidth: 0,
  maxWidth: "100%",
  overflow: "hidden",
};

const tabletToggleButtonStyle: React.CSSProperties = {
  width: "100%",
  height: "48px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(255,255,255,0.05)",
  border: "none",
  borderBottom: "1px solid rgba(255,255,255,0.1)",
  color: "#94a3b8",
  cursor: "pointer",
  padding: 0,
  touchAction: "manipulation",
};

const blueprintWorkspaceSidebarStyle: React.CSSProperties = {
  display: "grid",
  gap: "12px",
  alignContent: "start",
  position: "sticky",
  top: "12px",
};

const blueprintWorkspaceMainStyle: React.CSSProperties = {
  display: "grid",
  gap: "12px",
  minWidth: 0,
};

const blueprintWorkspaceInspectorStyle: React.CSSProperties = {
  display: "grid",
  gap: "12px",
  alignContent: "start",
  position: "sticky",
  top: "12px",
  minWidth: 0,
  maxWidth: "320px",
  width: "100%",
};

const blueprintInspectorCardStyle: React.CSSProperties = {
  display: "grid",
  gap: "4px",
  padding: "12px",
  borderRadius: "14px",
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(15,23,42,0.58)",
};

const inspectorOpeningItemStyle: React.CSSProperties = {
  display: "grid",
  gap: "6px",
  padding: "8px",
  borderRadius: "10px",
  background: "rgba(0,0,0,0.15)",
  border: "1px solid rgba(255,255,255,0.04)",
  marginTop: "8px",
};

const inspectorOpeningInputGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "8px",
};

const blueprintInspectorMetricGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "8px",
  marginTop: "8px",
};

const blueprintTakeoffNoteStyle: React.CSSProperties = {
  margin: 0,
  color: "#cbd5e1",
  fontSize: "12px",
  lineHeight: 1.35,
};

const blueprintWorkflowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: "10px",
  margin: "20px 0",
};

const blueprintWorkflowStepIndicatorStyle: React.CSSProperties = {
  width: "100%",
  minHeight: "44px",
  padding: "10px 14px",
  borderRadius: "14px",
  border: "1px solid rgba(255,255,255,0.06)",
  background: "rgba(255,255,255,0.02)",
  display: "flex",
  alignItems: "center",
  gap: "12px",
  transition: "all 0.3s ease",
};

const blueprintWorkflowStepIndicatorActiveStyle: React.CSSProperties = {
  ...blueprintWorkflowStepIndicatorStyle,
  background: "rgba(212,175,55,0.05)",
  border: "1px solid rgba(212,175,55,0.15)",
};

const blueprintWorkflowStepIndicatorDoneStyle: React.CSSProperties = {
  ...blueprintWorkflowStepIndicatorStyle,
  background: "rgba(34,197,94,0.05)",
  border: "1px solid rgba(34,197,94,0.12)",
};

const blueprintWorkflowStepIndicatorLabelStyle: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: 700,
  color: "#94a3b8",
  margin: 0,
};

const blueprintWorkflowStepIndicatorLabelActiveStyle: React.CSSProperties = {
  ...blueprintWorkflowStepIndicatorLabelStyle,
  color: "#f8fafc",
};

const blueprintWorkflowStepIndicatorLabelDoneStyle: React.CSSProperties = {
  ...blueprintWorkflowStepIndicatorLabelStyle,
  color: "#22c55e",
};

const blueprintSidebarSectionHeaderStyle: React.CSSProperties = {
  fontSize: "10px",
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "#64748b",
  marginTop: "24px",
  marginBottom: "12px",
  display: "flex",
  alignItems: "center",
  gap: "8px",
};

const blueprintSummaryBlockStyle: React.CSSProperties = {
  padding: "16px",
  borderRadius: "16px",
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.06)",
  display: "grid",
  gap: "12px",
};

const blueprintSummaryItemStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const blueprintSummaryLabelStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "#94a3b8",
  margin: 0,
};

const blueprintSummaryValueStyle: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: 700,
  color: "#f1f5f9",
  margin: 0,
};

const blueprintActionButtonStyle: React.CSSProperties = {
  width: "100%",
  minHeight: "40px",
  padding: "8px 16px",
  borderRadius: "12px",
  border: "1px solid rgba(212,175,55,0.25)",
  background: "rgba(212,175,55,0.1)",
  color: "#f8fafc",
  fontSize: "13px",
  fontWeight: 800,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
  transition: "all 0.2s ease",
};

const blueprintPrimaryActionButtonStyle: React.CSSProperties = {
  width: "100%",
  minHeight: "48px",
  padding: "12px 20px",
  borderRadius: "14px",
  background: "linear-gradient(135deg, #d4af37 0%, #b8962e 100%)",
  color: "#0f172a",
  fontSize: "14px",
  fontWeight: 900,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "10px",
  border: "none",
  cursor: "pointer",
  boxShadow: "0 8px 20px rgba(212,175,55,0.25)",
  marginTop: "16px",
  transition: "all 0.2s ease",
};

const persistentSummaryCardStyle: React.CSSProperties = {
  padding: "20px",
  borderRadius: "24px",
  background: "rgba(15, 23, 42, 0.4)",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
  gap: "16px",
  marginBottom: "20px",
  backdropFilter: "blur(12px)",
};

const persistentSummaryItemStyle: React.CSSProperties = {
  display: "grid",
  gap: "4px",
};

const persistentSummaryLabelStyle: React.CSSProperties = {
  fontSize: "10px",
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "#64748b",
  margin: 0,
};

const persistentSummaryValueStyle: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: 800,
  color: "#f8fafc",
  margin: 0,
  display: "flex",
  alignItems: "center",
  gap: "6px",
};

const envelopeSuggestionBadgeStyle: React.CSSProperties = {
  marginTop: "8px",
  padding: "8px 12px",
  borderRadius: "10px",
  background: "rgba(212,175,55,0.08)",
  border: "1px solid rgba(212,175,55,0.2)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "8px",
};

const envelopeSuggestionTextStyle: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 700,
  color: "#fde68a",
  margin: 0,
};

const envelopeSuggestionActionStyle: React.CSSProperties = {
  background: "rgba(212,175,55,0.2)",
  border: "1px solid rgba(212,175,55,0.3)",
  borderRadius: "6px",
  color: "#fde68a",
  fontSize: "10px",
  fontWeight: 900,
  padding: "2px 8px",
  cursor: "pointer",
  transition: "all 0.2s ease",
};

const constructionNotesListStyle: React.CSSProperties = {
  marginTop: "20px",
  padding: "16px",
  borderRadius: "16px",
  background: "rgba(255,255,255,0.02)",
  border: "1px solid rgba(255,255,255,0.05)",
};

const constructionNoteItemStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "#94a3b8",
  margin: "4px 0",
  display: "flex",
  alignItems: "center",
  gap: "8px",
};

const blueprintWorkflowStepStyle: React.CSSProperties = {
  width: "100%",
  minHeight: "38px",
  padding: "8px 10px",
  borderRadius: "12px",
  border: "1px solid rgba(212,175,55,0.20)",
  background: "rgba(255,255,255,0.035)",
  color: "#f8fafc",
  fontSize: "11px",
  fontWeight: 900,
  lineHeight: 1.25,
  display: "flex",
  alignItems: "center",
  textAlign: "left",
  cursor: "pointer",
};

const blueprintWorkflowStepDisabledStyle: React.CSSProperties = {
  ...blueprintWorkflowStepStyle,
  border: "1px solid rgba(148,163,184,0.16)",
  background: "rgba(15,23,42,0.42)",
  color: "#64748b",
  cursor: "not-allowed",
};

const blueprintUploadRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  flexWrap: "wrap",
};

const blueprintUploadButtonStyle: React.CSSProperties = {
  minHeight: "40px",
  padding: "8px 12px",
  borderRadius: "12px",
  border: "1px solid rgba(212,175,55,0.28)",
  background: "rgba(212,175,55,0.14)",
  color: "#f8fafc",
  fontSize: "12px",
  fontWeight: 900,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const blueprintUploadInputStyle: React.CSSProperties = {
  display: "none",
};

const blueprintUploadFileNameStyle: React.CSSProperties = {
  margin: 0,
  minWidth: 0,
  color: "#cbd5e1",
  fontSize: "12px",
  fontWeight: 800,
  overflowWrap: "anywhere",
};

const blueprintDetectButtonStyle: React.CSSProperties = {
  minHeight: "40px",
  padding: "8px 12px",
  borderRadius: "12px",
  border: "1px solid rgba(212,175,55,0.28)",
  background: "rgba(212,175,55,0.14)",
  color: "#f8fafc",
  fontSize: "12px",
  fontWeight: 900,
  cursor: "pointer",
};

const blueprintDetectButtonDisabledStyle: React.CSSProperties = {
  border: "1px solid rgba(148,163,184,0.16)",
  background: "rgba(15,23,42,0.48)",
  color: "#64748b",
  cursor: "not-allowed",
};

const blueprintWorkspaceStyle: React.CSSProperties = {
  width: "100%",
  display: "grid",
  gap: "10px",
  padding: "12px",
  borderRadius: "18px",
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.03)",
};

const blueprintWorkspaceEmptyStyle: React.CSSProperties = {
  minHeight: "clamp(420px, 58vh, 720px)",
  display: "grid",
  placeContent: "center",
  gap: "6px",
  padding: "24px",
  borderRadius: "18px",
  border: "1px dashed rgba(212,175,55,0.22)",
  background: "rgba(3,7,18,0.42)",
  textAlign: "center",
};

const blueprintWorkspaceToolbarStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  flexWrap: "wrap",
};

const blueprintNavigationContainerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  padding: "4px 8px",
  background: "rgba(255,255,255,0.04)",
  borderRadius: "10px",
  border: "1px solid rgba(255,255,255,0.08)",
};

const blueprintNavigationButtonStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "28px",
  height: "28px",
  borderRadius: "6px",
  border: "1px solid rgba(255,255,255,0.1)",
  background: "rgba(15,23,42,0.6)",
  color: "#f8fafc",
  cursor: "pointer",
  transition: "all 0.2s ease",
  padding: 0,
};

const blueprintNavigationPageLabelStyle: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 800,
  color: "#94a3b8",
  minWidth: "70px",
  textAlign: "center",
  textTransform: "uppercase",
  letterSpacing: "0.02em",
};

const blueprintZoomLabelStyle: React.CSSProperties = {
  fontSize: "10px",
  fontWeight: 900,
  color: "#fde68a",
  minWidth: "36px",
  textAlign: "center",
};

const blueprintViewBadgeStyle: React.CSSProperties = {
  fontSize: "9px",
  fontWeight: 800,
  color: "#94a3b8",
  padding: "4px 8px",
  borderRadius: "6px",
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.08)",
  textTransform: "uppercase",
  letterSpacing: "0.03em",
  marginLeft: "8px",
};

const blueprintCommandBarStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  padding: "12px",
  background: "rgba(15, 23, 42, 0.96)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "16px 16px 0 0",
  flexWrap: "wrap",
  zIndex: 10,
};

const commandBarGroupStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
};

const commandBarButtonStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  height: "44px",
  padding: "0 16px",
  borderRadius: "10px",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  color: "#f8fafc",
  fontSize: "12px",
  fontWeight: 700,
  cursor: "pointer",
  transition: "all 0.2s ease",
  whiteSpace: "nowrap",
};

const commandBarButtonActiveStyle: React.CSSProperties = {
  ...commandBarButtonStyle,
  background: "rgba(212,175,55,0.15)",
  border: "1px solid rgba(212,175,55,0.3)",
  color: "#fde68a",
};

const blueprintWorkspaceLabelStyle: React.CSSProperties = {
  margin: 0,
  color: "#f8fafc",
  fontSize: "12px",
  fontWeight: 900,
};

const blueprintWorkspaceMetaStyle: React.CSSProperties = {
  margin: "3px 0 0",
  color: "#94a3b8",
  fontSize: "11px",
  fontWeight: 800,
};

const blueprintZoomControlsStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
};

const blueprintCalibrationInlineStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  padding: "8px 10px",
  borderRadius: "12px",
  border: "1px solid rgba(212,175,55,0.18)",
  background: "rgba(15,23,42,0.64)",
};

const blueprintCalibrationStatusStyle: React.CSSProperties = {
  margin: 0,
  color: "#d4af37",
  fontSize: "11px",
  fontWeight: 900,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  whiteSpace: "nowrap",
};

const blueprintCalibrationHelperStyle: React.CSSProperties = {
  margin: "3px 0 0",
  color: "#94a3b8",
  fontSize: "11px",
  fontWeight: 800,
  whiteSpace: "nowrap",
};

const blueprintCalibrationInputGroupStyle: React.CSSProperties = {
  display: "grid",
  gap: "4px",
  minWidth: "150px",
};

const structuredCalibrationGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr 1.5fr",
  gap: "6px",
};

const roomCardInputWrapperStyle: React.CSSProperties = {
  display: "grid",
  gap: "4px",
};

const roomCardInputLabelStyle: React.CSSProperties = {
  color: "#94a3b8",
  fontSize: "10px",
  fontWeight: 800,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
};

const blueprintCalibrationInputLabelStyle: React.CSSProperties = {
  color: "#cbd5e1",
  fontSize: "10px",
  fontWeight: 900,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
};

const blueprintCalibrationInputStyle: React.CSSProperties = {
  width: "150px",
  height: "30px",
  borderRadius: "10px",
  border: "1px solid rgba(212,175,55,0.24)",
  background: "rgba(15,23,42,0.82)",
  color: "#f8fafc",
  fontSize: "12px",
  fontWeight: 800,
  padding: "0 9px",
};

const blueprintCalibrationFieldMeasurementStyle: React.CSSProperties = {
  color: "#94a3b8",
  fontSize: "10px",
  fontWeight: 800,
  whiteSpace: "nowrap",
};

const blueprintFocusAreaStyle: React.CSSProperties = {
  position: "absolute",
  border: "2px dashed #d4af37",
  background: "rgba(212,175,55,0.08)",
  borderRadius: "4px",
  pointerEvents: "none",
  zIndex: 15,
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "flex-start",
};

const blueprintFocusAreaLabelStyle: React.CSSProperties = {
  background: "#d4af37",
  color: "#1e293b",
  fontSize: "9px",
  fontWeight: 900,
  padding: "2px 6px",
  borderRadius: "0 0 4px 0",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const blueprintCalibrationButtonStyle: React.CSSProperties = {
  minHeight: "30px",
  border: "1px solid rgba(212,175,55,0.22)",
  borderRadius: "10px",
  background: "rgba(15,23,42,0.72)",
  color: "#f8fafc",
  fontSize: "11px",
  fontWeight: 900,
  padding: "0 10px",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const blueprintCalibrationConfirmButtonStyle: React.CSSProperties = {
  ...blueprintCalibrationButtonStyle,
  border: "1px solid rgba(134,239,172,0.24)",
  background: "rgba(22,101,52,0.28)",
  color: "#bbf7d0",
};

const blueprintTraceInlineStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  padding: "8px 10px",
  borderRadius: "12px",
  border: "1px solid rgba(148,163,184,0.18)",
  background: "rgba(15,23,42,0.5)",
};

const blueprintTraceAssistTextStyle: React.CSSProperties = {
  margin: "3px 0 0",
  color: "#cbd5e1",
  fontSize: "10px",
  fontWeight: 800,
  whiteSpace: "nowrap",
};

const blueprintTraceButtonStyle: React.CSSProperties = {
  minHeight: "36px",
  border: "1px solid rgba(212,175,55,0.28)",
  borderRadius: "10px",
  background: "rgba(212,175,55,0.14)",
  color: "#f8fafc",
  fontSize: "12px",
  fontWeight: 900,
  padding: "0 16px",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const blueprintTraceActiveButtonStyle: React.CSSProperties = {
  ...blueprintTraceButtonStyle,
  background: "rgba(212,175,55,0.24)",
  border: "1px solid rgba(212,175,55,0.45)",
  color: "#fde68a",
  boxShadow: "0 0 15px rgba(212,175,55,0.15)",
};

const blueprintTraceSecondaryButtonStyle: React.CSSProperties = {
  ...blueprintTraceButtonStyle,
  border: "1px solid rgba(148,163,184,0.24)",
  background: "rgba(15,23,42,0.76)",
  color: "#cbd5e1",
};

const blueprintZoomButtonStyle: React.CSSProperties = {
  width: "34px",
  height: "34px",
  borderRadius: "12px",
  border: "1px solid rgba(212,175,55,0.28)",
  background: "rgba(212,175,55,0.14)",
  color: "#f8fafc",
  fontSize: "18px",
  fontWeight: 900,
  cursor: "pointer",
  lineHeight: 1,
};

const blueprintViewportStyle: React.CSSProperties = {
  height: "clamp(480px, 85vh, 880px)",
  overflow: "auto",
  borderRadius: "14px",
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(3, 7, 18, 0.62)",
  cursor: "crosshair",
  position: "relative",
};

const blueprintCanvasStyle: React.CSSProperties = {
  position: "relative",
  display: "inline-block",
  lineHeight: 0,
  transformOrigin: "top left",
  transition: "transform 0.18s ease-out",
};

const blueprintImagePreviewStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "none",
  height: "auto",
  minWidth: "620px",
  display: "block",
};

const blueprintPdfPreviewStyle: React.CSSProperties = {
  width: "620px",
  minHeight: "240px",
  padding: "28px",
  display: "grid",
  alignContent: "center",
  gap: "6px",
  background: "linear-gradient(135deg, rgba(212,175,55,0.14), rgba(15,23,42,0.68))",
};

const blueprintManualFallbackLabelStyle: React.CSSProperties = {
  margin: "2px 0 -2px",
  color: "#d4af37",
  fontSize: "11px",
  fontWeight: 900,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
};

const blueprintPdfPreviewTitleStyle: React.CSSProperties = {
  margin: 0,
  color: "#f8fafc",
  fontSize: "13px",
  fontWeight: 900,
};

const blueprintPdfPreviewTextStyle: React.CSSProperties = {
  margin: 0,
  color: "#cbd5e1",
  fontSize: "12px",
  fontWeight: 800,
  overflowWrap: "anywhere",
};

const blueprintCalibrationOverlayStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  minWidth: "620px",
  cursor: "crosshair",
  zIndex: 1,
};

const blueprintCalibrationLineSvgStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  pointerEvents: "none",
  overflow: "visible",
};

const blueprintCalibrationLineStyle: React.CSSProperties = {
  stroke: "rgba(250,204,21,0.95)",
  strokeWidth: 0.35,
  strokeDasharray: "1.4 1",
  vectorEffect: "non-scaling-stroke",
};

const blueprintCalibrationLineConfirmedStyle: React.CSSProperties = {
  ...blueprintCalibrationLineStyle,
  stroke: "rgba(250,204,21,0.46)",
  strokeWidth: 0.24,
};

const blueprintCalibrationPointStyle: React.CSSProperties = {
  position: "absolute",
  width: "20px",
  height: "20px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  transform: "translate(-50%, -50%)",
  pointerEvents: "none",
  color: "#fac015",
};

const blueprintCalibrationCrosshairDotStyle: React.CSSProperties = {
  width: "3px",
  height: "3px",
  borderRadius: "50%",
  background: "currentColor",
  boxShadow: "0 0 1.5px rgba(0,0,0,0.9)",
  zIndex: 2,
};

const blueprintCalibrationCrosshairLineHStyle: React.CSSProperties = {
  position: "absolute",
  width: "12px",
  height: "1px",
  background: "currentColor",
  boxShadow: "0 0 1px rgba(0,0,0,0.5)",
};

const blueprintCalibrationCrosshairLineVStyle: React.CSSProperties = {
  position: "absolute",
  width: "1px",
  height: "12px",
  background: "currentColor",
  boxShadow: "0 0 1px rgba(0,0,0,0.5)",
};

const blueprintCalibrationNumberLabelStyle: React.CSSProperties = {
  position: "absolute",
  top: "-12px",
  right: "-12px",
  fontSize: "10px",
  fontWeight: 950,
  color: "#fde68a",
  textShadow: "0 1px 3px rgba(0,0,0,1)",
  pointerEvents: "none",
};

const blueprintMeasurementLabelStyle: React.CSSProperties = {
  position: "absolute",
  padding: "5px 8px",
  borderRadius: "999px",
  border: "1px solid rgba(250,204,21,0.74)",
  background: "rgba(15,23,42,0.9)",
  boxShadow: "0 10px 22px rgba(0,0,0,0.32)",
  color: "#f8fafc",
  fontSize: "11px",
  fontWeight: 900,
  transform: "translate(-50%, -50%)",
  pointerEvents: "none",
  whiteSpace: "nowrap",
};

const blueprintVerificationLineStyle: React.CSSProperties = {
  stroke: "rgba(168,85,247,0.95)",
  strokeWidth: 0.35,
  strokeDasharray: "1.4 1",
  vectorEffect: "non-scaling-stroke",
};

const blueprintVerificationPointStyle: React.CSSProperties = {
  ...blueprintCalibrationPointStyle,
  color: "#a855f7",
};

const blueprintRoomOutlineSvgStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  pointerEvents: "none",
  overflow: "visible",
};

const blueprintRoomOutlinePolygonStyle: React.CSSProperties = {
  fill: "rgba(56,189,248,0.12)",
  stroke: "rgba(56,189,248,0.96)",
  strokeWidth: 0.55,
  vectorEffect: "non-scaling-stroke",
  pointerEvents: "none",
};

const blueprintRoomBoundaryLineStyle: React.CSSProperties = {
  fill: "none",
  stroke: "rgba(14,165,233,0.72)",
  strokeWidth: 1.2,
  vectorEffect: "non-scaling-stroke",
  cursor: "pointer",
  pointerEvents: "stroke",
};

const blueprintRoomBoundaryLineSelectedStyle: React.CSSProperties = {
  stroke: "rgba(250,204,21,0.98)",
  strokeWidth: 1.8,
};

const blueprintRoomDraftPolygonStyle: React.CSSProperties = {
  fill: "rgba(212,175,55,0.1)",
  stroke: "rgba(250,204,21,0.92)",
  strokeWidth: 0.48,
  vectorEffect: "non-scaling-stroke",
};

const blueprintRoomDraftLineStyle: React.CSSProperties = {
  fill: "none",
  stroke: "rgba(250,204,21,0.92)",
  strokeWidth: 0.5,
  strokeDasharray: "1.5 1",
  vectorEffect: "non-scaling-stroke",
};

const blueprintRoomTracePointStyle: React.CSSProperties = {
  position: "absolute",
  width: "14px",
  height: "14px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  transform: "translate(-50%, -50%)",
  cursor: "grab",
  pointerEvents: "auto",
  touchAction: "none",
  color: "rgba(56,189,248,0.9)",
};

const blueprintRoomTracePointStartStyle: React.CSSProperties = {
  ...blueprintRoomTracePointStyle,
  color: "#38bdf8",
};

const blueprintRoomTracePointDraggingStyle: React.CSSProperties = {
  color: "#fac015",
  cursor: "grabbing",
};

const blueprintRoomTracePointSelectedStyle: React.CSSProperties = {
  color: "#fde68a",
  outline: "none",
  zIndex: 10,
};

const blueprintRoomTracePointFocusStyle: React.CSSProperties = {
  outline: "1.5px solid rgba(250,204,21,0.8)",
  outlineOffset: "3px",
};

const blueprintRoomTraceNudgePulseStyle: React.CSSProperties = {
  position: "absolute",
  inset: "-10px",
  borderRadius: "50%",
  border: "1.5px solid rgba(250,204,21,0.6)",
  pointerEvents: "none",
  animation: "nudgePulse 0.4s ease-out forwards",
};

const blueprintRoomTraceCrosshairDotStyle: React.CSSProperties = {
  width: "2px",
  height: "2px",
  borderRadius: "50%",
  background: "currentColor",
  boxShadow: "0 0 1px rgba(0,0,0,0.8)",
  zIndex: 2,
};

const blueprintRoomTraceCrosshairLineHStyle: React.CSSProperties = {
  position: "absolute",
  width: "9px",
  height: "1px",
  background: "currentColor",
  opacity: 0.8,
};

const blueprintRoomTraceCrosshairLineVStyle: React.CSSProperties = {
  position: "absolute",
  width: "1px",
  height: "9px",
  background: "currentColor",
  opacity: 0.8,
};

const blueprintRoomTraceNumberLabelStyle: React.CSSProperties = {
  position: "absolute",
  top: "-10px",
  right: "-10px",
  fontSize: "7px",
  fontWeight: 900,
  color: "#f8fafc",
  textShadow: "0 1px 2px rgba(0,0,0,0.9)",
  pointerEvents: "none",
};

const blueprintOverlayLayerStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  minWidth: "620px",
  pointerEvents: "none",
  zIndex: 2,
};

const blueprintOverlayMarkerStyle: React.CSSProperties = {
  position: "absolute",
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "flex-start",
  padding: "4px",
  borderRadius: "10px",
  border: "1px solid rgba(212,175,55,0.72)",
  background: "rgba(212,175,55,0.12)",
  boxShadow: "0 10px 24px rgba(0,0,0,0.22)",
  color: "#f8fafc",
  cursor: "pointer",
  pointerEvents: "auto",
};

const blueprintOverlayMarkerActiveStyle: React.CSSProperties = {
  border: "2px solid rgba(250,204,21,0.96)",
  background: "rgba(212,175,55,0.24)",
  boxShadow: "0 0 0 3px rgba(212,175,55,0.14), 0 14px 30px rgba(0,0,0,0.24)",
};

const blueprintOverlayLabelStyle: React.CSSProperties = {
  maxWidth: "100%",
  padding: "4px 6px",
  borderRadius: "999px",
  background: "rgba(15,23,42,0.86)",
  color: "#f8fafc",
  fontSize: "10px",
  fontWeight: 950,
  lineHeight: 1.1,
  overflowWrap: "anywhere",
  textAlign: "left",
};

const blueprintAirflowPreviewStyle: React.CSSProperties = {
  display: "grid",
  gap: "10px",
  padding: "12px",
  borderRadius: "14px",
  border: "1px solid rgba(212,175,55,0.22)",
  background: "linear-gradient(135deg, rgba(212,175,55,0.12), rgba(15,23,42,0.78))",
};

const blueprintAirflowPreviewLabelStyle: React.CSSProperties = {
  margin: 0,
  color: "#d4af37",
  fontSize: "10px",
  fontWeight: 950,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
};

const blueprintAirflowPreviewTitleStyle: React.CSSProperties = {
  margin: "3px 0 0",
  color: "#f8fafc",
  fontSize: "15px",
  fontWeight: 950,
};

const blueprintAirflowPreviewGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(118px, 1fr))",
  gap: "8px",
};

const blueprintAirflowPreviewMetricStyle: React.CSSProperties = {
  display: "grid",
  gap: "4px",
  minWidth: 0,
  padding: "9px",
  borderRadius: "12px",
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(3,7,18,0.34)",
  color: "#f8fafc",
  fontSize: "12px",
  fontWeight: 900,
};

const blueprintAirflowPreviewMetricLabelStyle: React.CSSProperties = {
  color: "#94a3b8",
  fontSize: "9px",
  fontWeight: 950,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const detectedRoomsSectionStyle: React.CSSProperties = {
  display: "grid",
  gap: "10px",
  padding: "12px 0 0",
  borderRadius: "16px",
  border: "0",
  background: "transparent",
};

const blueprintDrawerStyle: React.CSSProperties = {
  display: "grid",
  gap: "10px",
  padding: "12px",
  borderRadius: "16px",
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.025)",
};

const blueprintDrawerSummaryStyle: React.CSSProperties = {
  color: "#f8fafc",
  fontSize: "12px",
  fontWeight: 950,
  cursor: "pointer",
  listStyle: "revert",
};

const detectedRoomsNoteStyle: React.CSSProperties = {
  margin: "5px 0 0",
  color: "#94a3b8",
  fontSize: "12px",
  lineHeight: 1.35,
};

const detectedRoomActionMessageStyle: React.CSSProperties = {
  margin: "7px 0 0",
  color: "#d4af37",
  fontSize: "12px",
  fontWeight: 900,
};

const detectedRoomsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "10px",
};

const detectedRoomCardStyle: React.CSSProperties = {
  display: "grid",
  gap: "8px",
  padding: "10px",
  borderRadius: "14px",
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(15,23,42,0.58)",
};

const detectedRoomCardActiveStyle: React.CSSProperties = {
  border: "1px solid rgba(212,175,55,0.44)",
  background: "rgba(212,175,55,0.1)",
  boxShadow: "0 0 0 3px rgba(212,175,55,0.08)",
};

const detectedRoomHeaderStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  alignItems: "center",
  gap: "8px",
};

const tracedRoomTitleStyle: React.CSSProperties = {
  margin: 0,
  color: "#f8fafc",
  fontSize: "13px",
  fontWeight: 950,
  overflowWrap: "anywhere",
};

const detectedRoomInputStyle: React.CSSProperties = {
  ...inputControlStyle,
  height: "34px",
  minHeight: "34px",
  maxHeight: "34px",
  padding: "7px 10px",
  borderRadius: "12px",
  fontSize: "13px",
  boxSizing: "border-box",
};

const detectedRoomBadgeGroupStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: "6px",
  flexWrap: "wrap",
};

const detectedRoomConfidenceBadgeStyle: React.CSSProperties = {
  padding: "6px 8px",
  borderRadius: "999px",
  border: "1px solid rgba(212,175,55,0.22)",
  background: "rgba(212,175,55,0.12)",
  color: "#fde68a",
  fontSize: "10px",
  fontWeight: 950,
  textTransform: "uppercase",
  whiteSpace: "nowrap",
};

const detectedRoomWorkflowBadgeStyle: React.CSSProperties = {
  padding: "6px 8px",
  borderRadius: "999px",
  fontSize: "10px",
  fontWeight: 950,
  textTransform: "uppercase",
  whiteSpace: "nowrap",
};

const detectedRoomReviewBadgeStyle: React.CSSProperties = {
  border: "1px solid rgba(251,191,36,0.22)",
  background: "rgba(120,53,15,0.24)",
  color: "#fde68a",
};

const detectedRoomConfirmedBadgeStyle: React.CSSProperties = {
  border: "1px solid rgba(134,239,172,0.22)",
  background: "rgba(22,101,52,0.24)",
  color: "#86efac",
};

const detectedRoomSentBadgeStyle: React.CSSProperties = {
  border: "1px solid rgba(125,211,252,0.24)",
  background: "rgba(12,74,110,0.24)",
  color: "#bae6fd",
};

const detectedRoomFactsStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  flexWrap: "wrap",
  margin: 0,
  color: "#cbd5e1",
  fontSize: "11px",
  fontWeight: 800,
};

const tracedRoomEnvelopeInsightStyle: React.CSSProperties = {
  display: "grid",
  gap: "7px",
  padding: "10px",
  borderRadius: "12px",
  border: "1px solid rgba(56,189,248,0.18)",
  background: "rgba(3,7,18,0.28)",
};

const tracedRoomEnvelopeInsightTitleStyle: React.CSSProperties = {
  margin: 0,
  color: "#bae6fd",
  fontSize: "10px",
  fontWeight: 950,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const tracedRoomEnvelopeInsightMessagesStyle: React.CSSProperties = {
  display: "grid",
  gap: "4px",
};

const tracedRoomEnvelopeInsightMessageStyle: React.CSSProperties = {
  margin: 0,
  color: "#dbeafe",
  fontSize: "11px",
  fontWeight: 800,
  lineHeight: 1.45,
};

const detectedRoomEditGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(72px, 1fr))",
  gap: "8px",
};

const detectedRoomEditFieldStyle: React.CSSProperties = {
  display: "grid",
  gap: "5px",
  minWidth: 0,
};

const detectedRoomEditLabelStyle: React.CSSProperties = {
  color: "#94a3b8",
  fontSize: "9px",
  fontWeight: 950,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const detectedRoomCompactInputStyle: React.CSSProperties = {
  ...detectedRoomInputStyle,
  width: "100%",
  height: "32px",
  minHeight: "32px",
  maxHeight: "32px",
  padding: "2px 8px",
  fontSize: "11px",
};

const edgeTypeSelectorStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(80px, 1fr))",
  gap: "4px",
  marginTop: "8px",
};

const edgeTypeButtonStyle: React.CSSProperties = {
  padding: "6px 4px",
  borderRadius: "8px",
  fontSize: "9px",
  fontWeight: 800,
  textTransform: "uppercase",
  cursor: "pointer",
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(15,23,42,0.4)",
  color: "#94a3b8",
  transition: "all 0.2s ease",
  textAlign: "center",
};

const edgeTypeButtonActiveStyle: React.CSSProperties = {
  ...edgeTypeButtonStyle,
  background: "rgba(212,175,55,0.15)",
  color: "#fde68a",
  border: "1px solid rgba(212,175,55,0.4)",
};

const openingListStyle: React.CSSProperties = {
  display: "grid",
  gap: "6px",
  marginTop: "12px",
  width: "100%",
};

const openingItemStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "8px 12px",
  borderRadius: "10px",
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.06)",
};

const openingInfoStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "2px",
};

const openingTitleStyle: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 800,
  color: "#f1f5f9",
  margin: 0,
  textTransform: "uppercase",
};

const openingMetaStyle: React.CSSProperties = {
  fontSize: "10px",
  color: "#94a3b8",
  margin: 0,
};

const openingDeleteButtonStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "#f87171",
  fontSize: "10px",
  fontWeight: 800,
  cursor: "pointer",
  padding: "4px",
};

const openingAddButtonStyle: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: "8px",
  fontSize: "10px",
  fontWeight: 900,
  textTransform: "uppercase",
  cursor: "pointer",
  background: "rgba(212,175,55,0.1)",
  color: "#fde68a",
  border: "1px solid rgba(212,175,55,0.2)",
  display: "flex",
  alignItems: "center",
  gap: "6px",
};


const detectedRoomActionsStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "6px",
};

const detectedRoomButtonStyle: React.CSSProperties = {
  minHeight: "32px",
  padding: "7px 9px",
  borderRadius: "11px",
  border: "1px solid rgba(212,175,55,0.24)",
  background: "rgba(212,175,55,0.12)",
  color: "#f8fafc",
  fontSize: "11px",
  fontWeight: 900,
  cursor: "pointer",
};

const detectedRoomRemoveButtonStyle: React.CSSProperties = {
  ...detectedRoomButtonStyle,
  border: "1px solid rgba(248,113,113,0.22)",
  background: "rgba(127,29,29,0.22)",
  color: "#fecaca",
};

const tracedRoomButtonDisabledStyle: React.CSSProperties = {
  opacity: 0.45,
  cursor: "not-allowed",
};

const blueprintTakeoffInputGroupStyle: React.CSSProperties = {
  display: "grid",
  gap: "6px",
  flex: "0 0 86px",
  minWidth: "78px",
};

const blueprintTakeoffRoomNameGroupStyle: React.CSSProperties = {
  ...blueprintTakeoffInputGroupStyle,
  flex: "1 1 180px",
  minWidth: "160px",
};

const blueprintTakeoffInputLabelStyle: React.CSSProperties = {
  color: "#cbd5e1",
  fontSize: "10px",
  fontWeight: 900,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const blueprintTakeoffInputStyle: React.CSSProperties = {
  ...inputControlStyle,
  height: "38px",
  minHeight: "38px",
  maxHeight: "38px",
  padding: "8px 10px",
  borderRadius: "12px",
  fontSize: "13px",
  lineHeight: "20px",
  boxSizing: "border-box",
};

const blueprintTakeoffResultStyle: React.CSSProperties = {
  flex: "0 0 124px",
  alignSelf: "flex-end",
  display: "grid",
  alignContent: "center",
  height: "38px",
  minHeight: "38px",
  maxHeight: "38px",
  padding: "5px 10px",
  borderRadius: "12px",
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.08)",
  boxSizing: "border-box",
};

const blueprintTakeoffLabelStyle: React.CSSProperties = {
  margin: 0,
  color: "#94a3b8",
  fontSize: "9px",
  fontWeight: 800,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  lineHeight: 1,
};

const blueprintTakeoffValueStyle: React.CSSProperties = {
  margin: "2px 0 0",
  color: "#f8fafc",
  fontSize: "13px",
  fontWeight: 900,
  lineHeight: 1,
};

const blueprintTakeoffButtonStyle: React.CSSProperties = {
  ...calcActionButtonStyle,
  flex: "0 0 auto",
  alignSelf: "flex-end",
  height: "38px",
  minHeight: "38px",
  maxHeight: "38px",
  padding: "8px 12px",
  borderRadius: "12px",
  fontSize: "13px",
  whiteSpace: "nowrap",
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

const auditPanelStyle: React.CSSProperties = {
  marginTop: "32px",
  padding: "24px",
  borderRadius: "24px",
  background: "rgba(15, 23, 42, 0.4)",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  display: "grid",
  gap: "24px",
};

const auditTitleStyle: React.CSSProperties = {
  fontSize: "18px",
  fontWeight: 800,
  color: "#f8fafc",
  margin: 0,
};

const auditSubtitleStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "#64748b",
  margin: "4px 0 0 0",
};

const auditSectionTitleStyle: React.CSSProperties = {
  fontSize: "10px",
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "#94a3b8",
  margin: "0 0 12px 0",
};

const auditGridStyle: React.CSSProperties = {
  display: "grid",
  gap: "8px",
};

const auditRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.5fr 1fr 1fr 100px",
  padding: "10px 16px",
  borderRadius: "12px",
  background: "rgba(255, 255, 255, 0.02)",
  alignItems: "center",
  fontSize: "13px",
};

const auditLabelStyle: React.CSSProperties = {
  fontWeight: 600,
  color: "#f1f5f9",
  margin: 0,
};

const auditValueStyle: React.CSSProperties = {
  color: "#cbd5e1",
  margin: 0,
};

const auditSourceStyle: React.CSSProperties = {
  fontSize: "11px",
  color: "#64748b",
  margin: 0,
};

const auditBadgeStyle: React.CSSProperties = {
  fontSize: "10px",
  fontWeight: 900,
  padding: "2px 8px",
  borderRadius: "6px",
  textAlign: "center",
  textTransform: "uppercase",
};

const auditBadgeVerifiedStyle: React.CSSProperties = {
  ...auditBadgeStyle,
  background: "rgba(34, 197, 94, 0.15)",
  color: "#4ade80",
  border: "1px solid rgba(34, 197, 94, 0.2)",
};

const auditBadgeAssumedStyle: React.CSSProperties = {
  ...auditBadgeStyle,
  background: "rgba(212, 175, 55, 0.15)",
  color: "#fde68a",
  border: "1px solid rgba(212, 175, 55, 0.2)",
};

const auditBadgeMissingStyle: React.CSSProperties = {
  ...auditBadgeStyle,
  background: "rgba(239, 68, 68, 0.15)",
  color: "#f87171",
  border: "1px solid rgba(239, 68, 68, 0.2)",
};

const auditAssumptionItemStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "#94a3b8",
  margin: "4px 0",
  display: "flex",
  gap: "8px",
  alignItems: "baseline",
};

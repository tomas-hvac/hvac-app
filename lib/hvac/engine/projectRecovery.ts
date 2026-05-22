import {
  ProjectEngineState,
  ProjectResumeSuggestion,
  ProjectWorkflowStage,
} from "./projectEngineTypes";
import { getCriticalWarnings } from "./projectWarnings";

function buildSuggestion(
  state: ProjectEngineState,
  options: {
    id: string;
    title: string;
    message: string;
    whatChanged: string;
    recommendedStage: ProjectWorkflowStage;
    severity?: ProjectResumeSuggestion["severity"];
  }
): ProjectResumeSuggestion {
  return {
    id: options.id,
    title: options.title,
    message: options.message,
    whatChanged: options.whatChanged,
    recommendedStage: options.recommendedStage,
    lastActiveStage: state.lastActiveStage,
    lastSessionAt: state.lastSessionAt,
    severity: options.severity ?? "info",
  };
}

function hasRecoverableFootprint(state: ProjectEngineState): boolean {
  return Boolean(state.project.blueprintImage) ||
    state.project.calibration.status === "calibrated" ||
    state.project.tracedRooms.length > 0 ||
    state.dirtyFlags.length > 0 ||
    Object.values(state.milestones).some(Boolean);
}

export function getResumeSuggestion(state: ProjectEngineState): ProjectResumeSuggestion | undefined {
  if (!hasRecoverableFootprint(state)) return undefined;

  const firstCriticalWarning = getCriticalWarnings(state)[0];
  if (firstCriticalWarning) {
    return buildSuggestion(state, {
      id: `resume-warning-${firstCriticalWarning.id}`,
      title: "Resolve Blocking Issue",
      message: firstCriticalWarning.recommendedAction,
      whatChanged: firstCriticalWarning.message,
      recommendedStage: firstCriticalWarning.relatedStage,
      severity: "critical",
    });
  }

  const hasCalibratedRooms =
    state.project.calibration.status === "calibrated" &&
    state.project.tracedRooms.length > 0;

  const manualJDirty =
    hasCalibratedRooms &&
    (!state.milestones.manualJValidated ||
      state.calculationStatus === "dirty" ||
      state.dirtyFlags.some((flag) => flag === "MANUAL_J" || flag === "GEOMETRY" || flag === "ROOM_AREAS" || flag === "ENVELOPE"));

  if (manualJDirty) {
    return buildSuggestion(state, {
      id: "resume-load-calc",
      title: "Resume Load Calculation",
      message: "Continue at Manual J before moving downstream.",
      whatChanged: "Calibration and room takeoff are present, but Manual J is not validated for the current project state.",
      recommendedStage: "LOAD_CALC",
      severity: "warning",
    });
  }

  const manualDDirty =
    state.dirtyFlags.includes("MANUAL_D") ||
    (Boolean(state.project.manualDProjectState) && !state.milestones.manualDValidated);

  if (manualDDirty) {
    return buildSuggestion(state, {
      id: "resume-duct-design",
      title: "Resume Duct Design",
      message: "Manual D needs review before proposal or report work.",
      whatChanged: "The duct design milestone is missing or stale.",
      recommendedStage: "DUCT_DESIGN",
      severity: "warning",
    });
  }

  const proposalStale =
    state.dirtyFlags.includes("PROPOSAL") ||
    (state.milestones.manualDValidated && !state.milestones.proposalGenerated);

  if (proposalStale) {
    return buildSuggestion(state, {
      id: "resume-proposal",
      title: "Resume Proposal",
      message: "Review the customer proposal before reporting.",
      whatChanged: "Proposal work is not current with the validated design.",
      recommendedStage: "PROPOSAL",
      severity: "info",
    });
  }

  if (state.milestones.reportGenerated && !state.milestones.reportExported) {
    return buildSuggestion(state, {
      id: "resume-export",
      title: "Resume Export",
      message: "Export the latest generated report.",
      whatChanged: "A report exists, but the PDF export milestone has not been completed.",
      recommendedStage: "EXPORT",
      severity: "info",
    });
  }

  return undefined;
}

export function detectRecoverableWorkflowState(state: ProjectEngineState): ProjectResumeSuggestion | undefined {
  return getResumeSuggestion(state);
}

export function restoreWorkflowStage(state: ProjectEngineState): ProjectEngineState {
  const suggestion = state.resumeSuggestion ?? getResumeSuggestion(state);
  if (!suggestion) return state;

  return {
    ...state,
    workflowStage: suggestion.recommendedStage,
    lastActiveStage: suggestion.recommendedStage,
    resumeSuggestion: undefined,
    sessionRecovered: false,
    lastUpdatedAt: new Date().toISOString(),
  };
}

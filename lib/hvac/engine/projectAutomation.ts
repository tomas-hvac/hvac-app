import {
  ProjectEngineState,
  ProjectWorkflowStage,
} from "./projectEngineTypes";
import { getCriticalWarnings } from "./projectWarnings";

export type ProjectAutomationAction =
  | "GO_TO_STAGE"
  | "START_RECALCULATION"
  | "GENERATE_REPORT"
  | "EXPORT_REPORT"
  | "RESOLVE_WARNING";

export type ProjectAutomationRule = {
  id: string;
  label: string;
  evaluate: (state: ProjectEngineState) => ProjectAutomationResult | null;
};

export type ProjectAutomationResult = {
  ruleId: string;
  title: string;
  message: string;
  why: string;
  recommendedAction: string;
  suggestedStage?: ProjectWorkflowStage;
  actionType: ProjectAutomationAction;
  severity: "info" | "success" | "warning";
  preventsAutoAdvance?: boolean;
};

function hasValidManualD(state: ProjectEngineState): boolean {
  return state.milestones.manualDValidated && !state.dirtyFlags.includes("MANUAL_D");
}

function hasProposalSignal(state: ProjectEngineState): boolean {
  return state.milestones.proposalGenerated && !state.dirtyFlags.includes("PROPOSAL");
}

function hasReportSignal(state: ProjectEngineState): boolean {
  return state.milestones.reportGenerated && !state.milestones.reportExported && !state.dirtyFlags.includes("REPORT");
}

const automationRules: ProjectAutomationRule[] = [
  {
    id: "critical-warning-blocker",
    label: "Critical warning exists",
    evaluate: (state) => {
      const firstWarning = getCriticalWarnings(state)[0];
      if (!firstWarning) return null;

      return {
        ruleId: "critical-warning-blocker",
        title: "Resolve Critical Warning",
        message: firstWarning.title,
        why: firstWarning.message,
        recommendedAction: firstWarning.recommendedAction,
        suggestedStage: firstWarning.relatedStage,
        actionType: "RESOLVE_WARNING",
        severity: "warning",
        preventsAutoAdvance: true,
      };
    },
  },
  {
    id: "calibration-confirmed",
    label: "Calibration confirmed",
    evaluate: (state) => {
      if (state.project.calibration.status !== "calibrated") return null;
      if (state.workflowStage !== "CALIBRATION") return null;

      return {
        ruleId: "calibration-confirmed",
        title: "Start Takeoff",
        message: "Scale is confirmed. Room takeoff is ready to begin.",
        why: "The blueprint has a calibrated scale, so room areas can now be traced with reliable measurements.",
        recommendedAction: "Open the TAKEOFF stage.",
        suggestedStage: "TAKEOFF",
        actionType: "GO_TO_STAGE",
        severity: "success",
      };
    },
  },
  {
    id: "rooms-traced",
    label: "Rooms traced",
    evaluate: (state) => {
      if (state.project.tracedRooms.length === 0) return null;
      if (state.workflowStage !== "TAKEOFF") return null;

      return {
        ruleId: "rooms-traced",
        title: "Run Load Calculation",
        message: `${state.project.tracedRooms.length} room takeoff(s) are available for Manual J.`,
        why: "At least one traced room is present, giving the load workflow geometry to calculate from.",
        recommendedAction: "Open the LOAD_CALC stage.",
        suggestedStage: "LOAD_CALC",
        actionType: "GO_TO_STAGE",
        severity: "success",
      };
    },
  },
  {
    id: "dirty-geometry-after-valid-calculation",
    label: "Dirty geometry after valid calculation",
    evaluate: (state) => {
      const hasDirtyGeometry =
        state.dirtyFlags.includes("GEOMETRY") ||
        state.dirtyFlags.includes("ROOM_AREAS");

      if (!hasDirtyGeometry || state.calculationStatus !== "valid") return null;

      return {
        ruleId: "dirty-geometry-after-valid-calculation",
        title: "Refresh Manual J",
        message: "Geometry changed after the last valid load calculation.",
        why: "Room outlines or areas changed, so the current Manual J result may no longer match the takeoff.",
        recommendedAction: "Start recalculation from LOAD_CALC.",
        suggestedStage: "LOAD_CALC",
        actionType: "START_RECALCULATION",
        severity: "warning",
      };
    },
  },
  {
    id: "manual-j-validated",
    label: "Manual J validated",
    evaluate: (state) => {
      if (!state.milestones.manualJValidated) return null;
      if (state.calculationStatus !== "valid" || state.dirtyFlags.includes("MANUAL_J")) return null;
      if (state.workflowStage !== "LOAD_CALC") return null;

      return {
        ruleId: "manual-j-validated",
        title: "Design Ducts",
        message: "Manual J is valid and ready to feed airflow design.",
        why: "The ProjectEngine has an explicit Manual J validation milestone for the current project state.",
        recommendedAction: "Open the DUCT_DESIGN stage.",
        suggestedStage: "DUCT_DESIGN",
        actionType: "GO_TO_STAGE",
        severity: "success",
      };
    },
  },
  {
    id: "manual-d-validated",
    label: "Manual D validated",
    evaluate: (state) => {
      if (!hasValidManualD(state)) return null;
      if (state.workflowStage !== "DUCT_DESIGN") return null;

      return {
        ruleId: "manual-d-validated",
        title: "Prepare Proposal",
        message: "Manual D data is present and current.",
        why: "The ProjectEngine has an explicit Manual D validation milestone for the current project state.",
        recommendedAction: "Open the PROPOSAL stage.",
        suggestedStage: "PROPOSAL",
        actionType: "GO_TO_STAGE",
        severity: "success",
      };
    },
  },
  {
    id: "proposal-generated",
    label: "Proposal generated",
    evaluate: (state) => {
      if (!hasProposalSignal(state)) return null;
      if (state.workflowStage !== "PROPOSAL") return null;

      return {
        ruleId: "proposal-generated",
        title: "Generate Report",
        message: "Proposal data is ready for reporting.",
        why: "The proposal generation milestone has been marked complete.",
        recommendedAction: "Open the REPORT stage.",
        suggestedStage: "REPORT",
        actionType: "GENERATE_REPORT",
        severity: "success",
      };
    },
  },
  {
    id: "report-generated",
    label: "Report generated",
    evaluate: (state) => {
      if (!hasReportSignal(state)) return null;
      if (state.workflowStage !== "REPORT") return null;

      return {
        ruleId: "report-generated",
        title: "Export Report",
        message: "Report data is ready for PDF export.",
        why: "The report generation milestone is valid, but the export milestone is not current.",
        recommendedAction: "Open the EXPORT stage.",
        suggestedStage: "EXPORT",
        actionType: "EXPORT_REPORT",
        severity: "success",
      };
    },
  },
];

export function evaluateAutomationRules(state: ProjectEngineState): ProjectAutomationResult[] {
  const [criticalWarningRule, ...progressionRules] = automationRules;
  const blocker = criticalWarningRule.evaluate(state);

  if (blocker?.preventsAutoAdvance) {
    return [blocker];
  }

  return progressionRules
    .map((rule) => rule.evaluate(state))
    .filter((result): result is ProjectAutomationResult => Boolean(result));
}

export function getAutomationSuggestions(state: ProjectEngineState): ProjectAutomationResult[] {
  return state.automationSuggestions;
}

export function applyAutomationResult(
  state: ProjectEngineState,
  result: ProjectAutomationResult
): ProjectEngineState {
  const nextState: ProjectEngineState = {
    ...state,
    automationSuggestions: state.automationSuggestions.filter(
      (suggestion) => suggestion.ruleId !== result.ruleId
    ),
    lastUpdatedAt: new Date().toISOString(),
  };

  if (result.preventsAutoAdvance) {
    return result.suggestedStage
      ? { ...nextState, workflowStage: result.suggestedStage }
      : nextState;
  }

  if (result.actionType === "START_RECALCULATION") {
    return {
      ...nextState,
      workflowStage: result.suggestedStage ?? nextState.workflowStage,
      calculationStatus: "recalculating",
    };
  }

  if (result.suggestedStage) {
    return {
      ...nextState,
      workflowStage: result.suggestedStage,
    };
  }

  return nextState;
}

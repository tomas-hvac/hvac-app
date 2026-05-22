import { BlueprintProject } from "../blueprintProject";
import {
  ProjectAction,
  ProjectDirtyFlag,
  ProjectEngineState,
  ProjectMilestoneKey,
  ProjectTimelineEventType,
  ProjectWorkflowStage,
} from "./projectEngineTypes";
import {
  getStageGuard,
  getNextRecommendedStage,
  getWorkflowHealth,
} from "./projectWorkflowController";
import { invalidateProjectState, clearDirtyFlags } from "./projectInvalidation";
import { createTimelineEvent, appendTimelineEvent } from "./projectTimeline";
import { applyAutomationResult, evaluateAutomationRules } from "./projectAutomation";
import {
  detectRecoverableWorkflowState,
  getResumeSuggestion,
  restoreWorkflowStage,
} from "./projectRecovery";

const initialMilestones = {
  manualJValidated: false,
  manualDValidated: false,
  proposalGenerated: false,
  reportGenerated: false,
  reportExported: false,
};

const milestoneTimeline: Record<ProjectMilestoneKey, {
  type: ProjectTimelineEventType;
  title: string;
  message: string;
  relatedStage: ProjectWorkflowStage;
}> = {
  manualJValidated: {
    type: "MANUAL_J_RECALCULATED",
    title: "Manual J Validated",
    message: "Load calculations are synchronized with current project data.",
    relatedStage: "LOAD_CALC",
  },
  manualDValidated: {
    type: "MANUAL_D_RECALCULATED",
    title: "Manual D Validated",
    message: "Airflow design is synchronized with current load data.",
    relatedStage: "DUCT_DESIGN",
  },
  proposalGenerated: {
    type: "PROPOSAL_GENERATED",
    title: "Proposal Generated",
    message: "Customer proposal milestone marked complete.",
    relatedStage: "PROPOSAL",
  },
  reportGenerated: {
    type: "REPORT_GENERATED",
    title: "Report Generated",
    message: "Technician report preview generated.",
    relatedStage: "REPORT",
  },
  reportExported: {
    type: "REPORT_EXPORTED",
    title: "Report Exported",
    message: "Report export workflow started.",
    relatedStage: "EXPORT",
  },
};

const milestoneLabels: Record<ProjectMilestoneKey, string> = {
  manualJValidated: "Manual J",
  manualDValidated: "Manual D",
  proposalGenerated: "Proposal",
  reportGenerated: "Report",
  reportExported: "Report Export",
};

function markMilestone(
  state: ProjectEngineState,
  milestone: ProjectMilestoneKey
): ProjectEngineState {
  if (state.milestones[milestone]) return state;

  const event = milestoneTimeline[milestone];
  return appendTimelineEvent({
    ...state,
    milestones: {
      ...state.milestones,
      [milestone]: true,
    },
  }, createTimelineEvent(event.type, {
    title: event.title,
    message: event.message,
    severity: "success",
    relatedStage: event.relatedStage,
  }));
}

function resetMilestones(
  state: ProjectEngineState,
  milestones: ProjectMilestoneKey[],
  reason: string
): ProjectEngineState {
  const resetMilestones = milestones.filter((milestone) => state.milestones[milestone]);
  if (resetMilestones.length === 0) {
    return state;
  }

  return appendTimelineEvent({
    ...state,
    milestones: {
      ...state.milestones,
      ...Object.fromEntries(resetMilestones.map((milestone) => [milestone, false])),
    },
    lastUpdatedAt: new Date().toISOString(),
  }, createTimelineEvent("MILESTONE_RESET", {
    title: "Milestones Invalidated",
    message: `${resetMilestones.map((milestone) => milestoneLabels[milestone]).join(", ")} reset because ${reason}.`,
    severity: "warning",
    relatedStage: "LOAD_CALC",
    metadata: {
      reason,
      resetMilestones,
    },
  }));
}

function getMilestonesInvalidatedByDependency(
  dirtyFlagsOrActionType: string | ProjectDirtyFlag[]
): ProjectMilestoneKey[] {
  const actionType = Array.isArray(dirtyFlagsOrActionType)
    ? null
    : dirtyFlagsOrActionType;
  const dirtyFlags = Array.isArray(dirtyFlagsOrActionType)
    ? dirtyFlagsOrActionType
    : [];

  if (
    actionType === "UPDATE_CALIBRATION" ||
    actionType === "UPDATE_ROOM_TRACE" ||
    actionType === "UPDATE_ENVELOPE" ||
    actionType === "UPDATE_MANUAL_J" ||
    dirtyFlags.some((flag) => flag === "GEOMETRY" || flag === "ROOM_AREAS" || flag === "ENVELOPE" || flag === "MANUAL_J")
  ) {
    return ["manualJValidated", "manualDValidated", "proposalGenerated", "reportGenerated", "reportExported"];
  }

  if (
    actionType === "UPDATE_MANUAL_D" ||
    dirtyFlags.includes("MANUAL_D")
  ) {
    return ["manualDValidated", "proposalGenerated", "reportGenerated", "reportExported"];
  }

  if (
    actionType === "UPDATE_PROPOSAL" ||
    dirtyFlags.includes("PROPOSAL")
  ) {
    return ["reportGenerated", "reportExported"];
  }

  if (
    actionType === "MARK_REPORT_GENERATED" ||
    dirtyFlags.includes("REPORT")
  ) {
    return ["reportExported"];
  }

  return [];
}

function getMilestoneResetReason(dirtyFlagsOrActionType: string | ProjectDirtyFlag[]): string {
  const actionType = Array.isArray(dirtyFlagsOrActionType)
    ? null
    : dirtyFlagsOrActionType;

  switch (actionType) {
    case "UPDATE_CALIBRATION":
      return "calibration changed";
    case "UPDATE_ROOM_TRACE":
      return "room geometry changed";
    case "UPDATE_ENVELOPE":
      return "envelope settings changed";
    case "UPDATE_MANUAL_J":
      return "Manual J became dirty";
    case "UPDATE_MANUAL_D":
      return "Manual D became dirty";
    case "UPDATE_PROPOSAL":
      return "proposal changed";
    case "MARK_REPORT_GENERATED":
      return "report was regenerated";
    default:
      return Array.isArray(dirtyFlagsOrActionType)
        ? `${dirtyFlagsOrActionType.join(", ")} became dirty`
        : "upstream project data changed";
  }
}

export function resetDependentMilestones(
  state: ProjectEngineState,
  dirtyFlagsOrActionType: string | ProjectDirtyFlag[]
): ProjectEngineState {
  return resetMilestones(
    state,
    getMilestonesInvalidatedByDependency(dirtyFlagsOrActionType),
    getMilestoneResetReason(dirtyFlagsOrActionType)
  );
}

function invalidateStateAndMilestones(
  state: ProjectEngineState,
  actionType: string
): ProjectEngineState {
  return resetDependentMilestones(invalidateProjectState(state, actionType), actionType);
}

export function createInitialProjectEngineState(
  project: BlueprintProject
): ProjectEngineState {
  const initialEvent = createTimelineEvent("PROJECT_CREATED", {
    title: "Project Initialized",
    message: `Project "${project.name}" started.`,
    severity: "success",
    relatedStage: "SETUP",
  });

  const now = new Date().toISOString();
  const initialState: ProjectEngineState = {
    project,
    workflowStage: "SETUP",
    lastActiveStage: "SETUP",
    lastSessionAt: project.updatedAt || now,
    sessionRecovered: false,
    dirtyFlags: [],
    calculationStatus: "idle",
    milestones: { ...initialMilestones },
    timelineEvents: [initialEvent],
    automationSuggestions: [],
    automationEnabled: true,
    lastUpdatedAt: project.updatedAt || now,
    schemaVersion: 1.0,
  };

  const resumeSuggestion = detectRecoverableWorkflowState(initialState);
  if (!resumeSuggestion) return initialState;

  return appendTimelineEvent({
    ...initialState,
    sessionRecovered: true,
    resumeSuggestion,
  }, createTimelineEvent("SESSION_RECOVERED", {
    title: "Session Recovery Available",
    message: `Suggested resume stage: ${resumeSuggestion.recommendedStage}.`,
    severity: resumeSuggestion.severity === "critical" ? "critical" : "info",
    relatedStage: resumeSuggestion.recommendedStage,
    metadata: {
      resumeSuggestionId: resumeSuggestion.id,
    },
  }));
}

export function projectEngineReducer(
  state: ProjectEngineState,
  action: ProjectAction
): ProjectEngineState {
  let newState = state;

  switch (action.type) {
    case "SET_PROJECT":
      // Detect blueprint change for timeline
      if (!state.project.blueprintImage && action.project.blueprintImage) {
        newState = appendTimelineEvent(newState, createTimelineEvent("BLUEPRINT_UPLOADED", {
          title: "Blueprint Uploaded",
          message: `Linked file: ${action.project.blueprintImage.name}`,
          severity: "success",
          relatedStage: "SETUP",
        }));
      }
      
      newState = {
        ...newState,
        project: action.project,
        lastSessionAt: action.project.updatedAt || state.lastSessionAt,
        lastUpdatedAt: new Date().toISOString(),
      };
      break;

    case "SET_STAGE":
      if (state.workflowStage !== action.stage) {
        newState = appendTimelineEvent(newState, createTimelineEvent("STAGE_CHANGED", {
          title: `Moved to ${action.stage}`,
          message: `Workflow advanced to ${action.stage.toLowerCase().replace('_', ' ')} stage.`,
          severity: "info",
          relatedStage: action.stage,
        }));
      }
      newState = {
        ...newState,
        workflowStage: action.stage,
        lastActiveStage: action.stage,
        lastSessionAt: new Date().toISOString(),
        // Clear suggestions for this stage when entered
        automationSuggestions: state.automationSuggestions.filter(s => s.suggestedStage !== action.stage)
      };
      break;

    case "UPDATE_CALIBRATION":
      newState = appendTimelineEvent(state, createTimelineEvent("CALIBRATION_CONFIRMED", {
        title: "Scale Calibrated",
        message: `Blueprint scale set to ${state.project.calibration.pixelsPerFoot?.toFixed(2)} px/ft.`,
        severity: "success",
        relatedStage: "CALIBRATION",
      }));
      newState = invalidateStateAndMilestones(newState, action.type);
      break;

    case "UPDATE_ROOM_TRACE":
      newState = appendTimelineEvent(newState, createTimelineEvent("ROOM_TRACE_UPDATED", {
        title: "Takeoff Updated",
        message: `Current project includes ${newState.project.tracedRooms.length} room takeoff(s).`,
        severity: "info",
        relatedStage: "TAKEOFF",
      }));
      newState = invalidateStateAndMilestones(newState, action.type);
      break;

    case "UPDATE_ENVELOPE":
      newState = appendTimelineEvent(state, createTimelineEvent("ENVELOPE_UPDATED", {
        title: "Envelope Modified",
        message: `Insulation settings updated.`,
        severity: "warning",
        relatedStage: "LOAD_CALC",
      }));
      newState = invalidateStateAndMilestones(newState, action.type);
      break;

    case "UPDATE_MANUAL_J":
    case "UPDATE_MANUAL_D":
    case "UPDATE_PROPOSAL":
      newState = invalidateStateAndMilestones(state, action.type);
      break;

    case "START_RECALCULATION":
      newState = {
        ...state,
        calculationStatus: "recalculating",
      };
      break;

    case "COMPLETE_RECALCULATION":
      const stateWithClearedFlags = clearDirtyFlags(state, action.clearedFlags);
      newState = {
        ...stateWithClearedFlags,
        calculationStatus: "valid",
        lastCalculationAt: new Date().toISOString(),
      };
      if (action.clearedFlags.includes("MANUAL_J")) {
        newState = markMilestone(newState, "manualJValidated");
      }
      if (action.clearedFlags.includes("MANUAL_D") && Boolean(newState.project.manualDProjectState)) {
        newState = markMilestone(newState, "manualDValidated");
      }
      break;

    case "CLEAR_DIRTY_FLAGS":
      newState = clearDirtyFlags(state, action.flags);
      break;

    case "MARK_MANUAL_J_VALIDATED":
      newState = markMilestone(state, "manualJValidated");
      break;

    case "MARK_MANUAL_D_VALIDATED":
      newState = markMilestone(state, "manualDValidated");
      break;

    case "MARK_PROPOSAL_GENERATED":
      newState = markMilestone(state, "proposalGenerated");
      break;

    case "MARK_REPORT_GENERATED":
      newState = markMilestone(
        resetDependentMilestones(state, action.type),
        "reportGenerated"
      );
      break;

    case "MARK_REPORT_EXPORTED":
      newState = markMilestone(state, "reportExported");
      break;

    case "RESET_MILESTONE":
      newState = resetMilestones(state, [action.milestone], `${milestoneLabels[action.milestone]} was manually reset`);
      break;

    case "RUN_SESSION_RECOVERY":
      const resumeSuggestion = getResumeSuggestion(state);
      if (!resumeSuggestion) {
        newState = {
          ...state,
          sessionRecovered: false,
          resumeSuggestion: undefined,
          lastSessionAt: new Date().toISOString(),
        };
        break;
      }
      newState = appendTimelineEvent({
        ...state,
        sessionRecovered: true,
        resumeSuggestion,
        lastSessionAt: state.lastSessionAt || new Date().toISOString(),
      }, createTimelineEvent("SESSION_RECOVERED", {
        title: "Session Recovery Available",
        message: `Suggested resume stage: ${resumeSuggestion.recommendedStage}.`,
        severity: resumeSuggestion.severity === "critical" ? "critical" : "info",
        relatedStage: resumeSuggestion.recommendedStage,
        metadata: {
          resumeSuggestionId: resumeSuggestion.id,
        },
      }));
      break;

    case "RESUME_WORKFLOW":
      const suggestionToResume = state.resumeSuggestion ?? getResumeSuggestion(state);
      if (!suggestionToResume) {
        newState = state;
        break;
      }
      newState = appendTimelineEvent(
        restoreWorkflowStage({
          ...state,
          resumeSuggestion: suggestionToResume,
        }),
        createTimelineEvent("WORKFLOW_RESUMED", {
          title: "Workflow Resumed",
          message: `Technician resumed at ${suggestionToResume.recommendedStage}.`,
          severity: "success",
          relatedStage: suggestionToResume.recommendedStage,
          metadata: {
            resumeSuggestionId: suggestionToResume.id,
            previousStage: state.workflowStage,
          },
        })
      );
      break;

    case "DISMISS_RESUME_SUGGESTION":
      newState = {
        ...state,
        sessionRecovered: false,
        resumeSuggestion: undefined,
        lastSessionAt: new Date().toISOString(),
      };
      break;

    case "MARK_PROJECT_SAVED":
      newState = appendTimelineEvent(state, createTimelineEvent(
        action.autosave ? "AUTOSAVE_COMPLETED" : "PROJECT_SAVED",
        {
          title: action.autosave ? "Autosave Completed" : "Project Saved",
          message: action.autosave
            ? "Workflow metadata and project data were autosaved."
            : "Workflow metadata and project data were saved.",
          severity: "success",
          relatedStage: state.workflowStage,
        }
      ));
      break;

    case "MARK_PROJECT_LOADED":
      newState = appendTimelineEvent(state, createTimelineEvent(
        action.imported ? "PROJECT_IMPORTED" : "PROJECT_LOADED",
        {
          title: action.imported ? "Project Imported" : "Project Loaded",
          message: action.imported
            ? "Project file and workflow metadata were imported."
            : "Saved project and workflow metadata were loaded.",
          severity: "success",
          relatedStage: state.workflowStage,
        }
      ));
      break;

    case "ADD_TIMELINE_EVENT":
      newState = appendTimelineEvent(state, action.event);
      break;

    case "CLEAR_TIMELINE":
      newState = { ...state, timelineEvents: [] };
      break;

    case "DISMISS_AUTOMATION_SUGGESTION":
    case "DISMISS_SUGGESTION":
      newState = {
        ...state,
        automationSuggestions: state.automationSuggestions.filter(s => s.ruleId !== action.ruleId)
      };
      break;

    case "RUN_AUTOMATION_RULES":
    case "RUN_AUTOMATION":
      const suggestions = evaluateAutomationRules(state);
      newState = {
        ...state,
        automationSuggestions: suggestions,
        lastAutomationRunAt: new Date().toISOString()
      };
      break;

    case "APPLY_AUTOMATION_SUGGESTION":
      newState = applyAutomationResult(state, action.result);
      break;

    case "SET_AUTOMATION_ENABLED":
      newState = {
        ...state,
        automationEnabled: action.enabled,
        automationSuggestions: action.enabled
          ? evaluateAutomationRules(state)
          : [],
        lastAutomationRunAt: action.enabled ? new Date().toISOString() : state.lastAutomationRunAt,
        lastUpdatedAt: new Date().toISOString(),
      };
      break;

    default:
      return state;
  }

  // Auto-run automation on specific events if enabled
  if (
    newState.automationEnabled &&
    action.type !== "RUN_AUTOMATION_RULES" &&
    action.type !== "RUN_AUTOMATION" &&
    action.type !== "APPLY_AUTOMATION_SUGGESTION" &&
    action.type !== "DISMISS_AUTOMATION_SUGGESTION" &&
    action.type !== "DISMISS_SUGGESTION" &&
    action.type !== "SET_AUTOMATION_ENABLED"
  ) {
    const suggestions = evaluateAutomationRules(newState);
    // Only update if suggestions changed to avoid loops
    if (JSON.stringify(suggestions) !== JSON.stringify(newState.automationSuggestions)) {
        newState = {
            ...newState,
            automationSuggestions: suggestions,
            lastAutomationRunAt: new Date().toISOString()
        };
    }
  }

  return newState;
}

export function selectProjectReadiness(state: ProjectEngineState) {
  const stage = state.workflowStage;
  const guard = getStageGuard(state, stage);
  const health = getWorkflowHealth(state);

  return {
    stage,
    isValid: guard.isValid,
    blockers: guard.blockers,
    warnings: guard.warnings,
    health,
    calculationStatus: state.calculationStatus,
    lastCalculationAt: state.lastCalculationAt,
    isDirty: state.dirtyFlags.length > 0,
    dirtyFlags: state.dirtyFlags,
    suggestions: state.automationSuggestions
  };
}

export function selectNextRecommendedAction(state: ProjectEngineState) {
  const nextStage = getNextRecommendedStage(state);
  const guard = getStageGuard(state, nextStage);
  
  return {
    nextStage,
    action: guard.nextRecommendedAction,
  };
}

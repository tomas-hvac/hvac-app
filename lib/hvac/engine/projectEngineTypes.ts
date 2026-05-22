import { BlueprintProject } from "../blueprintProject";
import type { ProjectAutomationResult } from "./projectAutomation";

export type ProjectWorkflowStage =
  | "SETUP"
  | "CALIBRATION"
  | "TAKEOFF"
  | "LOAD_CALC"
  | "DUCT_DESIGN"
  | "PROPOSAL"
  | "REPORT"
  | "EXPORT";

export type ProjectDirtyFlag =
  | "GEOMETRY"
  | "ROOM_AREAS"
  | "ENVELOPE"
  | "MANUAL_J"
  | "MANUAL_D"
  | "PROPOSAL"
  | "REPORT";

export type ProjectHealthStatus =
  | "locked"
  | "ready"
  | "warning"
  | "complete"
  | "dirty";

export type ProjectCalculationStatus =
  | "idle"
  | "dirty"
  | "recalculating"
  | "valid";

export type ProjectTimelineEventType =
  | "PROJECT_CREATED"
  | "BLUEPRINT_UPLOADED"
  | "CALIBRATION_STARTED"
  | "CALIBRATION_CONFIRMED"
  | "ROOM_TRACE_UPDATED"
  | "ENVELOPE_UPDATED"
  | "MANUAL_J_RECALCULATED"
  | "MANUAL_D_RECALCULATED"
  | "PROPOSAL_GENERATED"
  | "REPORT_GENERATED"
  | "REPORT_EXPORTED"
  | "DIRTY_STATE_TRIGGERED"
  | "MILESTONE_RESET"
  | "SESSION_RECOVERED"
  | "WORKFLOW_RESUMED"
  | "PROJECT_SAVED"
  | "PROJECT_LOADED"
  | "AUTOSAVE_COMPLETED"
  | "PROJECT_IMPORTED"
  | "WARNING_TRIGGERED"
  | "STAGE_CHANGED"
  | "SMART_ACTION_EXECUTED"
  | "AUTOMATION_SUGGESTED";

export type ProjectTimelineEvent = {
  id: string;
  timestamp: string;
  type: ProjectTimelineEventType;
  title: string;
  message: string;
  severity: "info" | "success" | "warning" | "critical";
  relatedStage: ProjectWorkflowStage;
  metadata?: Record<string, any>;
};

export type ProjectAutomationSuggestion = ProjectAutomationResult;

export type ProjectMilestoneKey =
  | "manualJValidated"
  | "manualDValidated"
  | "proposalGenerated"
  | "reportGenerated"
  | "reportExported";

export type ProjectMilestoneFlags = Record<ProjectMilestoneKey, boolean>;

export type ProjectEngineMetadata = {
  schemaVersion: number;
  workflowStage: ProjectWorkflowStage;
  lastActiveStage: ProjectWorkflowStage;
  lastSessionAt: string;
  milestones: ProjectMilestoneFlags;
  calculationStatus: ProjectCalculationStatus;
  lastCalculationAt?: string;
  dirtyFlags: ProjectDirtyFlag[];
  timelineEvents?: ProjectTimelineEvent[];
};

export type ProjectResumeSuggestion = {
  id: string;
  title: string;
  message: string;
  whatChanged: string;
  recommendedStage: ProjectWorkflowStage;
  lastActiveStage: ProjectWorkflowStage;
  lastSessionAt: string;
  severity: "info" | "warning" | "critical";
};

export type StageGuardResult = {
  isValid: boolean;
  blockers: string[];
  warnings: string[];
  nextRecommendedAction: string;
};

export type ProjectEngineState = {
  project: BlueprintProject;
  workflowStage: ProjectWorkflowStage;
  lastActiveStage: ProjectWorkflowStage;
  lastSessionAt: string;
  sessionRecovered: boolean;
  resumeSuggestion?: ProjectResumeSuggestion;
  dirtyFlags: ProjectDirtyFlag[];
  calculationStatus: ProjectCalculationStatus;
  milestones: ProjectMilestoneFlags;
  timelineEvents: ProjectTimelineEvent[];
  automationSuggestions: ProjectAutomationSuggestion[];
  lastAutomationRunAt?: string;
  automationEnabled: boolean;
  lastCalculationAt?: string;
  lastUpdatedAt: string;
  schemaVersion: number;
};

export type ProjectAction =
  | { type: "SET_PROJECT"; project: BlueprintProject }
  | { type: "SET_STAGE"; stage: ProjectWorkflowStage }
  | { type: "UPDATE_CALIBRATION" }
  | { type: "UPDATE_ROOM_TRACE" }
  | { type: "UPDATE_ENVELOPE" }
  | { type: "UPDATE_MANUAL_J" }
  | { type: "UPDATE_MANUAL_D" }
  | { type: "UPDATE_PROPOSAL" }
  | { type: "START_RECALCULATION" }
  | { type: "COMPLETE_RECALCULATION"; clearedFlags: ProjectDirtyFlag[] }
  | { type: "CLEAR_DIRTY_FLAGS"; flags: ProjectDirtyFlag[] }
  | { type: "MARK_MANUAL_J_VALIDATED" }
  | { type: "MARK_MANUAL_D_VALIDATED" }
  | { type: "MARK_PROPOSAL_GENERATED" }
  | { type: "MARK_REPORT_GENERATED" }
  | { type: "MARK_REPORT_EXPORTED" }
  | { type: "RESET_MILESTONE"; milestone: ProjectMilestoneKey }
  | { type: "RUN_SESSION_RECOVERY" }
  | { type: "RESUME_WORKFLOW" }
  | { type: "DISMISS_RESUME_SUGGESTION" }
  | { type: "MARK_PROJECT_SAVED"; autosave?: boolean }
  | { type: "MARK_PROJECT_LOADED"; imported?: boolean }
  | { type: "ADD_TIMELINE_EVENT"; event: ProjectTimelineEvent }
  | { type: "CLEAR_TIMELINE" }
  | { type: "RUN_AUTOMATION_RULES" }
  | { type: "APPLY_AUTOMATION_SUGGESTION"; result: ProjectAutomationResult }
  | { type: "DISMISS_AUTOMATION_SUGGESTION"; ruleId: string }
  | { type: "SET_AUTOMATION_ENABLED"; enabled: boolean }
  // Backwards-compatible aliases for the unfinished automation draft.
  | { type: "DISMISS_SUGGESTION"; ruleId: string }
  | { type: "RUN_AUTOMATION" };

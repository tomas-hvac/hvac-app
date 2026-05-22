import type { BlueprintProject } from "../blueprintProject";
import type {
  ProjectCalculationStatus,
  ProjectDirtyFlag,
  ProjectEngineMetadata,
  ProjectEngineState,
  ProjectMilestoneFlags,
  ProjectTimelineEvent,
  ProjectTimelineEventType,
  ProjectWorkflowStage,
} from "./projectEngineTypes";
import { appendTimelineEvent, createTimelineEvent } from "./projectTimeline";
import { detectRecoverableWorkflowState } from "./projectRecovery";

const ENGINE_METADATA_SCHEMA_VERSION = 1;

const workflowStages: ProjectWorkflowStage[] = [
  "SETUP",
  "CALIBRATION",
  "TAKEOFF",
  "LOAD_CALC",
  "DUCT_DESIGN",
  "PROPOSAL",
  "REPORT",
  "EXPORT",
];

const dirtyFlags: ProjectDirtyFlag[] = [
  "GEOMETRY",
  "ROOM_AREAS",
  "ENVELOPE",
  "MANUAL_J",
  "MANUAL_D",
  "PROPOSAL",
  "REPORT",
];

const calculationStatuses: ProjectCalculationStatus[] = [
  "idle",
  "dirty",
  "recalculating",
  "valid",
];

const defaultMilestones: ProjectMilestoneFlags = {
  manualJValidated: false,
  manualDValidated: false,
  proposalGenerated: false,
  reportGenerated: false,
  reportExported: false,
};

type EngineSaveEventType = Extract<ProjectTimelineEventType, "PROJECT_SAVED" | "AUTOSAVE_COMPLETED">;

export type PreparedEngineStateForSave = {
  engineState: ProjectEngineState;
  metadata: ProjectEngineMetadata;
  appendedEvent?: ProjectTimelineEvent;
};

function isWorkflowStage(value: unknown): value is ProjectWorkflowStage {
  return typeof value === "string" && workflowStages.includes(value as ProjectWorkflowStage);
}

function isCalculationStatus(value: unknown): value is ProjectCalculationStatus {
  return typeof value === "string" && calculationStatuses.includes(value as ProjectCalculationStatus);
}

function normalizeDirtyFlags(value: unknown): ProjectDirtyFlag[] {
  if (!Array.isArray(value)) return [];
  return value.filter((flag): flag is ProjectDirtyFlag => dirtyFlags.includes(flag as ProjectDirtyFlag));
}

function normalizeTimelineEvents(value: unknown): ProjectTimelineEvent[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((event): event is ProjectTimelineEvent => {
    return Boolean(event) &&
      typeof event.id === "string" &&
      typeof event.timestamp === "string" &&
      typeof event.type === "string" &&
      typeof event.title === "string" &&
      typeof event.message === "string" &&
      isWorkflowStage(event.relatedStage);
  });
}

export function migrateEngineMetadata(metadata: unknown): ProjectEngineMetadata {
  const source = metadata && typeof metadata === "object"
    ? metadata as Partial<ProjectEngineMetadata>
    : {};
  const now = new Date().toISOString();
  const workflowStage = isWorkflowStage(source.workflowStage) ? source.workflowStage : "SETUP";
  const lastActiveStage = isWorkflowStage(source.lastActiveStage) ? source.lastActiveStage : workflowStage;
  const milestones = {
    ...defaultMilestones,
    ...(source.milestones && typeof source.milestones === "object" ? source.milestones : {}),
  };

  return {
    schemaVersion: ENGINE_METADATA_SCHEMA_VERSION,
    workflowStage,
    lastActiveStage,
    lastSessionAt: typeof source.lastSessionAt === "string" ? source.lastSessionAt : now,
    milestones,
    calculationStatus: isCalculationStatus(source.calculationStatus) ? source.calculationStatus : "idle",
    lastCalculationAt: typeof source.lastCalculationAt === "string" ? source.lastCalculationAt : undefined,
    dirtyFlags: normalizeDirtyFlags(source.dirtyFlags),
    timelineEvents: normalizeTimelineEvents(source.timelineEvents),
  };
}

export function serializeEngineMetadata(state: ProjectEngineState): ProjectEngineMetadata {
  return {
    schemaVersion: ENGINE_METADATA_SCHEMA_VERSION,
    workflowStage: state.workflowStage,
    lastActiveStage: state.lastActiveStage,
    lastSessionAt: new Date().toISOString(),
    milestones: { ...state.milestones },
    calculationStatus: state.calculationStatus,
    lastCalculationAt: state.lastCalculationAt,
    dirtyFlags: [...state.dirtyFlags],
    timelineEvents: state.timelineEvents.slice(0, 50),
  };
}

export function prepareEngineStateForSave(
  state: ProjectEngineState,
  eventType: EngineSaveEventType
): PreparedEngineStateForSave {
  const event = createTimelineEvent(eventType, {
    title: eventType === "AUTOSAVE_COMPLETED" ? "Autosave Completed" : "Project Saved",
    message: eventType === "AUTOSAVE_COMPLETED"
      ? "Workflow metadata and project data were autosaved."
      : "Workflow metadata and project data were saved.",
    severity: "success",
    relatedStage: state.workflowStage,
  });
  const engineState = appendTimelineEvent(state, event);
  const appendedEvent = engineState.timelineEvents[0]?.id === event.id
    ? event
    : undefined;

  return {
    engineState,
    metadata: serializeEngineMetadata(engineState),
    appendedEvent,
  };
}

export function hydrateEngineStateFromMetadata(
  project: BlueprintProject,
  metadata?: unknown
): ProjectEngineState {
  const migratedMetadata = migrateEngineMetadata(metadata);
  const now = new Date().toISOString();
  const timelineEvents = migratedMetadata.timelineEvents && migratedMetadata.timelineEvents.length > 0
    ? migratedMetadata.timelineEvents
    : [
        createTimelineEvent("PROJECT_CREATED", {
          title: "Project Initialized",
          message: `Project "${project.name}" started.`,
          severity: "success",
          relatedStage: "SETUP",
        }),
      ];

  const state: ProjectEngineState = {
    project,
    workflowStage: migratedMetadata.workflowStage,
    lastActiveStage: migratedMetadata.lastActiveStage,
    lastSessionAt: migratedMetadata.lastSessionAt,
    sessionRecovered: false,
    dirtyFlags: migratedMetadata.dirtyFlags,
    calculationStatus: migratedMetadata.calculationStatus,
    milestones: migratedMetadata.milestones,
    timelineEvents,
    automationSuggestions: [],
    automationEnabled: true,
    lastCalculationAt: migratedMetadata.lastCalculationAt,
    lastUpdatedAt: project.updatedAt || now,
    schemaVersion: migratedMetadata.schemaVersion,
  };

  const resumeSuggestion = detectRecoverableWorkflowState(state);
  return resumeSuggestion
    ? appendTimelineEvent({
        ...state,
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
      }))
    : state;
}

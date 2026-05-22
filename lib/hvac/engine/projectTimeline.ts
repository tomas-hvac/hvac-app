import { 
  ProjectTimelineEvent, 
  ProjectTimelineEventType, 
  ProjectWorkflowStage,
  ProjectEngineState
} from "./projectEngineTypes";

export function createTimelineEvent(
  type: ProjectTimelineEventType,
  options: {
    title: string;
    message: string;
    severity?: ProjectTimelineEvent["severity"];
    relatedStage: ProjectWorkflowStage;
    metadata?: Record<string, any>;
  }
): ProjectTimelineEvent {
  return {
    id: `ev-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    timestamp: new Date().toISOString(),
    type,
    title: options.title,
    message: options.message,
    severity: options.severity || "info",
    relatedStage: options.relatedStage,
    metadata: options.metadata,
  };
}

export function appendTimelineEvent(
  state: ProjectEngineState,
  event: ProjectTimelineEvent
): ProjectEngineState {
  // Avoid spam: don't add the same event type with the same message if it happened in the last 10 seconds
  const lastEvent = state.timelineEvents[0];
  if (lastEvent && 
      lastEvent.type === event.type && 
      lastEvent.message === event.message && 
      (Date.now() - new Date(lastEvent.timestamp).getTime() < 10000)) {
    return state;
  }

  // Keep it manageable (last 50 events)
  const newEvents = [event, ...state.timelineEvents].slice(0, 50);

  return {
    ...state,
    timelineEvents: newEvents,
    lastUpdatedAt: new Date().toISOString(),
  };
}

export function getTimelineEvents(state: ProjectEngineState): ProjectTimelineEvent[] {
  return state.timelineEvents;
}

export function getRecentTimelineEvents(
  state: ProjectEngineState, 
  limit: number = 5
): ProjectTimelineEvent[] {
  return state.timelineEvents.slice(0, limit);
}

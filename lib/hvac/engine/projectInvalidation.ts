import { ProjectDirtyFlag, ProjectEngineState } from "./projectEngineTypes";

export function getDirtyFlagsForAction(
  actionType: string
): ProjectDirtyFlag[] {
  switch (actionType) {
    case "UPDATE_CALIBRATION":
      return ["ROOM_AREAS", "MANUAL_J", "MANUAL_D", "PROPOSAL", "REPORT"];
    case "UPDATE_ROOM_TRACE":
      return ["GEOMETRY", "ROOM_AREAS", "MANUAL_J", "MANUAL_D", "PROPOSAL", "REPORT"];
    case "UPDATE_ENVELOPE":
      return ["ENVELOPE", "MANUAL_J", "MANUAL_D", "PROPOSAL", "REPORT"];
    case "UPDATE_MANUAL_J":
      return ["MANUAL_J", "MANUAL_D", "PROPOSAL", "REPORT"];
    case "UPDATE_MANUAL_D":
      return ["MANUAL_D", "PROPOSAL", "REPORT"];
    case "UPDATE_PROPOSAL":
      return ["PROPOSAL", "REPORT"];
    default:
      return [];
  }
}

export function invalidateProjectState(
  state: ProjectEngineState,
  actionType: string
): ProjectEngineState {
  const newFlags = getDirtyFlagsForAction(actionType);
  
  // Create a unique set of flags
  const combinedFlags = Array.from(new Set([...state.dirtyFlags, ...newFlags]));

  return {
    ...state,
    dirtyFlags: combinedFlags,
    calculationStatus: "dirty",
    lastUpdatedAt: new Date().toISOString(),
  };
}

export function clearDirtyFlags(
  state: ProjectEngineState,
  flagsToClear: ProjectDirtyFlag[]
): ProjectEngineState {
  return {
    ...state,
    dirtyFlags: state.dirtyFlags.filter((f) => !flagsToClear.includes(f)),
    lastUpdatedAt: new Date().toISOString(),
  };
}

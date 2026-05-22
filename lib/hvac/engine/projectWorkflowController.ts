import {
  ProjectEngineState,
  ProjectWorkflowStage,
  StageGuardResult,
  ProjectHealthStatus,
} from "./projectEngineTypes";

export function getStageGuard(
  state: ProjectEngineState,
  stage: ProjectWorkflowStage
): StageGuardResult {
  const { project } = state;
  const blockers: string[] = [];
  const warnings: string[] = [];
  let nextRecommendedAction = "";

  switch (stage) {
    case "SETUP":
      if (!project.name) blockers.push("Project name is required");
      nextRecommendedAction = "Upload a blueprint image to begin";
      break;

    case "CALIBRATION":
      if (!project.blueprintImage) {
        blockers.push("Blueprint image required for calibration");
        nextRecommendedAction = "Upload a blueprint in SETUP";
      } else if (project.calibration.status !== "calibrated") {
        nextRecommendedAction = "Define a known length on the blueprint";
      }
      break;

    case "TAKEOFF":
      if (project.calibration.status !== "calibrated") {
        blockers.push("Confirmed calibration required for takeoff");
        nextRecommendedAction = "Complete calibration first";
      } else if (project.tracedRooms.length === 0) {
        nextRecommendedAction = "Start tracing your first room";
      }
      break;

    case "LOAD_CALC":
      if (project.calibration.status !== "calibrated") {
        blockers.push("Calibration must be confirmed for accurate load calculations");
      }
      if (project.tracedRooms.length === 0) {
        blockers.push("At least one traced room is required");
      }
      if (blockers.length === 0) {
        const roomsMissingArea = project.tracedRooms.filter((r) => !r.squareFeet);
        if (roomsMissingArea.length > 0) {
          warnings.push(`${roomsMissingArea.length} rooms missing square footage calculation`);
        }
      }
      nextRecommendedAction = "Review room thermal boundaries";
      break;

    case "DUCT_DESIGN":
      if (project.tracedRooms.length === 0) {
        blockers.push("Cannot design ducts without rooms");
      }
      // In commercial workflow, we might require Manual J before Manual D
      if (!project.manualDProjectState) {
        warnings.push("Manual D state not initialized");
      }
      nextRecommendedAction = "Configure system tonnage and static pressure";
      break;

    case "PROPOSAL":
      if (project.tracedRooms.length === 0) blockers.push("No room data for proposal");
      if (state.dirtyFlags.includes("MANUAL_J")) warnings.push("Load calculations may be stale");
      nextRecommendedAction = "Review system options and pricing";
      break;

    case "REPORT":
      if (project.tracedRooms.length === 0) blockers.push("Nothing to report");
      nextRecommendedAction = "Generate and preview technician report";
      break;

    case "EXPORT":
      if (project.tracedRooms.length === 0) blockers.push("No data to export");
      nextRecommendedAction = "Print or save PDF report";
      break;
  }

  return {
    isValid: blockers.length === 0,
    blockers,
    warnings,
    nextRecommendedAction,
  };
}

export function canEnterStage(
  state: ProjectEngineState,
  stage: ProjectWorkflowStage
): boolean {
  // Logic to determine if we can switch to a stage. 
  // Usually, we can always 'view' a stage, but we might 'block' completion.
  // For a strict commercial workflow, we only allow entering if the previous critical stage is valid.
  const stages: ProjectWorkflowStage[] = [
    "SETUP",
    "CALIBRATION",
    "TAKEOFF",
    "LOAD_CALC",
    "DUCT_DESIGN",
    "PROPOSAL",
    "REPORT",
    "EXPORT",
  ];
  const stageIndex = stages.indexOf(stage);

  if (stageIndex <= 0) return true;

  // Check if all previous stages are valid
  for (let i = 0; i < stageIndex; i++) {
    const guard = getStageGuard(state, stages[i]);
    if (!guard.isValid) return false;
  }

  return true;
}

export function getNextRecommendedStage(
  state: ProjectEngineState
): ProjectWorkflowStage {
  const stages: ProjectWorkflowStage[] = [
    "SETUP",
    "CALIBRATION",
    "TAKEOFF",
    "LOAD_CALC",
    "DUCT_DESIGN",
    "PROPOSAL",
    "REPORT",
    "EXPORT",
  ];

  for (const stage of stages) {
    const guard = getStageGuard(state, stage);
    if (!guard.isValid) return stage;
  }

  return "REPORT";
}

export function getWorkflowHealth(state: ProjectEngineState): ProjectHealthStatus {
  const stages: ProjectWorkflowStage[] = [
    "SETUP",
    "CALIBRATION",
    "TAKEOFF",
    "LOAD_CALC",
    "DUCT_DESIGN",
    "PROPOSAL",
    "REPORT",
  ];
  
  const results = stages.map(s => ({ stage: s, guard: getStageGuard(state, s) }));
  const hasBlockers = results.some(r => !r.guard.isValid);
  const hasWarnings = results.some(r => r.guard.warnings.length > 0);
  const isDirty = state.dirtyFlags.length > 0;

  if (hasBlockers) return "locked";
  if (isDirty) return "dirty";
  if (hasWarnings) return "warning";
  
  const isComplete = results.every(r => r.guard.isValid);
  return isComplete ? "complete" : "ready";
}

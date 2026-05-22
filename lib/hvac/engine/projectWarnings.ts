import { ProjectEngineState, ProjectWorkflowStage } from "./projectEngineTypes";
import { calculateProjectHealthScore } from "./projectHealth";

export type ProjectWarningSeverity = "info" | "warning" | "critical";

export type ProjectWarningCategory =
  | "calibration"
  | "geometry"
  | "envelope"
  | "manualJ"
  | "manualD"
  | "proposal"
  | "report"
  | "workflow";

export type ProjectWorkflowWarning = {
  id: string;
  severity: ProjectWarningSeverity;
  category: ProjectWarningCategory;
  title: string;
  message: string;
  recommendedAction: string;
  relatedStage: ProjectWorkflowStage;
};

export function getProjectWarnings(state: ProjectEngineState): ProjectWorkflowWarning[] {
  const { project, dirtyFlags, calculationStatus, workflowStage, milestones } = state;
  const warnings: ProjectWorkflowWarning[] = [];

  // --- Calibration ---
  if (project.calibration.status !== "calibrated") {
    warnings.push({
      id: "cal_missing",
      severity: "critical",
      category: "calibration",
      title: "Calibration Required",
      message: "Blueprint scale has not been confirmed. Measurements will be inaccurate.",
      recommendedAction: "Use the calibration tool to define a known length.",
      relatedStage: "CALIBRATION",
    });
  }

  // --- Geometry ---
  if (project.tracedRooms.length === 0 && (workflowStage === "TAKEOFF" || workflowStage === "LOAD_CALC")) {
    warnings.push({
      id: "geom_no_rooms",
      severity: "warning",
      category: "geometry",
      title: "No Rooms Traced",
      message: "At least one room takeoff is required for thermal calculations.",
      recommendedAction: "Start tracing rooms on the blueprint.",
      relatedStage: "TAKEOFF",
    });
  }

  const suspiciousRooms = project.tracedRooms.filter(r => r.squareFeet !== null && r.squareFeet < 10);
  if (suspiciousRooms.length > 0) {
    warnings.push({
      id: "geom_small_rooms",
      severity: "warning",
      category: "geometry",
      title: "Suspicious Room Area",
      message: `${suspiciousRooms.length} room(s) have a suspiciously small area (< 10 sqft).`,
      recommendedAction: "Review room outlines for scale or tracing errors.",
      relatedStage: "TAKEOFF",
    });
  }

  if (dirtyFlags.includes("GEOMETRY") || dirtyFlags.includes("ROOM_AREAS")) {
    warnings.push({
      id: "geom_dirty",
      severity: "critical",
      category: "geometry",
      title: "Stale Geometry Data",
      message: "Room outlines have changed but areas have not been re-validated.",
      recommendedAction: "Re-run calculations to synchronize geometry.",
      relatedStage: "TAKEOFF",
    });
  }

  // --- Envelope ---
  if (dirtyFlags.includes("ENVELOPE")) {
    warnings.push({
      id: "env_dirty",
      severity: "warning",
      category: "envelope",
      title: "Envelope Data Stale",
      message: "Insulation or regional settings have changed.",
      recommendedAction: "Recalculate Manual J to apply new envelope defaults.",
      relatedStage: "LOAD_CALC",
    });
  }

  // --- Manual J ---
  if (calculationStatus === "dirty" || dirtyFlags.includes("MANUAL_J") || (calculationStatus === "valid" && !milestones.manualJValidated)) {
    warnings.push({
      id: "mj_dirty",
      severity: "critical",
      category: "manualJ",
      title: "Manual J Out of Sync",
      message: "Thermal load results do not match current project geometry or envelope.",
      recommendedAction: "Click 'Calculate Load' to refresh Manual J models.",
      relatedStage: "LOAD_CALC",
    });
  }

  if (!milestones.manualJValidated && (workflowStage === "LOAD_CALC" || workflowStage === "PROPOSAL")) {
    warnings.push({
      id: "mj_missing",
      severity: "critical",
      category: "manualJ",
      title: "Manual J Pending",
      message: "No thermal load calculations have been performed yet.",
      recommendedAction: "Perform initial load calculation.",
      relatedStage: "LOAD_CALC",
    });
  }

  // --- Manual D ---
  if (!milestones.manualDValidated && (workflowStage === "DUCT_DESIGN" || workflowStage === "REPORT")) {
    warnings.push({
      id: "md_missing",
      severity: "warning",
      category: "manualD",
      title: "Manual D Incomplete",
      message: project.manualDProjectState
        ? "Duct design exists but has not been validated as a project milestone."
        : "Duct design and airflow distribution models are missing.",
      recommendedAction: project.manualDProjectState
        ? "Validate Manual D before proceeding."
        : "Enter Duct Design stage to configure system airflow.",
      relatedStage: "DUCT_DESIGN",
    });
  }

  if (dirtyFlags.includes("MANUAL_D") || (project.manualDProjectState && !milestones.manualDValidated)) {
    warnings.push({
      id: "md_dirty",
      severity: "warning",
      category: "manualD",
      title: "Duct Design Stale",
      message: "Load changes have invalidated the current airflow distribution.",
      recommendedAction: "Review Manual D settings to re-balance registers.",
      relatedStage: "DUCT_DESIGN",
    });
  }

  // --- Proposal & Report ---
  if (!milestones.proposalGenerated && (workflowStage === "REPORT" || workflowStage === "EXPORT")) {
    warnings.push({
      id: "proposal_missing",
      severity: "warning",
      category: "proposal",
      title: "Proposal Milestone Pending",
      message: "ProjectEngine has not recorded a generated proposal for this project state.",
      recommendedAction: "Generate or confirm the proposal before final reporting.",
      relatedStage: "PROPOSAL",
    });
  }

  if (!milestones.reportGenerated && workflowStage === "EXPORT") {
    warnings.push({
      id: "report_missing",
      severity: "warning",
      category: "report",
      title: "Report Milestone Pending",
      message: "ProjectEngine has not recorded a generated report for this project state.",
      recommendedAction: "Preview the technician report before exporting.",
      relatedStage: "REPORT",
    });
  }

  if (milestones.reportGenerated && !milestones.reportExported && workflowStage === "EXPORT") {
    warnings.push({
      id: "report_export_stale",
      severity: "warning",
      category: "report",
      title: "Export Milestone Pending",
      message: "The report has been generated or regenerated but has not been exported again.",
      recommendedAction: "Export the latest report PDF.",
      relatedStage: "EXPORT",
    });
  }

  if (dirtyFlags.includes("PROPOSAL") || dirtyFlags.includes("REPORT")) {
    warnings.push({
      id: "report_dirty",
      severity: "warning",
      category: "report",
      title: "Report/Proposal Stale",
      message: "Project data has changed since the last report was generated.",
      recommendedAction: "Review reports to ensure latest data is reflected.",
      relatedStage: "REPORT",
    });
  }

  // --- Workflow / Health ---
  const healthScore = calculateProjectHealthScore(state);
  if (healthScore < 70 && (workflowStage === "PROPOSAL" || workflowStage === "REPORT")) {
    warnings.push({
      id: "wf_low_health",
      severity: "critical",
      category: "workflow",
      title: "Low Project Confidence",
      message: `Project health score (${healthScore}%) is below the field-ready threshold.`,
      recommendedAction: "Resolve all high-priority health items before proceeding.",
      relatedStage: "SETUP",
    });
  }

  return warnings;
}

export function getCriticalWarnings(state: ProjectEngineState): ProjectWorkflowWarning[] {
  return getProjectWarnings(state).filter(w => w.severity === "critical");
}

export function getWarningsByStage(state: ProjectEngineState, stage: ProjectWorkflowStage): ProjectWorkflowWarning[] {
  return getProjectWarnings(state).filter(w => w.relatedStage === stage);
}

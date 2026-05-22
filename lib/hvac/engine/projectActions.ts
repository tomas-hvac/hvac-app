import { ProjectEngineState, ProjectWorkflowStage } from "./projectEngineTypes";

export type ProjectSmartActionType =
  | "GO_TO_STAGE"
  | "START_RECALCULATION"
  | "CLEAR_DIRTY_FLAGS"
  | "REVIEW_CALIBRATION"
  | "REVIEW_GEOMETRY"
  | "REVIEW_ENVELOPE"
  | "REVIEW_MANUAL_J"
  | "REVIEW_MANUAL_D"
  | "REVIEW_PROPOSAL"
  | "REVIEW_REPORT"
  | "EXPORT_REPORT";

export type ProjectSmartAction = {
  id: string;
  label: string;
  description: string;
  category: string;
  severity: "primary" | "secondary";
  relatedStage: ProjectWorkflowStage;
  enabled: boolean;
  reasonDisabled?: string;
  actionType: ProjectSmartActionType;
};

export function getSmartWorkflowActions(state: ProjectEngineState): ProjectSmartAction[] {
  const { project, dirtyFlags, calculationStatus, milestones } = state;
  const actions: ProjectSmartAction[] = [];

  // 1. Calibration
  if (project.calibration.status !== "calibrated") {
    actions.push({
      id: "act_calibrate",
      label: "Review Calibration",
      description: "Define a known length to ensure measurement accuracy.",
      category: "Calibration",
      severity: "primary",
      relatedStage: "CALIBRATION",
      enabled: true,
      actionType: "REVIEW_CALIBRATION",
    });
  }

  // 2. Geometry
  if (project.tracedRooms.length === 0) {
    actions.push({
      id: "act_takeoff",
      label: "Start Room Takeoff",
      description: "Trace your first room to begin load calculations.",
      category: "Takeoff",
      severity: project.calibration.status === "calibrated" ? "primary" : "secondary",
      relatedStage: "TAKEOFF",
      enabled: project.calibration.status === "calibrated",
      reasonDisabled: "Requires confirmed calibration",
      actionType: "REVIEW_GEOMETRY",
    });
  }

  // 3. Manual J
  if (dirtyFlags.includes("MANUAL_J") || calculationStatus === "dirty" || (calculationStatus === "valid" && !milestones.manualJValidated)) {
    actions.push({
      id: "act_recalc_j",
      label: "Recalculate Manual J",
      description: "Refresh thermal models with current geometry and envelope data.",
      category: "Manual J",
      severity: "primary",
      relatedStage: "LOAD_CALC",
      enabled: project.tracedRooms.length > 0 && project.calibration.status === "calibrated",
      reasonDisabled: "Requires rooms and calibration",
      actionType: "START_RECALCULATION",
    });
  }

  // 4. Manual D
  if (dirtyFlags.includes("MANUAL_D") || (project.manualDProjectState && !milestones.manualDValidated)) {
    actions.push({
      id: "act_refresh_d",
      label: "Refresh Manual D",
      description: "Update airflow distribution based on new load requirements.",
      category: "Manual D",
      severity: dirtyFlags.includes("MANUAL_J") ? "secondary" : "primary",
      relatedStage: "DUCT_DESIGN",
      enabled: milestones.manualJValidated && calculationStatus === "valid",
      reasonDisabled: "Requires validated Manual J results",
      actionType: "START_RECALCULATION",
    });
  }

  // 5. Proposal
  if (dirtyFlags.includes("PROPOSAL") || (milestones.manualDValidated && !milestones.proposalGenerated)) {
    actions.push({
      id: "act_refresh_proposal",
      label: "Refresh Proposal",
      description: "Update system options and pricing with latest design data.",
      category: "Proposal",
      severity: "secondary",
      relatedStage: "PROPOSAL",
      enabled: milestones.manualDValidated,
      reasonDisabled: "Requires validated Manual D design",
      actionType: "REVIEW_PROPOSAL",
    });
  }

  // 6. Report
  if (dirtyFlags.includes("REPORT") || (milestones.proposalGenerated && !milestones.reportGenerated)) {
    actions.push({
      id: "act_regen_report",
      label: "Regenerate Report",
      description: "Ensure the technician report reflects all recent changes.",
      category: "Report",
      severity: "secondary",
      relatedStage: "REPORT",
      enabled: milestones.proposalGenerated,
      reasonDisabled: "Requires generated proposal",
      actionType: "REVIEW_REPORT",
    });
  }

  // 7. Export (Success case)
  if (milestones.reportGenerated && !milestones.reportExported && !dirtyFlags.includes("REPORT")) {
    actions.push({
      id: "act_export",
      label: "Export PDF Report",
      description: "Export the latest generated report and renew the export milestone.",
      category: "Export",
      severity: "primary",
      relatedStage: "EXPORT",
      enabled: true,
      actionType: "EXPORT_REPORT",
    });
  }

  return actions;
}

export function getPrimarySmartAction(state: ProjectEngineState): ProjectSmartAction | null {
  const actions = getSmartWorkflowActions(state);
  return actions.find(a => a.severity === "primary" && a.enabled) || actions[0] || null;
}

export function getActionsByStage(state: ProjectEngineState, stage: ProjectWorkflowStage): ProjectSmartAction[] {
  return getSmartWorkflowActions(state).filter(a => a.relatedStage === stage);
}

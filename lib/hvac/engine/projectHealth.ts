import { ProjectEngineState, ProjectDirtyFlag } from "./projectEngineTypes";

export type HealthStatus = "pass" | "warning" | "fail" | "pending";

export type HealthItem = {
  id: string;
  label: string;
  status: HealthStatus;
  message: string;
  weight: number;
};

export function getProjectHealthItems(state: ProjectEngineState): HealthItem[] {
  const { project, dirtyFlags, calculationStatus, milestones } = state;
  const items: HealthItem[] = [];

  // 1. Blueprint Upload
  items.push({
    id: "blueprint",
    label: "Blueprint Asset",
    status: project.blueprintImage ? "pass" : "fail",
    message: project.blueprintImage ? "Blueprint image linked" : "No blueprint image uploaded",
    weight: 10,
  });

  // 2. Calibration
  items.push({
    id: "calibration",
    label: "Scale Calibration",
    status: project.calibration.status === "calibrated" ? "pass" : 
            project.calibration.status === "ready" ? "warning" : "fail",
    message: project.calibration.status === "calibrated" ? "Scale confirmed" : "Scale unverified",
    weight: 20,
  });

  // 3. Rooms
  items.push({
    id: "rooms",
    label: "Room Takeoff",
    status: project.tracedRooms.length > 0 ? "pass" : "fail",
    message: project.tracedRooms.length > 0 ? `${project.tracedRooms.length} rooms traced` : "No rooms traced",
    weight: 20,
  });

  // 4. Geometry
  const missingArea = project.tracedRooms.some(r => r.squareFeet === null);
  items.push({
    id: "geometry",
    label: "Geometry Integrity",
    status: project.tracedRooms.length === 0 ? "pending" : missingArea ? "fail" : "pass",
    message: missingArea ? "Missing room area data" : "Polygon geometry valid",
    weight: 10,
  });

  // 5. Envelope
  items.push({
    id: "envelope",
    label: "Envelope Data",
    status: project.envelopeSettings.insulationQuality ? "pass" : "warning",
    message: `Using ${project.envelopeSettings.insulationQuality} insulation defaults`,
    weight: 10,
  });

  // 6. Manual J / Load
  const hasValidLoad = milestones.manualJValidated && calculationStatus === "valid";
  items.push({
    id: "manual_j",
    label: "Manual J Readiness",
    status: hasValidLoad ? "pass" : calculationStatus === "dirty" ? "warning" : "fail",
    message: hasValidLoad ? "Load data synchronized" : "Load data requires refresh",
    weight: 10,
  });

  // 7. Manual D / Duct
  items.push({
    id: "manual_d",
    label: "Duct Design",
    status: milestones.manualDValidated ? "pass" : project.manualDProjectState ? "warning" : "pending",
    message: milestones.manualDValidated
      ? "Airflow design validated"
      : project.manualDProjectState
        ? "Airflow model present but not milestone validated"
        : "Airflow design pending",
    weight: 10,
  });

  items.push({
    id: "proposal",
    label: "Proposal",
    status: milestones.proposalGenerated ? "pass" : milestones.manualDValidated ? "pending" : "warning",
    message: milestones.proposalGenerated ? "Proposal generated" : "Proposal milestone pending",
    weight: 5,
  });

  items.push({
    id: "report",
    label: "Report",
    status: milestones.reportGenerated ? "pass" : milestones.proposalGenerated ? "pending" : "warning",
    message: milestones.reportGenerated ? "Report generated" : "Report milestone pending",
    weight: 5,
  });

  items.push({
    id: "export",
    label: "PDF Export",
    status: milestones.reportExported ? "pass" : milestones.reportGenerated ? "pending" : "warning",
    message: milestones.reportExported ? "Latest report exported" : "Export milestone pending",
    weight: 5,
  });

  // 8. Data Freshness
  const isDirty = dirtyFlags.length > 0;
  items.push({
    id: "freshness",
    label: "Data Freshness",
    status: isDirty ? "warning" : "pass",
    message: isDirty ? `${dirtyFlags.length} stale data flags detected` : "All models synchronized",
    weight: 10,
  });

  return items;
}

export function calculateProjectHealthScore(state: ProjectEngineState): number {
  const items = getProjectHealthItems(state);
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  const earnedWeight = items.reduce((sum, item) => {
    if (item.status === "pass") return sum + item.weight;
    if (item.status === "warning") return sum + (item.weight * 0.5);
    return sum;
  }, 0);

  return Math.round((earnedWeight / totalWeight) * 100);
}

export function getProjectReliabilityLabel(score: number): string {
  if (score >= 90) return "Commercial Grade";
  if (score >= 70) return "Field Ready";
  if (score >= 50) return "Draft / Review";
  return "Incomplete";
}

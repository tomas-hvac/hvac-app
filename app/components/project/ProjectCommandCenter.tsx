"use client";

import React from "react";
import { ProjectResumeBanner } from "./ProjectResumeBanner";
import { ProjectHealthDashboard } from "./ProjectHealthDashboard";
import { SmartWorkflowActions } from "./SmartWorkflowActions";
import { ProjectWarningsPanel } from "./ProjectWarningsPanel";
import { WorkflowAutomationPanel } from "./WorkflowAutomationPanel";
import { ProjectActivityTimeline } from "./ProjectActivityTimeline";

interface ProjectCommandCenterProps {
  onRecalculate?: () => void;
  onGenerateProposal?: () => void;
  onGenerateReport?: () => void;
  onExport?: () => void;
}

export function ProjectCommandCenter({
  onRecalculate,
  onGenerateProposal,
  onGenerateReport,
  onExport,
}: ProjectCommandCenterProps) {
  return (
    <div style={{
      display: "grid",
      gap: "4px",
      alignContent: "start"
    }}>
      <ProjectResumeBanner />
      <ProjectHealthDashboard compact />
      <SmartWorkflowActions
        onRecalculate={onRecalculate}
        onGenerateProposal={onGenerateProposal}
        onGenerateReport={onGenerateReport}
        onExport={onExport}
      />
      <ProjectWarningsPanel />
      <WorkflowAutomationPanel onRecalculate={onRecalculate} />
      <ProjectActivityTimeline />
    </div>
  );
}

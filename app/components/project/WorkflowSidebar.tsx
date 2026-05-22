"use client";

import React from "react";
import { useProjectEngine } from "./useProjectEngine";
import { ProjectWorkflowStage } from "@/lib/hvac/engine/projectEngineTypes";
import { CheckCircle2, Circle, AlertCircle, Lock, PlayCircle } from "lucide-react";

const STAGES: { id: ProjectWorkflowStage; label: string }[] = [
  { id: "SETUP", label: "Project Setup" },
  { id: "CALIBRATION", label: "Calibration" },
  { id: "TAKEOFF", label: "Room Takeoff" },
  { id: "LOAD_CALC", label: "Load Calc" },
  { id: "DUCT_DESIGN", label: "Duct Design" },
  { id: "PROPOSAL", label: "Proposal" },
  { id: "REPORT", label: "Report" },
  { id: "EXPORT", label: "Export" },
];

export function WorkflowSidebar() {
  const { engineState, dispatchEngineAction, canEnterStage, getStageGuard } = useProjectEngine();
  const currentStage = engineState.workflowStage;

  return (
    <div style={{
      background: "rgba(15, 23, 42, 0.6)",
      backdropFilter: "blur(12px)",
      borderRadius: "16px",
      border: "1px solid rgba(255,255,255,0.08)",
      padding: "12px",
      display: "grid",
      gap: "4px",
      alignContent: "start",
      height: "fit-content",
      position: "sticky",
      top: "20px"
    }}>
      <p style={{
        margin: "0 0 12px 0",
        fontSize: "10px",
        fontWeight: 900,
        color: "#d4af37",
        textTransform: "uppercase",
        letterSpacing: "0.1em"
      }}>Workflow Pipeline</p>

      {STAGES.map((stage) => {
        const isCurrent = currentStage === stage.id;
        const isLocked = !canEnterStage(stage.id);
        const guard = getStageGuard(stage.id);
        const isComplete = guard.isValid && !isLocked && !isCurrent; // Simple heuristic for now

        let statusIcon = <Circle size={16} color="#475569" />;
        if (isLocked) statusIcon = <Lock size={16} color="#475569" />;
        else if (isCurrent) statusIcon = <PlayCircle size={16} color="#d4af37" />;
        else if (isComplete) statusIcon = <CheckCircle2 size={16} color="#4ade80" />;
        
        if (guard.warnings.length > 0 && !isLocked) {
          statusIcon = <AlertCircle size={16} color="#fbbf24" />;
        }
        if (!guard.isValid && !isLocked && !isCurrent) {
            statusIcon = <AlertCircle size={16} color="#f87171" />;
        }

        return (
          <button
            key={stage.id}
            onClick={() => !isLocked && dispatchEngineAction({ type: "SET_STAGE", stage: stage.id })}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 10px",
              borderRadius: "10px",
              border: isCurrent ? "1px solid rgba(212,175,55,0.3)" : "1px solid transparent",
              background: isCurrent ? "rgba(212,175,55,0.1)" : "transparent",
              color: isLocked ? "#64748b" : isCurrent ? "#f8fafc" : "#cbd5e1",
              cursor: isLocked ? "default" : "pointer",
              textAlign: "left",
              width: "100%",
              transition: "all 0.2s ease"
            }}
            disabled={isLocked}
          >
            {statusIcon}
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: "11px", fontWeight: isCurrent ? 800 : 600 }}>{stage.label}</p>
              {isCurrent && guard.blockers.length > 0 && (
                <p style={{ margin: "2px 0 0 0", fontSize: "10px", color: "#f87171" }}>{guard.blockers[0]}</p>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

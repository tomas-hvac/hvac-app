"use client";

import React from "react";
import { CheckCircle2, Circle, Lock, AlertCircle, PlayCircle } from "lucide-react";
import { useProjectEngine } from "./useProjectEngine";
import type { ProjectWorkflowStage } from "@/lib/hvac/engine/projectEngineTypes";

const STAGES: Array<{ id: ProjectWorkflowStage; label: string }> = [
  { id: "SETUP", label: "SETUP" },
  { id: "CALIBRATION", label: "CAL" },
  { id: "TAKEOFF", label: "TAKEOFF" },
  { id: "LOAD_CALC", label: "LOAD" },
  { id: "DUCT_DESIGN", label: "DUCT" },
  { id: "PROPOSAL", label: "PROPOSAL" },
  { id: "REPORT", label: "REPORT" },
  { id: "EXPORT", label: "EXPORT" },
];

export function WorkflowRail() {
  const { engineState, dispatchEngineAction, canEnterStage, getStageGuard } = useProjectEngine();
  const currentStage = engineState.workflowStage;

  return (
    <div style={{
      width: "100%",
      borderRadius: "12px",
      border: "1px solid rgba(255,255,255,0.06)",
      background: "rgba(15, 23, 42, 0.45)",
      padding: "6px 12px",
      marginBottom: "12px"
    }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "4px"
      }}>
        <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
          {STAGES.map((stage) => {
            const guard = getStageGuard(stage.id);
            const isCurrent = currentStage === stage.id;
            const isLocked = !canEnterStage(stage.id);
            const hasDirtyConcern =
              (stage.id === "LOAD_CALC" && (engineState.dirtyFlags.includes("MANUAL_J") || engineState.dirtyFlags.includes("ENVELOPE"))) ||
              (stage.id === "DUCT_DESIGN" && engineState.dirtyFlags.includes("MANUAL_D")) ||
              (stage.id === "PROPOSAL" && engineState.dirtyFlags.includes("PROPOSAL")) ||
              (stage.id === "REPORT" && engineState.dirtyFlags.includes("REPORT"));
            const isComplete = guard.isValid && !isLocked && !isCurrent && !hasDirtyConcern;

            let color = "#475569";
            if (isCurrent) color = "#d4af37";
            else if (hasDirtyConcern || guard.warnings.length > 0) color = "#fbbf24";
            else if (isComplete) color = "#4ade80";
            else if (!isLocked) color = "#94a3b8";

            return (
              <div
                key={stage.id}
                title={`${stage.label}: ${guard.blockers[0] ?? (isLocked ? 'Locked' : isCurrent ? 'Active' : 'Ready')}`}
                style={{
                  width: isCurrent ? "24px" : "12px",
                  height: "4px",
                  borderRadius: "2px",
                  background: color,
                  transition: "all 0.3s ease",
                  cursor: isLocked ? "default" : "pointer"
                }}
                onClick={() => !isLocked && dispatchEngineAction({ type: "SET_STAGE", stage: stage.id })}
              />
            );
          })}
        </div>
        <span style={{ 
          fontSize: "9px", 
          fontWeight: 900, 
          color: "#94a3b8", 
          textTransform: "uppercase", 
          letterSpacing: "0.08em" 
        }}>
          Status: {currentStage}
        </span>
      </div>
    </div>
  );
}

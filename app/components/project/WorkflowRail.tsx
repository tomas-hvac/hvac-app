"use client";

import React from "react";
import { CheckCircle2, Lock, AlertCircle, PlayCircle } from "lucide-react";
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
      overflowX: "auto",
      borderRadius: "12px",
      border: "1px solid rgba(255,255,255,0.06)",
      background: "rgba(15, 23, 42, 0.45)",
      padding: "6px",
      marginBottom: "12px"
    }}>
      <div style={{
        display: "grid",
        gridTemplateColumns: `repeat(${STAGES.length}, minmax(64px, 1fr))`,
        gap: "5px",
        minWidth: "560px"
      }}>
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

            let Icon = CheckCircle2;
            let color = "#475569";
            if (isLocked) Icon = Lock;
            if (isCurrent) {
              Icon = PlayCircle;
              color = "#d4af37";
            } else if (hasDirtyConcern || guard.warnings.length > 0) {
              Icon = AlertCircle;
              color = "#fbbf24";
            } else if (isComplete) {
              color = "#4ade80";
            } else if (!isLocked) {
              color = "#94a3b8";
            }

            return (
              <button
                key={stage.id}
                type="button"
                title={`${stage.label}: ${guard.blockers[0] ?? (isLocked ? 'Locked' : isCurrent ? 'Active' : 'Ready')}`}
                disabled={isLocked}
                onClick={() => !isLocked && dispatchEngineAction({ type: "SET_STAGE", stage: stage.id })}
                style={{
                  minHeight: "40px",
                  borderRadius: "10px",
                  border: isCurrent ? "1px solid rgba(212,175,55,0.28)" : "1px solid rgba(255,255,255,0.04)",
                  background: isCurrent ? "rgba(212,175,55,0.12)" : "rgba(255,255,255,0.02)",
                  color,
                  transition: "all 0.3s ease",
                  cursor: isLocked ? "default" : "pointer",
                  display: "grid",
                  placeItems: "center",
                  gap: "2px",
                  padding: "5px 6px",
                  WebkitTapHighlightColor: "transparent"
                }}
              >
                <Icon size={12} color={color} />
                <span style={{ fontSize: "9px", fontWeight: 900, letterSpacing: "0.03em" }}>{stage.label}</span>
              </button>
            );
          })}
      </div>
    </div>
  );
}

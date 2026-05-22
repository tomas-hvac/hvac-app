"use client";

import React, { useMemo } from "react";
import { useProjectEngine } from "./useProjectEngine";
import { getProjectWarnings } from "@/lib/hvac/engine/projectWarnings";
import { ProjectWorkflowStage } from "@/lib/hvac/engine/projectEngineTypes";
import { 
  X, 
  AlertTriangle, 
  AlertOctagon, 
  Info, 
  ArrowRightCircle, 
  FileWarning,
  CheckCircle2
} from "lucide-react";

interface ProjectIssuesDrawerProps {
  open: boolean;
  onClose: () => void;
}

export interface AggregatedIssue {
  id: string;
  title: string;
  message: string;
  explanation: string;
  severity: "critical" | "warning" | "info";
  relatedStage: ProjectWorkflowStage;
  recommendedAction: string;
}

export function ProjectIssuesDrawer({ open, onClose }: ProjectIssuesDrawerProps) {
  const { engineState, readiness, dispatchEngineAction } = useProjectEngine();
  const { project, dirtyFlags } = engineState;
  const { blockers } = readiness;

  const aggregatedIssues = useMemo(() => {
    const issues: AggregatedIssue[] = [];

    // 1. Add Engine Warnings (from logic)
    const engineWarnings = getProjectWarnings(engineState);
    engineWarnings.forEach(w => {
      issues.push({
        id: `warning-${w.id}`,
        title: w.title,
        message: w.message,
        explanation: w.message, // Use message as explanation if not available
        severity: w.severity,
        relatedStage: w.relatedStage,
        recommendedAction: w.recommendedAction,
      });
    });

    // 2. Add Workflow Blockers (if not already represented by warnings)
    blockers.forEach((blocker, index) => {
      const alreadyHasWarning = engineWarnings.some(w => w.message === blocker);
      if (!alreadyHasWarning) {
        issues.push({
          id: `blocker-${index}`,
          title: "Workflow Blocked",
          message: blocker,
          explanation: "A required step or piece of data is missing for the current workflow stage.",
          severity: "critical",
          relatedStage: engineState.workflowStage,
          recommendedAction: "Resolve requirement",
        });
      }
    });

    // 3. Add Dirty/Stale Data Issues
    if (dirtyFlags.length > 0) {
      const isManualJStale = dirtyFlags.some(f => ["GEOMETRY", "ROOM_AREAS", "ENVELOPE", "MANUAL_J"].includes(f));
      const isManualDStale = dirtyFlags.includes("MANUAL_D");

      if (isManualJStale) {
        issues.push({
          id: "issue-stale-manual-j",
          title: "Manual J Outdated",
          message: `Changes in ${dirtyFlags.filter(f => ["GEOMETRY", "ROOM_AREAS", "ENVELOPE", "MANUAL_J"].includes(f)).join(", ")} detected.`,
          explanation: "The load calculation results are no longer synchronized with the latest project data.",
          severity: "warning",
          relatedStage: "LOAD_CALC",
          recommendedAction: "Recalculate Load",
        });
      }

      if (isManualDStale) {
        issues.push({
          id: "issue-stale-manual-d",
          title: "Manual D Outdated",
          message: "Duct sizing data is stale.",
          explanation: "The duct design milestone needs review due to changes in upstream load or room data.",
          severity: "warning",
          relatedStage: "DUCT_DESIGN",
          recommendedAction: "Review Duct Design",
        });
      }
    }

    // 4. Specific: Calibration Issues
    if (project.calibration.status === "uncalibrated") {
      issues.push({
        id: "issue-calibration",
        title: "Calibration Required",
        message: "Blueprint scale has not been established.",
        explanation: "Room measurements and square footage cannot be calculated accurately without blueprint calibration.",
        severity: "critical",
        relatedStage: "CALIBRATION",
        recommendedAction: "Calibrate Blueprint",
      });
    }

    // 5. Specific: Missing Room Geometry
    if (project.tracedRooms.length === 0 && !["SETUP", "CALIBRATION"].includes(engineState.workflowStage)) {
      issues.push({
        id: "issue-no-rooms",
        title: "No Rooms Traced",
        message: "The load calculation requires room geometry.",
        explanation: "Manual J loads and duct sizes depend on individual room dimensions traced on the blueprint.",
        severity: "critical",
        relatedStage: "TAKEOFF",
        recommendedAction: "Trace Rooms",
      });
    }

    // Sort by severity: critical -> warning -> info
    return issues.sort((a, b) => {
      const scoreMap: Record<string, number> = { critical: 3, warning: 2, info: 1 };
      return scoreMap[b.severity] - scoreMap[a.severity];
    });

  }, [engineState, blockers, dirtyFlags, project, engineState.workflowStage]);

  if (!open) return null;

  const handleGoFix = (stage: ProjectWorkflowStage) => {
    dispatchEngineAction({ type: "SET_STAGE", stage });
    onClose();
  };

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      zIndex: 10000,
      display: "flex",
      justifyContent: "flex-end",
      background: "rgba(0,0,0,0.5)",
      backdropFilter: "blur(4px)"
    }}>
      {/* Backdrop click to close */}
      <div style={{ position: "absolute", inset: 0 }} onClick={onClose} />

      <div style={{
        position: "relative",
        width: "100%",
        maxWidth: "420px",
        height: "100%",
        background: "#0f172a",
        borderLeft: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "-20px 0 50px rgba(0,0,0,0.5)",
        display: "flex",
        flexDirection: "column"
      }}>
        {/* Header */}
        <div style={{
          padding: "20px 24px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 900, color: "#f8fafc" }}>Project Issues Center</h2>
            <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#64748b" }}>
              {aggregatedIssues.length} issue{aggregatedIssues.length === 1 ? "" : "s"} detected in current workflow
            </p>
          </div>
          <button 
            onClick={onClose}
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "8px",
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
              color: "#94a3b8",
              cursor: "pointer",
              display: "grid",
              placeItems: "center"
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* List */}
        <div style={{
          flex: 1,
          overflowY: "auto",
          padding: "20px",
          display: "grid",
          gap: "12px",
          alignContent: "start"
        }}>
          {aggregatedIssues.length === 0 ? (
            <div style={{
              padding: "40px 20px",
              textAlign: "center",
              display: "grid",
              gap: "12px",
              placeItems: "center"
            }}>
              <div style={{
                width: "48px",
                height: "48px",
                borderRadius: "16px",
                background: "rgba(74, 222, 128, 0.1)",
                display: "grid",
                placeItems: "center"
              }}>
                <CheckCircle2 size={24} color="#4ade80" />
              </div>
              <p style={{ margin: 0, fontSize: "14px", fontWeight: 800, color: "#cbd5e1" }}>No Issues Detected</p>
              <p style={{ margin: 0, fontSize: "12px", color: "#64748b" }}>Your project is synchronized and ready for the next stage.</p>
            </div>
          ) : (
            aggregatedIssues.map((issue) => {
              const isCritical = issue.severity === "critical";
              const color = isCritical ? "#f87171" : issue.severity === "warning" ? "#fbbf24" : "#60a5fa";
              const Icon = isCritical ? AlertOctagon : issue.severity === "warning" ? AlertTriangle : Info;

              return (
                <div key={issue.id} style={{
                  padding: "16px",
                  borderRadius: "16px",
                  background: "rgba(255,255,255,0.02)",
                  border: `1px solid ${isCritical ? "rgba(239, 68, 68, 0.12)" : "rgba(255,255,255,0.04)"}`,
                  display: "grid",
                  gap: "12px"
                }}>
                  <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                    <div style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "10px",
                      background: isCritical ? "rgba(239, 68, 68, 0.1)" : "rgba(255,255,255,0.03)",
                      display: "grid",
                      placeItems: "center",
                      flexShrink: 0
                    }}>
                      <Icon size={18} color={color} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <h4 style={{ margin: 0, fontSize: "14px", fontWeight: 900, color: "#f8fafc" }}>{issue.title}</h4>
                        <span style={{ 
                          fontSize: "8px", 
                          fontWeight: 900, 
                          color: "#475569", 
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                          background: "rgba(255,255,255,0.03)",
                          padding: "2px 6px",
                          borderRadius: "4px"
                        }}>
                          {issue.relatedStage}
                        </span>
                      </div>
                      <p style={{ margin: "4px 0 0 0", fontSize: "12px", fontWeight: 700, color: "#94a3b8", lineHeight: 1.4 }}>
                        {issue.message}
                      </p>
                      <p style={{ margin: "8px 0 0 0", fontSize: "11px", color: "#64748b", lineHeight: 1.4 }}>
                        {issue.explanation}
                      </p>
                    </div>
                  </div>

                  <div style={{ 
                    display: "flex", 
                    justifyContent: "flex-end", 
                    paddingTop: "10px",
                    borderTop: "1px solid rgba(255,255,255,0.03)"
                  }}>
                    <button
                      onClick={() => handleGoFix(issue.relatedStage)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "6px 12px",
                        borderRadius: "8px",
                        background: isCritical ? "rgba(239, 68, 68, 0.12)" : "rgba(255,255,255,0.03)",
                        color: isCritical ? "#fca5a5" : "#cbd5e1",
                        border: `1px solid ${isCritical ? "rgba(239, 68, 68, 0.2)" : "rgba(255,255,255,0.06)"}`,
                        fontSize: "10.5px",
                        fontWeight: 800,
                        cursor: "pointer"
                      }}
                    >
                      <ArrowRightCircle size={14} />
                      {issue.recommendedAction}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: "20px 24px",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(0,0,0,0.2)"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "#475569" }}>
            <FileWarning size={14} />
            <p style={{ margin: 0, fontSize: "11px", fontWeight: 600 }}>
              Issues impact project accuracy and downstream calculations.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

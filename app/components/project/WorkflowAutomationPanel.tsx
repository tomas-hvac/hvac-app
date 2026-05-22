"use client";

import React, { useState } from "react";
import { useProjectEngine } from "./useProjectEngine";
import { 
  Sparkles, 
  ArrowRightCircle, 
  X, 
  Lightbulb, 
  RefreshCw,
} from "lucide-react";
import type { ProjectAutomationResult } from "@/lib/hvac/engine/projectAutomation";

interface WorkflowAutomationPanelProps {
  onRecalculate?: () => void;
}

export function WorkflowAutomationPanel({ onRecalculate }: WorkflowAutomationPanelProps) {
  const { engineState, dispatchEngineAction } = useProjectEngine();
  const { automationEnabled, automationSuggestions } = engineState;
  const [isExpanded, setIsExpanded] = useState(false);

  if (!automationEnabled || automationSuggestions.length === 0) return null;

  const currentSuggestion = automationSuggestions[0];
  const canApplySuggestion =
    currentSuggestion.actionType !== "START_RECALCULATION" ||
    Boolean(onRecalculate);

  if (!canApplySuggestion) return null;

  const handleApply = (suggestion: ProjectAutomationResult) => {
    dispatchEngineAction({ type: "APPLY_AUTOMATION_SUGGESTION", result: suggestion });
    
    if (suggestion.actionType === "START_RECALCULATION" && onRecalculate) {
      onRecalculate();
    }
  };

  const handleDismiss = (ruleId: string) => {
    dispatchEngineAction({ type: "DISMISS_AUTOMATION_SUGGESTION", ruleId });
  };

  const isWarning = currentSuggestion.severity === "warning";
  const iconColor = isWarning ? "#fbbf24" : "#4ade80";

  return (
    <div style={{
      background: "rgba(15, 23, 42, 0.4)",
      backdropFilter: "blur(8px)",
      borderRadius: "14px",
      border: "1px solid rgba(255,255,255,0.05)",
      padding: "10px 12px",
      display: "grid",
      gap: isExpanded ? "10px" : "0",
      marginBottom: "8px",
      boxShadow: "none",
      transition: "all 0.2s ease"
    }}>
      <button
        type="button"
        onClick={() => setIsExpanded((current) => !current)}
        style={{
          background: "transparent",
          border: "none",
          padding: 0,
          cursor: "pointer",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          textAlign: "left",
          width: "100%"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Sparkles size={16} color="#475569" />
          <p style={{
            margin: 0,
            fontSize: "10px",
            fontWeight: 900,
            color: "#64748b",
            textTransform: "uppercase",
            letterSpacing: "0.08em"
          }}>Automation: {automationSuggestions.length}</p>
        </div>
        <span style={{
          fontSize: "9px",
          fontWeight: 800,
          color: "#475569",
          background: "rgba(255,255,255,0.02)",
          padding: "2px 6px",
          borderRadius: "6px",
          border: "1px solid rgba(255,255,255,0.04)"
        }}>
          {isExpanded ? "Hide" : "Review"}
        </span>
      </button>

      {isExpanded && <div style={{ display: "grid", gap: "8px", marginTop: "10px" }}>
            <div key={currentSuggestion.ruleId} style={{
              padding: "12px",
              borderRadius: "12px",
              background: "rgba(255,255,255,0.015)",
              border: "1px solid rgba(255,255,255,0.03)",
              position: "relative"
            }}>
              <button 
                type="button"
                onClick={() => handleDismiss(currentSuggestion.ruleId)}
                title="Dismiss automation suggestion"
                style={{
                  position: "absolute",
                  top: "10px",
                  right: "10px",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "#475569"
                }}
              >
                <X size={12} />
              </button>

              <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                <div style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "8px",
                  background: isWarning ? "rgba(251, 191, 36, 0.08)" : "rgba(74, 222, 128, 0.08)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0
                }}>
                  {currentSuggestion.actionType === "START_RECALCULATION" ? (
                    <RefreshCw size={14} color={iconColor} />
                  ) : (
                    <Lightbulb size={14} color={iconColor} />
                  )}
                </div>
                
                <div style={{ flex: 1, paddingRight: "16px" }}>
                  <p style={{ margin: 0, fontSize: "12px", fontWeight: 800, color: "#cbd5e1", lineHeight: 1.3 }}>
                    {currentSuggestion.title}
                  </p>
                  <p style={{ margin: "2px 0 0 0", fontSize: "11px", fontWeight: 700, color: "#94a3b8", lineHeight: 1.3 }}>
                    {currentSuggestion.message}
                  </p>
                  <p style={{ margin: "6px 0 0 0", fontSize: "10px", color: "#64748b", lineHeight: 1.4 }}>
                    {currentSuggestion.why}
                  </p>
                  <p style={{ margin: "6px 0 0 0", fontSize: "10.5px", color: "#d4af37", fontWeight: 800, lineHeight: 1.3 }}>
                    {currentSuggestion.recommendedAction}
                  </p>
                  
                  <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
                    <button
                      type="button"
                      onClick={() => handleApply(currentSuggestion)}
                      style={{
                        padding: "6px 12px",
                        borderRadius: "8px",
                        background: "rgba(212, 175, 55, 0.15)",
                        color: "#fde68a",
                        border: "1px solid rgba(212, 175, 55, 0.25)",
                        fontSize: "10.5px",
                        fontWeight: 800,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "5px"
                      }}
                    >
                      {currentSuggestion.actionType === "START_RECALCULATION"
                        ? "Apply Now"
                        : currentSuggestion.suggestedStage
                          ? `Go to ${currentSuggestion.suggestedStage}`
                          : "Apply Now"}
                      <ArrowRightCircle size={12} />
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => handleDismiss(currentSuggestion.ruleId)}
                      style={{
                        padding: "6px 10px",
                        borderRadius: "8px",
                        background: "rgba(255,255,255,0.02)",
                        border: "1px solid rgba(255,255,255,0.04)",
                        color: "#64748b",
                        fontSize: "10.5px",
                        fontWeight: 700,
                        cursor: "pointer"
                      }}
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            </div>
      </div>}
    </div>
  );
}

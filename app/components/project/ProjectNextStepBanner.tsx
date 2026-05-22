"use client";

import React from "react";
import { useProjectEngine } from "./useProjectEngine";
import { ArrowRight, AlertTriangle, RefreshCw, CheckCircle, Activity, ShieldCheck } from "lucide-react";

export function ProjectNextStepBanner() {
  const { readiness, nextRecommendedAction, nextRecommendedStage, dispatchEngineAction } = useProjectEngine();
  const { isValid, blockers, warnings, isDirty, dirtyFlags, calculationStatus, lastCalculationAt } = readiness;

  if (blockers.length > 0) {
    return (
      <div style={{
        padding: "10px 16px",
        borderRadius: "14px",
        background: "rgba(127, 29, 29, 0.12)",
        border: "1px solid rgba(248, 113, 113, 0.15)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "12px",
        marginBottom: "12px"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <AlertTriangle color="#f87171" size={16} />
          <div>
            <p style={{ margin: 0, fontSize: "12px", fontWeight: 850, color: "#fca5a5", letterSpacing: "0.02em" }}>WORKFLOW BLOCKED</p>
            <p style={{ margin: "1px 0 0 0", fontSize: "11px", color: "#f87171", opacity: 0.9 }}>{blockers[0]}</p>
          </div>
        </div>
      </div>
    );
  }

  // Calculation Status Logic
  let statusColor = "#4ade80";
  let statusBg = "rgba(34, 197, 94, 0.08)";
  let statusBorder = "1px solid rgba(34, 197, 94, 0.15)";
  let statusIcon = <CheckCircle color="#4ade80" size={16} />;
  let statusTitle = "STAGE READY";
  let statusMessage = nextRecommendedAction;

  if (calculationStatus === "recalculating") {
    statusColor = "#60a5fa";
    statusBg = "rgba(59, 130, 246, 0.08)";
    statusBorder = "1px solid rgba(59, 130, 246, 0.15)";
    statusIcon = <Activity color="#60a5fa" size={16} className="animate-pulse" />;
    statusTitle = "RECALCULATING";
    statusMessage = "Processing airflow and load models...";
  } else if (isDirty || calculationStatus === "dirty") {
    statusColor = "#fbbf24";
    statusBg = "rgba(212, 175, 55, 0.08)";
    statusBorder = "1px solid rgba(212, 175, 55, 0.15)";
    statusIcon = <RefreshCw color="#fbbf24" size={16} />;
    statusTitle = "ACTION REQUIRED";
    statusMessage = `Changes in ${dirtyFlags.join(", ")} require re-calculation`;
  } else if (calculationStatus === "valid") {
    statusIcon = <ShieldCheck color="#4ade80" size={16} />;
    statusTitle = "ENGINE SYNCHRONIZED";
    statusMessage = `Validated at ${new Date(lastCalculationAt!).toLocaleTimeString()}`;
  }

  return (
    <div style={{
      padding: "10px 16px",
      borderRadius: "14px",
      background: statusBg,
      border: statusBorder,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "12px",
      marginBottom: "12px"
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        {statusIcon}
        <div>
          <p style={{ 
            margin: 0, 
            fontSize: "12px", 
            fontWeight: 850, 
            color: statusColor,
            letterSpacing: "0.02em"
          }}>
            {statusTitle}
          </p>
          <p style={{ 
            margin: "1px 0 0 0", 
            fontSize: "11px", 
            color: statusColor,
            opacity: 0.8
          }}>
            {statusMessage}
          </p>
        </div>
      </div>

      {isValid && calculationStatus !== "recalculating" && !isDirty && (
        <button 
          onClick={() => dispatchEngineAction({ type: "SET_STAGE", stage: nextRecommendedStage })}
          style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "6px 12px",
          borderRadius: "8px",
          background: "rgba(212, 175, 55, 0.15)",
          color: "#fde68a",
          border: "1px solid rgba(212, 175, 55, 0.25)",
          fontWeight: 800,
          fontSize: "11px",
          cursor: "pointer",
          transition: "all 0.2s ease"
        }}>
          Continue
          <ArrowRight size={14} />
        </button>
      )}
    </div>
  );
}

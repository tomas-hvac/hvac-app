"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useProjectEngine } from "./useProjectEngine";
import { getProjectWarnings } from "@/lib/hvac/engine/projectWarnings";
import { 
  AlertTriangle, 
  AlertOctagon, 
  Info, 
  ArrowRightCircle, 
  ChevronRight 
} from "lucide-react";

export function ProjectWarningsPanel() {
  const { engineState, dispatchEngineAction } = useProjectEngine();
  const warnings = useMemo(() => getProjectWarnings(engineState), [engineState]);
  const criticalCount = warnings.filter(w => w.severity === "critical").length;
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (criticalCount > 0) setIsExpanded(true);
  }, [criticalCount]);

  if (warnings.length === 0) return null;

  // Sort: Critical -> Warning -> Info
  const sortedWarnings = [...warnings].sort((a, b) => {
    const severityMap = { critical: 0, warning: 1, info: 2 };
    return severityMap[a.severity] - severityMap[b.severity];
  });

  const borderColor = criticalCount > 0 ? "rgba(248, 113, 113, 0.15)" : "rgba(255, 255, 255, 0.05)";

  return (
    <div style={{
      background: "rgba(15, 23, 42, 0.35)",
      borderRadius: "14px",
      border: `1px solid ${borderColor}`,
      padding: "10px 12px",
      display: "grid",
      gap: isExpanded ? "10px" : "0",
      marginBottom: "8px",
      overflow: "hidden",
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
          <div style={{
            width: "24px",
            height: "24px",
            borderRadius: "8px",
            background: criticalCount > 0 ? "rgba(239, 68, 68, 0.08)" : "rgba(255, 255, 255, 0.03)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}>
            {criticalCount > 0 ? <AlertOctagon size={16} color="#f87171" /> : <AlertTriangle size={16} color="#475569" />}
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: "12px", fontWeight: 900, color: "#94a3b8" }}>
              Warnings: {warnings.length}
            </h4>
            <p style={{ margin: 0, fontSize: "10px", color: "#475569" }}>
              {criticalCount > 0 ? `${criticalCount} critical review required` : "Passive monitoring active"}
            </p>
          </div>
        </div>
        <span style={{
            fontSize: "9px",
            fontWeight: 900,
            padding: "3px 8px",
            borderRadius: "6px",
            background: "rgba(255,255,255,0.02)",
            color: criticalCount > 0 ? "#fca5a5" : "#475569",
            border: "1px solid rgba(255,255,255,0.04)",
            textTransform: "uppercase",
            letterSpacing: "0.04em"
          }}>
            {isExpanded ? "Hide" : "Review"}
          </span>
      </button>

      {isExpanded && <div style={{ display: "grid", gap: "6px", marginTop: "10px" }}>
        {sortedWarnings.map((warning) => {
          const isCritical = warning.severity === "critical";
          const iconColor = isCritical ? "#f87171" : warning.severity === "warning" ? "#d4af37" : "#60a5fa";
          const Icon = isCritical ? AlertOctagon : warning.severity === "warning" ? AlertTriangle : Info;

          return (
            <div key={warning.id} style={{
              padding: "10px 12px",
              borderRadius: "12px",
              background: "rgba(255,255,255,0.015)",
              border: `1px solid ${isCritical ? "rgba(239, 68, 68, 0.08)" : "rgba(255,255,255,0.02)"}`,
              display: "flex",
              gap: "10px",
              alignItems: "flex-start"
            }}>
              <Icon size={14} color={iconColor} style={{ marginTop: "2px", flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "2px" }}>
                  <p style={{ margin: 0, fontSize: "12px", fontWeight: 800, color: "#cbd5e1" }}>{warning.title}</p>
                  <span style={{ fontSize: "8px", color: "#475569", textTransform: "uppercase" }}>{warning.category}</span>
                </div>
                <p style={{ margin: 0, fontSize: "11px", color: "#94a3b8", lineHeight: 1.4 }}>{warning.message}</p>
                
                <button 
                  onClick={() => dispatchEngineAction({ type: "SET_STAGE", stage: warning.relatedStage })}
                  style={{
                    marginTop: "8px",
                    padding: "4px 8px",
                    borderRadius: "6px",
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.04)",
                    color: iconColor,
                    fontSize: "10px",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "5px"
                  }}
                >
                  <ArrowRightCircle size={11} />
                  {warning.recommendedAction}
                </button>
              </div>
            </div>
          );
        })}
      </div>}
    </div>
  );
}

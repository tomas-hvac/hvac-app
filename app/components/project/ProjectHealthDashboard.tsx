"use client";

import React, { useMemo } from "react";
import { useProjectEngine } from "./useProjectEngine";
import { 
  calculateProjectHealthScore, 
  getProjectHealthItems, 
  getProjectReliabilityLabel 
} from "@/lib/hvac/engine/projectHealth";
import { 
  CheckCircle2, 
  AlertCircle, 
  XCircle, 
  Clock, 
  ShieldCheck, 
  Trophy 
} from "lucide-react";

interface ProjectHealthDashboardProps {
  compact?: boolean;
}

export function ProjectHealthDashboard({ compact = false }: ProjectHealthDashboardProps) {
  const { engineState } = useProjectEngine();
  const { calculationStatus, lastCalculationAt, dirtyFlags } = engineState;

  const items = useMemo(() => getProjectHealthItems(engineState), [engineState]);
  const score = useMemo(() => calculateProjectHealthScore(engineState), [engineState]);
  const label = useMemo(() => getProjectReliabilityLabel(score), [score]);

  const scoreColor = score >= 90 ? "#4ade80" : score >= 70 ? "#fbbf24" : "#f87171";

  return (
    <div style={{
      background: "rgba(15, 23, 42, 0.45)",
      backdropFilter: "blur(8px)",
      borderRadius: compact ? "12px" : "18px",
      border: "1px solid rgba(255,255,255,0.06)",
      padding: compact ? "10px" : "16px",
      display: "grid",
      gap: compact ? "6px" : "12px",
      marginBottom: compact ? "4px" : "16px"
    }}>
      {/* Header with Score */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <p style={{
            margin: 0,
            fontSize: compact ? "8px" : "10px",
            fontWeight: 900,
            color: "#64748b",
            textTransform: "uppercase",
            letterSpacing: "0.08em"
          }}>Project Health</p>
          <h3 style={{ margin: "2px 0 0 0", fontSize: compact ? "13px" : "16px", fontWeight: 900, color: "#cbd5e1", display: "flex", alignItems: "center", gap: "6px" }}>
            {label}
            {score >= 90 && <Trophy size={compact ? 12 : 16} color="#d4af37" />}
          </h3>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ margin: 0, fontSize: compact ? "16px" : "20px", fontWeight: 950, color: scoreColor }}>{score}%</p>
          <div style={{ width: compact ? "40px" : "50px", height: "3px", background: "rgba(255,255,255,0.04)", borderRadius: "2px", marginTop: "3px", overflow: "hidden" }}>
            <div style={{ width: `${score}%`, height: "100%", background: scoreColor, transition: "width 0.5s ease" }} />
          </div>
        </div>
      </div>

      {/* Checklist */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5px" }}>
        {(compact ? items.slice(0, 4) : items).map((item) => {
          let Icon = Clock;
          let color = "#475569";

          if (item.status === "pass") {
            Icon = CheckCircle2;
            color = "#4ade80";
          } else if (item.status === "warning") {
            Icon = AlertCircle;
            color = "#fbbf24";
          } else if (item.status === "fail") {
            Icon = XCircle;
            color = "#f87171";
          }

          return (
            <div key={item.id} style={{
              display: "flex",
              alignItems: "center",
              gap: "5px",
              minHeight: compact ? "28px" : undefined,
              padding: compact ? "4px 6px" : "6px 8px",
              borderRadius: "8px",
              background: "rgba(255,255,255,0.015)",
              border: "1px solid rgba(255,255,255,0.03)"
            }}>
              <Icon size={compact ? 11 : 13} color={color} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: compact ? "8.5px" : "10px", fontWeight: 800, color: "#94a3b8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.label}</p>
                <p style={{ margin: 0, fontSize: "8px", color: "#475569", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.message}</p>
              </div>
            </div>
          );
        })}
      </div>
      {compact && items.length > 4 && (
        <p style={{ margin: "-2px 0 0 0", fontSize: "9px", color: "#475569", fontWeight: 700 }}>
          +{items.length - 4} more status items
        </p>
      )}

      {/* Footer Info */}
      {!compact && <div style={{ 
        padding: "10px 14px", 
        background: "rgba(0,0,0,0.2)", 
        borderRadius: "14px", 
        border: "1px solid rgba(255,255,255,0.03)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <ShieldCheck size={14} color={calculationStatus === "valid" ? "#4ade80" : "#64748b"} />
          <p style={{ margin: 0, fontSize: "11px", fontWeight: 700, color: "#94a3b8" }}>
            {calculationStatus === "valid" ? "Verified Engine State" : "Draft Mode"}
          </p>
        </div>
        {lastCalculationAt && (
          <p style={{ margin: 0, fontSize: "10px", color: "#64748b" }}>
            Synced {new Date(lastCalculationAt).toLocaleTimeString()}
          </p>
        )}
      </div>}

      {dirtyFlags.length > 0 && (
        <div style={{ 
          padding: "8px 12px", 
          background: "rgba(212, 175, 55, 0.08)", 
          borderRadius: "10px", 
          border: "1px solid rgba(212, 175, 55, 0.15)",
          display: "flex",
          alignItems: "center",
          gap: "8px"
        }}>
          <AlertCircle size={14} color="#d4af37" />
          <p style={{ margin: 0, fontSize: "10px", fontWeight: 800, color: "#d4af37" }}>
            Stale Data: {dirtyFlags.join(", ")}
          </p>
        </div>
      )}
    </div>
  );
}

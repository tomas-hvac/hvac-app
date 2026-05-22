"use client";

import React, { useEffect, useRef } from "react";
import { RotateCcw, ArrowRightCircle, Clock, X } from "lucide-react";
import { useProjectEngine } from "./useProjectEngine";

export function ProjectResumeBanner() {
  const { engineState, dispatchEngineAction } = useProjectEngine();
  const lastRecoveryProjectIdRef = useRef<string | null>(null);
  const suggestion = engineState.resumeSuggestion;

  useEffect(() => {
    if (lastRecoveryProjectIdRef.current === engineState.project.id) return;
    lastRecoveryProjectIdRef.current = engineState.project.id;
    dispatchEngineAction({ type: "RUN_SESSION_RECOVERY" });
  }, [engineState.project.id, dispatchEngineAction]);

  if (!suggestion || !engineState.sessionRecovered) return null;

  const isCritical = suggestion.severity === "critical";
  const accent = isCritical ? "#f87171" : suggestion.severity === "warning" ? "#fbbf24" : "#60a5fa";

  return (
    <div style={{
      padding: "10px 16px",
      borderRadius: "14px",
      background: isCritical ? "rgba(127, 29, 29, 0.12)" : "rgba(59, 130, 246, 0.08)",
      border: `1px solid ${isCritical ? "rgba(248, 113, 113, 0.2)" : "rgba(96, 165, 250, 0.18)"}`,
      display: "grid",
      gap: "10px",
      marginBottom: "12px"
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "flex-start" }}>
        <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
          <div style={{
            width: "30px",
            height: "30px",
            borderRadius: "10px",
            background: isCritical ? "rgba(248, 113, 113, 0.1)" : "rgba(96, 165, 250, 0.1)",
            display: "grid",
            placeItems: "center",
            flexShrink: 0
          }}>
            <RotateCcw size={15} color={accent} />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: "10px", fontWeight: 900, color: accent, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Resume Session
            </p>
            <p style={{ margin: "1px 0 0 0", fontSize: "14px", fontWeight: 900, color: "#f8fafc" }}>
              {suggestion.title}
            </p>
            <p style={{ margin: "1px 0 0 0", fontSize: "11px", lineHeight: 1.35, color: "#cbd5e1", opacity: 0.9 }}>
              {suggestion.whatChanged}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => dispatchEngineAction({ type: "DISMISS_RESUME_SUGGESTION" })}
          title="Dismiss resume suggestion"
          style={{
            width: "24px",
            height: "24px",
            borderRadius: "8px",
            border: "1px solid rgba(255,255,255,0.06)",
            background: "rgba(255,255,255,0.03)",
            color: "#94a3b8",
            cursor: "pointer",
            display: "grid",
            placeItems: "center",
            flexShrink: 0
          }}
        >
          <X size={12} />
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.2fr", gap: "8px" }}>
        {[
          { label: "Last Stage", value: suggestion.lastActiveStage },
          { label: "Resume At", value: suggestion.recommendedStage },
          { label: "Last Session", value: new Date(suggestion.lastSessionAt).toLocaleTimeString(), icon: true },
        ].map((item) => (
          <div key={item.label} style={{
            padding: "6px 10px",
            borderRadius: "10px",
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.05)",
            minWidth: 0
          }}>
            <p style={{ margin: 0, fontSize: "8px", fontWeight: 900, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              {item.label}
            </p>
            <p style={{ margin: "2px 0 0 0", fontSize: "10.5px", fontWeight: 800, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: "4px" }}>
              {item.icon && <Clock size={9} color="#94a3b8" />}
              {item.value}
            </p>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "center" }}>
        <p style={{ margin: 0, fontSize: "11px", color: "#94a3b8", lineHeight: 1.35, flex: 1 }}>
          {suggestion.message}
        </p>
        <button
          type="button"
          onClick={() => dispatchEngineAction({ type: "RESUME_WORKFLOW" })}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "7px 12px",
            borderRadius: "10px",
            background: accent,
            color: "#0f172a",
            border: "none",
            fontWeight: 900,
            fontSize: "11px",
            cursor: "pointer",
            whiteSpace: "nowrap"
          }}
        >
          Resume Now
          <ArrowRightCircle size={14} />
        </button>
      </div>
    </div>
  );
}

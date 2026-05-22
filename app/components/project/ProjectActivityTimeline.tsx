"use client";

import React, { useMemo, useState } from "react";
import { useProjectEngine } from "./useProjectEngine";
import { getTimelineEvents } from "@/lib/hvac/engine/projectTimeline";
import { 
  History, 
  CheckCircle2, 
  AlertCircle, 
  Info, 
  PlayCircle, 
  ChevronRight,
  Clock
} from "lucide-react";

export function ProjectActivityTimeline() {
  const { engineState } = useProjectEngine();
  const events = useMemo(() => getTimelineEvents(engineState), [engineState]);
  const [isExpanded, setIsExpanded] = useState(false);

  if (events.length === 0) return null;

  return (
    <div style={{
      background: "rgba(15, 23, 42, 0.35)",
      backdropFilter: "blur(8px)",
      borderRadius: "14px",
      border: "1px solid rgba(255,255,255,0.04)",
      padding: "10px 12px",
      maxHeight: isExpanded ? "300px" : "none",
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      gap: isExpanded ? "10px" : "0",
      marginBottom: "8px",
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
          <History size={16} color="#475569" />
          <p style={{
            margin: 0,
            fontSize: "10px",
            fontWeight: 900,
            color: "#64748b",
            textTransform: "uppercase",
            letterSpacing: "0.08em"
          }}>Activity Log</p>
        </div>
        <span style={{
          fontSize: "9px",
          fontWeight: 800,
          color: "#475569",
          background: "rgba(255,255,255,0.02)",
          padding: "2px 6px",
          borderRadius: "6px"
        }}>
          {isExpanded ? "Hide" : "Show"}
        </span>
      </button>

      {isExpanded && <div style={{ 
        flex: 1, 
        overflowY: "auto", 
        paddingRight: "4px",
        display: "grid",
        gap: "10px",
        marginTop: "10px"
      }}>
        {events.slice(0, 5).map((event, index) => {
          const isLast = index === Math.min(events.length, 5) - 1;
          const time = new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          
          let Icon = Info;
          let color = "#475569";
          
          if (event.severity === "success") {
            Icon = CheckCircle2;
            color = "#4ade80";
          } else if (event.severity === "warning") {
            Icon = AlertCircle;
            color = "#fbbf24";
          } else if (event.severity === "critical") {
            Icon = AlertCircle;
            color = "#f87171";
          } else if (event.type === "STAGE_CHANGED") {
            Icon = PlayCircle;
            color = "#d4af37";
          }

          return (
            <div key={event.id} style={{
              display: "flex",
              gap: "10px",
              position: "relative"
            }}>
              {!isLast && (
                <div style={{
                  position: "absolute",
                  left: "6px",
                  top: "20px",
                  bottom: "-10px",
                  width: "1px",
                  background: "rgba(255,255,255,0.03)"
                }} />
              )}
              
              <div style={{
                width: "13px",
                height: "13px",
                borderRadius: "50%",
                background: "#1e293b",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 1,
                marginTop: "2px"
              }}>
                <Icon size={12} color={color} />
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <p style={{ margin: 0, fontSize: "12px", fontWeight: 800, color: "#cbd5e1" }}>{event.title}</p>
                  <p style={{ margin: 0, fontSize: "9px", color: "#475569", display: "flex", alignItems: "center", gap: "3px" }}>
                    <Clock size={9} />
                    {time}
                  </p>
                </div>
                <p style={{ margin: "1px 0 0 0", fontSize: "10.5px", color: "#94a3b8", lineHeight: 1.3 }}>{event.message}</p>
              </div>
            </div>
          );
        })}
      </div>}

      {isExpanded && <div style={{ 
        paddingTop: "12px", 
        borderTop: "1px solid rgba(255,255,255,0.05)",
        textAlign: "center"
      }}>
        <button style={{
          background: "transparent",
          border: "none",
          color: "#64748b",
          fontSize: "11px",
          fontWeight: 700,
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: "4px"
        }}>
          Audit Complete
          <ChevronRight size={12} />
        </button>
      </div>}
    </div>
  );
}

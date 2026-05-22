"use client";

import React, { useMemo } from "react";
import { useProjectEngine } from "./useProjectEngine";
import { getSmartWorkflowActions } from "@/lib/hvac/engine/projectActions";
import { 
  Zap, 
  RefreshCw, 
  ArrowRightCircle, 
  FileText, 
  Layout, 
  DraftingCompass 
} from "lucide-react";
import { ProjectSmartAction } from "@/lib/hvac/engine/projectActions";

interface SmartWorkflowActionsProps {
  onRecalculate?: () => void;
  onGenerateProposal?: () => void;
  onGenerateReport?: () => void;
  onExport?: () => void;
}

export function SmartWorkflowActions({
  onRecalculate,
  onGenerateProposal,
  onGenerateReport,
  onExport,
}: SmartWorkflowActionsProps) {
  const { engineState, dispatchEngineAction } = useProjectEngine();
  const actions = useMemo(() => getSmartWorkflowActions(engineState), [engineState]);

  const hasHandler = (action: ProjectSmartAction) => {
    if (!action.enabled) return false;
    if (action.actionType === "START_RECALCULATION") return Boolean(onRecalculate);
    if (action.actionType === "REVIEW_PROPOSAL") return Boolean(onGenerateProposal);
    if (action.actionType === "REVIEW_REPORT") return Boolean(onGenerateReport);
    if (action.actionType === "EXPORT_REPORT") return Boolean(onExport);
    return true;
  };

  const actionableActions = actions.filter(hasHandler);
  const usefulDisabledAction = actions.find((action) => !action.enabled && action.reasonDisabled);

  if (actionableActions.length === 0) {
    if (!usefulDisabledAction) return null;

    return (
      <div style={{
        background: "rgba(15, 23, 42, 0.45)",
        borderRadius: "16px",
        border: "1px solid rgba(255,255,255,0.06)",
        padding: "14px 16px",
        marginBottom: "14px"
      }}>
        <p style={{ margin: 0, fontSize: "11px", fontWeight: 900, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.1em" }}>
          Next Available Action
        </p>
        <p style={{ margin: "5px 0 0 0", fontSize: "12px", color: "#64748b", lineHeight: 1.4 }}>
          {usefulDisabledAction.reasonDisabled}
        </p>
      </div>
    );
  }

  const handleActionClick = (action: ProjectSmartAction) => {
    if (!action.enabled) return;

    // 1. Handle Navigation
    if (action.actionType === "GO_TO_STAGE" || 
        action.actionType.startsWith("REVIEW_") || 
        action.actionType === "EXPORT_REPORT") {
      dispatchEngineAction({ type: "SET_STAGE", stage: action.relatedStage });
    }

    // 2. Handle Logic Triggers (Legacy Handlers)
    if (action.actionType === "START_RECALCULATION" && onRecalculate) {
      onRecalculate();
    } else if (action.actionType === "REVIEW_PROPOSAL" && onGenerateProposal) {
      onGenerateProposal();
    } else if (action.actionType === "REVIEW_REPORT" && onGenerateReport) {
      onGenerateReport();
    } else if (action.actionType === "EXPORT_REPORT" && onExport) {
      onExport();
    }
  };

  const primaryAction = actionableActions.find(a => a.severity === "primary") || actionableActions[0];
  const secondaryActions = actionableActions.filter(a => a.id !== primaryAction.id).slice(0, 2);

  return (
    <div style={{
      background: "rgba(15, 23, 42, 0.45)",
      backdropFilter: "blur(8px)",
      borderRadius: "18px",
      border: "1px solid rgba(255,255,255,0.06)",
      padding: "12px",
      display: "grid",
      gap: "10px",
      marginBottom: "12px"
    }}>
      <div>
        <p style={{
          margin: "0 0 8px 0",
          fontSize: "10px",
          fontWeight: 900,
          color: "#64748b",
          textTransform: "uppercase",
          letterSpacing: "0.08em"
        }}>Smart Recommendations</p>
        
        {/* Primary Action Card */}
        <button
          onClick={() => handleActionClick(primaryAction)}
          style={{
            width: "100%",
            textAlign: "left",
            padding: "12px",
            borderRadius: "14px",
            background: "rgba(212, 175, 55, 0.1)",
            border: "1px solid rgba(212, 175, 55, 0.25)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            transition: "all 0.2s ease"
          }}
        >
          <div style={{
            width: "32px",
            height: "32px",
            borderRadius: "10px",
            background: "#d4af37",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0
          }}>
            {primaryAction.actionType === "START_RECALCULATION" ? (
              <RefreshCw size={16} color="#1e293b" />
            ) : primaryAction.actionType === "EXPORT_REPORT" ? (
              <FileText size={16} color="#1e293b" />
            ) : (
              <Zap size={16} color="#1e293b" />
            )}
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: "14px", fontWeight: 800, color: "#f8fafc" }}>
              {primaryAction.label}
            </p>
            <p style={{ margin: "1px 0 0 0", fontSize: "11px", color: "#d4af37", opacity: 0.9 }}>
              {primaryAction.description}
            </p>
          </div>
          <ArrowRightCircle size={16} color="#d4af37" />
        </button>
      </div>

      {/* Secondary Actions Grid */}
      {secondaryActions.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
          {secondaryActions.map((action) => (
            <button
              key={action.id}
              onClick={() => handleActionClick(action)}
              style={{
                padding: "8px 10px",
                borderRadius: "10px",
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.04)",
                textAlign: "left",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px"
              }}
            >
              {action.actionType === "REVIEW_GEOMETRY" ? <DraftingCompass size={12} color="#94a3b8" /> : <Layout size={12} color="#94a3b8" />}
              <span style={{ fontSize: "10px", fontWeight: 700, color: "#cbd5e1" }}>{action.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

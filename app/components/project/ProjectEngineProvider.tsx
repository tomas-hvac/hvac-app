"use client";

import React, { createContext, useReducer, ReactNode, useMemo } from "react";
import { BlueprintProject } from "@/lib/hvac/blueprintProject";
import {
  ProjectAction,
  ProjectEngineState,
  ProjectWorkflowStage,
  StageGuardResult,
  ProjectHealthStatus,
} from "@/lib/hvac/engine/projectEngineTypes";
import {
  projectEngineReducer,
  selectProjectReadiness,
  selectNextRecommendedAction,
} from "@/lib/hvac/engine/projectEngine";
import { hydrateEngineStateFromMetadata } from "@/lib/hvac/engine/projectEnginePersistence";
import {
  canEnterStage,
  getStageGuard,
} from "@/lib/hvac/engine/projectWorkflowController";

interface ProjectEngineContextType {
  engineState: ProjectEngineState;
  dispatchEngineAction: React.Dispatch<ProjectAction>;
  readiness: ReturnType<typeof selectProjectReadiness>;
  workflowHealth: ProjectHealthStatus;
  nextRecommendedAction: string;
  nextRecommendedStage: ProjectWorkflowStage;
  canEnterStage: (stage: ProjectWorkflowStage) => boolean;
  getStageGuard: (stage: ProjectWorkflowStage) => StageGuardResult;
}

export const ProjectEngineContext = createContext<ProjectEngineContextType | null>(null);

interface ProjectEngineProviderProps {
  children: ReactNode;
  initialProject: BlueprintProject;
}

export function ProjectEngineProvider({ children, initialProject }: ProjectEngineProviderProps) {
  const [engineState, dispatchEngineAction] = useReducer(
    projectEngineReducer,
    initialProject,
    (proj) => hydrateEngineStateFromMetadata(proj, proj.engineMetadata)
  );

  const readiness = useMemo(() => selectProjectReadiness(engineState), [engineState]);
  const nextActionInfo = useMemo(() => selectNextRecommendedAction(engineState), [engineState]);

  const value = useMemo(
    () => ({
      engineState,
      dispatchEngineAction,
      readiness,
      workflowHealth: readiness.health,
      nextRecommendedAction: nextActionInfo.action,
      nextRecommendedStage: nextActionInfo.nextStage,
      canEnterStage: (stage: ProjectWorkflowStage) => canEnterStage(engineState, stage),
      getStageGuard: (stage: ProjectWorkflowStage) => getStageGuard(engineState, stage),
    }),
    [engineState, readiness, nextActionInfo]
  );

  return (
    <ProjectEngineContext.Provider value={value}>
      {children}
    </ProjectEngineContext.Provider>
  );
}

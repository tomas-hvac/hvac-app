"use client";

import { useContext } from "react";
import { ProjectEngineContext } from "./ProjectEngineProvider";

export function useProjectEngine() {
  const context = useContext(ProjectEngineContext);
  
  if (!context) {
    throw new Error("useProjectEngine must be used within a ProjectEngineProvider");
  }
  
  return context;
}

import { 
  BlueprintProject, 
  serializeBlueprintProject, 
  deserializeBlueprintProject 
} from "./blueprintProject";

const STORAGE_NAMESPACE = "blueprint-ai-v3-project-";

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function saveBlueprintProjectToLocalStorage(project: BlueprintProject): void {
  if (!isBrowser()) return;

  try {
    const serialized = serializeBlueprintProject(project);
    localStorage.setItem(`${STORAGE_NAMESPACE}${project.id}`, serialized);
  } catch (error) {
    console.error("Failed to save Blueprint project to localStorage:", error);
  }
}

export function loadBlueprintProjectFromLocalStorage(id: string): BlueprintProject | null {
  if (!isBrowser()) return null;

  try {
    const serialized = localStorage.getItem(`${STORAGE_NAMESPACE}${id}`);
    if (!serialized) return null;

    return deserializeBlueprintProject(serialized);
  } catch (error) {
    console.error(`Failed to load Blueprint project ${id} from localStorage:`, error);
    return null;
  }
}

export function listBlueprintProjectsFromLocalStorage(): BlueprintProject[] {
  if (!isBrowser()) return [];

  const projects: BlueprintProject[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(STORAGE_NAMESPACE)) {
      const serialized = localStorage.getItem(key);
      if (serialized) {
        try {
          const project = deserializeBlueprintProject(serialized);
          projects.push(project);
        } catch (error) {
          console.warn(`Skipping corrupted project at key ${key}:`, error);
        }
      }
    }
  }

  // Sort by updated date, newest first
  return projects.sort((a, b) => 
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export function deleteBlueprintProjectFromLocalStorage(id: string): void {
  if (!isBrowser()) return;

  localStorage.removeItem(`${STORAGE_NAMESPACE}${id}`);
}

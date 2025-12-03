import { createContext, useContext, useState, ReactNode } from "react";

interface Project {
  id: number;
  nome: string;
  construtora?: string | null;
  endereco?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  zona?: "norte" | "sul" | "leste" | "oeste" | "centro" | null;
  enquadramento?: "HIS1" | "HIS2" | "HMP" | "R2V" | null;
  developer?: string | null;
  valorMinimo?: number | null;
  valorMaximo?: number | null;
  metragemMinima?: number | null;
  metragemMaxima?: number | null;
  dormitorios?: string | null;
  vagas?: number | null;
  imagemPrincipal?: string | null;
}

interface CompareContextType {
  selectedProjects: Project[];
  addProject: (project: Project) => void;
  removeProject: (projectId: number) => void;
  clearAll: () => void;
  isSelected: (projectId: number) => boolean;
  canAddMore: boolean;
}

const CompareContext = createContext<CompareContextType | undefined>(undefined);

export function CompareProvider({ children }: { children: ReactNode }) {
  const [selectedProjects, setSelectedProjects] = useState<Project[]>([]);
  const MAX_PROJECTS = 3;

  const addProject = (project: Project) => {
    if (selectedProjects.length < MAX_PROJECTS && !isSelected(project.id)) {
      setSelectedProjects([...selectedProjects, project]);
    }
  };

  const removeProject = (projectId: number) => {
    setSelectedProjects(selectedProjects.filter((p) => p.id !== projectId));
  };

  const clearAll = () => {
    setSelectedProjects([]);
  };

  const isSelected = (projectId: number) => {
    return selectedProjects.some((p) => p.id === projectId);
  };

  const canAddMore = selectedProjects.length < MAX_PROJECTS;

  return (
    <CompareContext.Provider
      value={{
        selectedProjects,
        addProject,
        removeProject,
        clearAll,
        isSelected,
        canAddMore,
      }}
    >
      {children}
    </CompareContext.Provider>
  );
}

export function useCompare() {
  const context = useContext(CompareContext);
  if (context === undefined) {
    throw new Error("useCompare must be used within a CompareProvider");
  }
  return context;
}

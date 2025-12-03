import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { X, ArrowRight } from "lucide-react";
import { useCompare } from "@/contexts/CompareContext";
import { useLocation } from "wouter";

export default function CompareBar() {
  const { selectedProjects, removeProject, clearAll } = useCompare();
  const [, setLocation] = useLocation();

  if (selectedProjects.length === 0) {
    return null;
  }

  const handleCompare = () => {
    const ids = selectedProjects.map((p) => p.id).join(",");
    setLocation(`/comparar?ids=${ids}`);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-t">
      <div className="container mx-auto">
        <Card className="p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="font-semibold">
                Comparar Projetos ({selectedProjects.length}/3)
              </span>
            </div>

            <div className="flex items-center gap-2 flex-1 overflow-x-auto">
              {selectedProjects.map((project) => (
                <div
                  key={project.id}
                  className="flex items-center gap-2 bg-muted px-3 py-2 rounded-md whitespace-nowrap"
                >
                  <span className="text-sm">{project.nome}</span>
                  <button
                    onClick={() => removeProject(project.id)}
                    className="hover:bg-background rounded-full p-1"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={clearAll}>
                Limpar
              </Button>
              <Button
                onClick={handleCompare}
                disabled={selectedProjects.length < 2}
              >
                Comparar
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

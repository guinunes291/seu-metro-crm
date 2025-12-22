import * as React from "react";
import { Check, ChevronsUpDown, Building2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface Project {
  id: number;
  nome: string;
}

interface ProjectComboboxProps {
  projects: Project[];
  value: string; // projectId ou nome manual
  onChange: (value: string, isManual: boolean) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function ProjectCombobox({
  projects,
  value,
  onChange,
  placeholder = "Buscar ou digitar projeto...",
  disabled = false,
}: ProjectComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [searchValue, setSearchValue] = React.useState("");

  // Encontrar o projeto selecionado pelo ID
  const selectedProject = projects.find((p) => p.id.toString() === value);
  
  // Se não encontrou por ID, pode ser um valor manual
  const displayValue = selectedProject?.nome || (value && !projects.find(p => p.id.toString() === value) ? value : "");

  // Filtrar projetos baseado na busca
  const filteredProjects = projects.filter((project) =>
    project.nome.toLowerCase().includes(searchValue.toLowerCase())
  );

  // Verificar se o texto digitado corresponde exatamente a algum projeto
  const exactMatch = projects.find(
    (p) => p.nome.toLowerCase() === searchValue.toLowerCase()
  );

  const handleSelect = (projectId: string) => {
    onChange(projectId, false);
    setOpen(false);
    setSearchValue("");
  };

  const handleManualEntry = () => {
    if (searchValue.trim()) {
      onChange(searchValue.trim(), true);
      setOpen(false);
      setSearchValue("");
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
          disabled={disabled}
        >
          <span className="flex items-center gap-2 truncate">
            {displayValue ? (
              <>
                <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{displayValue}</span>
                {!selectedProject && value && (
                  <span className="text-xs text-muted-foreground">(manual)</span>
                )}
              </>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Digite para buscar..."
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandList>
            {filteredProjects.length === 0 && !searchValue && (
              <CommandEmpty>Nenhum projeto cadastrado.</CommandEmpty>
            )}
            
            {filteredProjects.length > 0 && (
              <CommandGroup heading="Projetos cadastrados">
                {filteredProjects.map((project) => (
                  <CommandItem
                    key={project.id}
                    value={project.id.toString()}
                    onSelect={() => handleSelect(project.id.toString())}
                    className="cursor-pointer"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === project.id.toString() ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <Building2 className="mr-2 h-4 w-4 text-muted-foreground" />
                    {project.nome}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {searchValue && !exactMatch && (
              <>
                {filteredProjects.length > 0 && <CommandSeparator />}
                <CommandGroup heading="Não encontrou?">
                  <CommandItem
                    onSelect={handleManualEntry}
                    className="cursor-pointer text-primary"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Usar "{searchValue}" como projeto
                  </CommandItem>
                </CommandGroup>
              </>
            )}

            {filteredProjects.length === 0 && searchValue && (
              <CommandGroup>
                <CommandItem
                  onSelect={handleManualEntry}
                  className="cursor-pointer text-primary"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Usar "{searchValue}" como projeto
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

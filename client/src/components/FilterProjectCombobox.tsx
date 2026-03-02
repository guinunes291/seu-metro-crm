import * as React from "react";
import { Check, ChevronsUpDown, Building2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
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

interface FilterProjectComboboxProps {
  projects: Project[];
  value: string; // "all" ou projectId como string
  onChange: (value: string) => void;
  placeholder?: string;
}

export function FilterProjectCombobox({
  projects,
  value,
  onChange,
  placeholder = "Todos os projetos",
}: FilterProjectComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [searchValue, setSearchValue] = React.useState("");

  const selectedProject = projects.find((p) => p.id.toString() === value);

  const filteredProjects = React.useMemo(() => {
    if (!searchValue.trim()) return projects;
    return projects.filter((project) =>
      project.nome.toLowerCase().includes(searchValue.toLowerCase())
    );
  }, [projects, searchValue]);

  const handleSelect = (projectId: string) => {
    onChange(projectId);
    setOpen(false);
    setSearchValue("");
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("all");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal h-10"
        >
          <span className="flex items-center gap-2 truncate min-w-0">
            {selectedProject ? (
              <>
                <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{selectedProject.nome}</span>
              </>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </span>
          <span className="flex items-center gap-1 shrink-0 ml-2">
            {selectedProject && (
              <X
                className="h-3.5 w-3.5 opacity-60 hover:opacity-100 transition-opacity"
                onClick={handleClear}
              />
            )}
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="min-w-[var(--radix-popover-trigger-width)] w-[420px] max-w-[90vw] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Digite para buscar projeto..."
            value={searchValue}
            onValueChange={setSearchValue}
            autoFocus
          />
          <CommandList className="max-h-80">
            <CommandGroup>
              <CommandItem
                value="all"
                onSelect={() => handleSelect("all")}
                className="cursor-pointer"
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    value === "all" ? "opacity-100" : "opacity-0"
                  )}
                />
                <span className="text-muted-foreground">Todos os projetos</span>
              </CommandItem>
            </CommandGroup>

            {filteredProjects.length > 0 ? (
              <CommandGroup heading={`${filteredProjects.length} projeto(s) encontrado(s)`}>
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
                    <Building2 className="mr-2 h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="whitespace-normal break-words leading-snug">{project.nome}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : (
              <CommandEmpty>Nenhum projeto encontrado para "{searchValue}".</CommandEmpty>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

import { useState, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Users, ArrowLeft, Plus } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";

const STATUS_OPTIONS = [
  { value: "novo", label: "Novo" },
  { value: "aguardando_atendimento", label: "Aguardando" },
  { value: "em_atendimento", label: "Em atendimento" },
  { value: "agendado", label: "Agendado" },
  { value: "qualificado", label: "Qualificado" },
  { value: "perdido", label: "Perdido" },
];

const TEMPERATURA_OPTIONS = [
  { value: "quente", label: "🔥 Quente" },
  { value: "morno", label: "🟡 Morno" },
  { value: "frio", label: "🔵 Frio" },
];

const FAIXA_RENDA_OPTIONS = [
  { value: "ate_2sm", label: "Até 2 SM" },
  { value: "2_4sm", label: "2 a 4 SM" },
  { value: "4_6sm", label: "4 a 6 SM" },
  { value: "acima_6sm", label: "Acima de 6 SM" },
];

function useDebounce<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export default function NovaOfertaAtiva() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const isGestor = user?.role === "gestor" || user?.role === "admin" || user?.role === "superintendente";

  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [selectedCorretorId, setSelectedCorretorId] = useState<number | undefined>();
  const [filtros, setFiltros] = useState<{
    status: string[];
    temperatura: string[];
    projetoId: number[];
    faixaRenda: string[];
    semInteracaoHaDias?: number;
  }>({ status: [], temperatura: [], projetoId: [], faixaRenda: [] });

  const debouncedFiltros = useDebounce(filtros, 500);

  const { data: projetos } = trpc.projects.list.useQuery();
  const { data: corretores } = (trpc.corretores as any).list.useQuery(undefined, { enabled: isGestor });

  const { data: preview, isLoading: previewLoading } = trpc.ofertaAtiva.previewFiltros.useQuery(
    { filtros: debouncedFiltros, corretorId: isGestor ? selectedCorretorId : undefined },
    { staleTime: 0 },
  );

  const createMutation = trpc.ofertaAtiva.create.useMutation({
    onSuccess: (result) => navigate(`/oferta-ativa/${result.id}`),
  });

  function toggleMulti(field: "status" | "temperatura" | "faixaRenda", value: string) {
    setFiltros((prev) => {
      const current = prev[field];
      return {
        ...prev,
        [field]: current.includes(value) ? current.filter((v) => v !== value) : [...current, value],
      };
    });
  }

  function toggleProjeto(id: number) {
    setFiltros((prev) => ({
      ...prev,
      projetoId: prev.projetoId.includes(id) ? prev.projetoId.filter((v) => v !== id) : [...prev.projetoId, id],
    }));
  }

  function handleCreate() {
    if (!nome.trim()) return;
    createMutation.mutate({
      nome: nome.trim(),
      descricao: descricao.trim() || undefined,
      filtros,
      corretorId: isGestor ? selectedCorretorId : undefined,
    });
  }

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6 p-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/oferta-ativa")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-xl font-bold">Nova Lista de Oferta Ativa</h1>
        </div>

        <div className="bg-white border rounded-xl p-6 space-y-6">
          <div className="space-y-4">
            <div>
              <Label>Nome da Lista *</Label>
              <Input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Leads quentes terça 20/05"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Descrição (opcional)</Label>
              <Input
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Objetivo da campanha..."
                className="mt-1"
              />
            </div>
            {isGestor && corretores && (
              <div>
                <Label>Corretor destinatário</Label>
                <Select
                  value={selectedCorretorId?.toString() ?? ""}
                  onValueChange={(v) => setSelectedCorretorId(v ? Number(v) : undefined)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Todos / minha carteira" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos os leads</SelectItem>
                    {(corretores as any[]).map((c: any) => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div>
            <h2 className="font-semibold mb-3">Filtros de leads</h2>

            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Status no CRM</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {STATUS_OPTIONS.map((opt) => (
                    <label key={opt.value} className="flex items-center gap-1.5 cursor-pointer">
                      <Checkbox
                        checked={filtros.status.includes(opt.value)}
                        onCheckedChange={() => toggleMulti("status", opt.value)}
                      />
                      <span className="text-sm">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium">Temperatura</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {TEMPERATURA_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => toggleMulti("temperatura", opt.value)}
                      className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                        filtros.temperatura.includes(opt.value)
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background border-border hover:border-primary/50"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium">Faixa de Renda</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {FAIXA_RENDA_OPTIONS.map((opt) => (
                    <label key={opt.value} className="flex items-center gap-1.5 cursor-pointer">
                      <Checkbox
                        checked={filtros.faixaRenda.includes(opt.value)}
                        onCheckedChange={() => toggleMulti("faixaRenda", opt.value)}
                      />
                      <span className="text-sm">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {projetos && projetos.length > 0 && (
                <div>
                  <Label className="text-sm font-medium">Projetos</Label>
                  <div className="flex flex-wrap gap-2 mt-2 max-h-32 overflow-y-auto">
                    {projetos.map((p: any) => (
                      <label key={p.id} className="flex items-center gap-1.5 cursor-pointer">
                        <Checkbox
                          checked={filtros.projetoId.includes(p.id)}
                          onCheckedChange={() => toggleProjeto(p.id)}
                        />
                        <span className="text-sm">{p.nome}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <Label className="text-sm font-medium">Sem interação há (dias)</Label>
                <Input
                  type="number"
                  min={0}
                  value={filtros.semInteracaoHaDias ?? ""}
                  onChange={(e) => setFiltros((prev) => ({
                    ...prev,
                    semInteracaoHaDias: e.target.value ? Number(e.target.value) : undefined,
                  }))}
                  placeholder="Ex: 7"
                  className="mt-1 max-w-32"
                />
              </div>
            </div>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 flex items-center gap-3">
            <Users className="w-5 h-5 text-muted-foreground shrink-0" />
            {previewLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Calculando...
              </div>
            ) : preview ? (
              <div>
                <p className="text-sm font-medium">{preview.count} leads encontrados</p>
                {preview.sample.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Ex: {preview.sample.map((l: any) => l.nome).join(", ")}
                    {preview.count > 5 ? "..." : ""}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Defina os filtros para ver a contagem</p>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => navigate("/oferta-ativa")}>
              Cancelar
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!nome.trim() || createMutation.isPending}
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Criando...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Criar Lista
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

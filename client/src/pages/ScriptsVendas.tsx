import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Copy, Plus, Pencil, Trash2, Search, MessageSquare,
  Phone, Mail, BookOpen, ToggleLeft, ToggleRight,
  ChevronDown, ChevronUp, Flame, Thermometer, Snowflake,
  AlertCircle, Target, MessageCircle, Clock, Tag,
} from "lucide-react";

// ─── SCRIPTS DE VENDAS ───────────────────────────────────────────────────────

type Categoria =
  | "primeiro_contato" | "agendamento" | "pos_visita"
  | "objecao_preco" | "objecao_documentacao" | "objecao_credito"
  | "nao_compareceu" | "reativacao" | "fechamento" | "outro";

type Tipo = "whatsapp" | "telefone" | "email";

const CATEGORIA_LABELS: Record<Categoria, string> = {
  primeiro_contato: "Primeiro Contato",
  agendamento: "Agendamento",
  pos_visita: "Pós-visita",
  objecao_preco: "Objeção: Preço",
  objecao_documentacao: "Objeção: Documentação",
  objecao_credito: "Objeção: Crédito",
  nao_compareceu: "Não Compareceu",
  reativacao: "Reativação",
  fechamento: "Fechamento",
  outro: "Outro",
};

const TIPO_CONFIG: Record<Tipo, { label: string; color: string; icon: React.ReactNode }> = {
  whatsapp: { label: "WhatsApp", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400", icon: <MessageSquare className="h-3 w-3" /> },
  telefone: { label: "Telefone", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400", icon: <Phone className="h-3 w-3" /> },
  email: { label: "E-mail", color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400", icon: <Mail className="h-3 w-3" /> },
};

const CATEGORIAS = Object.keys(CATEGORIA_LABELS) as Categoria[];
const TIPOS = Object.keys(TIPO_CONFIG) as Tipo[];

type Script = {
  id: number;
  titulo: string;
  conteudo: string;
  categoria: Categoria;
  tipo: Tipo;
  ativo: boolean;
  ordem: number;
};

type FormData = {
  titulo: string;
  conteudo: string;
  categoria: Categoria;
  tipo: Tipo;
  ordem: number;
};

const FORM_EMPTY: FormData = {
  titulo: "",
  conteudo: "",
  categoria: "primeiro_contato",
  tipo: "whatsapp",
  ordem: 0,
};

// ─── OBJEÇÕES DO PLAYBOOK ─────────────────────────────────────────────────────

const FASES = [
  { slug: "fase_a", label: "A — Lead Novo / 1º Contato" },
  { slug: "fase_b", label: "B — Sem Resposta" },
  { slug: "fase_c", label: "C — Qualificação" },
  { slug: "fase_d", label: "D — Simulação e Crédito" },
  { slug: "fase_e", label: "E — Produto e Localização" },
  { slug: "fase_f", label: "F — Preço e Negociação" },
  { slug: "fase_g", label: "G — Agendamento de Visita" },
  { slug: "fase_h", label: "H — Confirmação de Visita" },
  { slug: "fase_i", label: "I — Pós-Visita" },
  { slug: "fase_j", label: "J — Documentação" },
  { slug: "fase_k", label: "K — Análise de Crédito" },
  { slug: "fase_l", label: "L — Fechamento" },
  { slug: "fase_m", label: "M — Recuperação" },
];

type Temperatura = "quente" | "morno" | "frio";

const TEMP_CONFIG: Record<Temperatura, { label: string; color: string; icon: React.ReactNode }> = {
  quente: { label: "Quente", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", icon: <Flame className="h-3 w-3" /> },
  morno: { label: "Morno", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", icon: <Thermometer className="h-3 w-3" /> },
  frio: { label: "Frio", color: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400", icon: <Snowflake className="h-3 w-3" /> },
};

type Objecao = {
  id: number;
  fase: string;
  faseSlug: string;
  situacao: string;
  frase: string;
  significado: string | null;
  tipoObjecao: string | null;
  temperatura: Temperatura | null;
  objetivo: string | null;
  respostaAcr: string | null;
  msgWhatsapp: string | null;
  canal: string | null;
  perguntaQualificacao: string | null;
  tagCrm: string | null;
  tempoResposta: string | null;
  prioridade: string | null;
  erroComum: string | null;
};

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────

export default function ScriptsVendas() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "superintendente";

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3">
          <BookOpen className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Scripts de Vendas</h1>
            <p className="text-sm text-muted-foreground">Abordagens prontas e playbook de objeções</p>
          </div>
        </div>

        <Tabs defaultValue="objecoes">
          <TabsList className="flex flex-wrap gap-0.5 h-auto bg-muted p-1 rounded-lg">
            <TabsTrigger value="objecoes" className="flex-1 min-w-[120px] text-xs">
              🛡️ Objeções do Playbook
            </TabsTrigger>
            <TabsTrigger value="scripts" className="flex-1 min-w-[100px] text-xs">
              📋 Scripts Prontos
            </TabsTrigger>
          </TabsList>

          {/* ABA: OBJEÇÕES DO PLAYBOOK */}
          <TabsContent value="objecoes" className="mt-4">
            <ObjecoesPlaybook />
          </TabsContent>

          {/* ABA: SCRIPTS PRONTOS */}
          <TabsContent value="scripts" className="mt-4">
            <ScriptsProntos isAdmin={isAdmin} />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

// ─── ABA OBJEÇÕES DO PLAYBOOK ─────────────────────────────────────────────────

function ObjecoesPlaybook() {
  const [faseFiltro, setFaseFiltro] = useState<string>("todas");
  const [tempFiltro, setTempFiltro] = useState<string>("todas");
  const [busca, setBusca] = useState("");
  const [buscaDebounced, setBuscaDebounced] = useState("");
  const [expandido, setExpandido] = useState<number | null>(null);

  // Debounce simples
  const handleBusca = (v: string) => {
    setBusca(v);
    clearTimeout((window as any).__buscaTimer);
    (window as any).__buscaTimer = setTimeout(() => setBuscaDebounced(v), 350);
  };

  const { data: objecoes = [], isLoading } = trpc.scripts.listObjecoes.useQuery({
    faseSlug: faseFiltro === "todas" ? undefined : faseFiltro,
    temperatura: tempFiltro === "todas" ? undefined : tempFiltro as Temperatura,
    busca: buscaDebounced || undefined,
  });

  // Agrupar por fase
  const porFase: Record<string, Objecao[]> = {};
  for (const o of objecoes as Objecao[]) {
    if (!porFase[o.faseSlug]) porFase[o.faseSlug] = [];
    porFase[o.faseSlug].push(o);
  }

  const fasesParaExibir = faseFiltro === "todas"
    ? FASES.filter(f => porFase[f.slug]?.length > 0)
    : FASES.filter(f => f.slug === faseFiltro);

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por frase, situação ou mensagem..."
            className="pl-9"
            value={busca}
            onChange={(e) => handleBusca(e.target.value)}
          />
        </div>
        <Select value={faseFiltro} onValueChange={setFaseFiltro}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Fase do funil" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as fases</SelectItem>
            {FASES.map(f => (
              <SelectItem key={f.slug} value={f.slug}>{f.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={tempFiltro} onValueChange={setTempFiltro}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Temperatura" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas</SelectItem>
            <SelectItem value="quente">🔥 Quente</SelectItem>
            <SelectItem value="morno">🌡️ Morno</SelectItem>
            <SelectItem value="frio">❄️ Frio</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Contagem */}
      {!isLoading && (
        <p className="text-xs text-muted-foreground">
          {(objecoes as Objecao[]).length} situações encontradas
        </p>
      )}

      {isLoading && (
        <div className="text-center py-10 text-muted-foreground">
          <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2" />
          Carregando objeções...
        </div>
      )}

      {/* Objeções por fase */}
      {fasesParaExibir.map(fase => {
        const lista = porFase[fase.slug] || [];
        if (!lista.length) return null;
        return (
          <div key={fase.slug}>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-2">
              <span className="text-primary">{fase.label}</span>
              <Badge variant="secondary" className="text-xs">{lista.length}</Badge>
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {lista.map(obj => (
                <ObjecaoCard
                  key={obj.id}
                  objecao={obj}
                  expandido={expandido === obj.id}
                  onToggle={() => setExpandido(expandido === obj.id ? null : obj.id)}
                />
              ))}
            </div>
          </div>
        );
      })}

      {!isLoading && (objecoes as Objecao[]).length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Nenhuma objeção encontrada</p>
          <p className="text-sm">Tente ajustar os filtros</p>
        </div>
      )}
    </div>
  );
}

function ObjecaoCard({ objecao, expandido, onToggle }: {
  objecao: Objecao;
  expandido: boolean;
  onToggle: () => void;
}) {
  const temp = objecao.temperatura ? TEMP_CONFIG[objecao.temperatura] : TEMP_CONFIG.morno;

  function copiar(texto: string) {
    navigator.clipboard.writeText(texto).then(() => {
      toast.success("Copiado!");
    }).catch(() => {
      toast.error("Não foi possível copiar.");
    });
  }

  return (
    <Card className="flex flex-col gap-0">
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground mb-1 truncate">{objecao.situacao}</p>
            <CardTitle className="text-sm font-semibold leading-snug">
              "{objecao.frase}"
            </CardTitle>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <Badge className={`gap-1 text-xs px-1.5 py-0 ${temp.color}`}>
              {temp.icon} {temp.label}
            </Badge>
            {objecao.prioridade && (
              <span className="text-xs text-muted-foreground">{objecao.prioridade}</span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 flex flex-col gap-3 flex-1">
        {/* Significado */}
        {objecao.significado && (
          <p className="text-xs text-muted-foreground italic leading-relaxed">
            {objecao.significado}
          </p>
        )}

        {/* Mensagem WhatsApp */}
        {objecao.msgWhatsapp && (
          <div className="bg-green-50 dark:bg-green-900/20 rounded-md p-3 space-y-1">
            <div className="flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-400">
              <MessageSquare className="h-3 w-3" />
              Mensagem WhatsApp
            </div>
            <p className="text-xs text-foreground leading-relaxed">
              {expandido ? objecao.msgWhatsapp : objecao.msgWhatsapp.slice(0, 120) + (objecao.msgWhatsapp.length > 120 ? "…" : "")}
            </p>
            <Button
              size="sm"
              variant="default"
              className="gap-1.5 w-full mt-1 h-7 text-xs"
              onClick={() => copiar(objecao.msgWhatsapp!)}
            >
              <Copy className="h-3 w-3" />
              Copiar mensagem
            </Button>
          </div>
        )}

        {/* Expandido: Resposta ACR + Objetivo + Erro */}
        {expandido && (
          <div className="space-y-3 border-t pt-3">
            {objecao.objetivo && (
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-xs font-medium text-primary">
                  <Target className="h-3 w-3" />
                  Objetivo do Corretor
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{objecao.objetivo}</p>
              </div>
            )}
            {objecao.respostaAcr && (
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-xs font-medium text-primary">
                  <MessageCircle className="h-3 w-3" />
                  Resposta Estruturada (ACR)
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">{objecao.respostaAcr}</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 w-full h-7 text-xs"
                  onClick={() => copiar(objecao.respostaAcr!)}
                >
                  <Copy className="h-3 w-3" />
                  Copiar resposta ACR
                </Button>
              </div>
            )}
            {objecao.perguntaQualificacao && (
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-xs font-medium text-primary">
                  <MessageCircle className="h-3 w-3" />
                  Pergunta de Avanço
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{objecao.perguntaQualificacao}</p>
              </div>
            )}
            {objecao.erroComum && (
              <div className="bg-red-50 dark:bg-red-900/20 rounded-md p-2 space-y-1">
                <div className="flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400">
                  <AlertCircle className="h-3 w-3" />
                  Erro a Evitar
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{objecao.erroComum}</p>
              </div>
            )}
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              {objecao.tagCrm && (
                <span className="flex items-center gap-1">
                  <Tag className="h-3 w-3" />
                  {objecao.tagCrm}
                </span>
              )}
              {objecao.tempoResposta && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {objecao.tempoResposta}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Botão expandir */}
        <Button
          size="sm"
          variant="ghost"
          className="gap-1.5 w-full h-7 text-xs text-muted-foreground"
          onClick={onToggle}
        >
          {expandido ? (
            <><ChevronUp className="h-3 w-3" /> Ver menos</>
          ) : (
            <><ChevronDown className="h-3 w-3" /> Ver resposta completa</>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── ABA SCRIPTS PRONTOS ──────────────────────────────────────────────────────

function ScriptsProntos({ isAdmin }: { isAdmin: boolean }) {
  const [busca, setBusca] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState<Categoria | "todas">("todas");
  const [tipoFiltro, setTipoFiltro] = useState<Tipo | "todos">("todos");
  const [incluirInativos, setIncluirInativos] = useState(false);

  const [dialogAberto, setDialogAberto] = useState(false);
  const [editando, setEditando] = useState<Script | null>(null);
  const [form, setForm] = useState<FormData>(FORM_EMPTY);

  const { data: scripts = [], refetch } = trpc.scripts.list.useQuery({
    categoria: categoriaFiltro === "todas" ? undefined : categoriaFiltro,
    tipo: tipoFiltro === "todos" ? undefined : tipoFiltro,
    incluirInativos: isAdmin ? incluirInativos : false,
  });

  const createMutation = trpc.scripts.create.useMutation({
    onSuccess: () => { toast.success("Script criado com sucesso!"); refetch(); fecharDialog(); },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.scripts.update.useMutation({
    onSuccess: () => { toast.success("Script atualizado!"); refetch(); fecharDialog(); },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.scripts.delete.useMutation({
    onSuccess: () => { toast.success("Script removido."); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const toggleAtivoMutation = trpc.scripts.update.useMutation({
    onSuccess: () => refetch(),
    onError: (e) => toast.error(e.message),
  });

  function abrirCriar() {
    setEditando(null);
    setForm(FORM_EMPTY);
    setDialogAberto(true);
  }

  function abrirEditar(script: Script) {
    setEditando(script);
    setForm({
      titulo: script.titulo,
      conteudo: script.conteudo,
      categoria: script.categoria,
      tipo: script.tipo,
      ordem: script.ordem,
    });
    setDialogAberto(true);
  }

  function fecharDialog() {
    setDialogAberto(false);
    setEditando(null);
    setForm(FORM_EMPTY);
  }

  function salvar() {
    if (!form.titulo.trim() || !form.conteudo.trim()) {
      toast.error("Título e conteúdo são obrigatórios");
      return;
    }
    if (editando) {
      updateMutation.mutate({ id: editando.id, ...form });
    } else {
      createMutation.mutate(form);
    }
  }

  function confirmarDelete(script: Script) {
    if (!window.confirm(`Remover o script "${script.titulo}"?`)) return;
    deleteMutation.mutate({ id: script.id });
  }

  function copiar(conteudo: string) {
    navigator.clipboard.writeText(conteudo).then(() => {
      toast.success("Copiado para a área de transferência!");
    }).catch(() => {
      toast.error("Não foi possível copiar. Selecione e copie manualmente.");
    });
  }

  function toggleAtivo(script: Script) {
    toggleAtivoMutation.mutate({ id: script.id, ativo: !script.ativo });
  }

  const scriptsFiltrados = scripts.filter((s: Script) => {
    if (!busca) return true;
    const q = busca.toLowerCase();
    return s.titulo.toLowerCase().includes(q) || s.conteudo.toLowerCase().includes(q);
  });

  const categoriasSemFiltro = categoriaFiltro === "todas"
    ? CATEGORIAS
    : [categoriaFiltro];

  return (
    <>
      <div className="space-y-4">
        {/* Filtros */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar scripts..."
              className="pl-9"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
          <Select value={categoriaFiltro} onValueChange={(v) => setCategoriaFiltro(v as Categoria | "todas")}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as categorias</SelectItem>
              {CATEGORIAS.map((c) => (
                <SelectItem key={c} value={c}>{CATEGORIA_LABELS[c]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={tipoFiltro} onValueChange={(v) => setTipoFiltro(v as Tipo | "todos")}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os tipos</SelectItem>
              {TIPOS.map((t) => (
                <SelectItem key={t} value={t}>{TIPO_CONFIG[t].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIncluirInativos(!incluirInativos)}
              className="gap-2"
            >
              {incluirInativos ? <ToggleRight className="h-4 w-4 text-primary" /> : <ToggleLeft className="h-4 w-4" />}
              {incluirInativos ? "Mostrando inativos" : "Ocultar inativos"}
            </Button>
          )}
          {isAdmin && (
            <Button onClick={abrirCriar} className="gap-2">
              <Plus className="h-4 w-4" />
              Novo Script
            </Button>
          )}
        </div>

        {/* Scripts por categoria */}
        {categoriasSemFiltro.map((cat) => {
          const lista = scriptsFiltrados.filter((s: Script) => s.categoria === cat);
          if (!lista.length) return null;
          return (
            <div key={cat}>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                {CATEGORIA_LABELS[cat]}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {lista.map((script: Script) => (
                  <ScriptCard
                    key={script.id}
                    script={script}
                    isAdmin={isAdmin}
                    onCopiar={copiar}
                    onEditar={abrirEditar}
                    onDeletar={confirmarDelete}
                    onToggleAtivo={toggleAtivo}
                  />
                ))}
              </div>
            </div>
          );
        })}

        {scriptsFiltrados.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Nenhum script encontrado</p>
            {isAdmin && (
              <Button variant="link" onClick={abrirCriar} className="mt-2">
                Criar o primeiro script
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Dialog criar/editar */}
      <Dialog open={dialogAberto} onOpenChange={(o) => { if (!o) fecharDialog(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar Script" : "Novo Script"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">Título</label>
              <Input
                placeholder="Ex: Primeiro contato — lead novo"
                value={form.titulo}
                onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
                maxLength={150}
              />
            </div>
            <div className="flex gap-3">
              <div className="flex-1 space-y-1">
                <label className="text-sm font-medium">Categoria</label>
                <Select value={form.categoria} onValueChange={(v) => setForm((f) => ({ ...f, categoria: v as Categoria }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS.map((c) => (
                      <SelectItem key={c} value={c}>{CATEGORIA_LABELS[c]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 space-y-1">
                <label className="text-sm font-medium">Canal</label>
                <Select value={form.tipo} onValueChange={(v) => setForm((f) => ({ ...f, tipo: v as Tipo }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS.map((t) => (
                      <SelectItem key={t} value={t}>{TIPO_CONFIG[t].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-24 space-y-1">
                <label className="text-sm font-medium">Ordem</label>
                <Input
                  type="number"
                  min={0}
                  value={form.ordem}
                  onChange={(e) => setForm((f) => ({ ...f, ordem: Number(e.target.value) }))}
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Conteúdo</label>
              <Textarea
                placeholder="Digite o texto do script aqui..."
                value={form.conteudo}
                onChange={(e) => setForm((f) => ({ ...f, conteudo: e.target.value }))}
                rows={8}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Use [NOME], [PROJETO], [DATA] como variáveis que serão substituídas no uso.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={fecharDialog}>Cancelar</Button>
            <Button
              onClick={salvar}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {editando ? "Salvar alterações" : "Criar script"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ScriptCard({
  script, isAdmin, onCopiar, onEditar, onDeletar, onToggleAtivo,
}: {
  script: Script;
  isAdmin: boolean;
  onCopiar: (c: string) => void;
  onEditar: (s: Script) => void;
  onDeletar: (s: Script) => void;
  onToggleAtivo: (s: Script) => void;
}) {
  const [expandido, setExpandido] = useState(false);
  const tipo = TIPO_CONFIG[script.tipo];
  const preview = script.conteudo.length > 120 ? script.conteudo.slice(0, 120) + "…" : script.conteudo;

  return (
    <Card className={`relative flex flex-col gap-0 ${!script.ativo ? "opacity-50" : ""}`}>
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm font-semibold leading-snug">{script.titulo}</CardTitle>
          <Badge className={`shrink-0 gap-1 text-xs px-1.5 py-0 ${tipo.color}`}>
            {tipo.icon} {tipo.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 flex flex-col gap-3 flex-1">
        <p
          className="text-xs text-muted-foreground whitespace-pre-wrap cursor-pointer"
          onClick={() => setExpandido(!expandido)}
        >
          {expandido ? script.conteudo : preview}
          {script.conteudo.length > 120 && (
            <span className="text-primary ml-1">{expandido ? " ver menos" : " ver mais"}</span>
          )}
        </p>
        <div className="flex gap-2 mt-auto flex-wrap">
          <Button
            size="sm"
            variant="default"
            className="gap-1.5 flex-1"
            onClick={() => onCopiar(script.conteudo)}
          >
            <Copy className="h-3.5 w-3.5" />
            Copiar
          </Button>
          {isAdmin && (
            <>
              <Button size="sm" variant="outline" className="gap-1" onClick={() => onEditar(script)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1"
                onClick={() => onToggleAtivo(script)}
                title={script.ativo ? "Desativar" : "Ativar"}
              >
                {script.ativo ? <ToggleRight className="h-3.5 w-3.5 text-primary" /> : <ToggleLeft className="h-3.5 w-3.5" />}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1 text-destructive hover:text-destructive"
                onClick={() => onDeletar(script)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

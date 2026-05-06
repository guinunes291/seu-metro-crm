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
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Copy, Plus, Pencil, Trash2, Search, MessageSquare,
  Phone, Mail, BookOpen, ToggleLeft, ToggleRight,
} from "lucide-react";

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

export default function ScriptsVendas() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "superintendente";

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
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <BookOpen className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Scripts de Vendas</h1>
              <p className="text-sm text-muted-foreground">Abordagens prontas para cada situação</p>
            </div>
          </div>
          {isAdmin && (
            <Button onClick={abrirCriar} className="gap-2">
              <Plus className="h-4 w-4" />
              Novo Script
            </Button>
          )}
        </div>

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
    </DashboardLayout>
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

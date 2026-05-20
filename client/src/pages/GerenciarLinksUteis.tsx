import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Link2, Plus, Pencil, Trash2, Eye, EyeOff, Loader2, BarChart2 } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { toast } from "sonner";

type LinkForm = {
  titulo: string;
  descricao: string;
  url: string;
  categoria: string;
  status: "ativo" | "inativo";
};

const EMPTY_FORM: LinkForm = { titulo: "", descricao: "", url: "", categoria: "", status: "ativo" };

function formatDataHora(date: Date | string) {
  return new Date(date).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function GerenciarLinksUteis() {
  const { user } = useAuth();
  const utils = trpc.useUtils();

  const isGestor =
    user?.role === "gestor" || user?.role === "admin" || user?.role === "superintendente";

  const { data: links, isLoading } = trpc.linksUteis.adminList.useQuery(undefined, {
    enabled: isGestor,
  });
  const { data: relatorio, isLoading: relatorioLoading } = trpc.linksUteis.relatorioAcessos.useQuery(undefined, {
    enabled: isGestor,
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<NonNullable<typeof links>[number] | null>(null);
  const [form, setForm] = useState<LinkForm>(EMPTY_FORM);
  const [editForm, setEditForm] = useState<LinkForm>(EMPTY_FORM);

  const createMutation = trpc.linksUteis.create.useMutation({
    onSuccess: () => {
      utils.linksUteis.adminList.invalidate();
      setCreateOpen(false);
      setForm(EMPTY_FORM);
      toast.success("Link criado com sucesso");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.linksUteis.update.useMutation({
    onSuccess: () => {
      utils.linksUteis.adminList.invalidate();
      setEditingLink(null);
      toast.success("Link atualizado");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.linksUteis.delete.useMutation({
    onSuccess: () => {
      utils.linksUteis.adminList.invalidate();
      toast.success("Link excluído");
    },
    onError: (e) => toast.error(e.message),
  });

  function openEdit(link: NonNullable<typeof links>[number]) {
    setEditingLink(link);
    setEditForm({
      titulo: link.titulo,
      descricao: link.descricao ?? "",
      url: link.url,
      categoria: link.categoria,
      status: link.status,
    });
  }

  function handleCreate() {
    if (!form.titulo.trim() || !form.url.trim() || !form.categoria.trim()) {
      toast.error("Título, URL e categoria são obrigatórios");
      return;
    }
    createMutation.mutate({ ...form, descricao: form.descricao || undefined });
  }

  function handleUpdate() {
    if (!editingLink) return;
    updateMutation.mutate({
      id: editingLink.id,
      ...editForm,
      descricao: editForm.descricao || undefined,
    });
  }

  function toggleStatus(link: NonNullable<typeof links>[number]) {
    updateMutation.mutate({
      id: link.id,
      status: link.status === "ativo" ? "inativo" : "ativo",
    });
  }

  if (!isGestor) {
    return (
      <DashboardLayout>
        <div className="text-center py-20 text-muted-foreground">Acesso restrito a gestores.</div>
      </DashboardLayout>
    );
  }

  const categorias = links
    ? [...new Set(links.map((l) => l.categoria))].sort()
    : [];

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Link2 className="w-6 h-6 text-primary" />
              Gerenciar Links Úteis
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {links?.length ?? 0} links cadastrados
            </p>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Novo Link
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar novo link</DialogTitle>
              </DialogHeader>
              <LinkForm form={form} setForm={setForm} categoriasSugeridas={categorias} />
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
                <Button onClick={handleCreate} disabled={createMutation.isPending}>
                  {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Criar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs defaultValue="links">
          <TabsList>
            <TabsTrigger value="links">
              <Link2 className="w-4 h-4 mr-2" />
              Links ({links?.length ?? 0})
            </TabsTrigger>
            <TabsTrigger value="relatorio">
              <BarChart2 className="w-4 h-4 mr-2" />
              Relatório de Acessos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="links" className="mt-4">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : !links || links.length === 0 ? (
              <div className="text-center py-16 border border-dashed rounded-xl">
                <Link2 className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-muted-foreground font-medium">Nenhum link cadastrado</p>
                <p className="text-sm text-muted-foreground">Clique em "Novo Link" para começar.</p>
              </div>
            ) : (
              <div className="border rounded-xl overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Título</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>URL</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {links.map((link) => (
                      <TableRow key={link.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{link.titulo}</p>
                            {link.descricao && (
                              <p className="text-xs text-muted-foreground line-clamp-1">{link.descricao}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{link.categoria}</Badge>
                        </TableCell>
                        <TableCell className="max-w-[200px]">
                          <p className="text-xs text-muted-foreground truncate">{link.url}</p>
                        </TableCell>
                        <TableCell>
                          <Badge variant={link.status === "ativo" ? "default" : "secondary"}>
                            {link.status === "ativo" ? "Ativo" : "Inativo"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              title={link.status === "ativo" ? "Desativar" : "Ativar"}
                              onClick={() => toggleStatus(link)}
                            >
                              {link.status === "ativo" ? (
                                <EyeOff className="w-4 h-4" />
                              ) : (
                                <Eye className="w-4 h-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Editar"
                              onClick={() => openEdit(link)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Excluir"
                              className="text-destructive hover:text-destructive"
                              onClick={() => {
                                if (confirm(`Excluir "${link.titulo}"?`)) {
                                  deleteMutation.mutate({ id: link.id });
                                }
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="relatorio" className="mt-4">
            {relatorioLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : !relatorio || relatorio.length === 0 ? (
              <div className="text-center py-16 border border-dashed rounded-xl">
                <BarChart2 className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-muted-foreground font-medium">Nenhum acesso registrado ainda</p>
              </div>
            ) : (
              <div className="border rounded-xl overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Corretor</TableHead>
                      <TableHead>Link</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Data / Hora</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {relatorio.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium text-sm">
                          {row.corretorNome ?? "—"}
                        </TableCell>
                        <TableCell className="text-sm">{row.linkTitulo ?? "—"}</TableCell>
                        <TableCell>
                          {row.linkCategoria ? (
                            <Badge variant="outline" className="text-xs">{row.linkCategoria}</Badge>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDataHora(row.createdAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="px-4 py-2 border-t text-xs text-muted-foreground">
                  Exibindo os últimos {relatorio.length} acessos
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Dialog de edição */}
        <Dialog open={!!editingLink} onOpenChange={(open) => !open && setEditingLink(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar link</DialogTitle>
            </DialogHeader>
            <LinkForm form={editForm} setForm={setEditForm} categoriasSugeridas={categorias} />
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingLink(null)}>Cancelar</Button>
              <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
                {updateMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

function LinkForm({
  form,
  setForm,
  categoriasSugeridas,
}: {
  form: LinkForm;
  setForm: React.Dispatch<React.SetStateAction<LinkForm>>;
  categoriasSugeridas: string[];
}) {
  return (
    <div className="space-y-4 py-2">
      <div>
        <Label>Título *</Label>
        <Input
          value={form.titulo}
          onChange={(e) => setForm((p) => ({ ...p, titulo: e.target.value }))}
          placeholder="Ex: Grupo Construtora Vibra"
          className="mt-1"
        />
      </div>
      <div>
        <Label>Descrição curta</Label>
        <Input
          value={form.descricao}
          onChange={(e) => setForm((p) => ({ ...p, descricao: e.target.value }))}
          placeholder="Breve descrição do link..."
          className="mt-1"
          maxLength={500}
        />
      </div>
      <div>
        <Label>URL *</Label>
        <Input
          value={form.url}
          onChange={(e) => setForm((p) => ({ ...p, url: e.target.value }))}
          placeholder="https://..."
          className="mt-1"
          type="url"
        />
      </div>
      <div>
        <Label>Categoria *</Label>
        <Input
          value={form.categoria}
          onChange={(e) => setForm((p) => ({ ...p, categoria: e.target.value }))}
          placeholder="Ex: WhatsApp, Tabelões, Portais..."
          className="mt-1"
          list="categorias-list"
        />
        {categoriasSugeridas.length > 0 && (
          <datalist id="categorias-list">
            {categoriasSugeridas.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        )}
        <p className="text-xs text-muted-foreground mt-1">
          Digite uma categoria existente ou crie uma nova.
        </p>
      </div>
      <div>
        <Label>Status</Label>
        <Select
          value={form.status}
          onValueChange={(v) => setForm((p) => ({ ...p, status: v as "ativo" | "inativo" }))}
        >
          <SelectTrigger className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ativo">Ativo</SelectItem>
            <SelectItem value="inativo">Inativo</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

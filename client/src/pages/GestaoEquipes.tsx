import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Users, Plus, Edit, Trash2, UserPlus, UserMinus, Crown, Shield } from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/_core/hooks/useAuth";

export default function GestaoEquipes() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [dialogAberto, setDialogAberto] = useState(false);
  const [equipeEditando, setEquipeEditando] = useState<number | null>(null);
  const [dialogCorretoresAberto, setDialogCorretoresAberto] = useState(false);
  const [equipeCorretores, setEquipeCorretores] = useState<number | null>(null);
  const [dialogSuperAberto, setDialogSuperAberto] = useState(false);
  const [equipeParaSuper, setEquipeParaSuper] = useState<number | null>(null);
  const [superSelecionado, setSuperSelecionado] = useState<string>("none");

  const utils = trpc.useUtils();
  const { data: equipes, isLoading, refetch } = trpc.equipes.list.useQuery();
  const { data: usuarios, isLoading: isLoadingUsuarios } = trpc.equipes.listUsuariosParaGestor.useQuery(undefined, {
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });
  const { data: superintendentes } = trpc.equipes.listSuperintendentes.useQuery(undefined, {
    enabled: isAdmin,
  });
  const { data: corretoresDaEquipe } = trpc.equipes.getCorretores.useQuery(
    { equipeId: equipeCorretores! },
    { enabled: !!equipeCorretores }
  );

  const criarEquipe = trpc.equipes.create.useMutation({
    onSuccess: () => {
      toast.success("Equipe criada com sucesso!");
      refetch();
      setDialogAberto(false);
    },
    onError: (error) => {
      toast.error(`Erro ao criar equipe: ${error.message}`);
    },
  });

  const atualizarEquipe = trpc.equipes.update.useMutation({
    onSuccess: () => {
      toast.success("Equipe atualizada com sucesso!");
      refetch();
      setDialogAberto(false);
      setEquipeEditando(null);
    },
    onError: (error) => {
      toast.error(`Erro ao atualizar equipe: ${error.message}`);
    },
  });

  const deletarEquipe = trpc.equipes.delete.useMutation({
    onSuccess: () => {
      toast.success("Equipe desativada com sucesso!");
      refetch();
    },
    onError: (error) => {
      toast.error(`Erro ao desativar equipe: ${error.message}`);
    },
  });

  const adicionarCorretor = trpc.equipes.adicionarCorretor.useMutation({
    onSuccess: () => {
      toast.success("Corretor adicionado à equipe!");
      utils.equipes.list.invalidate();
      utils.equipes.listUsuariosParaGestor.invalidate();
      utils.equipes.getCorretores.invalidate();
    },
    onError: (error) => {
      toast.error(`Erro ao adicionar corretor: ${error.message}`);
    },
  });

  const removerCorretor = trpc.equipes.removerCorretor.useMutation({
    onSuccess: () => {
      toast.success("Corretor removido da equipe!");
      utils.equipes.list.invalidate();
      utils.equipes.listUsuariosParaGestor.invalidate();
      utils.equipes.getCorretores.invalidate();
    },
    onError: (error) => {
      toast.error(`Erro ao remover corretor: ${error.message}`);
    },
  });

  const atribuirSuperintendente = trpc.equipes.atribuirSuperintendente.useMutation({
    onSuccess: () => {
      toast.success("Superintendente atribuído com sucesso!");
      refetch();
      setDialogSuperAberto(false);
      setEquipeParaSuper(null);
      setSuperSelecionado("none");
    },
    onError: (error) => {
      toast.error(`Erro ao atribuir superintendente: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      nome: formData.get("nome") as string,
      descricao: formData.get("descricao") as string,
      gestorId: parseInt(formData.get("gestorId") as string),
      cor: formData.get("cor") as string,
      metaMensal: parseInt(formData.get("metaMensal") as string),
    };
    if (equipeEditando) {
      atualizarEquipe.mutate({ id: equipeEditando, ...data });
    } else {
      criarEquipe.mutate(data);
    }
  };

  const handleAtribuirSuper = () => {
    if (!equipeParaSuper) return;
    atribuirSuperintendente.mutate({
      equipeId: equipeParaSuper,
      superintendenteId: superSelecionado === "none" ? null : parseInt(superSelecionado),
    });
  };

  const gestores = usuarios || [];
  const corretoresSemEquipe = usuarios?.filter(u => u.role === "corretor" && !u.equipeId);

  // Agrupar equipes por superintendente (apenas para admin)
  const equipesAgrupadas = isAdmin && superintendentes
    ? {
        semSuperintendente: equipes?.filter(e => !e.superintendenteId) || [],
        porSuperintendente: superintendentes.map(s => ({
          superintendente: s,
          equipes: equipes?.filter(e => e.superintendenteId === s.id) || [],
        })),
      }
    : null;

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="p-6">Carregando equipes...</div>
      </DashboardLayout>
    );
  }

  const renderEquipeCard = (equipe: NonNullable<typeof equipes>[0]) => {
    const superDoEquipe = superintendentes?.find(s => s.id === equipe.superintendenteId);
    return (
      <Card key={equipe.id} className="relative">
        <div
          className="absolute top-0 left-0 right-0 h-2 rounded-t-lg"
          style={{ backgroundColor: equipe.cor }}
        />
        <CardHeader className="pt-6">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                {equipe.nome}
                {!equipe.ativa && <Badge variant="secondary">Inativa</Badge>}
              </CardTitle>
              <CardDescription className="mt-1 space-y-0.5">
                <div>Gestor: {equipe.gestorNome}</div>
                {superDoEquipe && (
                  <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                    <Crown className="h-3 w-3" />
                    <span>Super: {superDoEquipe.name}</span>
                  </div>
                )}
              </CardDescription>
            </div>
            <div className="flex gap-1">
              {isAdmin && (
                <Button
                  variant="ghost"
                  size="icon"
                  title="Atribuir Superintendente"
                  onClick={() => {
                    setEquipeParaSuper(equipe.id);
                    setSuperSelecionado(equipe.superintendenteId?.toString() ?? "none");
                    setDialogSuperAberto(true);
                  }}
                >
                  <Crown className="h-4 w-4 text-amber-500" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setEquipeEditando(equipe.id);
                  setDialogAberto(true);
                }}
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  if (confirm("Deseja realmente desativar esta equipe?")) {
                    deletarEquipe.mutate({ id: equipe.id });
                  }
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {equipe.descricao && (
            <p className="text-sm text-muted-foreground mb-4">{equipe.descricao}</p>
          )}
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Meta Mensal:</span>
              <span className="font-medium">{equipe.metaMensal} vendas</span>
            </div>
          </div>
          <Button
            variant="outline"
            className="w-full mt-4"
            onClick={() => {
              setEquipeCorretores(equipe.id);
              setDialogCorretoresAberto(true);
            }}
          >
            <Users className="mr-2 h-4 w-4" />
            Gerenciar Corretores
          </Button>
        </CardContent>
      </Card>
    );
  };

  return (
    <DashboardLayout>
      <div className="container py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Gestão de Equipes</h1>
            <p className="text-muted-foreground">
              {isAdmin
                ? "Gerencie equipes, gestores e atribua superintendentes"
                : "Equipes sob sua supervisão"}
            </p>
          </div>
          {isAdmin && (
            <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
              <DialogTrigger asChild>
                <Button onClick={() => setEquipeEditando(null)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Nova Equipe
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{equipeEditando ? "Editar Equipe" : "Nova Equipe"}</DialogTitle>
                  <DialogDescription>
                    Preencha os dados da equipe e atribua um gestor responsável
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="nome">Nome da Equipe</Label>
                    <Input
                      id="nome"
                      name="nome"
                      placeholder="Ex: Equipe Alpha"
                      required
                      defaultValue={equipeEditando ? equipes?.find(e => e.id === equipeEditando)?.nome : ""}
                    />
                  </div>
                  <div>
                    <Label htmlFor="descricao">Descrição</Label>
                    <Textarea
                      id="descricao"
                      name="descricao"
                      placeholder="Descrição da equipe..."
                      defaultValue={equipeEditando ? equipes?.find(e => e.id === equipeEditando)?.descricao || "" : ""}
                    />
                  </div>
                  <div>
                    <Label htmlFor="gestorId">Gestor Responsável</Label>
                    <Select name="gestorId" required defaultValue={equipeEditando ? equipes?.find(e => e.id === equipeEditando)?.gestorId.toString() : ""}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um gestor" />
                      </SelectTrigger>
                      <SelectContent>
                        {gestores && gestores.length > 0 ? (
                          gestores.map(gestor => (
                            <SelectItem key={gestor.id} value={gestor.id.toString()}>
                              {gestor.name} ({gestor.role})
                            </SelectItem>
                          ))
                        ) : (
                          <div className="p-2 text-sm text-muted-foreground">Nenhum usuário disponível</div>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="cor">Cor da Equipe</Label>
                      <Input
                        id="cor"
                        name="cor"
                        type="color"
                        defaultValue={equipeEditando ? equipes?.find(e => e.id === equipeEditando)?.cor : "#3b82f6"}
                      />
                    </div>
                    <div>
                      <Label htmlFor="metaMensal">Meta Mensal</Label>
                      <Input
                        id="metaMensal"
                        name="metaMensal"
                        type="number"
                        min="1"
                        defaultValue={equipeEditando ? equipes?.find(e => e.id === equipeEditando)?.metaMensal : 10}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => { setDialogAberto(false); setEquipeEditando(null); }}>
                      Cancelar
                    </Button>
                    <Button type="submit">
                      {equipeEditando ? "Atualizar" : "Criar"} Equipe
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Visão agrupada por superintendente (apenas admin) */}
        {isAdmin && equipesAgrupadas ? (
          <div className="space-y-8">
            {/* Equipes com superintendente */}
            {equipesAgrupadas.porSuperintendente.map(({ superintendente, equipes: eqs }) => (
              <div key={superintendente.id}>
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="h-5 w-5 text-amber-500" />
                  <h2 className="text-lg font-semibold">{superintendente.name}</h2>
                  <Badge variant="outline" className="text-amber-600 border-amber-400">Superintendente</Badge>
                  <span className="text-sm text-muted-foreground">({eqs.length} equipe{eqs.length !== 1 ? "s" : ""})</span>
                </div>
                {eqs.length === 0 ? (
                  <p className="text-sm text-muted-foreground pl-7">Nenhuma equipe atribuída</p>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {eqs.map(renderEquipeCard)}
                  </div>
                )}
              </div>
            ))}

            {/* Equipes sem superintendente */}
            {equipesAgrupadas.semSuperintendente.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Users className="h-5 w-5 text-muted-foreground" />
                  <h2 className="text-lg font-semibold text-muted-foreground">Sem Superintendente</h2>
                  <span className="text-sm text-muted-foreground">({equipesAgrupadas.semSuperintendente.length} equipe{equipesAgrupadas.semSuperintendente.length !== 1 ? "s" : ""})</span>
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {equipesAgrupadas.semSuperintendente.map(renderEquipeCard)}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Visão plana para superintendente/gestor */
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {equipes?.map(renderEquipeCard)}
          </div>
        )}

        {/* Dialog de Atribuição de Superintendente */}
        <Dialog open={dialogSuperAberto} onOpenChange={setDialogSuperAberto}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-amber-500" />
                Atribuir Superintendente
              </DialogTitle>
              <DialogDescription>
                Selecione o superintendente responsável por esta equipe.
                O superintendente verá apenas as equipes atribuídas a ele.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Equipe</Label>
                <p className="text-sm font-medium mt-1">
                  {equipes?.find(e => e.id === equipeParaSuper)?.nome}
                </p>
              </div>
              <div>
                <Label>Superintendente</Label>
                <Select value={superSelecionado} onValueChange={setSuperSelecionado}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione um superintendente" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Sem superintendente —</SelectItem>
                    {superintendentes?.map(s => (
                      <SelectItem key={s.id} value={s.id.toString()}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {(!superintendentes || superintendentes.length === 0) && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Nenhum superintendente cadastrado. Promova um usuário para o cargo de Superintendente primeiro.
                  </p>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDialogSuperAberto(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleAtribuirSuper} disabled={atribuirSuperintendente.isPending}>
                  {atribuirSuperintendente.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialog de Gerenciamento de Corretores */}
        <Dialog open={dialogCorretoresAberto} onOpenChange={setDialogCorretoresAberto}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Corretores da Equipe</DialogTitle>
              <DialogDescription>
                Adicione ou remova corretores desta equipe
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <h3 className="font-medium mb-2">Corretores na Equipe</h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {corretoresDaEquipe && corretoresDaEquipe.length > 0 ? (
                    corretoresDaEquipe.map(corretor => (
                      <div key={corretor.id} className="flex items-center justify-between p-2 border rounded">
                        <span>{corretor.name}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removerCorretor.mutate({ corretorId: corretor.id })}
                        >
                          <UserMinus className="h-4 w-4" />
                        </Button>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">Nenhum corretor nesta equipe</p>
                  )}
                </div>
              </div>
              <div>
                <h3 className="font-medium mb-2">Adicionar Corretor</h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {corretoresSemEquipe && corretoresSemEquipe.length > 0 ? (
                    corretoresSemEquipe.map(corretor => (
                      <div key={corretor.id} className="flex items-center justify-between p-2 border rounded">
                        <span>{corretor.name}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => adicionarCorretor.mutate({
                            corretorId: corretor.id,
                            equipeId: equipeCorretores!
                          })}
                        >
                          <UserPlus className="h-4 w-4" />
                        </Button>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">Todos os corretores já estão em equipes</p>
                  )}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

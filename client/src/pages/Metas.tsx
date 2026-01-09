import { useState, useMemo } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { 
  Target, Users, Calendar, DollarSign, TrendingUp, Plus, Edit, Trash2,
  CheckCircle, AlertCircle, Trophy, Medal
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const MESES = [
  { value: 1, label: "Janeiro" },
  { value: 2, label: "Fevereiro" },
  { value: 3, label: "Março" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Maio" },
  { value: 6, label: "Junho" },
  { value: 7, label: "Julho" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Setembro" },
  { value: 10, label: "Outubro" },
  { value: 11, label: "Novembro" },
  { value: 12, label: "Dezembro" },
];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value / 100);
}

function getProgressColor(progress: number): string {
  if (progress >= 100) return "bg-green-500";
  if (progress >= 75) return "bg-blue-500";
  if (progress >= 50) return "bg-yellow-500";
  if (progress >= 25) return "bg-orange-500";
  return "bg-red-500";
}

function getProgressBadge(progress: number) {
  if (progress >= 100) {
    return <Badge className="bg-green-500 hover:bg-green-600"><Trophy className="h-3 w-3 mr-1" /> Meta Atingida!</Badge>;
  }
  if (progress >= 75) {
    return <Badge className="bg-blue-500 hover:bg-blue-600"><Medal className="h-3 w-3 mr-1" /> Quase lá!</Badge>;
  }
  if (progress >= 50) {
    return <Badge variant="secondary">Em progresso</Badge>;
  }
  return <Badge variant="outline">Iniciando</Badge>;
}

export default function Metas() {
  const { user } = useAuth();
  const isGestor = user?.role === "gestor" || user?.role === "admin";
  const utils = trpc.useUtils();
  
  // Estado para filtro de mês/ano
  const now = new Date();
  const [mesSelecionado, setMesSelecionado] = useState(now.getMonth() + 1);
  const [anoSelecionado, setAnoSelecionado] = useState(now.getFullYear());
  
  // Estado para modal de criação/edição
  const [modalAberto, setModalAberto] = useState(false);
  const [metaEditando, setMetaEditando] = useState<any>(null);
  const [corretorSelecionado, setCorretorSelecionado] = useState<number | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    metaLeads: 0,
    metaAgendamentos: 0,
    metaVisitas: 0,
    metaContratos: 0,
    metaVGV: 0,
    observacoes: "",
  });
  
  // Queries
  const { data: corretores } = trpc.corretores.list.useQuery();
  const { data: progressoTodos, isLoading } = trpc.metas.getProgressoTodos.useQuery(
    { mes: mesSelecionado, ano: anoSelecionado },
    { enabled: isGestor }
  );
  
  // Mutations
  const createMeta = trpc.metas.create.useMutation({
    onSuccess: () => {
      toast.success("Meta criada com sucesso!");
      utils.metas.getProgressoTodos.invalidate();
      fecharModal();
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao criar meta");
    },
  });
  
  const updateMeta = trpc.metas.update.useMutation({
    onSuccess: () => {
      toast.success("Meta atualizada com sucesso!");
      utils.metas.getProgressoTodos.invalidate();
      fecharModal();
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao atualizar meta");
    },
  });
  
  const deleteMeta = trpc.metas.delete.useMutation({
    onSuccess: () => {
      toast.success("Meta excluída com sucesso!");
      utils.metas.getProgressoTodos.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao excluir meta");
    },
  });
  
  // Anos disponíveis
  const anos = useMemo(() => {
    const anoAtual = new Date().getFullYear();
    return [anoAtual - 1, anoAtual, anoAtual + 1];
  }, []);
  
  // Funções auxiliares
  const abrirModalCriar = (corretorId: number) => {
    setCorretorSelecionado(corretorId);
    setMetaEditando(null);
    setFormData({
      metaLeads: 0,
      metaAgendamentos: 0,
      metaVisitas: 0,
      metaContratos: 0,
      metaVGV: 0,
      observacoes: "",
    });
    setModalAberto(true);
  };
  
  const abrirModalEditar = (meta: any) => {
    setCorretorSelecionado(meta.corretorId);
    setMetaEditando(meta);
    setFormData({
      metaLeads: meta.metaLeads || 0,
      metaAgendamentos: meta.metaAgendamentos || 0,
      metaVisitas: meta.metaVisitas || 0,
      metaContratos: meta.metaContratos || 0,
      metaVGV: meta.metaVGV || 0,
      observacoes: meta.observacoes || "",
    });
    setModalAberto(true);
  };
  
  const fecharModal = () => {
    setModalAberto(false);
    setMetaEditando(null);
    setCorretorSelecionado(null);
  };
  
  const salvarMeta = () => {
    if (!corretorSelecionado) return;
    
    if (metaEditando) {
      updateMeta.mutate({
        id: metaEditando.id,
        ...formData,
      });
    } else {
      createMeta.mutate({
        corretorId: corretorSelecionado,
        mes: mesSelecionado,
        ano: anoSelecionado,
        ...formData,
      });
    }
  };
  
  const excluirMeta = (metaId: number) => {
    if (confirm("Tem certeza que deseja excluir esta meta?")) {
      deleteMeta.mutate({ id: metaId });
    }
  };
  
  // Verificar permissão
  if (!isGestor) {
    return (
      <DashboardLayout>
        <div className="container py-8">
          <div className="text-center py-16">
            <AlertCircle className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-2xl font-bold mb-2">Acesso Restrito</h2>
            <p className="text-muted-foreground">
              Apenas gestores podem acessar o sistema de metas.
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }
  
  return (
    <DashboardLayout>
      <div className="container py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Target className="h-8 w-8" />
              Metas por Corretor
            </h1>
            <p className="text-muted-foreground mt-2">
              Defina e acompanhe as metas mensais de cada corretor
            </p>
          </div>
          
          {/* Filtro de mês/ano */}
          <div className="flex items-center gap-2">
            <Select 
              value={mesSelecionado.toString()} 
              onValueChange={(v) => setMesSelecionado(parseInt(v))}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Mês" />
              </SelectTrigger>
              <SelectContent>
                {MESES.map((mes) => (
                  <SelectItem key={mes.value} value={mes.value.toString()}>
                    {mes.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select 
              value={anoSelecionado.toString()} 
              onValueChange={(v) => setAnoSelecionado(parseInt(v))}
            >
              <SelectTrigger className="w-[100px]">
                <SelectValue placeholder="Ano" />
              </SelectTrigger>
              <SelectContent>
                {anos.map((ano) => (
                  <SelectItem key={ano} value={ano.toString()}>
                    {ano}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            Carregando metas...
          </div>
        ) : (
          <div className="space-y-6">
            {progressoTodos && progressoTodos.length > 0 ? (
              progressoTodos.map((item) => (
                <Card key={item.corretor.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Users className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{item.corretor.nome}</CardTitle>
                          <CardDescription>
                            {item.corretor.status === "presente" ? (
                              <Badge variant="default" className="bg-green-500">Presente</Badge>
                            ) : (
                              <Badge variant="secondary">Ausente</Badge>
                            )}
                          </CardDescription>
                        </div>
                      </div>
                      
                      {item.progresso ? (
                        <div className="flex items-center gap-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => abrirModalEditar(item.progresso?.meta)}
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            Editar
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="text-red-500 hover:text-red-600"
                            onClick={() => item.progresso?.meta.id && excluirMeta(item.progresso.meta.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => abrirModalCriar(item.corretor.id)}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Definir Meta
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    {item.progresso ? (
                      <div className="space-y-6">
                        {/* Grid de métricas */}
                        <div className="grid gap-4 md:grid-cols-5">
                          {/* Leads */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Leads</span>
                              <span className="font-medium">
                                {item.progresso.realizado.leads} / {item.progresso.meta.metaLeads}
                              </span>
                            </div>
                            <Progress 
                              value={Math.min(item.progresso.progresso.leads, 100)} 
                              className={`h-2 ${getProgressColor(item.progresso.progresso.leads)}`}
                            />
                            <div className="text-xs text-right text-muted-foreground">
                              {item.progresso.progresso.leads}%
                            </div>
                          </div>
                          
                          {/* Agendamentos */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Agendamentos</span>
                              <span className="font-medium">
                                {item.progresso.realizado.agendamentos} / {item.progresso.meta.metaAgendamentos}
                              </span>
                            </div>
                            <Progress 
                              value={Math.min(item.progresso.progresso.agendamentos, 100)} 
                              className={`h-2 ${getProgressColor(item.progresso.progresso.agendamentos)}`}
                            />
                            <div className="text-xs text-right text-muted-foreground">
                              {item.progresso.progresso.agendamentos}%
                            </div>
                          </div>
                          
                          {/* Visitas */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Visitas</span>
                              <span className="font-medium">
                                {item.progresso.realizado.visitas} / {item.progresso.meta.metaVisitas}
                              </span>
                            </div>
                            <Progress 
                              value={Math.min(item.progresso.progresso.visitas, 100)} 
                              className={`h-2 ${getProgressColor(item.progresso.progresso.visitas)}`}
                            />
                            <div className="text-xs text-right text-muted-foreground">
                              {item.progresso.progresso.visitas}%
                            </div>
                          </div>
                          
                          {/* Contratos */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Contratos</span>
                              <span className="font-medium">
                                {item.progresso.realizado.contratos} / {item.progresso.meta.metaContratos}
                              </span>
                            </div>
                            <Progress 
                              value={Math.min(item.progresso.progresso.contratos, 100)} 
                              className={`h-2 ${getProgressColor(item.progresso.progresso.contratos)}`}
                            />
                            <div className="text-xs text-right text-muted-foreground">
                              {item.progresso.progresso.contratos}%
                            </div>
                          </div>
                          
                          {/* VGV */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">VGV</span>
                              <span className="font-medium text-xs">
                                {formatCurrency(item.progresso.realizado.vgv)}
                              </span>
                            </div>
                            <Progress 
                              value={Math.min(item.progresso.progresso.vgv, 100)} 
                              className={`h-2 ${getProgressColor(item.progresso.progresso.vgv)}`}
                            />
                            <div className="text-xs text-right text-muted-foreground">
                              {item.progresso.progresso.vgv}% de {formatCurrency(item.progresso.meta.metaVGV)}
                            </div>
                          </div>
                        </div>
                        
                        {/* Badge de status geral */}
                        <div className="flex items-center justify-between pt-4 border-t">
                          <div className="text-sm text-muted-foreground">
                            {item.progresso.meta.observacoes && (
                              <span>Obs: {item.progresso.meta.observacoes}</span>
                            )}
                          </div>
                          {getProgressBadge(item.progresso.progressoGeral || 0)}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>Nenhuma meta definida para {MESES[mesSelecionado - 1].label} de {anoSelecionado}</p>
                        <Button 
                          variant="outline" 
                          className="mt-4"
                          onClick={() => abrirModalCriar(item.corretor.id)}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Definir Meta
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card>
                <CardContent className="py-16">
                  <div className="text-center text-muted-foreground">
                    <Users className="h-16 w-16 mx-auto mb-4 opacity-50" />
                    <h3 className="text-lg font-medium mb-2">Nenhum corretor cadastrado</h3>
                    <p>Cadastre corretores para definir metas.</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
        
        {/* Modal de criação/edição */}
        <Dialog open={modalAberto} onOpenChange={setModalAberto}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>
                {metaEditando ? "Editar Meta" : "Definir Nova Meta"}
              </DialogTitle>
              <DialogDescription>
                {metaEditando 
                  ? "Atualize os valores da meta para este corretor."
                  : `Defina as metas para ${MESES[mesSelecionado - 1].label} de ${anoSelecionado}.`
                }
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="metaLeads">Meta de Leads</Label>
                  <Input
                    id="metaLeads"
                    type="number"
                    min="0"
                    value={formData.metaLeads}
                    onChange={(e) => setFormData({ ...formData, metaLeads: parseInt(e.target.value) || 0 })}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="metaAgendamentos">Meta de Agendamentos</Label>
                  <Input
                    id="metaAgendamentos"
                    type="number"
                    min="0"
                    value={formData.metaAgendamentos}
                    onChange={(e) => setFormData({ ...formData, metaAgendamentos: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="metaVisitas">Meta de Visitas</Label>
                  <Input
                    id="metaVisitas"
                    type="number"
                    min="0"
                    value={formData.metaVisitas}
                    onChange={(e) => setFormData({ ...formData, metaVisitas: parseInt(e.target.value) || 0 })}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="metaContratos">Meta de Contratos</Label>
                  <Input
                    id="metaContratos"
                    type="number"
                    min="0"
                    value={formData.metaContratos}
                    onChange={(e) => setFormData({ ...formData, metaContratos: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="metaVGV">Meta de VGV (R$)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">R$</span>
                  <Input
                    id="metaVGV"
                    type="number"
                    min="0"
                    step="1000"
                    className="pl-10"
                    value={formData.metaVGV / 100}
                    onChange={(e) => setFormData({ ...formData, metaVGV: Math.round(parseFloat(e.target.value) * 100) || 0 })}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Ex: R$ 500.000 para meta de quinhentos mil reais
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="observacoes">Observações</Label>
                <Textarea
                  id="observacoes"
                  placeholder="Observações sobre a meta..."
                  value={formData.observacoes}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={fecharModal}>
                Cancelar
              </Button>
              <Button 
                onClick={salvarMeta}
                disabled={createMeta.isPending || updateMeta.isPending}
              >
                {createMeta.isPending || updateMeta.isPending ? "Salvando..." : "Salvar Meta"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Target, Phone, MessageSquare, CalendarCheck, Eye, FileText, 
  TrendingUp, Settings, Users, AlertCircle, Edit, Save, Trophy
} from "lucide-react";
import { toast } from "sonner";

function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

export default function MetasDiarias() {
  const { user } = useAuth();
  const isGestor = user?.role === 'gestor' || user?.role === 'admin';
  
  const [modalAberto, setModalAberto] = useState(false);
  const [corretorSelecionado, setCorretorSelecionado] = useState<number | null>(null);
  const [formMeta, setFormMeta] = useState({
    metaLigacoes: 20,
    metaWhatsapp: 30,
    metaAgendamentos: 3,
    metaVisitas: 2,
    metaDocumentacoes: 1,
    metaVendas: 1,
  });
  
  // Queries
  const { data: corretores } = trpc.corretores.list.useQuery();
  const { data: metasDiarias, refetch: refetchMetas } = trpc.metasDiarias.list.useQuery(undefined, { enabled: isGestor });
  const { data: progressoMetas, refetch: refetchProgresso } = trpc.metasDiarias.getProgresso.useQuery(undefined, { enabled: isGestor });
  const { data: configPontuacao, refetch: refetchPontuacao } = trpc.pontuacao.get.useQuery();
  
  // Mutations
  const upsertMeta = trpc.metasDiarias.upsert.useMutation({
    onSuccess: () => {
      toast.success('Meta diária salva com sucesso!');
      refetchMetas();
      refetchProgresso();
      setModalAberto(false);
    },
    onError: (error) => {
      toast.error(`Erro ao salvar meta: ${error.message}`);
    }
  });
  
  const updatePontuacao = trpc.pontuacao.update.useMutation({
    onSuccess: () => {
      toast.success('Configuração de pontuação atualizada!');
      refetchPontuacao();
    },
    onError: (error) => {
      toast.error(`Erro ao atualizar pontuação: ${error.message}`);
    }
  });
  
  // Estado para edição de pontuação
  const [editandoPontuacao, setEditandoPontuacao] = useState(false);
  const [formPontuacao, setFormPontuacao] = useState({
    pontosLigacao: 1,
    pontosLigacaoAtendida: 2,
    pontosWhatsapp: 1,
    pontosWhatsappRespondido: 2,
    pontosAgendamento: 15,
    pontosVisita: 25,
    pontosDocumentacao: 35,
    pontosVenda: 80,
  });
  
  // Atualizar form quando carregar config
  useState(() => {
    if (configPontuacao) {
      setFormPontuacao({
        pontosLigacao: configPontuacao.pontosLigacao || 1,
        pontosLigacaoAtendida: configPontuacao.pontosLigacaoAtendida || 2,
        pontosWhatsapp: configPontuacao.pontosWhatsapp || 1,
        pontosWhatsappRespondido: configPontuacao.pontosWhatsappRespondido || 2,
        pontosAgendamento: configPontuacao.pontosAgendamento || 15,
        pontosVisita: configPontuacao.pontosVisita || 25,
        pontosDocumentacao: configPontuacao.pontosDocumentacao || 35,
        pontosVenda: configPontuacao.pontosVenda || 80,
      });
    }
  });
  
  const abrirModalMeta = (corretorId: number) => {
    setCorretorSelecionado(corretorId);
    
    // Buscar meta existente do corretor
    const metaExistente = metasDiarias?.find(m => m.corretorId === corretorId);
    if (metaExistente) {
      setFormMeta({
        metaLigacoes: metaExistente.metaLigacoes,
        metaWhatsapp: metaExistente.metaWhatsapp,
        metaAgendamentos: metaExistente.metaAgendamentos,
        metaVisitas: metaExistente.metaVisitas,
        metaDocumentacoes: metaExistente.metaDocumentacoes,
        metaVendas: metaExistente.metaVendas,
      });
    } else {
      setFormMeta({
        metaLigacoes: 20,
        metaWhatsapp: 30,
        metaAgendamentos: 3,
        metaVisitas: 2,
        metaDocumentacoes: 1,
        metaVendas: 1,
      });
    }
    
    setModalAberto(true);
  };
  
  const salvarMeta = () => {
    if (!corretorSelecionado) return;
    
    upsertMeta.mutate({
      corretorId: corretorSelecionado,
      ...formMeta,
    });
  };
  
  const salvarPontuacao = () => {
    updatePontuacao.mutate(formPontuacao);
    setEditandoPontuacao(false);
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
              Apenas gestores podem acessar a configuração de metas diárias.
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
              Metas Diárias de Produtividade
            </h1>
            <p className="text-muted-foreground mt-2">
              Configure as metas diárias e pontuação por atividade para cada corretor
            </p>
          </div>
        </div>
        
        <Tabs defaultValue="metas" className="space-y-6">
          <TabsList>
            <TabsTrigger value="metas" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Metas por Corretor
            </TabsTrigger>
            <TabsTrigger value="pontuacao" className="flex items-center gap-2">
              <Trophy className="h-4 w-4" />
              Pontuação por Atividade
            </TabsTrigger>
            <TabsTrigger value="progresso" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Progresso do Dia
            </TabsTrigger>
          </TabsList>
          
          {/* Tab: Metas por Corretor */}
          <TabsContent value="metas">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {corretores?.map((corretor) => {
                const metaCorretor = metasDiarias?.find(m => m.corretorId === corretor.id);
                
                return (
                  <Card key={corretor.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={corretor.fotoUrl || undefined} />
                            <AvatarFallback>{getInitials(corretor.name)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <CardTitle className="text-base">{corretor.name}</CardTitle>
                            <CardDescription className="text-xs">
                              {corretor.status === 'presente' ? (
                                <Badge variant="default" className="bg-green-500">Presente</Badge>
                              ) : (
                                <Badge variant="secondary">Ausente</Badge>
                              )}
                            </CardDescription>
                          </div>
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => abrirModalMeta(corretor.id)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {metaCorretor ? (
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-blue-500" />
                            <span>{metaCorretor.metaLigacoes} ligações</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <MessageSquare className="h-4 w-4 text-green-500" />
                            <span>{metaCorretor.metaWhatsapp} WhatsApp</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <CalendarCheck className="h-4 w-4 text-purple-500" />
                            <span>{metaCorretor.metaAgendamentos} agendamentos</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Eye className="h-4 w-4 text-amber-500" />
                            <span>{metaCorretor.metaVisitas} visitas</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-cyan-500" />
                            <span>{metaCorretor.metaDocumentacoes} docs</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Trophy className="h-4 w-4 text-yellow-500" />
                            <span>{metaCorretor.metaVendas} vendas</span>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          Nenhuma meta definida
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>
          
          {/* Tab: Pontuação por Atividade */}
          <TabsContent value="pontuacao">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Configuração de Pontuação</CardTitle>
                    <CardDescription>
                      Defina quantos pontos cada atividade vale no ranking de produtividade
                    </CardDescription>
                  </div>
                  {!editandoPontuacao ? (
                    <Button onClick={() => setEditandoPontuacao(true)}>
                      <Edit className="h-4 w-4 mr-2" />
                      Editar
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setEditandoPontuacao(false)}>
                        Cancelar
                      </Button>
                      <Button onClick={salvarPontuacao}>
                        <Save className="h-4 w-4 mr-2" />
                        Salvar
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-blue-500" />
                      Ligação Realizada
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      value={editandoPontuacao ? formPontuacao.pontosLigacao : (configPontuacao?.pontosLigacao || 1)}
                      onChange={(e) => setFormPontuacao({ ...formPontuacao, pontosLigacao: parseInt(e.target.value) || 0 })}
                      disabled={!editandoPontuacao}
                    />
                    <p className="text-xs text-muted-foreground">pontos</p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-green-500" />
                      Ligação Atendida
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      value={editandoPontuacao ? formPontuacao.pontosLigacaoAtendida : (configPontuacao?.pontosLigacaoAtendida || 2)}
                      onChange={(e) => setFormPontuacao({ ...formPontuacao, pontosLigacaoAtendida: parseInt(e.target.value) || 0 })}
                      disabled={!editandoPontuacao}
                    />
                    <p className="text-xs text-muted-foreground">pontos</p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-blue-500" />
                      WhatsApp Enviado
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      value={editandoPontuacao ? formPontuacao.pontosWhatsapp : (configPontuacao?.pontosWhatsapp || 1)}
                      onChange={(e) => setFormPontuacao({ ...formPontuacao, pontosWhatsapp: parseInt(e.target.value) || 0 })}
                      disabled={!editandoPontuacao}
                    />
                    <p className="text-xs text-muted-foreground">pontos</p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-green-500" />
                      WhatsApp Respondido
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      value={editandoPontuacao ? formPontuacao.pontosWhatsappRespondido : (configPontuacao?.pontosWhatsappRespondido || 2)}
                      onChange={(e) => setFormPontuacao({ ...formPontuacao, pontosWhatsappRespondido: parseInt(e.target.value) || 0 })}
                      disabled={!editandoPontuacao}
                    />
                    <p className="text-xs text-muted-foreground">pontos</p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <CalendarCheck className="h-4 w-4 text-purple-500" />
                      Agendamento Confirmado
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      value={editandoPontuacao ? formPontuacao.pontosAgendamento : (configPontuacao?.pontosAgendamento || 15)}
                      onChange={(e) => setFormPontuacao({ ...formPontuacao, pontosAgendamento: parseInt(e.target.value) || 0 })}
                      disabled={!editandoPontuacao}
                    />
                    <p className="text-xs text-muted-foreground">pontos</p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Eye className="h-4 w-4 text-amber-500" />
                      Visita Realizada
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      value={editandoPontuacao ? formPontuacao.pontosVisita : (configPontuacao?.pontosVisita || 25)}
                      onChange={(e) => setFormPontuacao({ ...formPontuacao, pontosVisita: parseInt(e.target.value) || 0 })}
                      disabled={!editandoPontuacao}
                    />
                    <p className="text-xs text-muted-foreground">pontos</p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-cyan-500" />
                      Documentação Recolhida
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      value={editandoPontuacao ? formPontuacao.pontosDocumentacao : (configPontuacao?.pontosDocumentacao || 35)}
                      onChange={(e) => setFormPontuacao({ ...formPontuacao, pontosDocumentacao: parseInt(e.target.value) || 0 })}
                      disabled={!editandoPontuacao}
                    />
                    <p className="text-xs text-muted-foreground">pontos</p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Trophy className="h-4 w-4 text-yellow-500" />
                      Venda Realizada
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      value={editandoPontuacao ? formPontuacao.pontosVenda : (configPontuacao?.pontosVenda || 80)}
                      onChange={(e) => setFormPontuacao({ ...formPontuacao, pontosVenda: parseInt(e.target.value) || 0 })}
                      disabled={!editandoPontuacao}
                    />
                    <p className="text-xs text-muted-foreground">pontos</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Tab: Progresso do Dia */}
          <TabsContent value="progresso">
            <div className="space-y-4">
              {progressoMetas?.map((item: any) => (
                <Card key={item.corretor.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={item.corretor.foto || undefined} />
                          <AvatarFallback>{getInitials(item.corretor.nome)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <CardTitle className="text-lg">{item.corretor.nome}</CardTitle>
                          <CardDescription className="flex items-center gap-2">
                            <span className="font-semibold text-primary">{item.pontuacaoTotal} pontos</span>
                            <span>•</span>
                            <span>{item.progressoGeral}% da meta geral</span>
                          </CardDescription>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-2xl font-bold ${
                          item.progressoGeral >= 100 ? 'text-green-500' :
                          item.progressoGeral >= 50 ? 'text-amber-500' :
                          'text-red-500'
                        }`}>
                          {item.progressoGeral}%
                        </div>
                        <p className="text-xs text-muted-foreground">Progresso Geral</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
                      {/* Ligações */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-1">
                            <Phone className="h-4 w-4 text-blue-500" />
                            Ligações
                          </span>
                          <span className="font-medium">{item.realizado.ligacoesRealizadas}/{item.meta.metaLigacoes}</span>
                        </div>
                        <Progress value={Math.min(item.progresso.ligacoes, 100)} className="h-2" />
                        <p className="text-xs text-muted-foreground text-right">{item.progresso.ligacoes}%</p>
                      </div>
                      
                      {/* WhatsApp */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-1">
                            <MessageSquare className="h-4 w-4 text-green-500" />
                            WhatsApp
                          </span>
                          <span className="font-medium">{item.realizado.whatsappEnviados}/{item.meta.metaWhatsapp}</span>
                        </div>
                        <Progress value={Math.min(item.progresso.whatsapp, 100)} className="h-2" />
                        <p className="text-xs text-muted-foreground text-right">{item.progresso.whatsapp}%</p>
                      </div>
                      
                      {/* Agendamentos */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-1">
                            <CalendarCheck className="h-4 w-4 text-purple-500" />
                            Agendamentos
                          </span>
                          <span className="font-medium">{item.realizado.agendamentosConfirmados}/{item.meta.metaAgendamentos}</span>
                        </div>
                        <Progress value={Math.min(item.progresso.agendamentos, 100)} className="h-2" />
                        <p className="text-xs text-muted-foreground text-right">{item.progresso.agendamentos}%</p>
                      </div>
                      
                      {/* Visitas */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-1">
                            <Eye className="h-4 w-4 text-amber-500" />
                            Visitas
                          </span>
                          <span className="font-medium">{item.realizado.visitasRealizadas}/{item.meta.metaVisitas}</span>
                        </div>
                        <Progress value={Math.min(item.progresso.visitas, 100)} className="h-2" />
                        <p className="text-xs text-muted-foreground text-right">{item.progresso.visitas}%</p>
                      </div>
                      
                      {/* Documentações */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-1">
                            <FileText className="h-4 w-4 text-cyan-500" />
                            Documentações
                          </span>
                          <span className="font-medium">{item.realizado.documentacoesRecolhidas}/{item.meta.metaDocumentacoes}</span>
                        </div>
                        <Progress value={Math.min(item.progresso.documentacoes, 100)} className="h-2" />
                        <p className="text-xs text-muted-foreground text-right">{item.progresso.documentacoes}%</p>
                      </div>
                      
                      {/* Vendas */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-1">
                            <Trophy className="h-4 w-4 text-yellow-500" />
                            Vendas
                          </span>
                          <span className="font-medium">{item.realizado.vendasRealizadas || 0}/{item.meta.metaVendas}</span>
                        </div>
                        <Progress value={Math.min(item.progresso.vendas, 100)} className="h-2" />
                        <p className="text-xs text-muted-foreground text-right">{item.progresso.vendas}%</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              
              {(!progressoMetas || progressoMetas.length === 0) && (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhum dado de progresso disponível</p>
                    <p className="text-sm">Configure as metas diárias para os corretores primeiro.</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
        
        {/* Modal de Definir Meta */}
        <Dialog open={modalAberto} onOpenChange={setModalAberto}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Definir Metas Diárias</DialogTitle>
              <DialogDescription>
                Configure as metas diárias de produtividade para este corretor.
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="metaLigacoes" className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-blue-500" />
                    Meta de Ligações
                  </Label>
                  <Input
                    id="metaLigacoes"
                    type="number"
                    min="0"
                    value={formMeta.metaLigacoes}
                    onChange={(e) => setFormMeta({ ...formMeta, metaLigacoes: parseInt(e.target.value) || 0 })}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="metaWhatsapp" className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-green-500" />
                    Meta de WhatsApp
                  </Label>
                  <Input
                    id="metaWhatsapp"
                    type="number"
                    min="0"
                    value={formMeta.metaWhatsapp}
                    onChange={(e) => setFormMeta({ ...formMeta, metaWhatsapp: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="metaAgendamentos" className="flex items-center gap-2">
                    <CalendarCheck className="h-4 w-4 text-purple-500" />
                    Meta de Agendamentos
                  </Label>
                  <Input
                    id="metaAgendamentos"
                    type="number"
                    min="0"
                    value={formMeta.metaAgendamentos}
                    onChange={(e) => setFormMeta({ ...formMeta, metaAgendamentos: parseInt(e.target.value) || 0 })}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="metaVisitas" className="flex items-center gap-2">
                    <Eye className="h-4 w-4 text-amber-500" />
                    Meta de Visitas
                  </Label>
                  <Input
                    id="metaVisitas"
                    type="number"
                    min="0"
                    value={formMeta.metaVisitas}
                    onChange={(e) => setFormMeta({ ...formMeta, metaVisitas: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="metaDocumentacoes" className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-cyan-500" />
                    Meta de Documentações
                  </Label>
                  <Input
                    id="metaDocumentacoes"
                    type="number"
                    min="0"
                    value={formMeta.metaDocumentacoes}
                    onChange={(e) => setFormMeta({ ...formMeta, metaDocumentacoes: parseInt(e.target.value) || 0 })}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="metaVendas" className="flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-yellow-500" />
                    Meta de Vendas
                  </Label>
                  <Input
                    id="metaVendas"
                    type="number"
                    min="0"
                    value={formMeta.metaVendas}
                    onChange={(e) => setFormMeta({ ...formMeta, metaVendas: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setModalAberto(false)}>
                Cancelar
              </Button>
              <Button onClick={salvarMeta} disabled={upsertMeta.isPending}>
                {upsertMeta.isPending ? 'Salvando...' : 'Salvar Meta'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

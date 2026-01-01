import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  Loader2, 
  Phone, 
  MessageCircle, 
  Mail, 
  Calendar, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertTriangle,
  Plus,
  RefreshCw,
  User,
  FileText,
  Target
} from "lucide-react";
import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { toast } from "sonner";

type TipoTarefa = "follow_up" | "agendamento" | "ligacao" | "whatsapp" | "email" | "visita" | "documentacao" | "outro";
type Prioridade = "baixa" | "media" | "alta";

const tipoLabels: Record<TipoTarefa, string> = {
  follow_up: "Follow-up",
  agendamento: "Agendamento",
  ligacao: "Ligação",
  whatsapp: "WhatsApp",
  email: "E-mail",
  visita: "Visita",
  documentacao: "Documentação",
  outro: "Outro",
};

const tipoIcons: Record<TipoTarefa, React.ReactNode> = {
  follow_up: <Target className="h-4 w-4" />,
  agendamento: <Calendar className="h-4 w-4" />,
  ligacao: <Phone className="h-4 w-4" />,
  whatsapp: <MessageCircle className="h-4 w-4" />,
  email: <Mail className="h-4 w-4" />,
  visita: <User className="h-4 w-4" />,
  documentacao: <FileText className="h-4 w-4" />,
  outro: <Clock className="h-4 w-4" />,
};

const prioridadeColors: Record<Prioridade, string> = {
  baixa: "bg-gray-100 text-gray-800",
  media: "bg-yellow-100 text-yellow-800",
  alta: "bg-red-100 text-red-800",
};

// Tipos para o modal de registro de interação
type TipoContato = "whatsapp" | "ligacao" | "email" | "sms" | "visita" | "outro";
type ResultadoContato = "contato_realizado" | "nao_atendeu" | "agendamento" | "visita_realizada" | "proposta_enviada" | "recusou" | "outro";

export default function TarefasDoDia() {
  const [showNovaTarefa, setShowNovaTarefa] = useState(false);
  const [showRegistrarTentativa, setShowRegistrarTentativa] = useState<number | null>(null);
  const [showConcluirTarefa, setShowConcluirTarefa] = useState<number | null>(null);
  
  // Estado para o modal de registro de interação (ao clicar em Não Respondeu/Respondeu)
  const [showRegistrarInteracao, setShowRegistrarInteracao] = useState<{
    followUpId: number;
    leadId: number;
    leadNome: string;
    tipoResultado: "nao_atendeu" | "respondeu";
  } | null>(null);
  const [interacaoForm, setInteracaoForm] = useState({
    tipoContato: "whatsapp" as TipoContato,
    resultado: "contato_realizado" as ResultadoContato,
    observacoes: "",
  });
  
  // Form states
  const [novaTarefa, setNovaTarefa] = useState({
    titulo: "",
    descricao: "",
    tipo: "outro" as TipoTarefa,
    dataAgendada: new Date().toISOString().split('T')[0],
    prioridade: "media" as Prioridade,
  });
  const [observacaoTentativa, setObservacaoTentativa] = useState("");
  const [observacaoConclusao, setObservacaoConclusao] = useState("");

  // Queries
  const { data: tarefasDoDia, isLoading, refetch } = trpc.tarefasDoDia.getAll.useQuery();
  const { data: leads } = trpc.leads.list.useQuery();

  // Mutations
  const criarTarefaMutation = trpc.tarefas.create.useMutation({
    onSuccess: () => {
      toast.success("Tarefa criada com sucesso!");
      setShowNovaTarefa(false);
      setNovaTarefa({
        titulo: "",
        descricao: "",
        tipo: "outro",
        dataAgendada: new Date().toISOString().split('T')[0],
        prioridade: "media",
      });
      refetch();
    },
    onError: (error) => {
      toast.error(`Erro ao criar tarefa: ${error.message}`);
    },
  });

  const concluirTarefaMutation = trpc.tarefas.concluir.useMutation({
    onSuccess: () => {
      toast.success("Tarefa concluída!");
      setShowConcluirTarefa(null);
      setObservacaoConclusao("");
      refetch();
    },
    onError: (error) => {
      toast.error(`Erro ao concluir tarefa: ${error.message}`);
    },
  });

  const registrarTentativaMutation = trpc.followUps.registrarTentativa.useMutation({
    onSuccess: (data) => {
      toast.success(data.mensagem);
      setShowRegistrarTentativa(null);
      setShowRegistrarInteracao(null);
      setObservacaoTentativa("");
      setInteracaoForm({ tipoContato: "whatsapp", resultado: "contato_realizado", observacoes: "" });
      refetch();
    },
    onError: (error) => {
      toast.error(`Erro ao registrar tentativa: ${error.message}`);
    },
  });

  // Mutation para adicionar interação ao histórico do lead
  const addInteractionMutation = trpc.leads.addInteraction.useMutation({
    onSuccess: () => {
      // Após salvar a interação, registrar a tentativa de follow-up
      if (showRegistrarInteracao) {
        registrarTentativaMutation.mutate({
          followUpId: showRegistrarInteracao.followUpId,
          resultado: showRegistrarInteracao.tipoResultado,
          observacao: interacaoForm.observacoes || undefined,
        });
      }
    },
    onError: (error) => {
      toast.error(`Erro ao registrar interação: ${error.message}`);
    },
  });

  const handleCriarTarefa = () => {
    criarTarefaMutation.mutate({
      ...novaTarefa,
      dataAgendada: new Date(novaTarefa.dataAgendada + "T09:00:00"),
    });
  };

  const handleRegistrarTentativa = (resultado: "nao_atendeu" | "respondeu" | "outro") => {
    if (showRegistrarTentativa === null) return;
    registrarTentativaMutation.mutate({
      followUpId: showRegistrarTentativa,
      resultado,
      observacao: observacaoTentativa || undefined,
    });
  };

  const handleConcluirTarefa = () => {
    if (showConcluirTarefa === null) return;
    concluirTarefaMutation.mutate({
      id: showConcluirTarefa,
      observacoes: observacaoConclusao || undefined,
    });
  };

  // Handler para salvar interação e registrar tentativa de follow-up
  const handleSalvarInteracao = () => {
    if (!showRegistrarInteracao) return;
    
    // Primeiro salva a interação no histórico do lead
    addInteractionMutation.mutate({
      leadId: showRegistrarInteracao.leadId,
      tipo: interacaoForm.tipoContato,
      resultado: interacaoForm.resultado,
      observacoes: interacaoForm.observacoes || undefined,
    });
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  const { followUps = [], tarefas = [], agendados = [], total = 0 } = tarefasDoDia || {};

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Tarefas do Dia</h1>
            <p className="text-muted-foreground">
              {total} tarefa(s) para hoje • {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Atualizar
            </Button>
            <Button onClick={() => setShowNovaTarefa(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Nova Tarefa
            </Button>
          </div>
        </div>

        {/* Resumo */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Target className="h-5 w-5 text-orange-500" />
                Follow-ups
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{followUps.length}</p>
              <p className="text-sm text-muted-foreground">Clientes aguardando contato</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5 text-blue-500" />
                Agendamentos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{agendados.length}</p>
              <p className="text-sm text-muted-foreground">Visitas/reuniões marcadas</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                Tarefas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{tarefas.length}</p>
              <p className="text-sm text-muted-foreground">Tarefas personalizadas</p>
            </CardContent>
          </Card>
        </div>

        {/* Follow-ups Pendentes */}
        {followUps.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-orange-500" />
                Follow-ups do Dia
              </CardTitle>
              <CardDescription>
                Clientes aguardando contato. Após 5 dias sem resposta, o lead vai para Perdido/Lixeira.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {followUps.map((followUp) => (
                  <div 
                    key={followUp.id} 
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border bg-orange-50/50 dark:bg-orange-950/20 gap-4"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-900">
                        <span className="text-lg font-bold text-orange-600 dark:text-orange-400">
                          {followUp.tentativaAtual}/{followUp.maxTentativas}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-lg">{followUp.leadNome}</p>
                        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                          {followUp.leadTelefone && (
                            <a 
                              href={`tel:${followUp.leadTelefone}`}
                              className="flex items-center gap-1 hover:text-primary"
                            >
                              <Phone className="h-3 w-3" />
                              {followUp.leadTelefone}
                            </a>
                          )}
                          {followUp.leadEmail && (
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {followUp.leadEmail}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {followUp.tentativaAtual === 0 
                            ? "Primeiro contato do dia" 
                            : `Dia ${followUp.tentativaAtual} de follow-up`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3">
                      {followUp.leadTelefone && (
                        <>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => window.open(`tel:${followUp.leadTelefone}`, '_self')}
                            title="Ligar"
                          >
                            <Phone className="h-4 w-4" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => window.open(`https://wa.me/55${followUp.leadTelefone?.replace(/\D/g, '')}`, '_blank')}
                            title="WhatsApp"
                          >
                            <MessageCircle className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      <Button 
                        size="sm" 
                        variant="destructive"
                        onClick={() => {
                          setInteracaoForm({
                            tipoContato: "whatsapp",
                            resultado: "nao_atendeu",
                            observacoes: "",
                          });
                          setShowRegistrarInteracao({
                            followUpId: followUp.id,
                            leadId: followUp.leadId,
                            leadNome: followUp.leadNome,
                            tipoResultado: "nao_atendeu",
                          });
                        }}
                        className="whitespace-nowrap"
                        disabled={registrarTentativaMutation.isPending || addInteractionMutation.isPending}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Não Respondeu
                      </Button>
                      <Button 
                        size="sm" 
                        variant="default"
                        className="bg-green-600 hover:bg-green-700 whitespace-nowrap"
                        onClick={() => {
                          setInteracaoForm({
                            tipoContato: "whatsapp",
                            resultado: "contato_realizado",
                            observacoes: "",
                          });
                          setShowRegistrarInteracao({
                            followUpId: followUp.id,
                            leadId: followUp.leadId,
                            leadNome: followUp.leadNome,
                            tipoResultado: "respondeu",
                          });
                        }}
                        disabled={registrarTentativaMutation.isPending || addInteractionMutation.isPending}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Respondeu
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Agendamentos do Dia */}
        {agendados.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-blue-500" />
                Agendamentos de Hoje
              </CardTitle>
              <CardDescription>
                Visitas e reuniões marcadas para hoje
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {agendados.map((lead) => (
                  <div 
                    key={lead.id} 
                    className="flex items-center justify-between p-4 rounded-lg border bg-blue-50/50"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-100">
                        <Calendar className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium">{lead.nome}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          {lead.telefone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {lead.telefone}
                            </span>
                          )}
                          {lead.proximoFollowup && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(lead.proximoFollowup).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {lead.telefone && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => window.open(`https://wa.me/55${lead.telefone?.replace(/\D/g, '')}`, '_blank')}
                        >
                          <MessageCircle className="h-4 w-4" />
                        </Button>
                      )}
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => window.open(`/leads?id=${lead.id}`, '_self')}
                      >
                        Ver Lead
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tarefas Personalizadas */}
        {tarefas.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                Minhas Tarefas
              </CardTitle>
              <CardDescription>
                Tarefas que você criou para hoje
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {tarefas.map((tarefa) => (
                  <div 
                    key={tarefa.id} 
                    className="flex items-center justify-between p-4 rounded-lg border"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-100">
                        {tipoIcons[tarefa.tipo as TipoTarefa]}
                      </div>
                      <div>
                        <p className="font-medium">{tarefa.titulo}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Badge variant="outline" className={prioridadeColors[tarefa.prioridade as Prioridade]}>
                            {tarefa.prioridade}
                          </Badge>
                          <span>{tipoLabels[tarefa.tipo as TipoTarefa]}</span>
                          {tarefa.leadNome && (
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {tarefa.leadNome}
                            </span>
                          )}
                        </div>
                        {tarefa.descricao && (
                          <p className="text-sm text-muted-foreground mt-1">{tarefa.descricao}</p>
                        )}
                      </div>
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => setShowConcluirTarefa(tarefa.id)}
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Concluir
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Sem tarefas */}
        {total === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
              <p className="text-lg font-medium">Nenhuma tarefa para hoje!</p>
              <p className="text-sm text-muted-foreground mb-4">
                Você está em dia com suas atividades
              </p>
              <Button onClick={() => setShowNovaTarefa(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Criar Nova Tarefa
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Dialog: Nova Tarefa */}
      <Dialog open={showNovaTarefa} onOpenChange={setShowNovaTarefa}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Tarefa</DialogTitle>
            <DialogDescription>
              Crie uma tarefa para lembrar de algo importante
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Título</label>
              <Input
                placeholder="Ex: Ligar para cliente sobre documentação"
                value={novaTarefa.titulo}
                onChange={(e) => setNovaTarefa({ ...novaTarefa, titulo: e.target.value })}
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Descrição (opcional)</label>
              <Textarea
                placeholder="Detalhes adicionais..."
                value={novaTarefa.descricao}
                onChange={(e) => setNovaTarefa({ ...novaTarefa, descricao: e.target.value })}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Tipo</label>
                <Select 
                  value={novaTarefa.tipo} 
                  onValueChange={(v) => setNovaTarefa({ ...novaTarefa, tipo: v as TipoTarefa })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(tipoLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Prioridade</label>
                <Select 
                  value={novaTarefa.prioridade} 
                  onValueChange={(v) => setNovaTarefa({ ...novaTarefa, prioridade: v as Prioridade })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baixa">Baixa</SelectItem>
                    <SelectItem value="media">Média</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Data</label>
              <Input
                type="date"
                value={novaTarefa.dataAgendada}
                onChange={(e) => setNovaTarefa({ ...novaTarefa, dataAgendada: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNovaTarefa(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleCriarTarefa}
              disabled={!novaTarefa.titulo || criarTarefaMutation.isPending}
            >
              {criarTarefaMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar Tarefa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Registrar Tentativa de Follow-up */}
      <AlertDialog open={showRegistrarTentativa !== null} onOpenChange={() => setShowRegistrarTentativa(null)}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-center text-xl">Cliente respondeu?</AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              Registre o resultado da tentativa de contato
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <Button 
                size="lg"
                variant="outline"
                className="h-24 flex-col gap-2 border-red-200 hover:bg-red-50 hover:border-red-300"
                onClick={() => handleRegistrarTentativa("nao_atendeu")}
                disabled={registrarTentativaMutation.isPending}
              >
                <XCircle className="h-8 w-8 text-red-500" />
                <span className="font-semibold text-red-600">Não</span>
              </Button>
              <Button 
                size="lg"
                variant="outline"
                className="h-24 flex-col gap-2 border-green-200 hover:bg-green-50 hover:border-green-300"
                onClick={() => handleRegistrarTentativa("respondeu")}
                disabled={registrarTentativaMutation.isPending}
              >
                <CheckCircle2 className="h-8 w-8 text-green-500" />
                <span className="font-semibold text-green-600">Sim</span>
              </Button>
            </div>
            <Textarea
              placeholder="Observações (opcional)..."
              value={observacaoTentativa}
              onChange={(e) => setObservacaoTentativa(e.target.value)}
              className="mt-4"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="w-full">Cancelar</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog: Concluir Tarefa */}
      <AlertDialog open={showConcluirTarefa !== null} onOpenChange={() => setShowConcluirTarefa(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Concluir Tarefa</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja marcar esta tarefa como concluída?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <Textarea
              placeholder="Observações sobre a conclusão (opcional)..."
              value={observacaoConclusao}
              onChange={(e) => setObservacaoConclusao(e.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConcluirTarefa}
              disabled={concluirTarefaMutation.isPending}
            >
              {concluirTarefaMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Concluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog: Registrar Interação (ao clicar em Não Respondeu/Respondeu) */}
      <Dialog open={showRegistrarInteracao !== null} onOpenChange={() => setShowRegistrarInteracao(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Interação</DialogTitle>
            <DialogDescription>
              Adicione um registro de contato com o lead {showRegistrarInteracao?.leadNome}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Tipo de Contato</label>
              <Select
                value={interacaoForm.tipoContato}
                onValueChange={(value: TipoContato) => setInteracaoForm({ ...interacaoForm, tipoContato: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="ligacao">Ligação</SelectItem>
                  <SelectItem value="email">E-mail</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="visita">Visita</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid gap-2">
              <label className="text-sm font-medium">Resultado</label>
              <Select
                value={interacaoForm.resultado}
                onValueChange={(value: ResultadoContato) => setInteracaoForm({ ...interacaoForm, resultado: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="contato_realizado">Contato Realizado</SelectItem>
                  <SelectItem value="nao_atendeu">Não Atendeu</SelectItem>
                  <SelectItem value="agendamento">Agendamento</SelectItem>
                  <SelectItem value="visita_realizada">Visita Realizada</SelectItem>
                  <SelectItem value="proposta_enviada">Proposta Enviada</SelectItem>
                  <SelectItem value="recusou">Recusou</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid gap-2">
              <label className="text-sm font-medium">Observações</label>
              <Textarea
                value={interacaoForm.observacoes}
                onChange={(e) => setInteracaoForm({ ...interacaoForm, observacoes: e.target.value })}
                rows={4}
                placeholder="Descreva o que foi conversado..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRegistrarInteracao(null)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSalvarInteracao} 
              disabled={addInteractionMutation.isPending || registrarTentativaMutation.isPending}
            >
              {(addInteractionMutation.isPending || registrarTentativaMutation.isPending) ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</>
              ) : (
                "Salvar Interação"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

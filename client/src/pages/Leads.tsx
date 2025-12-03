import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { 
  Phone, Mail, Building2, Calendar, MessageSquare, Search, Filter,
  Clock, AlertCircle, CheckCircle2, XCircle, Eye, LayoutGrid, List
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";

const statusLabels: Record<string, string> = {
  novo: "Novo",
  aguardando_atendimento: "Aguardando Atendimento",
  em_atendimento: "Em Atendimento",
  agendado: "Agendado",
  visita_realizada: "Visita Realizada",
  analise_credito: "Análise de Crédito",
  contrato_fechado: "Contrato Fechado",
  perdido: "Perdido",
};

const tipoLabels: Record<string, string> = {
  whatsapp: "WhatsApp",
  ligacao: "Ligação",
  email: "E-mail",
  sms: "SMS",
  visita: "Visita",
  outro: "Outro",
};

const resultadoLabels: Record<string, string> = {
  contato_realizado: "Contato Realizado",
  nao_atendeu: "Não Atendeu",
  agendamento: "Agendamento",
  visita_realizada: "Visita Realizada",
  proposta_enviada: "Proposta Enviada",
  recusou: "Recusou",
  outro: "Outro",
};

export default function Leads() {
  const { data: leads, isLoading, refetch } = trpc.leads.list.useQuery();
  const { data: projects } = trpc.projects.list.useQuery();
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [detailsDialog, setDetailsDialog] = useState(false);
  const [interactionDialog, setInteractionDialog] = useState(false);
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [projectFilter, setProjectFilter] = useState<string>("all");

  const updateLeadMutation = trpc.leads.update.useMutation();
  const addInteractionMutation = trpc.leads.addInteraction.useMutation();
  const { data: leadHistory } = trpc.leads.getHistory.useQuery(
    { leadId: selectedLead?.id || 0 },
    { enabled: !!selectedLead }
  );

  const [interactionForm, setInteractionForm] = useState({
    tipo: "whatsapp" as "ligacao" | "whatsapp" | "email" | "sms" | "visita" | "outro",
    resultado: "contato_realizado" as "contato_realizado" | "nao_atendeu" | "agendamento" | "visita_realizada" | "proposta_enviada" | "recusou" | "outro",
    observacoes: "",
  });

  const handleAddInteraction = async () => {
    if (!selectedLead) return;

    try {
      await addInteractionMutation.mutateAsync({
        leadId: selectedLead.id,
        ...interactionForm,
      });

      toast.success("Interação registrada com sucesso!");
      setInteractionDialog(false);
      setInteractionForm({
        tipo: "whatsapp",
        resultado: "contato_realizado",
        observacoes: "",
      });
      refetch();
    } catch (error) {
      toast.error("Erro ao registrar interação");
    }
  };

  const handleUpdateStatus = async (leadId: number, newStatus: string) => {
    try {
      await updateLeadMutation.mutateAsync({
        id: leadId,
        data: { status: newStatus as any },
      });

      toast.success("Status atualizado com sucesso!");
      refetch();
    } catch (error) {
      toast.error("Erro ao atualizar status");
    }
  };

  const handleUpdateObservacoes = async (leadId: number, observacoes: string) => {
    try {
      await updateLeadMutation.mutateAsync({
        id: leadId,
        data: { observacoes },
      });

      toast.success("Observações atualizadas!");
      refetch();
    } catch (error) {
      toast.error("Erro ao atualizar observações");
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "contrato_fechado":
        return "default";
      case "perdido":
        return "destructive";
      case "novo":
      case "aguardando_atendimento":
        return "secondary";
      default:
        return "outline";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "contrato_fechado":
        return <CheckCircle2 className="h-4 w-4" />;
      case "perdido":
        return <XCircle className="h-4 w-4" />;
      case "novo":
      case "aguardando_atendimento":
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  // Filtrar leads
  const filteredLeads = leads?.filter((lead) => {
    const matchesSearch = 
      lead.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.telefone.includes(searchTerm) ||
      (lead.email && lead.email.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === "all" || lead.status === statusFilter;
    const matchesProject = projectFilter === "all" || lead.projectId?.toString() === projectFilter;

    return matchesSearch && matchesStatus && matchesProject;
  }) || [];

  const openDetails = (lead: any) => {
    setSelectedLead(lead);
    setDetailsDialog(true);
  };

  return (
    <DashboardLayout>
      <div className="container py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Meus Leads</h1>
          <p className="text-muted-foreground mt-2">
            Gerencie seus contatos e acompanhe o funil de vendas
          </p>
        </div>

        {/* Filtros e Busca */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Filtros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="search">Buscar</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="search"
                    placeholder="Nome, telefone, email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os status</SelectItem>
                    {Object.entries(statusLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="project">Projeto</Label>
                <Select value={projectFilter} onValueChange={setProjectFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os projetos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os projetos</SelectItem>
                    {projects?.map((project) => (
                      <SelectItem key={project.id} value={project.id.toString()}>
                        {project.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Visualização</Label>
                <div className="flex gap-2">
                  <Button
                    variant={viewMode === "cards" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setViewMode("cards")}
                    className="flex-1"
                  >
                    <LayoutGrid className="h-4 w-4 mr-2" />
                    Cards
                  </Button>
                  <Button
                    variant={viewMode === "table" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setViewMode("table")}
                    className="flex-1"
                  >
                    <List className="h-4 w-4 mr-2" />
                    Tabela
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Estatísticas Rápidas */}
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total de Leads
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{filteredLeads.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Em Atendimento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {filteredLeads.filter(l => l.status === "em_atendimento").length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Agendados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {filteredLeads.filter(l => l.status === "agendado").length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Contratos Fechados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {filteredLeads.filter(l => l.status === "contrato_fechado").length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Lista de leads */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Carregando leads...</p>
          </div>
        ) : filteredLeads.length > 0 ? (
          viewMode === "cards" ? (
            <div className="grid gap-4">
              {filteredLeads.map((lead) => {
                const project = projects?.find(p => p.id === lead.projectId);
                const needsFollowup = lead.diasFollowupConsecutivos < 5 && lead.status !== "contrato_fechado" && lead.status !== "perdido";
                
                return (
                  <Card key={lead.id} className="hover:shadow-md transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-xl">{lead.nome}</CardTitle>
                            {needsFollowup && (
                              <Badge variant="outline" className="text-orange-600 border-orange-600">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                Follow-up: Dia {lead.diasFollowupConsecutivos}/5
                              </Badge>
                            )}
                          </div>
                          <CardDescription className="mt-1">
                            {lead.origem && `Origem: ${lead.origem}`}
                          </CardDescription>
                        </div>
                        <Badge variant={getStatusVariant(lead.status)} className="flex items-center gap-1">
                          {getStatusIcon(lead.status)}
                          {statusLabels[lead.status]}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            <a href={`tel:${lead.telefone}`} className="hover:underline">
                              {lead.telefone}
                            </a>
                          </div>
                          {lead.email && (
                            <div className="flex items-center gap-2 text-sm">
                              <Mail className="h-4 w-4 text-muted-foreground" />
                              <a href={`mailto:${lead.email}`} className="hover:underline">
                                {lead.email}
                              </a>
                            </div>
                          )}
                          {project && (
                            <div className="flex items-center gap-2 text-sm">
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                              <span>{project.nome}</span>
                            </div>
                          )}
                          {lead.ultimoContato && (
                            <div className="flex items-center gap-2 text-sm">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              <span>
                                Último contato: {format(new Date(lead.ultimoContato), "dd/MM/yyyy", { locale: ptBR })}
                              </span>
                            </div>
                          )}
                        </div>
                        
                        <div className="flex flex-col gap-2">
                          <Select
                            value={lead.status}
                            onValueChange={(value) => handleUpdateStatus(lead.id, value)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(statusLabels).map(([value, label]) => (
                                <SelectItem key={value} value={value}>
                                  {label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1"
                              onClick={() => {
                                setSelectedLead(lead);
                                setInteractionDialog(true);
                              }}
                            >
                              <MessageSquare className="h-4 w-4 mr-2" />
                              Registrar
                            </Button>
                            
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openDetails(lead)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                      
                      {lead.observacoes && (
                        <div className="mt-4 pt-4 border-t">
                          <p className="text-sm text-muted-foreground">
                            <strong>Observações:</strong> {lead.observacoes}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Projeto</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Último Contato</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLeads.map((lead) => {
                    const project = projects?.find(p => p.id === lead.projectId);
                    
                    return (
                      <TableRow key={lead.id}>
                        <TableCell className="font-medium">{lead.nome}</TableCell>
                        <TableCell>{lead.telefone}</TableCell>
                        <TableCell>{project?.nome || "-"}</TableCell>
                        <TableCell>
                          <Badge variant={getStatusVariant(lead.status)}>
                            {statusLabels[lead.status]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {lead.ultimoContato 
                            ? format(new Date(lead.ultimoContato), "dd/MM/yyyy", { locale: ptBR })
                            : "-"
                          }
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedLead(lead);
                                setInteractionDialog(true);
                              }}
                            >
                              <MessageSquare className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openDetails(lead)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          )
        ) : (
          <div className="text-center py-12">
            <Phone className="h-20 w-20 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold mb-2">Nenhum lead encontrado</h3>
            <p className="text-muted-foreground">
              {searchTerm || statusFilter !== "all" || projectFilter !== "all"
                ? "Tente ajustar os filtros de busca"
                : "Aguarde a distribuição de novos leads pelo gestor"
              }
            </p>
          </div>
        )}

        {/* Dialog de detalhes do lead */}
        <Dialog open={detailsDialog} onOpenChange={setDetailsDialog}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl">{selectedLead?.nome}</DialogTitle>
              <DialogDescription>
                Detalhes completos do lead e histórico de interações
              </DialogDescription>
            </DialogHeader>
            
            {selectedLead && (
              <div className="space-y-6">
                {/* Informações básicas */}
                <div>
                  <h3 className="font-semibold mb-3">Informações de Contato</h3>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <a href={`tel:${selectedLead.telefone}`} className="hover:underline">
                        {selectedLead.telefone}
                      </a>
                    </div>
                    {selectedLead.email && (
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <a href={`mailto:${selectedLead.email}`} className="hover:underline">
                          {selectedLead.email}
                        </a>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-sm">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span>{projects?.find(p => p.id === selectedLead.projectId)?.nome || "Sem projeto"}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>
                        Criado em: {format(new Date(selectedLead.createdAt), "dd/MM/yyyy", { locale: ptBR })}
                      </span>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Status e Follow-up */}
                <div>
                  <h3 className="font-semibold mb-3">Status e Follow-up</h3>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <Label>Status Atual</Label>
                      <Select
                        value={selectedLead.status}
                        onValueChange={(value) => {
                          handleUpdateStatus(selectedLead.id, value);
                          setSelectedLead({ ...selectedLead, status: value });
                        }}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(statusLabels).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Follow-up Consecutivo</Label>
                      <div className="mt-1 p-2 border rounded-md bg-muted/50">
                        <span className="text-sm font-medium">
                          Dia {selectedLead.diasFollowupConsecutivos} de 5
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Observações */}
                <div>
                  <Label htmlFor="observacoes-detail">Observações</Label>
                  <Textarea
                    id="observacoes-detail"
                    value={selectedLead.observacoes || ""}
                    onChange={(e) => setSelectedLead({ ...selectedLead, observacoes: e.target.value })}
                    onBlur={() => handleUpdateObservacoes(selectedLead.id, selectedLead.observacoes || "")}
                    rows={3}
                    placeholder="Adicione observações sobre o lead..."
                    className="mt-1"
                  />
                </div>

                <Separator />

                {/* Histórico de interações */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold">Histórico de Interações</h3>
                    <Button
                      size="sm"
                      onClick={() => {
                        setInteractionDialog(true);
                        setDetailsDialog(false);
                      }}
                    >
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Nova Interação
                    </Button>
                  </div>
                  
                  {leadHistory && leadHistory.length > 0 ? (
                    <div className="space-y-3 max-h-[300px] overflow-y-auto">
                      {leadHistory.map((interaction: any) => (
                        <div key={interaction.id} className="p-3 border rounded-lg bg-muted/50">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{tipoLabels[interaction.tipo]}</Badge>
                              <Badge variant="secondary">{resultadoLabels[interaction.resultado]}</Badge>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(interaction.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                            </span>
                          </div>
                          {interaction.observacoes && (
                            <p className="text-sm text-muted-foreground mt-2">
                              {interaction.observacoes}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Nenhuma interação registrada ainda</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Dialog de interação */}
        <Dialog open={interactionDialog} onOpenChange={setInteractionDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar Interação</DialogTitle>
              <DialogDescription>
                Adicione um registro de contato com o lead {selectedLead?.nome}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="tipo">Tipo de Contato</Label>
                <Select
                  value={interactionForm.tipo}
                  onValueChange={(value: any) => setInteractionForm({ ...interactionForm, tipo: value })}
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
                <Label htmlFor="resultado">Resultado</Label>
                <Select
                  value={interactionForm.resultado}
                  onValueChange={(value: any) => setInteractionForm({ ...interactionForm, resultado: value })}
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
                <Label htmlFor="observacoes">Observações</Label>
                <Textarea
                  id="observacoes"
                  value={interactionForm.observacoes}
                  onChange={(e) => setInteractionForm({ ...interactionForm, observacoes: e.target.value })}
                  rows={4}
                  placeholder="Descreva o que foi conversado..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setInteractionDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleAddInteraction} disabled={addInteractionMutation.isPending}>
                {addInteractionMutation.isPending ? "Salvando..." : "Salvar Interação"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

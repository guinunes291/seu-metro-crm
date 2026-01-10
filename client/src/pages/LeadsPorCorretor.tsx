import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Loader2, Users, UserCheck, UserX, Phone, Mail, Calendar, Filter, RefreshCw, Trash2, MessageCircle } from "lucide-react";
import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { toast } from "sonner";
import { useWebhookLeadNotification } from "@/hooks/useWebhookLeadNotification";

type LeadStatus = 'novo' | 'aguardando_atendimento' | 'em_atendimento' | 'agendado' | 'visita_realizada' | 'analise_credito' | 'contrato_fechado' | 'perdido';

const statusLabels: Record<LeadStatus, string> = {
  novo: "Novo",
  aguardando_atendimento: "Aguardando",
  em_atendimento: "Em Atendimento",
  agendado: "Agendado",
  visita_realizada: "Visita Realizada",
  analise_credito: "Análise de Crédito",
  contrato_fechado: "Contrato Fechado",
  perdido: "Perdido",
};

const statusColors: Record<LeadStatus, string> = {
  novo: "bg-blue-100 text-blue-800",
  aguardando_atendimento: "bg-yellow-100 text-yellow-800",
  em_atendimento: "bg-purple-100 text-purple-800",
  agendado: "bg-orange-100 text-orange-800",
  visita_realizada: "bg-cyan-100 text-cyan-800",
  analise_credito: "bg-indigo-100 text-indigo-800",
  contrato_fechado: "bg-green-100 text-green-800",
  perdido: "bg-red-100 text-red-800",
};

export default function LeadsPorCorretor() {
  // Hook de notificação para leads Facebook Ads
  useWebhookLeadNotification();
  
  const [corretorId, setCorretorId] = useState<number | undefined>(undefined);
  const [status, setStatus] = useState<LeadStatus | undefined>(undefined);
  const [dataInicio, setDataInicio] = useState<string>("");
  const [dataFim, setDataFim] = useState<string>("");
  const [selectedLeads, setSelectedLeads] = useState<number[]>([]);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Buscar corretores
  const { data: corretores, isLoading: loadingCorretores } = trpc.corretores.list.useQuery();

  // Buscar estatísticas por corretor
  const { data: estatisticas, isLoading: loadingEstatisticas, refetch: refetchEstatisticas } = 
    trpc.distribution.getEstatisticasPorCorretor.useQuery();

  // Buscar leads com filtros
  const { data: leads, isLoading: loadingLeads, refetch: refetchLeads } = 
    trpc.distribution.getLeadsPorCorretor.useQuery({
      corretorId,
      status,
      dataInicio: dataInicio || undefined,
      dataFim: dataFim || undefined,
    });

  // Mutation para excluir múltiplos leads
  const deleteManyMutation = trpc.leads.deleteMany.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.deleted} lead(s) excluído(s) com sucesso`);
      setSelectedLeads([]);
      refetchLeads();
      refetchEstatisticas();
    },
    onError: (error) => {
      toast.error(`Erro ao excluir leads: ${error.message}`);
    },
  });

  const handleRefresh = () => {
    refetchEstatisticas();
    refetchLeads();
  };

  const clearFilters = () => {
    setCorretorId(undefined);
    setStatus(undefined);
    setDataInicio("");
    setDataFim("");
  };

  const toggleSelectLead = (leadId: number) => {
    setSelectedLeads(prev => 
      prev.includes(leadId) 
        ? prev.filter(id => id !== leadId)
        : [...prev, leadId]
    );
  };

  const toggleSelectAll = () => {
    if (leads && selectedLeads.length === leads.length) {
      setSelectedLeads([]);
    } else if (leads) {
      setSelectedLeads(leads.map(l => l.id));
    }
  };

  const handleDeleteSelected = () => {
    if (selectedLeads.length === 0) return;
    setShowDeleteDialog(true);
  };

  const confirmDelete = () => {
    deleteManyMutation.mutate({ ids: selectedLeads });
    setShowDeleteDialog(false);
  };

  if (loadingCorretores || loadingEstatisticas) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Leads por Corretor</h1>
            <p className="text-muted-foreground">
              Acompanhe os leads de cada corretor com filtros detalhados
            </p>
          </div>
          <div className="flex gap-2">
            {selectedLeads.length > 0 && (
              <Button 
                variant="destructive" 
                onClick={handleDeleteSelected}
                disabled={deleteManyMutation.isPending}
              >
                {deleteManyMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                Excluir ({selectedLeads.length})
              </Button>
            )}
            <Button variant="outline" onClick={handleRefresh}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Atualizar
            </Button>
          </div>
        </div>

        {/* Cards de Resumo por Corretor */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {estatisticas?.map((corretor) => (
            <Card 
              key={corretor.id} 
              className={`cursor-pointer transition-all hover:shadow-md ${
                corretorId === corretor.id ? "ring-2 ring-primary" : ""
              }`}
              onClick={() => setCorretorId(corretorId === corretor.id ? undefined : corretor.id)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{corretor.nome}</CardTitle>
                  <Badge variant={corretor.totalLeads > 0 ? "default" : "secondary"}>
                    {corretor.totalLeads} leads
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-1">
                    <UserCheck className="h-4 w-4 text-green-600" />
                    <span>{corretor.contratos} convertidos</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4 text-blue-600" />
                    <span>{corretor.emAtendimento} atendendo</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <UserX className="h-4 w-4 text-red-600" />
                    <span>{corretor.perdidos} perdidos</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground">
                      Taxa: {corretor.taxaConversao}%
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filtros */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
              {/* Corretor */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Corretor</label>
                <Select 
                  value={corretorId?.toString() || "all"} 
                  onValueChange={(v) => setCorretorId(v === "all" ? undefined : parseInt(v))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os corretores" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os corretores</SelectItem>
                    {corretores?.map((corretor) => (
                      <SelectItem key={corretor.id} value={corretor.id.toString()}>
                        {corretor.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Status */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <Select 
                  value={status || "all"} 
                  onValueChange={(v) => setStatus(v === "all" ? undefined : v as LeadStatus)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os status</SelectItem>
                    {Object.entries(statusLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Data Início */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Data Início</label>
                <input
                  type="date"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                />
              </div>

              {/* Data Fim */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Data Fim</label>
                <input
                  type="date"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                />
              </div>

              {/* Botão Limpar */}
              <div className="space-y-2">
                <label className="text-sm font-medium">&nbsp;</label>
                <Button variant="outline" className="w-full" onClick={clearFilters}>
                  Limpar Filtros
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabela de Leads */}
        <Card>
          <CardHeader>
            <CardTitle>Leads</CardTitle>
            <CardDescription>
              {leads?.length || 0} lead(s) encontrado(s)
              {selectedLeads.length > 0 && ` • ${selectedLeads.length} selecionado(s)`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingLeads ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : leads && leads.length > 0 ? (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={leads.length > 0 && selectedLeads.length === leads.length}
                          onCheckedChange={toggleSelectAll}
                        />
                      </TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Corretor</TableHead>
                      <TableHead>Contato</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Projeto</TableHead>
                      <TableHead>Data Criação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leads.map((lead) => (
                      <TableRow key={lead.id} className={`${
                        selectedLeads.includes(lead.id) ? "bg-muted/50" : ""
                      } ${lead.origemWebhook ? 'bg-red-50/30 border-l-4 border-l-red-500' : ''}`}>
                        <TableCell>
                          <Checkbox
                            checked={selectedLeads.includes(lead.id)}
                            onCheckedChange={() => toggleSelectLead(lead.id)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {lead.nome}
                            {lead.origemWebhook && (
                              <Badge className="bg-red-600 hover:bg-red-700 text-white text-xs">
                                🔥 ADS URGENTE
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{lead.corretorNome || "-"}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {lead.telefone && (
                              <div className="flex items-center gap-1 text-sm">
                                <Phone className="h-3 w-3" />
                                {lead.telefone}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-5 w-5 p-0 ml-1 bg-green-50 hover:bg-green-100 text-green-700"
                                  onClick={() => {
                                    const phone = lead.telefone?.replace(/\D/g, '') || '';
                                    const formattedPhone = phone.startsWith('55') ? phone : `55${phone}`;
                                    window.open(`https://wa.me/${formattedPhone}`, '_blank');
                                  }}
                                >
                                  <MessageCircle className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                            {lead.email && (
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <Mail className="h-3 w-3" />
                                {lead.email}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={statusColors[lead.status as LeadStatus] || ""}>
                            {statusLabels[lead.status as LeadStatus] || lead.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{lead.projectNome || "-"}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {lead.createdAt 
                              ? new Date(lead.createdAt).toLocaleDateString('pt-BR')
                              : "-"
                            }
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Users className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium">Nenhum lead encontrado</p>
                <p className="text-sm text-muted-foreground">
                  Ajuste os filtros para ver os leads
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog de confirmação de exclusão */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir {selectedLeads.length} lead(s)?
              Esta ação não pode ser desfeita. Todo o histórico de interações
              também será excluído.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Search, ArrowRightLeft, History, User, Phone, Mail } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function GestaoAtribuicoes() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [corretorFilter, setCorretorFilter] = useState<string>('');
  const [tipoFilter, setTipoFilter] = useState<'lead' | 'contrato' | ''>('');
  
  // Modal de reatribuição
  const [modalAberto, setModalAberto] = useState(false);
  const [leadSelecionado, setLeadSelecionado] = useState<any>(null);
  const [novoCorretorId, setNovoCorretorId] = useState<string>('');
  const [motivo, setMotivo] = useState('');
  const [observacoes, setObservacoes] = useState('');
  
  // Modal de histórico
  const [historicoAberto, setHistoricoAberto] = useState(false);
  const [leadHistorico, setLeadHistorico] = useState<any>(null);

  // Queries
  const { data: leads, refetch: refetchLeads } = trpc.leads.list.useQuery({
    searchTerm,
    status: statusFilter || undefined,
    corretorId: corretorFilter ? parseInt(corretorFilter) : undefined,
    limit: 100,
  });

  const { data: corretores } = trpc.corretores.list.useQuery();
  
  const { data: historico } = trpc.reatribuicao.listarHistorico.useQuery({
    leadId: leadHistorico?.id,
    limit: 20,
  }, {
    enabled: !!leadHistorico,
  });

  // Mutations
  const utils = trpc.useUtils();
  
  const reatribuirLead = trpc.reatribuicao.reatribuirLead.useMutation({
    onSuccess: () => {
      toast.success('Lead reatribuído com sucesso! As métricas serão atualizadas automaticamente.');
      setModalAberto(false);
      
      // Invalidar todas as queries relacionadas para atualização em tempo real
      utils.leads.list.invalidate();
      utils.leads.getById.invalidate();
      utils.reatribuicao.listarHistorico.invalidate();
      utils.dashboard.invalidate(); // Atualiza dashboard
      utils.performance.invalidate(); // Atualiza performance
      utils.corretores.invalidate(); // Atualiza lista de corretores
      
      resetForm();
    },
    onError: (error) => {
      toast.error(`Erro ao reatribuir lead: ${error.message}`);
    },
  });

  const resetForm = () => {
    setLeadSelecionado(null);
    setNovoCorretorId('');
    setMotivo('');
    setObservacoes('');
  };

  const handleReatribuir = (lead: any) => {
    setLeadSelecionado(lead);
    setModalAberto(true);
  };

  const handleConfirmarReatribuicao = () => {
    if (!novoCorretorId) {
      toast.error('Selecione um corretor');
      return;
    }

    reatribuirLead.mutate({
      leadId: leadSelecionado.id,
      novoCorretorId: parseInt(novoCorretorId),
      motivo,
      observacoes,
    });
  };

  const handleVerHistorico = (lead: any) => {
    setLeadHistorico(lead);
    setHistoricoAberto(true);
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      novo: { label: 'Novo', variant: 'default' },
      aguardando_atendimento: { label: 'Aguardando', variant: 'secondary' },
      em_atendimento: { label: 'Em Atendimento', variant: 'default' },
      agendado: { label: 'Agendado', variant: 'default' },
      visita_realizada: { label: 'Visita Realizada', variant: 'default' },
      analise_credito: { label: 'Análise', variant: 'default' },
      contrato_fechado: { label: 'Contrato Fechado', variant: 'default' },
      perdido: { label: 'Perdido', variant: 'destructive' },
    };

    const config = statusMap[status] || { label: status, variant: 'outline' };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Gestão de Atribuições</h1>
        <p className="text-muted-foreground">
          Reatribua leads e contratos entre corretores de forma fácil e rápida
        </p>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>Filtre leads por status, corretor ou busca</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Buscar</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Nome, telefone, email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={statusFilter || "todos"} onValueChange={(v) => setStatusFilter(v === "todos" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="novo">Novo</SelectItem>
                  <SelectItem value="aguardando_atendimento">Aguardando</SelectItem>
                  <SelectItem value="em_atendimento">Em Atendimento</SelectItem>
                  <SelectItem value="agendado">Agendado</SelectItem>
                  <SelectItem value="visita_realizada">Visita Realizada</SelectItem>
                  <SelectItem value="analise_credito">Análise de Crédito</SelectItem>
                  <SelectItem value="contrato_fechado">Contrato Fechado</SelectItem>
                  <SelectItem value="perdido">Perdido</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Corretor Atual</Label>
              <Select value={corretorFilter || "todos"} onValueChange={(v) => setCorretorFilter(v === "todos" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {corretores?.map((corretor) => (
                    <SelectItem key={corretor.id} value={corretor.id.toString()}>
                      {corretor.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={tipoFilter || "todos"} onValueChange={(v) => setTipoFilter(v === "todos" ? "" : (v as any))}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="lead">Apenas Leads</SelectItem>
                  <SelectItem value="contrato">Apenas Contratos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Leads */}
      <Card>
        <CardHeader>
          <CardTitle>Leads ({leads?.leads.length || 0})</CardTitle>
          <CardDescription>Clique em "Reatribuir" para transferir o lead para outro corretor</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {leads?.leads.map((lead) => (
              <div
                key={lead.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
              >
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold">{lead.nome}</h3>
                    {getStatusBadge(lead.status)}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    {lead.telefone && (
                      <div className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {lead.telefone}
                      </div>
                    )}
                    {lead.email && (
                      <div className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {lead.email}
                      </div>
                    )}
                    {lead.corretorNome && (
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {lead.corretorNome}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleVerHistorico(lead)}
                  >
                    <History className="h-4 w-4 mr-2" />
                    Histórico
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleReatribuir(lead)}
                  >
                    <ArrowRightLeft className="h-4 w-4 mr-2" />
                    Reatribuir
                  </Button>
                </div>
              </div>
            ))}

            {!leads?.leads.length && (
              <div className="text-center py-12 text-muted-foreground">
                Nenhum lead encontrado
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Modal de Reatribuição */}
      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reatribuir Lead</DialogTitle>
            <DialogDescription>
              Transferir lead "{leadSelecionado?.nome}" para outro corretor
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Corretor Atual</Label>
              <Input value={leadSelecionado?.corretorNome || 'Não atribuído'} disabled />
            </div>

            <div className="space-y-2">
              <Label>Novo Corretor *</Label>
              <Select value={novoCorretorId} onValueChange={setNovoCorretorId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um corretor" />
                </SelectTrigger>
                <SelectContent>
                  {corretores
                    ?.filter((c) => c.id !== leadSelecionado?.corretorId)
                    .map((corretor) => (
                      <SelectItem key={corretor.id} value={corretor.id.toString()}>
                        {corretor.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Motivo</Label>
              <Input
                placeholder="Ex: Redistribuição de carga"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                placeholder="Observações adicionais (opcional)"
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalAberto(false)}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmarReatribuicao} disabled={reatribuirLead.isPending}>
              {reatribuirLead.isPending ? 'Reatribuindo...' : 'Confirmar Reatribuição'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Histórico */}
      <Dialog open={historicoAberto} onOpenChange={setHistoricoAberto}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Histórico de Transferências</DialogTitle>
            <DialogDescription>
              Histórico completo de reatribuições do lead "{leadHistorico?.nome}"
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {historico?.map((item) => (
              <div key={item.id} className="p-4 border rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <Badge>{item.tipo === 'lead' ? 'Lead' : 'Contrato'}</Badge>
                  <span className="text-sm text-muted-foreground">
                    {new Date(item.createdAt).toLocaleString('pt-BR')}
                  </span>
                </div>
                <div className="text-sm">
                  <p>
                    <span className="font-medium">De:</span> Corretor ID {item.corretorAnteriorId}
                  </p>
                  <p>
                    <span className="font-medium">Para:</span> Corretor ID {item.corretorNovoId}
                  </p>
                  {item.motivo && (
                    <p>
                      <span className="font-medium">Motivo:</span> {item.motivo}
                    </p>
                  )}
                  {item.observacoes && (
                    <p className="text-muted-foreground">{item.observacoes}</p>
                  )}
                </div>
              </div>
            ))}

            {!historico?.length && (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma transferência registrada
              </div>
            )}
          </div>

          <DialogFooter>
            <Button onClick={() => setHistoricoAberto(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

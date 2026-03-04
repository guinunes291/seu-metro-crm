import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { trpc } from '@/lib/trpc';
import { DollarSign, TrendingUp, Clock, CheckCircle, Upload, Building2, AlertCircle, XCircle, Undo2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useAuth } from '@/_core/hooks/useAuth';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/** Formata data de venda com segurança de timezone (evita aparecer um dia antes) */
function formatDataVenda(dataVenda: string | Date): string {
  const str = typeof dataVenda === 'string' ? dataVenda : dataVenda.toISOString();
  const safeStr = str.includes('T') ? str : str + 'T12:00:00';
  return format(new Date(safeStr), 'dd/MM/yyyy', { locale: ptBR });
}

function ComissoesContent() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');
  const [filtroTipo, setFiltroTipo] = useState<string>('todos');
  const [dialogImportOpen, setDialogImportOpen] = useState(false);
  
  // Estado de edição inline do percentual da imobiliária
  const [editandoPercentualId, setEditandoPercentualId] = useState<number | null>(null);
  const [novoPercentual, setNovoPercentual] = useState<string>('');

  // Estados para distrato
  const [dialogDistrato, setDialogDistrato] = useState(false);
  const [contratoDistrato, setContratoDistrato] = useState<{ id: number; cliente: string } | null>(null);
  const [motivoDistrato, setMotivoDistrato] = useState('');
  const [abaAtiva, setAbaAtiva] = useState<'comissoes' | 'distratos'>('comissoes');

  // Estados do formulário de importação
  const [contratoId, setContratoId] = useState<number | null>(null);
  const [usuarioId, setUsuarioId] = useState<number | null>(null);
  const [tipo, setTipo] = useState<string>('corretor');
  const [valorBase, setValorBase] = useState('');
  const [percentual, setPercentual] = useState('');
  const [percentualDesconto, setPercentualDesconto] = useState('0');
  const [status, setStatus] = useState('pendente_assinatura');
  
  // Query de comissões
  const { data: comissoes, isLoading } = trpc.comissoes.listar.useQuery({
    status: filtroStatus === 'todos' ? undefined : filtroStatus,
    tipo: filtroTipo === 'todos' ? undefined : filtroTipo,
  });
  
  // Mutations
  const utils = trpc.useUtils();
  const marcarComoPagaMutation = trpc.comissoes.marcarComoPaga.useMutation({
    onSuccess: () => {
      utils.comissoes.listar.invalidate();
    },
  });
  
  // Mutation para atualizar percentual da imobiliária
  const atualizarPercentualMutation = trpc.dashboard.atualizarContrato.useMutation({
    onSuccess: () => {
      utils.comissoes.listarImobiliaria.invalidate();
      setEditandoPercentualId(null);
      setNovoPercentual('');
      toast.success('Percentual atualizado com sucesso!');
    },
    onError: (error) => {
      toast.error(`Erro ao atualizar: ${error.message}`);
    },
  });

  // Mutation para atualizar status de recebimento da imobiliária
  const atualizarStatusImobMutation = trpc.comissoes.atualizarStatusImobiliaria.useMutation({
    onSuccess: () => {
      utils.comissoes.listarImobiliaria.invalidate();
      toast.success('Status atualizado com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar status: ' + error.message);
    },
  });

  // Mutations para distrato
  const registrarDistrato = trpc.dashboard.registrarDistrato.useMutation({
    onSuccess: () => {
      utils.comissoes.listarImobiliaria.invalidate();
      utils.dashboard.listarDistratos.invalidate();
      utils.dashboard.metricasDistratos.invalidate();
      setDialogDistrato(false);
      setMotivoDistrato('');
      setContratoDistrato(null);
      toast.success('Distrato registrado com sucesso! O contrato foi removido das métricas.');
    },
    onError: (error) => {
      toast.error('Erro ao registrar distrato: ' + error.message);
    },
  });

  const desfazerDistrato = trpc.dashboard.desfazerDistrato.useMutation({
    onSuccess: () => {
      utils.comissoes.listarImobiliaria.invalidate();
      utils.dashboard.listarDistratos.invalidate();
      utils.dashboard.metricasDistratos.invalidate();
      toast.success('Distrato desfeito. Contrato restaurado nas métricas.');
    },
    onError: (error) => {
      toast.error('Erro ao desfazer distrato: ' + error.message);
    },
  });

  // Query de distratos
  const { data: distratos } = trpc.dashboard.listarDistratos.useQuery(
    undefined,
    { enabled: isAdmin }
  );

  const { data: metricasDistratos } = trpc.dashboard.metricasDistratos.useQuery(
    undefined,
    { enabled: isAdmin }
  );

  // Mutation para gerar comissões em lote
  const gerarEmLoteMutation = trpc.comissoes.gerarEmLote.useMutation({
    onSuccess: (data) => {
      utils.comissoes.listar.invalidate();
      utils.comissoes.listarImobiliaria.invalidate();
      toast.success(data.mensagem || data.gerados + ' comissões geradas com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao gerar comissões: ' + error.message);
    },
  });

  const importarComissaoMutation = trpc.comissoes.importarManual.useMutation({
    onSuccess: () => {
      toast.success('Comissão importada com sucesso!');
      utils.comissoes.listar.invalidate();
      limparFormulario();
      setDialogImportOpen(false);
    },
    onError: (error) => {
      toast.error(`Erro ao importar comissão: ${error.message}`);
    },
  });
  
  // Queries para selects
  const { data: contratos } = trpc.comissoes.listarContratos.useQuery();
  const { data: usuarios } = trpc.comissoes.listarUsuarios.useQuery();

  // Query de comissões da imobiliária (admin only)
  const { data: comissoesImobiliaria } = trpc.comissoes.listarImobiliaria.useQuery(
    undefined,
    { enabled: isAdmin }
  );

  // Preencher VGV automaticamente ao selecionar contrato
  useEffect(() => {
    if (contratoId && contratos) {
      const contrato = contratos.find(c => c.id === contratoId);
      if (contrato?.valorVenda) {
        const vgv = Number(contrato.valorVenda);
        setValorBase(vgv.toFixed(2).replace('.', ','));
      }
    }
  }, [contratoId, contratos]);
  
  const limparFormulario = () => {
    setContratoId(null);
    setUsuarioId(null);
    setTipo('corretor');
    setValorBase('');
    setPercentual('');
    setPercentualDesconto('0');
    setStatus('pendente_assinatura');
  };
  
  const handleImportar = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!contratoId || !usuarioId || !valorBase || !percentual) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }
    
    const valorBaseNum = parseFloat(valorBase.replace(/[^\d,]/g, '').replace(',', '.'));
    const percentualNum = parseFloat(percentual.replace(',', '.'));
    const percentualDescontoNum = parseFloat(percentualDesconto.replace(',', '.'));
    
    const valorComissao = (valorBaseNum * percentualNum) / 100;
    const valorLiquido = valorComissao - (valorComissao * percentualDescontoNum / 100);
    
    importarComissaoMutation.mutate({
      contratoId,
      usuarioId,
      tipo: tipo as 'corretor' | 'gerente' | 'superintendente',
      valorBase: valorBaseNum,
      percentual: percentualNum,
      valorComissao,
      percentualDesconto: percentualDescontoNum,
      valorLiquido,
      status: status as 'pendente_assinatura' | 'a_pagar' | 'paga',
    });
  };
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };
  
  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline', label: string }> = {
      pendente_assinatura: { variant: 'secondary', label: 'Pendente Assinatura' },
      a_pagar: { variant: 'default', label: 'A Pagar' },
      paga: { variant: 'outline', label: 'Paga' },
    };
    
    const config = variants[status] || { variant: 'outline', label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };
  
  const getTipoBadge = (tipo: string) => {
    const labels: Record<string, string> = {
      corretor: 'Corretor',
      gerente: 'Gerente',
      superintendente: 'Superintendente',
    };
    return <Badge variant="outline">{labels[tipo] || tipo}</Badge>;
  };

  const getStatusImobBadge = (status: string) => {
    const config: Record<string, { className: string; label: string }> = {
      pendente: { className: 'text-orange-700 border-orange-300 bg-orange-50', label: 'Pendente' },
      recebido: { className: 'text-emerald-700 border-emerald-300 bg-emerald-50', label: 'Recebido' },
      em_disputa: { className: 'text-red-700 border-red-300 bg-red-50', label: 'Em Disputa' },
    };
    const c = config[status] || config.pendente;
    return <Badge variant="outline" className={c.className}>{c.label}</Badge>;
  };
  
  // Calcular totais das comissões individuais
  const totalAPagar = comissoes?.filter(c => c.status === 'a_pagar').reduce((sum, c) => sum + Number(c.valorLiquido), 0) || 0;
  const totalPendente = comissoes?.filter(c => c.status === 'pendente_assinatura').reduce((sum, c) => sum + Number(c.valorLiquido), 0) || 0;
  const totalPago = comissoes?.filter(c => c.status === 'paga').reduce((sum, c) => sum + Number(c.valorLiquido), 0) || 0;

  // Calcular totais da imobiliária
  const totalImobiliaria = comissoesImobiliaria?.reduce((sum, c) => sum + c.valorComissao, 0) || 0;
  const totalImobRecebido = comissoesImobiliaria?.filter(c => c.statusRecebimento === 'recebido').reduce((sum, c) => sum + c.valorComissao, 0) || 0;
  const totalImobPendente = comissoesImobiliaria?.filter(c => c.statusRecebimento !== 'recebido').reduce((sum, c) => sum + c.valorComissao, 0) || 0;
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Comissões</h1>
          <p className="text-muted-foreground">Gerencie e acompanhe suas comissões de vendas</p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => gerarEmLoteMutation.mutate()}
              disabled={gerarEmLoteMutation.isPending}
            >
              <TrendingUp className="w-4 h-4 mr-2" />
              {gerarEmLoteMutation.isPending ? 'Gerando...' : 'Gerar Comissões em Lote'}
            </Button>
            <Dialog open={dialogImportOpen} onOpenChange={setDialogImportOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Upload className="w-4 h-4 mr-2" />
                  Importar Comissão
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Importar Comissão Manual</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleImportar} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="contrato">Contrato *</Label>
                    <Select value={contratoId?.toString() || ''} onValueChange={(v) => setContratoId(Number(v))}>
                      <SelectTrigger id="contrato">
                        <SelectValue placeholder="Selecione o contrato" />
                      </SelectTrigger>
                      <SelectContent className="z-[9999]">
                        {contratos?.map((c) => (
                          <SelectItem key={c.id} value={c.id.toString()}>
                            {c.clienteNome} - {c.projetoNome || c.projetoCustom}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="usuario">Beneficiário *</Label>
                    <Select value={usuarioId?.toString() || ''} onValueChange={(v) => setUsuarioId(Number(v))}>
                      <SelectTrigger id="usuario">
                        <SelectValue placeholder="Selecione o usuário" />
                      </SelectTrigger>
                      <SelectContent className="z-[9999]">
                        {usuarios?.map((u) => (
                          <SelectItem key={u.id} value={u.id.toString()}>
                            {u.name} ({u.role})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="tipo">Tipo</Label>
                      <Select value={tipo} onValueChange={setTipo}>
                        <SelectTrigger id="tipo">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="corretor">Corretor</SelectItem>
                          <SelectItem value="gerente">Gerente</SelectItem>
                          <SelectItem value="superintendente">Superintendente</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="status">Status</Label>
                      <Select value={status} onValueChange={setStatus}>
                        <SelectTrigger id="status">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pendente_assinatura">Pendente Assinatura</SelectItem>
                          <SelectItem value="a_pagar">A Pagar</SelectItem>
                          <SelectItem value="paga">Paga</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="valorBase">Valor Base (VGV) *</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">R$</span>
                        <Input
                          id="valorBase"
                          value={valorBase}
                          onChange={(e) => setValorBase(e.target.value.replace(/[^\d,]/g, ''))}
                          placeholder="0,00"
                          className="pl-10"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="percentual">Percentual (%) *</Label>
                      <div className="relative">
                        <Input
                          id="percentual"
                          value={percentual}
                          onChange={(e) => setPercentual(e.target.value.replace(/[^\d,]/g, ''))}
                          placeholder="1,85"
                          className="pr-8"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="percentualDesconto">Desconto NF (%)</Label>
                    <div className="relative">
                      <Input
                        id="percentualDesconto"
                        value={percentualDesconto}
                        onChange={(e) => setPercentualDesconto(e.target.value.replace(/[^\d,]/g, ''))}
                        placeholder="0 ou 6"
                        className="pr-8"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Aplicar 6% quando o cliente tiver entrada menor que 6%
                    </p>
                  </div>
                  
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setDialogImportOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={importarComissaoMutation.isPending}>
                      Importar
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      {/* Cards da Imobiliária - Admin only */}
      {isAdmin && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-2 border-emerald-200 bg-emerald-50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-semibold text-emerald-800">Total Imobiliária</CardTitle>
              <Building2 className="h-4 w-4 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-700">{formatCurrency(totalImobiliaria)}</div>
              <p className="text-xs text-emerald-600 mt-1">{comissoesImobiliaria?.length || 0} contratos (3-4% VGV)</p>
            </CardContent>
          </Card>
          <Card className="border-2 border-orange-200 bg-orange-50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-semibold text-orange-800">A Receber</CardTitle>
              <Clock className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-700">{formatCurrency(totalImobPendente)}</div>
              <p className="text-xs text-orange-600 mt-1">Pendente / Em disputa</p>
            </CardContent>
          </Card>
          <Card className="border-2 border-blue-200 bg-blue-50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-semibold text-blue-800">Já Recebido</CardTitle>
              <CheckCircle className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-700">{formatCurrency(totalImobRecebido)}</div>
              <p className="text-xs text-blue-600 mt-1">Confirmado pela incorporadora</p>
            </CardContent>
          </Card>
          <Card
            className="border-2 border-red-200 bg-red-50 cursor-pointer hover:bg-red-100 transition-colors"
            onClick={() => setAbaAtiva(abaAtiva === 'distratos' ? 'comissoes' : 'distratos')}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-semibold text-red-800">Distratos</CardTitle>
              <XCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-700">{metricasDistratos?.totalDistratos || 0}</div>
              <p className="text-xs text-red-600 mt-1">{formatCurrency(metricasDistratos?.vgvDistratado || 0)} em VGV</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Cards de Resumo das Comissões Individuais */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">A Pagar</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(totalAPagar)}</div>
            <p className="text-xs text-muted-foreground mt-1">Pronto para pagamento</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendente Assinatura</CardTitle>
            <Clock className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{formatCurrency(totalPendente)}</div>
            <p className="text-xs text-muted-foreground mt-1">Aguardando financiamento</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pagas</CardTitle>
            <CheckCircle className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{formatCurrency(totalPago)}</div>
            <p className="text-xs text-muted-foreground mt-1">Total recebido</p>
          </CardContent>
        </Card>
      </div>
      
      {/* Seção Comissões da Imobiliária - Admin only */}
      {isAdmin && comissoesImobiliaria && comissoesImobiliaria.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-emerald-600" />
              <div>
                <CardTitle>Comissões da Imobiliária por Contrato</CardTitle>
                <CardDescription>Detalhamento do percentual recebido pela imobiliária em cada venda — clique no status para alterar</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Projeto</TableHead>
                    <TableHead className="text-right">VGV</TableHead>
                    <TableHead className="text-right">% Imobiliária</TableHead>
                    <TableHead className="text-right">Comissão</TableHead>
                    <TableHead>Status Recebimento</TableHead>
                    <TableHead>Data da Venda</TableHead>
                    <TableHead className="text-center">Distrato</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comissoesImobiliaria.map((item) => (
                    <TableRow key={item.contratoId}>
                      <TableCell className="font-medium">{item.clienteNome}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{item.projetoNome}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.valorVenda)}</TableCell>
                      <TableCell className="text-right">
                        {editandoPercentualId === item.contratoId ? (
                          <div className="flex items-center gap-1 justify-end">
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              max="100"
                              value={novoPercentual}
                              onChange={(e) => setNovoPercentual(e.target.value)}
                              className="w-20 h-7 text-sm text-right"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  atualizarPercentualMutation.mutate({
                                    contratoId: item.contratoId,
                                    percentualComissao: parseFloat(novoPercentual),
                                  });
                                }
                                if (e.key === 'Escape') {
                                  setEditandoPercentualId(null);
                                }
                              }}
                            />
                            <span className="text-sm text-muted-foreground">%</span>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-emerald-600"
                              onClick={() => atualizarPercentualMutation.mutate({
                                contratoId: item.contratoId,
                                percentualComissao: parseFloat(novoPercentual),
                              })}
                            >
                              ✓
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-red-500"
                              onClick={() => setEditandoPercentualId(null)}
                            >
                              ✕
                            </Button>
                          </div>
                        ) : (
                          <div
                            className="flex items-center gap-1 justify-end cursor-pointer group"
                            onClick={() => {
                              setEditandoPercentualId(item.contratoId);
                              setNovoPercentual(item.percentualImobiliaria.toFixed(2));
                            }}
                          >
                            <Badge variant="outline" className="text-emerald-700 border-emerald-300 group-hover:bg-emerald-50">
                              {item.percentualImobiliaria.toFixed(2)}%
                            </Badge>
                            <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">✏️</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-bold text-emerald-700">
                        {formatCurrency(item.valorComissao)}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={item.statusRecebimento || 'pendente'}
                          onValueChange={(novoStatus) => {
                            atualizarStatusImobMutation.mutate({
                              contratoId: item.contratoId,
                              status: novoStatus as 'pendente' | 'recebido' | 'em_disputa',
                            });
                          }}
                        >
                          <SelectTrigger className="w-[140px] h-8 text-xs">
                            <SelectValue>
                              {getStatusImobBadge(item.statusRecebimento || 'pendente')}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pendente">
                              <div className="flex items-center gap-2">
                                <Clock className="h-3 w-3 text-orange-500" />
                                Pendente
                              </div>
                            </SelectItem>
                            <SelectItem value="recebido">
                              <div className="flex items-center gap-2">
                                <CheckCircle className="h-3 w-3 text-emerald-500" />
                                Recebido
                              </div>
                            </SelectItem>
                            <SelectItem value="em_disputa">
                              <div className="flex items-center gap-2">
                                <AlertCircle className="h-3 w-3 text-red-500" />
                                Em Disputa
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>{formatDataVenda(item.dataVenda)}</TableCell>
                      <TableCell className="text-center">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-red-600 hover:text-red-700 hover:bg-red-50 text-xs"
                          onClick={() => {
                            setContratoDistrato({ id: item.contratoId, cliente: item.clienteNome });
                            setDialogDistrato(true);
                          }}
                        >
                          <XCircle className="h-3.5 w-3.5 mr-1" />
                          Distrato
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabela de Distratos - Admin only */}
      {isAdmin && abaAtiva === 'distratos' && (
        <Card className="border-2 border-red-200">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-600" />
                <div>
                  <CardTitle className="text-red-800">Distratos Registrados</CardTitle>
                  <CardDescription>Contratos cancelados por desistência do cliente — excluídos de VGV, metas e comissões</CardDescription>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => setAbaAtiva('comissoes')}>
                Fechar
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {!distratos || distratos.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <XCircle className="h-12 w-12 mx-auto mb-3 text-red-200" />
                <p>Nenhum distrato registrado</p>
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Corretor</TableHead>
                      <TableHead>Projeto</TableHead>
                      <TableHead className="text-right">VGV</TableHead>
                      <TableHead>Data da Venda</TableHead>
                      <TableHead>Data Distrato</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead className="text-center">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {distratos.map((d) => (
                      <TableRow key={d.id} className="bg-red-50/50">
                        <TableCell className="font-medium">{d.cliente}</TableCell>
                        <TableCell>{d.corretor}</TableCell>
                        <TableCell className="max-w-[160px] truncate">{d.projeto}</TableCell>
                        <TableCell className="text-right text-red-700 font-semibold line-through">{formatCurrency(d.vgv)}</TableCell>
                        <TableCell>{formatDataVenda(d.dataVenda)}</TableCell>
                        <TableCell>
                          {d.dataDistrato ? format(new Date(d.dataDistrato), 'dd/MM/yyyy', { locale: ptBR }) : '-'}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">{d.motivoDistrato || '-'}</TableCell>
                        <TableCell className="text-center">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => desfazerDistrato.mutate({ contratoId: d.id })}
                            disabled={desfazerDistrato.isPending}
                          >
                            <Undo2 className="h-3 w-3 mr-1" />
                            Desfazer
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Dialog de Confirmação de Distrato */}
      <Dialog open={dialogDistrato} onOpenChange={setDialogDistrato}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <XCircle className="h-5 w-5" />
              Registrar Distrato
            </DialogTitle>
            <DialogDescription>
              Registrar distrato para o contrato de <strong>{contratoDistrato?.cliente}</strong>.
              Este contrato será removido das métricas de VGV, metas e comissões.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="motivo">Motivo do Distrato *</Label>
              <Textarea
                id="motivo"
                value={motivoDistrato}
                onChange={(e) => setMotivoDistrato(e.target.value)}
                placeholder="Descreva o motivo da desistência do cliente..."
                rows={3}
              />
            </div>
            <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700">
              <strong>Atenção:</strong> Esta ação irá:
              <ul className="mt-1 ml-4 list-disc space-y-0.5">
                <li>Remover o contrato do VGV e das metas</li>
                <li>Cancelar as comissões pendentes</li>
                <li>Reverter o lead para "Em Atendimento"</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogDistrato(false)}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={!motivoDistrato.trim() || registrarDistrato.isPending}
              onClick={() => {
                if (contratoDistrato) {
                  registrarDistrato.mutate({
                    contratoId: contratoDistrato.id,
                    motivoDistrato: motivoDistrato.trim(),
                  });
                }
              }}
            >
              {registrarDistrato.isPending ? 'Registrando...' : 'Confirmar Distrato'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Filtros e Tabela */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Minhas Comissões</CardTitle>
              <CardDescription>Histórico completo de comissões</CardDescription>
            </div>
            <div className="flex gap-2">
              <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Status</SelectItem>
                  <SelectItem value="pendente_assinatura">Pendente Assinatura</SelectItem>
                  <SelectItem value="a_pagar">A Pagar</SelectItem>
                  <SelectItem value="paga">Paga</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Tipos</SelectItem>
                  <SelectItem value="corretor">Corretor</SelectItem>
                  <SelectItem value="gerente">Gerente</SelectItem>
                  <SelectItem value="superintendente">Superintendente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : !comissoes || comissoes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Nenhuma comissão encontrada</div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    {isAdmin && <TableHead>Beneficiário</TableHead>}
                    <TableHead>Tipo</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Projeto</TableHead>
                    <TableHead className="text-right">VGV</TableHead>
                    <TableHead className="text-right">%</TableHead>
                    <TableHead className="text-right">Comissão</TableHead>
                    <TableHead className="text-right">Desconto</TableHead>
                    <TableHead className="text-right">Valor Líquido</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data Venda</TableHead>
                    {isAdmin && <TableHead className="text-center">Ações</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comissoes.map((comissao) => (
                    <TableRow key={comissao.id}>
                      {isAdmin && <TableCell>{comissao.usuarioNome}</TableCell>}
                      <TableCell>{getTipoBadge(comissao.tipo)}</TableCell>
                      <TableCell>{comissao.clienteNome}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{comissao.projetoNome}</TableCell>
                      <TableCell className="text-right">{formatCurrency(Number(comissao.valorBase))}</TableCell>
                      <TableCell className="text-right">{Number(comissao.percentual).toFixed(2)}%</TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(Number(comissao.valorComissao))}</TableCell>
                      <TableCell className="text-right text-red-600">
                        {Number(comissao.percentualDesconto) > 0 ? `-${Number(comissao.percentualDesconto).toFixed(0)}%` : '-'}
                      </TableCell>
                      <TableCell className="text-right font-bold text-green-600">
                        {formatCurrency(Number(comissao.valorLiquido))}
                      </TableCell>
                      <TableCell>{getStatusBadge(comissao.status)}</TableCell>
                      <TableCell>{formatDataVenda(comissao.dataVenda)}</TableCell>
                      {isAdmin && (
                        <TableCell className="text-center">
                          {comissao.status === 'a_pagar' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => marcarComoPagaMutation.mutate({ id: comissao.id })}
                              disabled={marcarComoPagaMutation.isPending}
                            >
                              Marcar como Paga
                            </Button>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


export default function Comissoes() {
  return (
    <DashboardLayout>
      <ComissoesContent />
    </DashboardLayout>
  );
}

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { trpc } from '@/lib/trpc';
import { DollarSign, TrendingUp, Clock, CheckCircle, Filter, Upload, Building2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useAuth } from '@/_core/hooks/useAuth';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function ComissoesContent() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');
  const [filtroTipo, setFiltroTipo] = useState<string>('todos');
  const [dialogImportOpen, setDialogImportOpen] = useState(false);
  
  // Estado de edição inline do percentual da imobiliária
  const [editandoPercentualId, setEditandoPercentualId] = useState<number | null>(null);
  const [novoPercentual, setNovoPercentual] = useState<string>('');

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
  
  // Calcular totais
  const totalAPagar = comissoes?.filter(c => c.status === 'a_pagar').reduce((sum, c) => sum + Number(c.valorLiquido), 0) || 0;
  const totalPendente = comissoes?.filter(c => c.status === 'pendente_assinatura').reduce((sum, c) => sum + Number(c.valorLiquido), 0) || 0;
  const totalPago = comissoes?.filter(c => c.status === 'paga').reduce((sum, c) => sum + Number(c.valorLiquido), 0) || 0;

  // Calcular total da imobiliária
  const totalImobiliaria = comissoesImobiliaria?.reduce((sum, c) => sum + c.valorComissao, 0) || 0;
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Comissões</h1>
          <p className="text-muted-foreground">Gerencie e acompanhe suas comissões de vendas</p>
        </div>
        {isAdmin && (
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
                    <Label htmlFor="tipo">Tipo *</Label>
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
                    <Label htmlFor="status">Status *</Label>
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
                    <Input
                      id="valorBase"
                      value={valorBase}
                      onChange={(e) => setValorBase(e.target.value)}
                      placeholder="R$ 500.000,00"
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="percentual">Percentual *</Label>
                    <div className="relative">
                      <Input
                        id="percentual"
                        value={percentual}
                        onChange={(e) => setPercentual(e.target.value.replace(/[^\d,]/g, ''))}
                        placeholder="1,85"
                        className="pr-8"
                        required
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
        )}
      </div>
      
      {/* Card Imobiliária - Admin only */}
      {isAdmin && (
        <Card className="border-2 border-emerald-200 bg-emerald-50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-base font-semibold text-emerald-800">Comissão da Imobiliária</CardTitle>
              <CardDescription className="text-emerald-600">Total a receber das incorporadoras (3-4% do VGV)</CardDescription>
            </div>
            <Building2 className="h-6 w-6 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-700">{formatCurrency(totalImobiliaria)}</div>
            <p className="text-sm text-emerald-600 mt-1">{comissoesImobiliaria?.length || 0} contratos</p>
          </CardContent>
        </Card>
      )}

      {/* Cards de Resumo */}
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
                <CardDescription>Detalhamento do percentual recebido pela imobiliária em cada venda</CardDescription>
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
                    <TableHead className="text-right">Comissão Imobiliária</TableHead>
                    <TableHead>Data da Venda</TableHead>
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
                      <TableCell>{format(new Date(item.dataVenda), 'dd/MM/yyyy', { locale: ptBR })}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

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
                      <TableCell>{format(new Date(comissao.dataVenda), 'dd/MM/yyyy', { locale: ptBR })}</TableCell>
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

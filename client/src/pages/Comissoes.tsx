import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { trpc } from '@/lib/trpc';
import { DollarSign, TrendingUp, Clock, CheckCircle, Filter } from 'lucide-react';
import { useAuth } from '@/_core/hooks/useAuth';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function Comissoes() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');
  const [filtroTipo, setFiltroTipo] = useState<string>('todos');
  
  // Query de comissões
  const { data: comissoes, isLoading } = trpc.comissoes.listar.useQuery({
    status: filtroStatus === 'todos' ? undefined : filtroStatus,
    tipo: filtroTipo === 'todos' ? undefined : filtroTipo,
  });
  
  // Mutation para marcar como paga
  const utils = trpc.useUtils();
  const marcarComoPagaMutation = trpc.comissoes.marcarComoPaga.useMutation({
    onSuccess: () => {
      utils.comissoes.listar.invalidate();
    },
  });
  
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
  
  return (
    <div className="container mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Comissões</h1>
        <p className="text-muted-foreground">Gerencie e acompanhe suas comissões de vendas</p>
      </div>
      
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

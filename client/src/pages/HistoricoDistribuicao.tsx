import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  History, 
  Filter, 
  RefreshCw, 
  ChevronLeft, 
  ChevronRight,
  Zap,
  User,
  Clock,
  TrendingUp,
  BarChart3
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

export default function HistoricoDistribuicao() {
  const { user } = useAuth();
  const [page, setPage] = useState(0);
  const [filtros, setFiltros] = useState<{
    dataInicio?: string;
    dataFim?: string;
    corretorId?: number;
    tipo?: 'automatica' | 'manual' | 'inicial';
  }>({});
  
  const pageSize = 20;
  
  // Queries
  const { data: historico, isLoading, refetch } = trpc.historicoDistribuicao.list.useQuery({
    dataInicio: filtros.dataInicio ? new Date(filtros.dataInicio) : undefined,
    dataFim: filtros.dataFim ? new Date(filtros.dataFim) : undefined,
    corretorId: filtros.corretorId,
    tipo: filtros.tipo,
    limit: pageSize,
    offset: page * pageSize,
  });
  
  const { data: estatisticas } = trpc.historicoDistribuicao.estatisticas.useQuery({ dias: 30 });
  const { data: corretores } = trpc.corretores.list.useQuery();
  
  // Verificar permissão
  if (user?.role !== 'gestor' && user?.role !== 'admin' && user?.role !== 'superintendente') {
    return (
      <DashboardLayout>
        <div className="container py-8">
          <div className="text-center py-16">
            <History className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-2xl font-bold mb-2">Acesso Restrito</h2>
            <p className="text-muted-foreground">
              Apenas gestores podem acessar o histórico de distribuição.
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }
  
  const totalPages = Math.ceil((historico?.total || 0) / pageSize);
  
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };
  
  const getTipoBadge = (tipo: string) => {
    switch (tipo) {
      case 'automatica':
        return <Badge className="bg-green-500 hover:bg-green-600"><Zap className="h-3 w-3 mr-1" />Automática</Badge>;
      case 'manual':
        return <Badge className="bg-blue-500 hover:bg-blue-600"><User className="h-3 w-3 mr-1" />Manual</Badge>;
      case 'inicial':
        return <Badge className="bg-purple-500 hover:bg-purple-600"><Clock className="h-3 w-3 mr-1" />Inicial</Badge>;
      default:
        return <Badge variant="outline">{tipo}</Badge>;
    }
  };
  
  const limparFiltros = () => {
    setFiltros({});
    setPage(0);
  };
  
  // Calcular totais das estatísticas
  const totalAutomaticas = estatisticas?.reduce((acc, item) => acc + item.automaticas, 0) || 0;
  const totalManuais = estatisticas?.reduce((acc, item) => acc + item.manuais, 0) || 0;
  const totalDistribuicoes = totalAutomaticas + totalManuais;
  
  return (
    <DashboardLayout>
      <div className="container py-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <History className="h-8 w-8" />
            Histórico de Distribuição
          </h1>
          <p className="text-muted-foreground mt-1">
            Visualize todas as distribuições de leads realizadas no sistema
          </p>
        </div>
        
        {/* Cards de estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total (30 dias)</CardDescription>
              <CardTitle className="text-3xl">{totalDistribuicoes}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">distribuições realizadas</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <Zap className="h-4 w-4 text-green-500" />
                Automáticas
              </CardDescription>
              <CardTitle className="text-3xl text-green-600">{totalAutomaticas}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                {totalDistribuicoes > 0 ? Math.round((totalAutomaticas / totalDistribuicoes) * 100) : 0}% do total
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <User className="h-4 w-4 text-blue-500" />
                Manuais
              </CardDescription>
              <CardTitle className="text-3xl text-blue-600">{totalManuais}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                {totalDistribuicoes > 0 ? Math.round((totalManuais / totalDistribuicoes) * 100) : 0}% do total
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <TrendingUp className="h-4 w-4 text-purple-500" />
                Média/Dia
              </CardDescription>
              <CardTitle className="text-3xl text-purple-600">
                {estatisticas && estatisticas.length > 0 
                  ? Math.round(totalDistribuicoes / estatisticas.length) 
                  : 0}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">distribuições por dia</p>
            </CardContent>
          </Card>
        </div>
        
        {/* Gráfico de distribuições */}
        {estatisticas && estatisticas.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Distribuições por Dia (30 dias)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={estatisticas}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="data" 
                      tickFormatter={(value) => {
                        const date = new Date(value);
                        return `${date.getDate()}/${date.getMonth() + 1}`;
                      }}
                    />
                    <YAxis />
                    <Tooltip 
                      labelFormatter={(value) => {
                        const date = new Date(value);
                        return date.toLocaleDateString('pt-BR');
                      }}
                    />
                    <Legend />
                    <Bar dataKey="automaticas" name="Automáticas" fill="#22c55e" stackId="a" />
                    <Bar dataKey="manuais" name="Manuais" fill="#3b82f6" stackId="a" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Filtros */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="space-y-2">
                <Label>Data Início</Label>
                <Input
                  type="date"
                  value={filtros.dataInicio || ''}
                  onChange={(e) => {
                    setFiltros({ ...filtros, dataInicio: e.target.value });
                    setPage(0);
                  }}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Data Fim</Label>
                <Input
                  type="date"
                  value={filtros.dataFim || ''}
                  onChange={(e) => {
                    setFiltros({ ...filtros, dataFim: e.target.value });
                    setPage(0);
                  }}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Corretor</Label>
                <Select
                  value={filtros.corretorId?.toString() || 'todos'}
                  onValueChange={(value) => {
                    setFiltros({ 
                      ...filtros, 
                      corretorId: value === 'todos' ? undefined : parseInt(value) 
                    });
                    setPage(0);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    {corretores?.map((c) => (
                      <SelectItem key={c.id} value={c.id.toString()}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select
                  value={filtros.tipo || 'todos'}
                  onValueChange={(value) => {
                    setFiltros({ 
                      ...filtros, 
                      tipo: value === 'todos' ? undefined : value as any 
                    });
                    setPage(0);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="automatica">Automática</SelectItem>
                    <SelectItem value="manual">Manual</SelectItem>
                    <SelectItem value="inicial">Inicial</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>&nbsp;</Label>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={limparFiltros} className="flex-1">
                    Limpar
                  </Button>
                  <Button variant="outline" onClick={() => refetch()}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Tabela de histórico */}
        <Card>
          <CardHeader>
            <CardTitle>Registro de Distribuições</CardTitle>
            <CardDescription>
              {historico?.total || 0} registros encontrados
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Carregando...
              </div>
            ) : historico?.items && historico.items.length > 0 ? (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Lead</TableHead>
                      <TableHead>Corretor</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Distribuído Por</TableHead>
                      <TableHead>Motivo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historico.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="whitespace-nowrap">
                          {formatDate(item.createdAt)}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{item.leadNome}</p>
                            {item.leadTelefone && (
                              <p className="text-sm text-muted-foreground">{item.leadTelefone}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{item.corretorNome || '-'}</TableCell>
                        <TableCell>{getTipoBadge(item.tipo)}</TableCell>
                        <TableCell>
                          {item.tipo === 'automatica' ? (
                            <span className="text-muted-foreground">Sistema (Roleta)</span>
                          ) : item.distribuidoPorNome ? (
                            item.distribuidoPorNome
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {item.motivo || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                
                {/* Paginação */}
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Mostrando {page * pageSize + 1} a {Math.min((page + 1) * pageSize, historico.total)} de {historico.total}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.max(0, p - 1))}
                      disabled={page === 0}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Anterior
                    </Button>
                    <span className="text-sm">
                      Página {page + 1} de {totalPages || 1}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => p + 1)}
                      disabled={page >= totalPages - 1}
                    >
                      Próxima
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma distribuição encontrada</p>
                <p className="text-sm">Ajuste os filtros ou aguarde novas distribuições</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

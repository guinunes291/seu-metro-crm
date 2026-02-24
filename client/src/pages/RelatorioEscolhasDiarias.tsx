import { useState, useMemo, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CheckCircle2, XCircle, Calendar, TrendingUp, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

type PeriodOption = 'ultimos7' | 'ultimos30' | 'ultimos90' | 'todoperiodo';

export default function RelatorioEscolhasDiarias() {
  const [periodo, setPeriodo] = useState<PeriodOption>('ultimos30');
  const [corretorSelecionado, setCorretorSelecionado] = useState<number | undefined>(undefined);

  // Calcular datas baseado no período
  const { dataInicio, dataFim } = useMemo(() => {
    const hoje = new Date();
    const fim = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 23, 59, 59);
    let inicio: Date;

    switch (periodo) {
      case 'ultimos7':
        inicio = new Date(hoje.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'ultimos30':
        inicio = new Date(hoje.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'ultimos90':
        inicio = new Date(hoje.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case 'todoperiodo':
        inicio = new Date(2024, 0, 1); // 1º de janeiro de 2024
        break;
      default:
        inicio = new Date(hoje.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    return { dataInicio: inicio, dataFim: fim };
  }, [periodo]);

  // Buscar dados do relatório
  const { data, isLoading, error } = trpc.progressoFollowUps.getRelatorioEscolhasDiarias.useQuery({
    dataInicio,
    dataFim,
    corretorId: corretorSelecionado,
  });
  
  // Debug: log dos dados retornados
  useEffect(() => {
    console.log('[Frontend] Dados do relatório:', { data, isLoading, error, dataInicio, dataFim });
  }, [data, isLoading, error, dataInicio, dataFim]);

  // Buscar lista de corretores para o filtro
  const { data: corretoresData } = trpc.users.listCorretores.useQuery();

  const periodoLabel = {
    ultimos7: 'Últimos 7 dias',
    ultimos30: 'Últimos 30 dias',
    ultimos90: 'Últimos 90 dias',
    todoperiodo: 'Todo o período',
  };

  if (isLoading) {
    return (
      <div className="container py-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="container py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Relatório de Escolhas Diárias</h1>
          <p className="text-muted-foreground">
            Acompanhe a adesão dos corretores ao sistema de follow-up
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Select value={periodo} onValueChange={(v) => setPeriodo(v as PeriodOption)}>
            <SelectTrigger className="w-[180px]">
              <Calendar className="mr-2 h-4 w-4" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ultimos7">Últimos 7 dias</SelectItem>
              <SelectItem value="ultimos30">Últimos 30 dias</SelectItem>
              <SelectItem value="ultimos90">Últimos 90 dias</SelectItem>
              <SelectItem value="todoperiodo">Todo o período</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={corretorSelecionado?.toString() || 'todos'}
            onValueChange={(v) => setCorretorSelecionado(v === 'todos' ? undefined : parseInt(v))}
          >
            <SelectTrigger className="w-[200px]">
              <Users className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Todos os corretores" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os corretores</SelectItem>
              {corretoresData?.map((corretor) => (
                <SelectItem key={corretor.id} value={corretor.id.toString()}>
                  {corretor.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Cards de Estatísticas */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Escolhas</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.estatisticas.totalEscolhas || 0}</div>
            <p className="text-xs text-muted-foreground">{periodoLabel[periodo]}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aceitaram Follow-up</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {data?.estatisticas.totalAceitou || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {data?.estatisticas.totalEscolhas
                ? Math.round(
                    ((data.estatisticas.totalAceitou / data.estatisticas.totalEscolhas) * 100) * 10
                  ) / 10
                : 0}
              % do total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recusaram Follow-up</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {data?.estatisticas.totalRecusou || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {data?.estatisticas.totalEscolhas
                ? Math.round(
                    ((data.estatisticas.totalRecusou / data.estatisticas.totalEscolhas) * 100) * 10
                  ) / 10
                : 0}
              % do total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Adesão</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.estatisticas.taxaAdesao || 0}%</div>
            <p className="text-xs text-muted-foreground">
              Percentual de aceitação
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Corretores */}
      <Card>
        <CardHeader>
          <CardTitle>Adesão por Corretor</CardTitle>
          <CardDescription>
            Detalhamento de escolhas diárias por corretor
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data?.porCorretor && data.porCorretor.length > 0 ? (
            <div className="rounded-md border">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-4 text-left font-medium">Corretor</th>
                    <th className="p-4 text-center font-medium">Total de Escolhas</th>
                    <th className="p-4 text-center font-medium">Aceitou</th>
                    <th className="p-4 text-center font-medium">Recusou</th>
                    <th className="p-4 text-center font-medium">Taxa de Adesão</th>
                  </tr>
                </thead>
                <tbody>
                  {data.porCorretor
                    .sort((a, b) => b.taxaAdesao - a.taxaAdesao)
                    .map((corretor) => (
                      <tr key={corretor.corretorId} className="border-b">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={corretor.foto || undefined} />
                              <AvatarFallback>
                                {corretor.nome
                                  .split(' ')
                                  .map((n) => n[0])
                                  .join('')
                                  .toUpperCase()
                                  .slice(0, 2)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{corretor.nome}</span>
                          </div>
                        </td>
                        <td className="p-4 text-center">{corretor.totalEscolhas}</td>
                        <td className="p-4 text-center">
                          <Badge variant="outline" className="border-green-600 text-green-600">
                            {corretor.totalAceitou}
                          </Badge>
                        </td>
                        <td className="p-4 text-center">
                          <Badge variant="outline" className="border-red-600 text-red-600">
                            {corretor.totalRecusou}
                          </Badge>
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div className="h-2 w-24 rounded-full bg-muted overflow-hidden">
                              <div
                                className="h-full bg-green-600"
                                style={{ width: `${corretor.taxaAdesao}%` }}
                              />
                            </div>
                            <span className="text-sm font-medium">
                              {Math.round(corretor.taxaAdesao)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">Nenhuma escolha registrada</p>
              <p className="text-sm text-muted-foreground">
                Não há dados de escolhas diárias para o período selecionado
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

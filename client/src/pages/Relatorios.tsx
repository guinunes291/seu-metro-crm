import React, { useState, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { FunilChart } from "@/components/charts/FunilChart";
import { BarChart } from "@/components/charts/BarChart";
import { LineChart } from "@/components/charts/LineChart";
import { PieChart } from "@/components/charts/PieChart";
import { ScatterChart } from "@/components/charts/ScatterChart";
import { Heatmap } from "@/components/charts/Heatmap";
import { DataTable } from "@/components/charts/DataTable";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";
import { CustomReportBuilder } from "@/components/CustomReportBuilder";

// ============================================================================
// COMPONENTE: Relatório de Leads Facebook ADS Perdidos por Timer
// ============================================================================

function FacebookTimerRelatorio({
  dataInicio,
  dataFim,
  periodo,
}: {
  dataInicio: Date | undefined;
  dataFim: Date | undefined;
  periodo: string;
}) {
  // Datas padrão: mês atual
  const defaultInicio = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const defaultFim = useMemo(() => new Date(), []);

  const inicio = dataInicio || defaultInicio;
  const fim = dataFim || defaultFim;

  const { data, isLoading, error } = trpc.relatorios.leadsTimerPorCorretor.useQuery({
    dataInicio: inicio.toISOString(),
    dataFim: fim.toISOString(),
  }, {
    refetchOnWindowFocus: false,
  });

  const totais = useMemo(() => {
    if (!data) return { recebidos: 0, perdidos: 0, taxaMedia: 0 };
    const recebidos = data.reduce((s, r) => s + r.recebidos, 0);
    const perdidos = data.reduce((s, r) => s + r.perdidosPorTimer, 0);
    const taxaMedia = recebidos > 0 ? Math.round((perdidos / recebidos) * 100) : 0;
    return { recebidos, perdidos, taxaMedia };
  }, [data]);

  // Ordenar por perdidos desc
  const dadosOrdenados = useMemo(() => {
    if (!data) return [];
    return [...data].sort((a, b) => b.perdidosPorTimer - a.perdidosPorTimer);
  }, [data]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Calculando métricas...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-destructive">Erro ao carregar dados: {error.message}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Leads Facebook ADS — Perdidos por Timer</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Leads recebidos via Facebook ADS que foram redistribuídos automaticamente por não atendimento em 15 minutos.
          Período: {inicio.toLocaleDateString('pt-BR')} – {fim.toLocaleDateString('pt-BR')}
        </p>
      </div>

      {/* Cards de totais */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Recebidos</CardDescription>
            <CardTitle className="text-3xl text-blue-600">{totais.recebidos}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Leads Facebook ADS distribuídos no período</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Perdidos por Timer</CardDescription>
            <CardTitle className="text-3xl text-red-600">{totais.perdidos}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Não atendidos em 15 min e redistribuídos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Taxa de Perda Média</CardDescription>
            <CardTitle className={`text-3xl ${
              totais.taxaMedia >= 50 ? 'text-red-600' :
              totais.taxaMedia >= 25 ? 'text-yellow-600' : 'text-green-600'
            }`}>{totais.taxaMedia}%</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Percentual perdido sobre recebidos</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabela por corretor */}
      {dadosOrdenados.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground py-8">
              Nenhum dado encontrado para o período selecionado.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Detalhamento por Corretor</CardTitle>
            <CardDescription>Ordenado por maior número de leads perdidos</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">#</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Corretor</th>
                    <th className="text-center py-3 px-4 font-medium text-muted-foreground">Recebidos</th>
                    <th className="text-center py-3 px-4 font-medium text-muted-foreground">Perdidos por Timer</th>
                    <th className="text-center py-3 px-4 font-medium text-muted-foreground">Atendidos</th>
                    <th className="text-center py-3 px-4 font-medium text-muted-foreground">Taxa de Perda</th>
                  </tr>
                </thead>
                <tbody>
                  {dadosOrdenados.map((row, idx) => {
                    const atendidos = row.recebidos - row.perdidosPorTimer;
                    return (
                      <tr
                        key={row.corretorId}
                        className={`border-b last:border-0 ${
                          row.perdidosPorTimer > 0 ? 'hover:bg-muted/50' : 'opacity-60 hover:bg-muted/30'
                        }`}
                      >
                        <td className="py-3 px-4 text-muted-foreground">{idx + 1}</td>
                        <td className="py-3 px-4 font-medium">{row.corretorNome}</td>
                        <td className="py-3 px-4 text-center">{row.recebidos}</td>
                        <td className="py-3 px-4 text-center">
                          <span className={`font-semibold ${
                            row.perdidosPorTimer > 0 ? 'text-red-600' : 'text-green-600'
                          }`}>
                            {row.perdidosPorTimer}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center text-green-600">{atendidos}</td>
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-xs font-medium ${
                            row.taxaPerda >= 50
                              ? 'bg-red-100 text-red-700'
                              : row.taxaPerda >= 25
                              ? 'bg-yellow-100 text-yellow-700'
                              : row.taxaPerda > 0
                              ? 'bg-orange-100 text-orange-700'
                              : 'bg-green-100 text-green-700'
                          }`}>
                            {row.taxaPerda}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Gráfico de barras */}
      {dadosOrdenados.filter(r => r.recebidos > 0).length > 0 && (
        <BarChart
          data={dadosOrdenados.filter(r => r.recebidos > 0)}
          dataKeys={[
            { key: 'recebidos', name: 'Recebidos', color: 'hsl(var(--chart-1))' },
            { key: 'perdidosPorTimer', name: 'Perdidos por Timer', color: 'hsl(var(--destructive))' },
          ]}
          xAxisKey="corretorNome"
          title="Recebidos vs Perdidos por Timer"
          description="Comparação por corretor"
          layout="vertical"
          height={Math.max(300, dadosOrdenados.filter(r => r.recebidos > 0).length * 40)}
        />
      )}
    </div>
  );
}

export default function Relatorios() {
  const [periodo, setPeriodo] = useState<string>("all");
  const [customStart, setCustomStart] = useState<Date | undefined>();
  const [customEnd, setCustomEnd] = useState<Date | undefined>();

  // Calcular datas baseado no período selecionado
  const getDateRange = () => {
    if (periodo === "custom" && customStart && customEnd) {
      return { dataInicio: customStart, dataFim: customEnd };
    }
    // Para outros períodos, o DateRangeFilter já calcula
    return { dataInicio: undefined, dataFim: undefined };
  };

  const { dataInicio, dataFim } = getDateRange();

  // Queries para todos os relatórios
  const funilQuery = trpc.relatorios.funilConversao.useQuery({ dataInicio, dataFim });
  const taxaConversaoQuery = trpc.relatorios.taxaConversaoPorCorretor.useQuery({ dataInicio, dataFim });
  const tempoMedioQuery = trpc.relatorios.tempoMedioPorEtapa.useQuery({ dataInicio, dataFim });
  const evolucaoVendasQuery = trpc.relatorios.evolucaoVendas.useQuery(
    { 
      dataInicio: dataInicio || new Date(new Date().setMonth(new Date().getMonth() - 3)), 
      dataFim: dataFim || new Date(),
      agrupamento: 'dia'
    },
    { enabled: !!dataInicio || !!dataFim }
  );
  const distribuicaoProjetosQuery = trpc.relatorios.distribuicaoVendasPorProjeto.useQuery({ dataInicio, dataFim });
  const origemEfetivaQuery = trpc.relatorios.origemLeadsMaisEfetiva.useQuery({ dataInicio, dataFim });
  const leadsPorHorarioQuery = trpc.relatorios.leadsPorHorarioEntrada.useQuery({ dataInicio, dataFim });
  const rankingQuery = trpc.relatorios.rankingCorretores.useQuery({ dataInicio, dataFim });
  const produtividadeQuery = trpc.relatorios.produtividadePorCorretor.useQuery({ dataInicio, dataFim });
  const comparativoMensalQuery = trpc.relatorios.comparativoMensalCorretores.useQuery({
    anoInicio: new Date().getFullYear() - 1,
    anoFim: new Date().getFullYear()
  });
  const cargaTrabalhoQuery = trpc.relatorios.cargaTrabalho.useQuery();
  const previsaoVendasQuery = trpc.relatorios.previsaoVendas.useQuery();

  const isLoading = funilQuery.isLoading || taxaConversaoQuery.isLoading;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Relatórios de Gestão</h1>
            <p className="text-muted-foreground">
              Análises completas de performance, conversão e produtividade
            </p>
          </div>
          
          <DateRangeFilter
            value={periodo}
            onChange={(value, start, end) => {
              setPeriodo(value);
              setCustomStart(start);
              setCustomEnd(end);
            }}
          />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-96">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <Tabs defaultValue="vendas" className="space-y-6">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="vendas">Vendas</TabsTrigger>
              <TabsTrigger value="leads">Leads</TabsTrigger>
              <TabsTrigger value="corretores">Corretores</TabsTrigger>
              <TabsTrigger value="facebook-timer">Facebook Timer</TabsTrigger>
              <TabsTrigger value="previsao">Previsão</TabsTrigger>
              <TabsTrigger value="personalizado">Personalizado</TabsTrigger>
            </TabsList>

            {/* ABA: VENDAS */}
            <TabsContent value="vendas" className="space-y-6">
              {/* Funil de Conversão */}
              <FunilChart
                data={funilQuery.data || []}
                title="Funil de Conversão Geral"
                description="Leads em cada etapa do funil com taxas de conversão"
              />

              <div className="grid gap-6 md:grid-cols-2">
                {/* Evolução de Vendas (VGV) */}
                {evolucaoVendasQuery.data && evolucaoVendasQuery.data.length > 0 && (
                  <LineChart
                    data={evolucaoVendasQuery.data}
                    dataKeys={[
                      { key: 'vgv', name: 'VGV (R$)', color: 'hsl(var(--primary))' },
                      { key: 'quantidade', name: 'Quantidade', color: 'hsl(var(--chart-2))' }
                    ]}
                    xAxisKey="periodo"
                    title="Evolução de Vendas (VGV)"
                    description="Valor total de vendas por período"
                    height={350}
                  />
                )}

                {/* Distribuição por Projeto */}
                {distribuicaoProjetosQuery.data && distribuicaoProjetosQuery.data.length > 0 && (
                  <PieChart
                    data={distribuicaoProjetosQuery.data}
                    dataKey="quantidade"
                    nameKey="projetoNome"
                    title="Distribuição de Vendas por Projeto"
                    description="Percentual de vendas de cada empreendimento"
                    height={350}
                  />
                )}
              </div>

              {/* Tempo Médio por Etapa */}
              {tempoMedioQuery.data && tempoMedioQuery.data.length > 0 && (
                <BarChart
                  data={tempoMedioQuery.data}
                  dataKeys={[
                    { key: 'tempoMedioDias', name: 'Dias', color: 'hsl(var(--primary))' }
                  ]}
                  xAxisKey="status"
                  title="Tempo Médio por Etapa do Funil"
                  description="Quantos dias os leads permanecem em cada status"
                  height={300}
                />
              )}
            </TabsContent>

            {/* ABA: LEADS */}
            <TabsContent value="leads" className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                {/* Origem de Leads mais Efetiva */}
                {origemEfetivaQuery.data && origemEfetivaQuery.data.length > 0 && (
                  <BarChart
                    data={origemEfetivaQuery.data}
                    dataKeys={[
                      { key: 'totalLeads', name: 'Total de Leads', color: 'hsl(var(--chart-1))' },
                      { key: 'leadsFechados', name: 'Leads Fechados', color: 'hsl(var(--chart-2))' }
                    ]}
                    xAxisKey="origem"
                    title="Origem de Leads mais Efetiva"
                    description="Volume e conversão por origem"
                    height={350}
                  />
                )}

                {/* Qualidade de Leads por Origem (Scatter) */}
                {origemEfetivaQuery.data && origemEfetivaQuery.data.length > 0 && (
                  <ScatterChart
                    data={origemEfetivaQuery.data}
                    xKey="totalLeads"
                    yKey="taxaConversao"
                    title="Qualidade de Leads por Origem"
                    description="Volume vs Taxa de Conversão"
                    xLabel="Volume de Leads"
                    yLabel="Taxa de Conversão (%)"
                    height={350}
                  />
                )}
              </div>

              {/* Heatmap de Horários */}
              {leadsPorHorarioQuery.data && leadsPorHorarioQuery.data.length > 0 && (
                <Heatmap
                  data={leadsPorHorarioQuery.data}
                  title="Leads por Horário de Entrada"
                  description="Concentração de novos leads por dia da semana e hora"
                />
              )}
            </TabsContent>

            {/* ABA: CORRETORES */}
            <TabsContent value="corretores" className="space-y-6">
              {/* Ranking de Corretores */}
              {rankingQuery.data && rankingQuery.data.length > 0 && (
                <DataTable
                  data={rankingQuery.data}
                  columns={[
                    { key: 'corretorNome', label: 'Corretor', align: 'left' },
                    { key: 'leadsAtendidos', label: 'Leads Atendidos', align: 'center' },
                    { key: 'leadsFechados', label: 'Leads Fechados', align: 'center' },
                    { 
                      key: 'taxaConversao', 
                      label: 'Taxa Conversão', 
                      align: 'center',
                      format: (val) => `${val}%`
                    },
                    { 
                      key: 'vgvGerado', 
                      label: 'VGV Gerado', 
                      align: 'right',
                      format: (val) => `R$ ${val.toLocaleString('pt-BR')}`
                    },
                    { 
                      key: 'tempoMedioRespostaMinutos', 
                      label: 'Tempo Resposta (min)', 
                      align: 'center',
                      format: (val) => val ? Math.round(val) : '-'
                    }
                  ]}
                  title="Ranking de Corretores"
                  description="Métricas completas de performance"
                />
              )}

              <div className="grid gap-6 md:grid-cols-2">
                {/* Taxa de Conversão por Corretor */}
                {taxaConversaoQuery.data && taxaConversaoQuery.data.length > 0 && (
                  <BarChart
                    data={taxaConversaoQuery.data}
                    dataKeys={[
                      { key: 'taxaConversao', name: 'Taxa de Conversão (%)', color: 'hsl(var(--primary))' }
                    ]}
                    xAxisKey="corretorNome"
                    title="Taxa de Conversão por Corretor"
                    description="Percentual de leads fechados"
                    layout="vertical"
                    height={400}
                  />
                )}

                {/* Carga de Trabalho */}
                {cargaTrabalhoQuery.data && cargaTrabalhoQuery.data.length > 0 && (
                  <BarChart
                    data={cargaTrabalhoQuery.data}
                    dataKeys={[
                      { key: 'leadsAtivos', name: 'Leads Ativos', color: 'hsl(var(--chart-1))' },
                      { key: 'capacidadeIdeal', name: 'Capacidade Ideal', color: 'hsl(var(--chart-3))' }
                    ]}
                    xAxisKey="corretorNome"
                    title="Carga de Trabalho"
                    description="Leads ativos vs capacidade ideal (50 leads)"
                    layout="vertical"
                    height={400}
                  />
                )}
              </div>

              {/* Produtividade por Corretor */}
              {produtividadeQuery.data && produtividadeQuery.data.length > 0 && (
                <BarChart
                  data={produtividadeQuery.data}
                  dataKeys={[
                    { key: 'emAtendimento', name: 'Em Atendimento', color: 'hsl(var(--chart-1))' },
                    { key: 'agendados', name: 'Agendados', color: 'hsl(var(--chart-2))' },
                    { key: 'visitasRealizadas', name: 'Visitas', color: 'hsl(var(--chart-3))' },
                    { key: 'analiseCredito', name: 'Análise Crédito', color: 'hsl(var(--chart-4))' }
                  ]}
                  xAxisKey="corretorNome"
                  title="Produtividade por Corretor"
                  description="Distribuição de leads por etapa"
                  height={350}
                />
              )}

              {/* Comparativo Mensal */}
              {comparativoMensalQuery.data && comparativoMensalQuery.data.length > 0 && (
                <LineChart
                  data={comparativoMensalQuery.data}
                  dataKeys={
                    // Criar uma linha para cada corretor
                    Array.from(new Set(comparativoMensalQuery.data.map(d => d.corretorNome)))
                      .map((nome, i) => ({
                        key: `vendas_${nome}`,
                        name: nome,
                        color: `hsl(var(--chart-${(i % 5) + 1}))`
                      }))
                  }
                  xAxisKey="mes"
                  title="Comparativo Mensal de Corretores"
                  description="Evolução de vendas mês a mês"
                  height={400}
                />
              )}
            </TabsContent>

            {/* ABA: FACEBOOK TIMER */}
            <TabsContent value="facebook-timer" className="space-y-6">
              <FacebookTimerRelatorio
                dataInicio={dataInicio}
                dataFim={dataFim}
                periodo={periodo}
              />
            </TabsContent>

            {/* ABA: PREVISÃO */}
            <TabsContent value="previsao" className="space-y-6">
              {previsaoVendasQuery.data && (
                <>
                  <div className="grid gap-6 md:grid-cols-3">
                    <Card>
                      <CardHeader>
                        <CardTitle>Previsão de VGV</CardTitle>
                        <CardDescription>Baseado no pipeline atual</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold text-primary">
                          R$ {previsaoVendasQuery.data.previsaoVGV.toLocaleString('pt-BR')}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Taxa Conversão Histórica</CardTitle>
                        <CardDescription>Média geral</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold">
                          {previsaoVendasQuery.data.taxaConversaoHistorica}%
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Leads no Pipeline</CardTitle>
                        <CardDescription>Não fechados nem perdidos</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold">
                          {previsaoVendasQuery.data.pipeline.reduce((sum, p) => sum + p.quantidade, 0)}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Detalhamento do Pipeline */}
                  <DataTable
                    data={previsaoVendasQuery.data.pipeline}
                    columns={[
                      { key: 'status', label: 'Status', align: 'left' },
                      { key: 'quantidade', label: 'Quantidade', align: 'center' },
                      { 
                        key: 'vgvPotencial', 
                        label: 'VGV Potencial', 
                        align: 'right',
                        format: (val) => `R$ ${val.toLocaleString('pt-BR')}`
                      },
                      { 
                        key: 'peso', 
                        label: 'Peso (%)', 
                        align: 'center',
                        format: (val) => `${(val * 100).toFixed(0)}%`
                      },
                      { 
                        key: 'vgvPonderado', 
                        label: 'VGV Ponderado', 
                        align: 'right',
                        format: (val) => `R$ ${val.toLocaleString('pt-BR')}`
                      }
                    ]}
                    title="Detalhamento do Pipeline"
                    description="VGV potencial ponderado por probabilidade de conversão"
                  />
                </>
              )}
            </TabsContent>

            {/* ABA: PERSONALIZADO */}
            <TabsContent value="personalizado" className="space-y-6">
              <CustomReportBuilder />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </DashboardLayout>
  );
}

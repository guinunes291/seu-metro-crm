import DashboardLayout from "@/components/DashboardLayout";
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  TrendingUp, 
  Clock, 
  Target, 
  Award, 
  Trophy,
  Users,
  BarChart3,
  CheckCircle2,
  XCircle
} from "lucide-react";

function MinhaPerformance() {
  const [periodo, setPeriodo] = useState<string>("mes");
  
  // Calcular datas baseado no período selecionado
  const { dataInicio, dataFim } = useMemo(() => {
    const hoje = new Date();
    const fim = hoje.toISOString();
    let inicio: string;
    
    switch (periodo) {
      case "semana":
        const semanaAtras = new Date(hoje);
        semanaAtras.setDate(hoje.getDate() - 7);
        inicio = semanaAtras.toISOString();
        break;
      case "mes":
        const mesAtras = new Date(hoje);
        mesAtras.setMonth(hoje.getMonth() - 1);
        inicio = mesAtras.toISOString();
        break;
      case "ano":
        const anoAtras = new Date(hoje);
        anoAtras.setFullYear(hoje.getFullYear() - 1);
        inicio = anoAtras.toISOString();
        break;
      case "tudo":
      default:
        return { dataInicio: undefined, dataFim: undefined };
    }
    
    return { dataInicio: inicio, dataFim: fim };
  }, [periodo]);
  
  const { data: metricas, isLoading: loadingMetricas } = trpc.performance.minhas.useQuery(
    dataInicio && dataFim ? { dataInicio, dataFim } : undefined
  );
  const { data: ranking, isLoading: loadingRanking } = trpc.performance.ranking.useQuery(
    dataInicio && dataFim ? { dataInicio, dataFim } : undefined
  );

  if (loadingMetricas || loadingRanking) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Carregando métricas...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!metricas || !ranking) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Não foi possível carregar as métricas.</p>
        </div>
      </DashboardLayout>
    );
  }

  // Encontrar posição do corretor no ranking
  const minhaPos = ranking.find((r) => r.corretorId === metricas.totalLeads); // Temporário
  const posicao = minhaPos?.posicao || 0;

  // Determinar badge baseado na posição
  const getBadge = () => {
    if (posicao === 1) return { icon: Trophy, color: "text-yellow-500", label: "🥇 1º Lugar" };
    if (posicao === 2) return { icon: Trophy, color: "text-gray-400", label: "🥈 2º Lugar" };
    if (posicao === 3) return { icon: Trophy, color: "text-amber-600", label: "🥉 3º Lugar" };
    if (posicao <= 5) return { icon: Award, color: "text-blue-500", label: `⭐ Top 5 (${posicao}º)` };
    return { icon: Target, color: "text-muted-foreground", label: `${posicao}º Lugar` };
  };

  const badge = getBadge();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold">Minha Performance</h1>
            <p className="text-muted-foreground">
              Acompanhe suas métricas e compare com a equipe
            </p>
          </div>
          
          {/* Seletor de Período */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Período:</span>
            <Select value={periodo} onValueChange={setPeriodo}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Selecione o período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="semana">Últimos 7 dias</SelectItem>
                <SelectItem value="mes">Últimos 30 dias</SelectItem>
                <SelectItem value="ano">Último ano</SelectItem>
                <SelectItem value="tudo">Todos os períodos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Badge de Ranking */}
        <Card className="p-6 bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
          <div className="flex items-center gap-4">
            <div className={`p-4 rounded-full bg-background ${badge.color}`}>
              <badge.icon className="h-8 w-8" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Sua Posição no Ranking</p>
              <p className="text-2xl font-bold">{badge.label}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {ranking.length} corretores no total
              </p>
            </div>
          </div>
        </Card>

        {/* Métricas Principais */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Total de Leads */}
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total de Leads</p>
                <p className="text-3xl font-bold mt-2">{metricas.totalLeads}</p>
              </div>
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
          </Card>

          {/* Taxa de Conversão */}
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Taxa de Conversão</p>
                <p className="text-3xl font-bold mt-2 text-green-600">
                  {metricas.taxaConversao.toFixed(1)}%
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {metricas.leadsConvertidos} convertidos
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-600" />
            </div>
          </Card>

          {/* Tempo Médio de Resposta */}
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Tempo Médio</p>
                <p className="text-3xl font-bold mt-2 text-blue-600">
                  {metricas.tempoMedioResposta.toFixed(1)}h
                </p>
                <p className="text-xs text-muted-foreground mt-1">de resposta</p>
              </div>
              <Clock className="h-8 w-8 text-blue-600" />
            </div>
          </Card>

          {/* Taxa de Contato */}
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Taxa de Contato</p>
                <p className="text-3xl font-bold mt-2 text-purple-600">
                  {metricas.taxaContato.toFixed(1)}%
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {metricas.leadsContatados} contatados
                </p>
              </div>
              <BarChart3 className="h-8 w-8 text-purple-600" />
            </div>
          </Card>
        </div>

        {/* Leads por Status */}
        <Card className="p-6">
          <h2 className="text-xl font-bold mb-4">Leads por Status</h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {metricas.leadsPorStatus.map((item) => (
              <div
                key={item.status}
                className="flex items-center justify-between p-4 rounded-lg bg-muted/50"
              >
                <div>
                  <p className="text-sm font-medium capitalize">
                    {item.status.replace(/_/g, " ")}
                  </p>
                  <p className="text-2xl font-bold mt-1">{item.count}</p>
                </div>
                {item.status === "contrato_fechado" ? (
                  <CheckCircle2 className="h-6 w-6 text-green-600" />
                ) : item.status === "perdido" ? (
                  <XCircle className="h-6 w-6 text-red-600" />
                ) : (
                  <Target className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
            ))}
          </div>
        </Card>

        {/* Leads por Projeto */}
        <Card className="p-6">
          <h2 className="text-xl font-bold mb-4">Performance por Projeto</h2>
          <div className="space-y-3">
            {metricas.leadsPorProjeto.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhum lead vinculado a projetos ainda
              </p>
            ) : (
              metricas.leadsPorProjeto.slice(0, 10).map((projeto) => {
                const taxaConversaoProjeto =
                  projeto.count > 0 ? (projeto.convertidos / projeto.count) * 100 : 0;

                return (
                  <div
                    key={projeto.projectId}
                    className="flex items-center justify-between p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div className="flex-1">
                      <p className="font-medium">{projeto.projectName}</p>
                      <p className="text-sm text-muted-foreground">
                        {projeto.count} leads • {projeto.convertidos} convertidos
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-green-600">
                        {taxaConversaoProjeto.toFixed(1)}%
                      </p>
                      <p className="text-xs text-muted-foreground">conversão</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>

        {/* Ranking Completo */}
        <Card className="p-6">
          <h2 className="text-xl font-bold mb-4">Ranking da Equipe</h2>
          <div className="space-y-2">
            {ranking.map((corretor, index) => {
              const isMe = index + 1 === posicao;
              const medalha =
                index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : "";

              return (
                <div
                  key={corretor.corretorId}
                  className={`flex items-center justify-between p-4 rounded-lg transition-colors ${
                    isMe
                      ? "bg-primary/10 border-2 border-primary"
                      : "bg-muted/50 hover:bg-muted"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-background font-bold">
                      {medalha || `${index + 1}º`}
                    </div>
                    <div>
                      <p className={`font-medium ${isMe ? "text-primary font-bold" : ""}`}>
                        {corretor.corretorNome}
                        {isMe && " (Você)"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {corretor.totalLeads} leads • {corretor.leadsConvertidos} convertidos
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-green-600">
                      {corretor.taxaConversao.toFixed(1)}%
                    </p>
                    <p className="text-xs text-muted-foreground">taxa de conversão</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}

export default MinhaPerformance;

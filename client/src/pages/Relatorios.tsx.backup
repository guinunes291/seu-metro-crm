import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { TrendingUp, Users, CheckCircle, XCircle, Clock, Target } from "lucide-react";

export default function Relatorios() {
  const { data: leads } = trpc.leads.list.useQuery();

  // Calcular estatísticas
  const totalLeads = leads?.length || 0;
  const leadsNovos = leads?.filter(l => l.status === "novo").length || 0;
  const leadsEmAtendimento = leads?.filter(l => 
    l.status === "em_atendimento" || 
    l.status === "aguardando_atendimento"
  ).length || 0;
  const leadsAgendados = leads?.filter(l => l.status === "agendado").length || 0;
  const visitasRealizadas = leads?.filter(l => l.status === "visita_realizada").length || 0;
  const analisesCredito = leads?.filter(l => l.status === "analise_credito").length || 0;
  const leadsFechados = leads?.filter(l => l.status === "contrato_fechado").length || 0;
  const leadsPerdidos = leads?.filter(l => l.status === "perdido").length || 0;

  const taxaConversao = totalLeads > 0 ? ((leadsFechados / totalLeads) * 100).toFixed(1) : "0";
  const taxaAgendamento = totalLeads > 0 ? ((leadsAgendados / totalLeads) * 100).toFixed(1) : "0";
  const taxaVisita = totalLeads > 0 ? ((visitasRealizadas / totalLeads) * 100).toFixed(1) : "0";

  return (
    <DashboardLayout>
      <div className="container py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Relatórios</h1>
          <p className="text-muted-foreground mt-2">
            Análise de performance e métricas de conversão
          </p>
        </div>

        {/* Métricas principais */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Leads</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalLeads}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {leadsNovos} novos
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Taxa de Conversão</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{taxaConversao}%</div>
              <p className="text-xs text-muted-foreground mt-1">
                {leadsFechados} contratos fechados
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Taxa de Agendamento</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{taxaAgendamento}%</div>
              <p className="text-xs text-muted-foreground mt-1">
                {leadsAgendados} agendamentos
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Taxa de Visita</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{taxaVisita}%</div>
              <p className="text-xs text-muted-foreground mt-1">
                {visitasRealizadas} visitas realizadas
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Funil de vendas */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Funil de Vendas</CardTitle>
            <CardDescription>
              Visualização do fluxo de leads pelo processo de vendas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Novos Leads</span>
                  <span className="text-sm text-muted-foreground">{leadsNovos}</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div 
                    className="bg-blue-500 h-2 rounded-full transition-all" 
                    style={{ width: totalLeads > 0 ? `${(leadsNovos / totalLeads) * 100}%` : '0%' }}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Em Atendimento</span>
                  <span className="text-sm text-muted-foreground">{leadsEmAtendimento}</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div 
                    className="bg-yellow-500 h-2 rounded-full transition-all" 
                    style={{ width: totalLeads > 0 ? `${(leadsEmAtendimento / totalLeads) * 100}%` : '0%' }}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Agendados</span>
                  <span className="text-sm text-muted-foreground">{leadsAgendados}</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div 
                    className="bg-orange-500 h-2 rounded-full transition-all" 
                    style={{ width: totalLeads > 0 ? `${(leadsAgendados / totalLeads) * 100}%` : '0%' }}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Visitas Realizadas</span>
                  <span className="text-sm text-muted-foreground">{visitasRealizadas}</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div 
                    className="bg-purple-500 h-2 rounded-full transition-all" 
                    style={{ width: totalLeads > 0 ? `${(visitasRealizadas / totalLeads) * 100}%` : '0%' }}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Análise de Crédito</span>
                  <span className="text-sm text-muted-foreground">{analisesCredito}</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div 
                    className="bg-indigo-500 h-2 rounded-full transition-all" 
                    style={{ width: totalLeads > 0 ? `${(analisesCredito / totalLeads) * 100}%` : '0%' }}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Contratos Fechados</span>
                  <span className="text-sm text-muted-foreground">{leadsFechados}</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div 
                    className="bg-green-500 h-2 rounded-full transition-all" 
                    style={{ width: totalLeads > 0 ? `${(leadsFechados / totalLeads) * 100}%` : '0%' }}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Perdidos</span>
                  <span className="text-sm text-muted-foreground">{leadsPerdidos}</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div 
                    className="bg-red-500 h-2 rounded-full transition-all" 
                    style={{ width: totalLeads > 0 ? `${(leadsPerdidos / totalLeads) * 100}%` : '0%' }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Resumo de performance */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                Sucessos
              </CardTitle>
              <CardDescription>Leads convertidos em contratos</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">{leadsFechados}</div>
              <p className="text-sm text-muted-foreground mt-2">
                {taxaConversao}% de taxa de conversão
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-500" />
                Perdidos
              </CardTitle>
              <CardDescription>Leads que não converteram</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">{leadsPerdidos}</div>
              <p className="text-sm text-muted-foreground mt-2">
                {totalLeads > 0 ? ((leadsPerdidos / totalLeads) * 100).toFixed(1) : "0"}% de taxa de perda
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}

import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Building2, Users, CheckCircle, TrendingUp, Clock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";

export default function Dashboard() {
  const { user } = useAuth();
  const { data: leads, isLoading: leadsLoading } = trpc.leads.list.useQuery();
  const { data: projects } = trpc.projects.list.useQuery();

  const isGestor = user?.role === "gestor" || user?.role === "admin";

  // Estatísticas
  const totalLeads = leads?.length || 0;
  const leadsNovos = leads?.filter(l => l.status === "novo").length || 0;
  const leadsEmAtendimento = leads?.filter(l => l.status === "em_atendimento" || l.status === "aguardando_atendimento").length || 0;
  const leadsAgendados = leads?.filter(l => l.status === "agendado").length || 0;
  const leadsFechados = leads?.filter(l => l.status === "contrato_fechado").length || 0;
  const leadsPerdidos = leads?.filter(l => l.status === "perdido").length || 0;

  const taxaConversao = totalLeads > 0 ? ((leadsFechados / totalLeads) * 100).toFixed(1) : "0";

  return (
    <DashboardLayout>
      <div className="container py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Bem-vindo de volta, {user?.name || "Corretor"}!
          </p>
        </div>

        {/* Cards de estatísticas */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Leads</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalLeads}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {leadsNovos} novos leads
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Em Atendimento</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{leadsEmAtendimento}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {leadsAgendados} agendados
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Contratos Fechados</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{leadsFechados}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Taxa de conversão: {taxaConversao}%
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Projetos Ativos</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{projects?.length || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Empreendimentos disponíveis
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Leads recentes */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Leads Recentes</CardTitle>
              <CardDescription>Últimos leads atribuídos a você</CardDescription>
            </CardHeader>
            <CardContent>
              {leadsLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Carregando...
                </div>
              ) : leads && leads.length > 0 ? (
                <div className="space-y-4">
                  {leads.slice(0, 5).map((lead) => (
                    <div key={lead.id} className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-medium">{lead.nome}</p>
                        <p className="text-sm text-muted-foreground">{lead.telefone}</p>
                      </div>
                      <Badge variant={
                        lead.status === "contrato_fechado" ? "default" :
                        lead.status === "perdido" ? "destructive" :
                        lead.status === "novo" ? "secondary" : "outline"
                      }>
                        {lead.status.replace(/_/g, " ")}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum lead encontrado</p>
                </div>
              )}
              <Link href="/leads">
                <Button variant="outline" className="w-full mt-4">
                  Ver todos os leads
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Projetos Disponíveis</CardTitle>
              <CardDescription>Empreendimentos para oferecer aos clientes</CardDescription>
            </CardHeader>
            <CardContent>
              {projects && projects.length > 0 ? (
                <div className="space-y-4">
                  {projects.slice(0, 5).map((project) => (
                    <div key={project.id} className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-medium">{project.nome}</p>
                        <p className="text-sm text-muted-foreground">
                          {project.bairro}, {project.cidade}
                        </p>
                      </div>
                      <Badge variant={
                        project.status === "ativo" ? "default" :
                        project.status === "esgotado" ? "destructive" : "secondary"
                      }>
                        {project.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum projeto cadastrado</p>
                </div>
              )}
              <Link href="/projetos">
                <Button variant="outline" className="w-full mt-4">
                  Ver todos os projetos
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}

import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Loader2, Users, TrendingUp, Info } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";

export default function ControleLimites() {
  const { data: corretores, isLoading } = trpc.corretores.listarLimites.useQuery();

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  const totalCorretores = corretores?.length || 0;
  const corretoresPresentes = corretores?.filter(c => c.status === "presente").length || 0;
  const totalLeadsHoje = corretores?.reduce((acc, c) => acc + c.leadsRecebidosHoje, 0) || 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Cabeçalho */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Volume de Leads por Corretor</h1>
          <p className="text-muted-foreground mt-2">
            Acompanhe quantos leads cada corretor recebeu hoje
          </p>
        </div>

        {/* Aviso informativo */}
        <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800">
          <CardContent className="flex items-start gap-3 pt-4">
            <Info className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-blue-700 dark:text-blue-300">
              Os limites diários de leads foram removidos. Corretores com status <strong>Presente</strong> recebem leads sem restrição de volume diário, respeitando apenas o limite de leads aguardando atendimento.
            </p>
          </CardContent>
        </Card>

        {/* Cards de Resumo */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Corretores</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalCorretores}</div>
              <p className="text-xs text-muted-foreground">
                {corretoresPresentes} presentes agora
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Leads Distribuídos Hoje</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalLeadsHoje}</div>
              <p className="text-xs text-muted-foreground">
                Total acumulado no dia
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Média por Corretor</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {totalCorretores > 0 ? Math.round(totalLeadsHoje / totalCorretores) : 0}
              </div>
              <p className="text-xs text-muted-foreground">
                Leads/corretor hoje
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tabela de Corretores */}
        <Card>
          <CardHeader>
            <CardTitle>Volume de Leads por Corretor — Hoje</CardTitle>
            <CardDescription>
              Quantidade de leads recebidos por cada corretor no dia atual.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {corretores
                ?.slice()
                .sort((a, b) => b.leadsRecebidosHoje - a.leadsRecebidosHoje)
                .map((corretor) => (
                  <div
                    key={corretor.corretorId}
                    className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={corretor.fotoUrl || undefined} />
                      <AvatarFallback>
                        {corretor.nome.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{corretor.nome}</p>
                      <p className="text-sm text-muted-foreground truncate">{corretor.email}</p>
                    </div>
                    <Badge variant={corretor.status === "presente" ? "default" : "secondary"}>
                      {corretor.status === "presente" ? "Presente" : "Ausente"}
                    </Badge>
                    <div className="text-right min-w-[80px]">
                      <div className="text-xl font-bold">{corretor.leadsRecebidosHoje}</div>
                      <div className="text-xs text-muted-foreground">leads hoje</div>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

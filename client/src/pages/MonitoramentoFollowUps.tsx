import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle2, XCircle, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function MonitoramentoFollowUps() {
  const { data: progressos, isLoading } = trpc.progressoFollowUps.listarProgressoEquipe.useQuery(undefined, {
    refetchInterval: 10000, // Atualiza a cada 10 segundos
  });

  const formatarHorario = (data: string | null) => {
    if (!data) return "—";
    const date = new Date(data);
    return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };

  const calcularEstatisticas = () => {
    if (!progressos || progressos.length === 0) {
      return {
        totalCorretores: 0,
        desbloqueados: 0,
        mediaPercentual: 0,
        totalFollowUps: 0,
      };
    }

    const desbloqueados = progressos.filter(p => p.desbloqueado).length;
    const mediaPercentual = Math.round(
      progressos.reduce((acc, p) => acc + p.percentual, 0) / progressos.length
    );
    const totalFollowUps = progressos.reduce((acc, p) => acc + p.concluidos, 0);

    return {
      totalCorretores: progressos.length,
      desbloqueados,
      mediaPercentual,
      totalFollowUps,
    };
  };

  const stats = calcularEstatisticas();

  return (
    <DashboardLayout>
      <div className="container py-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Monitoramento de Follow-ups</h1>
          <p className="text-muted-foreground mt-2">
            Acompanhe o progresso diário de todos os corretores em tempo real
          </p>
        </div>

        {/* Cards de Estatísticas */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Corretores</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalCorretores}</div>
              <p className="text-xs text-muted-foreground mt-1">Ativos no sistema</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Desbloqueados</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.desbloqueados}</div>
              <p className="text-xs text-muted-foreground mt-1">≥ 60% concluído</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Média da Equipe</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.mediaPercentual}%</div>
              <p className="text-xs text-muted-foreground mt-1">Progresso médio</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Follow-ups Hoje</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalFollowUps}</div>
              <p className="text-xs text-muted-foreground mt-1">Concluídos pela equipe</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabela de Progresso */}
        <Card>
          <CardHeader>
            <CardTitle>Progresso Individual</CardTitle>
            <CardDescription>
              Atualização automática a cada 10 segundos
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : !progressos || progressos.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <XCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Nenhum corretor encontrado</p>
                <p className="text-sm mt-2">Cadastre corretores para começar o monitoramento</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Corretor</TableHead>
                    <TableHead className="text-center">Follow-ups</TableHead>
                    <TableHead className="text-center">Progresso</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right">Último Follow-up</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {progressos.map((progresso) => (
                    <TableRow key={progresso.corretorId}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{progresso.corretorNome}</div>
                          <div className="text-sm text-muted-foreground">{progresso.corretorEmail}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-mono font-medium">
                          {progresso.concluidos}/{progresso.total}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center gap-2 justify-center">
                          <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all duration-500 ${
                                progresso.desbloqueado ? "bg-green-500" : "bg-red-500"
                              }`}
                              style={{ width: `${Math.min(progresso.percentual, 100)}%` }}
                            />
                          </div>
                          <span className={`font-semibold text-sm ${
                            progresso.desbloqueado ? "text-green-600" : "text-red-600"
                          }`}>
                            {progresso.percentual}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {progresso.desbloqueado ? (
                          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Desbloqueado
                          </Badge>
                        ) : (
                          <Badge variant="destructive">
                            <XCircle className="h-3 w-3 mr-1" />
                            Bloqueado
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1 text-sm text-muted-foreground">
                          <Clock className="h-3.5 w-3.5" />
                          {formatarHorario(progresso.ultimoFollowUp)}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

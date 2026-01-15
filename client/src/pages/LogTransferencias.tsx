import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Calendar, Filter, RefreshCw, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function LogTransferencias() {
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [motivo, setMotivo] = useState<"2_dias_sem_interacao" | "sem_corretores_disponiveis" | "todos">("todos");
  const [statusFinal, setStatusFinal] = useState<"transferido" | "perdido" | "todos">("todos");
  const [page, setPage] = useState(0);
  const limit = 50;

  const { data: logs, isLoading, refetch } = trpc.logTransferencias.list.useQuery({
    dataInicio: dataInicio || undefined,
    dataFim: dataFim || undefined,
    motivo: motivo === "todos" ? undefined : motivo,
    statusFinal: statusFinal === "todos" ? undefined : statusFinal,
    limit,
    offset: page * limit,
  });

  const { data: totalCount } = trpc.logTransferencias.count.useQuery({
    dataInicio: dataInicio || undefined,
    dataFim: dataFim || undefined,
    motivo: motivo === "todos" ? undefined : motivo,
    statusFinal: statusFinal === "todos" ? undefined : statusFinal,
  });

  const totalPages = Math.ceil((totalCount || 0) / limit);

  const handleLimparFiltros = () => {
    setDataInicio("");
    setDataFim("");
    setMotivo("todos");
    setStatusFinal("todos");
    setPage(0);
  };

  const getMotivoLabel = (m: string) => {
    switch (m) {
      case "2_dias_sem_interacao":
        return "2 dias sem interação";
      case "sem_corretores_disponiveis":
        return "Sem corretores disponíveis";
      default:
        return m;
    }
  };

  const getStatusBadge = (status: string) => {
    if (status === "transferido") {
      return (
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
          <CheckCircle className="w-3 h-3 mr-1" />
          Transferido
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
        <XCircle className="w-3 h-3 mr-1" />
        Perdido
      </Badge>
    );
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Log de Transferências Automáticas</h1>
        <p className="text-muted-foreground mt-2">
          Histórico de leads transferidos automaticamente após 2 dias sem interação
        </p>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filtros
          </CardTitle>
          <CardDescription>
            Filtre os logs por período, motivo ou status final
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Data Início */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Data Início</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Data Fim */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Data Fim</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Motivo */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Motivo</label>
              <Select value={motivo} onValueChange={(v) => setMotivo(v as any)}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os motivos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os motivos</SelectItem>
                  <SelectItem value="2_dias_sem_interacao">2 dias sem interação</SelectItem>
                  <SelectItem value="sem_corretores_disponiveis">Sem corretores disponíveis</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Status Final */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Status Final</label>
              <Select value={statusFinal} onValueChange={(v) => setStatusFinal(v as any)}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os status</SelectItem>
                  <SelectItem value="transferido">Transferido</SelectItem>
                  <SelectItem value="perdido">Perdido</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={() => refetch()} variant="outline" size="sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              Atualizar
            </Button>
            <Button onClick={handleLimparFiltros} variant="ghost" size="sm">
              Limpar Filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardHeader>
          <CardTitle>
            Transferências Registradas
            {totalCount !== undefined && (
              <span className="text-sm font-normal text-muted-foreground ml-2">
                ({totalCount} registro{totalCount !== 1 ? "s" : ""})
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">
              Carregando logs...
            </div>
          ) : !logs || logs.length === 0 ? (
            <div className="text-center py-12">
              <AlertTriangle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                Nenhum registro encontrado com os filtros aplicados
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Lead</TableHead>
                      <TableHead>Corretor Origem</TableHead>
                      <TableHead>Corretor Destino</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead>Status Final</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-mono text-sm">
                          {format(new Date(log.dataTransferencia), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </TableCell>
                        <TableCell className="font-medium">
                          {log.leadNome}
                          <div className="text-xs text-muted-foreground">ID: {log.leadId}</div>
                        </TableCell>
                        <TableCell>
                          {log.corretorOrigemNome || (
                            <span className="text-muted-foreground">
                              ID: {log.corretorOrigemId || "-"}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {log.corretorDestinoNome || (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{getMotivoLabel(log.motivo)}</span>
                        </TableCell>
                        <TableCell>{getStatusBadge(log.statusFinal)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Paginação */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    Página {page + 1} de {totalPages}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => setPage(page - 1)}
                      disabled={page === 0}
                      variant="outline"
                      size="sm"
                    >
                      Anterior
                    </Button>
                    <Button
                      onClick={() => setPage(page + 1)}
                      disabled={page >= totalPages - 1}
                      variant="outline"
                      size="sm"
                    >
                      Próxima
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

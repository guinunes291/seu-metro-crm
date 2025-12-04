import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, TrendingUp, AlertCircle, CheckCircle2 } from "lucide-react";

export default function LeadsPorCorretor() {
  const [selectedCorretor, setSelectedCorretor] = useState<number | undefined>();
  const [selectedStatus, setSelectedStatus] = useState<string | undefined>();

  // Buscar estatísticas por corretor
  const { data: estatisticas, isLoading: loadingStats } = trpc.distribution.getEstatisticasPorCorretor.useQuery();

  // Buscar leads filtrados
  const { data: leads, isLoading: loadingLeads } = trpc.distribution.getLeadsPorCorretor.useQuery({
    corretorId: selectedCorretor,
    status: selectedStatus,
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      novo: { variant: "outline", label: "Novo" },
      aguardando_atendimento: { variant: "secondary", label: "Aguardando" },
      em_atendimento: { variant: "default", label: "Em Atendimento" },
      agendado: { variant: "default", label: "Agendado" },
      visita_realizada: { variant: "default", label: "Visita Realizada" },
      analise_credito: { variant: "default", label: "Análise Crédito" },
      contrato_fechado: { variant: "default", label: "Contrato Fechado" },
      perdido: { variant: "destructive", label: "Perdido" },
    };

    const config = variants[status] || { variant: "outline" as const, label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Leads por Corretor</h1>
        <p className="text-muted-foreground mt-2">
          Visualize e gerencie os leads distribuídos para cada corretor
        </p>
      </div>

      {/* Estatísticas Gerais */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {loadingStats ? (
          <>
            {[...Array(4)].map((_, i) => (
              <Card key={i}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-4 rounded-full" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="h-3 w-32 mt-2" />
                </CardContent>
              </Card>
            ))}
          </>
        ) : (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de Corretores</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{estatisticas?.length || 0}</div>
                <p className="text-xs text-muted-foreground">Ativos no sistema</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Leads Distribuídos</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {estatisticas?.reduce((acc: number, e: any) => acc + e.total, 0) || 0}
                </div>
                <p className="text-xs text-muted-foreground">Total geral</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Em Atendimento</CardTitle>
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {estatisticas?.reduce((acc: number, e: any) => acc + e.emAtendimento, 0) || 0}
                </div>
                <p className="text-xs text-muted-foreground">Sendo trabalhados</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Convertidos</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {estatisticas?.reduce((acc: number, e: any) => acc + e.convertidos, 0) || 0}
                </div>
                <p className="text-xs text-muted-foreground">Contratos fechados</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Tabela de Estatísticas por Corretor */}
      <Card>
        <CardHeader>
          <CardTitle>Estatísticas por Corretor</CardTitle>
          <CardDescription>Performance de cada corretor no sistema</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingStats ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Corretor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Em Atendimento</TableHead>
                  <TableHead className="text-right">Aguardando</TableHead>
                  <TableHead className="text-right">Convertidos</TableHead>
                  <TableHead className="text-right">Perdidos</TableHead>
                  <TableHead className="text-right">Taxa Conversão</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {estatisticas?.map((stat: any) => (
                  <TableRow key={stat.corretorId}>
                    <TableCell className="font-medium">{stat.corretorNome}</TableCell>
                    <TableCell>
                      <Badge variant={stat.corretorStatus === "presente" ? "default" : "secondary"}>
                        {stat.corretorStatus}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{stat.total}</TableCell>
                    <TableCell className="text-right">{stat.emAtendimento}</TableCell>
                    <TableCell className="text-right">{stat.aguardando}</TableCell>
                    <TableCell className="text-right">{stat.convertidos}</TableCell>
                    <TableCell className="text-right">{stat.perdidos}</TableCell>
                    <TableCell className="text-right">{stat.taxaConversao.toFixed(1)}%</TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedCorretor(stat.corretorId)}
                      >
                        Ver Leads
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Filtros e Lista de Leads */}
      <Card>
        <CardHeader>
          <CardTitle>Leads Detalhados</CardTitle>
          <CardDescription>Filtre e visualize os leads de cada corretor</CardDescription>
          <div className="flex gap-4 mt-4">
            <Select
              value={selectedCorretor?.toString() || "all"}
              onValueChange={(value) => setSelectedCorretor(value === "all" ? undefined : parseInt(value))}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Todos os corretores" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os corretores</SelectItem>
                {estatisticas?.map((stat: any) => (
                  <SelectItem key={stat.corretorId} value={stat.corretorId.toString()}>
                    {stat.corretorNome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={selectedStatus || "all"}
              onValueChange={(value) => setSelectedStatus(value === "all" ? undefined : value)}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Todos os status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="novo">Novo</SelectItem>
                <SelectItem value="aguardando_atendimento">Aguardando</SelectItem>
                <SelectItem value="em_atendimento">Em Atendimento</SelectItem>
                <SelectItem value="agendado">Agendado</SelectItem>
                <SelectItem value="visita_realizada">Visita Realizada</SelectItem>
                <SelectItem value="analise_credito">Análise Crédito</SelectItem>
                <SelectItem value="contrato_fechado">Contrato Fechado</SelectItem>
                <SelectItem value="perdido">Perdido</SelectItem>
              </SelectContent>
            </Select>

            {(selectedCorretor || selectedStatus) && (
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedCorretor(undefined);
                  setSelectedStatus(undefined);
                }}
              >
                Limpar Filtros
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loadingLeads ? (
            <div className="space-y-2">
              {[...Array(10)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : leads && leads.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Corretor</TableHead>
                  <TableHead>Projeto</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data Distribuição</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map((lead: any) => (
                  <TableRow key={lead.id}>
                    <TableCell className="font-medium">{lead.nome}</TableCell>
                    <TableCell>{lead.telefone}</TableCell>
                    <TableCell>{lead.email || "-"}</TableCell>
                    <TableCell>{lead.corretorNome || "-"}</TableCell>
                    <TableCell>{lead.projectNome || "-"}</TableCell>
                    <TableCell>{getStatusBadge(lead.status)}</TableCell>
                    <TableCell>
                      {lead.dataDistribuicao
                        ? new Date(lead.dataDistribuicao).toLocaleDateString("pt-BR")
                        : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              Nenhum lead encontrado com os filtros selecionados
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

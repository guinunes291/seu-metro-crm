import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, UserCheck, UserX, CheckCircle2, XCircle, Play, History, Clock, Package, AlertTriangle } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { toast } from "sonner";

function LeadsParadosSection() {
  const [levantamentoRealizado, setLevantamentoRealizado] = useState(false);
  const [estatisticas, setEstatisticas] = useState<any>(null);

  // Query para levantamento
  const levantamento = trpc.system.levantarLeadsParadosDistribuicao.useQuery(undefined, {
    enabled: false,
  });

  // Mutation para redistribuição
  const redistribuir = trpc.system.redistribuirLeadsParadosDistribuicao.useMutation({
    onSuccess: (data) => {
      console.log("Redistribuição sucesso:", data);
      toast.success("✅ Redistribuição Concluída", {
        description: data.mensagem,
      });
      setLevantamentoRealizado(false);
      setEstatisticas(null);
    },
    onError: (error) => {
      console.error("Redistribuição erro:", error);
      toast.error("❌ Erro na Redistribuição", {
        description: error.message,
      });
    },
  });

  const handleLevantamento = async () => {
    try {
      const resultado = await levantamento.refetch();
      if (resultado.data) {
        setEstatisticas(resultado.data);
        setLevantamentoRealizado(true);
        toast.success("📊 Levantamento Concluído", {
          description: `${resultado.data.total} leads encontrados sem interação nos últimos 2 dias`,
        });
      } else if (resultado.error) {
        toast.error("❌ Erro no Levantamento", {
          description: resultado.error.message,
        });
      }
    } catch (error: any) {
      toast.error("❌ Erro no Levantamento", {
        description: error.message || "Erro desconhecido",
      });
    }
  };

  const handleRedistribuir = () => {
    console.log("handleRedistribuir chamado", { estatisticas, levantamentoRealizado });
    if (window.confirm(`Confirma a redistribuição de ${estatisticas?.total || 0} leads parados?`)) {
      console.log("Confirmação aceita, chamando redistribuir.mutate()");
      redistribuir.mutate();
    } else {
      console.log("Confirmação cancelada");
    }
  };

  return (
    <div className="space-y-4">
      {/* Botões de Ação */}
      <div className="flex gap-3">
        <Button
          onClick={handleLevantamento}
          disabled={levantamento.isFetching}
          variant="outline"
          className="flex-1"
        >
          {levantamento.isFetching ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Analisando...
            </>
          ) : (
            <>
              <Package className="mr-2 h-4 w-4" />
              1. Fazer Levantamento
            </>
          )}
        </Button>
        <Button
          onClick={handleRedistribuir}
          disabled={!levantamentoRealizado || redistribuir.isPending || !estatisticas || estatisticas.total === 0}
          className="flex-1"
        >
          {redistribuir.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Redistribuindo...
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" />
              2. Redistribuir Leads
            </>
          )}
        </Button>
      </div>

      {/* Estatísticas do Levantamento */}
      {levantamentoRealizado && estatisticas && (
        <Alert className="bg-white border-orange-200">
          <AlertDescription>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-lg">Total de Leads Parados:</span>
                <Badge variant="destructive" className="text-lg px-3 py-1">
                  {estatisticas.total}
                </Badge>
              </div>

              {/* Por Status */}
              {estatisticas.porStatus && Object.keys(estatisticas.porStatus).length > 0 && (
                <div>
                  <p className="font-medium mb-2 text-sm">Por Status:</p>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(estatisticas.porStatus)
                      .sort((a: any, b: any) => b[1] - a[1])
                      .slice(0, 6)
                      .map(([status, count]: any) => (
                        <div key={status} className="flex justify-between text-sm bg-orange-50 px-2 py-1 rounded">
                          <span className="capitalize">{status.replace(/_/g, ' ')}</span>
                          <span className="font-medium">{count}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Por Corretor */}
              {estatisticas.porCorretor && Object.keys(estatisticas.porCorretor).length > 0 && (
                <div>
                  <p className="font-medium mb-2 text-sm">Por Corretor (Top 5):</p>
                  <div className="space-y-1">
                    {Object.entries(estatisticas.porCorretor)
                      .sort((a: any, b: any) => b[1] - a[1])
                      .slice(0, 5)
                      .map(([corretor, count]: any) => (
                        <div key={corretor} className="flex justify-between text-sm bg-orange-50 px-2 py-1 rounded">
                          <span>{corretor}</span>
                          <span className="font-medium">{count}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

export default function ControleDistribuicao() {
  const [resultado, setResultado] = useState<{
    tipo: "sucesso" | "erro";
    mensagem: string;
  } | null>(null);

  // Buscar estatísticas de distribuição
  const { data: estatisticas, isLoading, refetch } = trpc.distribution.getEstatisticas.useQuery();

  // Buscar estatísticas do estoque
  const { data: estoque, refetch: refetchEstoque } = trpc.distribution.getEstatisticasEstoque.useQuery();

  // Buscar histórico de distribuições
  const { data: historico, refetch: refetchHistorico } = trpc.distribution.getHistorico.useQuery({ limit: 20 });

  // Mutation para distribuir todos os leads
  const distribuirTodos = trpc.distribution.distribuirTodos.useMutation({
    onSuccess: (data) => {
      setResultado({
        tipo: "sucesso",
        mensagem: `✅ Distribuição concluída! ${data.success} leads distribuídos com sucesso${data.failed > 0 ? `, ${data.failed} falharam` : ""}.`,
      });
      refetch();
      refetchHistorico();
      refetchEstoque();
    },
    onError: (error) => {
      setResultado({
        tipo: "erro",
        mensagem: `❌ Erro na distribuição: ${error.message}`,
      });
    },
  });

  // Mutation para distribuir estoque
  const distribuirEstoque = trpc.distribution.distribuirEstoque.useMutation({
    onSuccess: (data) => {
      setResultado({
        tipo: "sucesso",
        mensagem: `✅ Estoque distribuído! ${data.distribuidos} leads distribuídos, ${data.erros} erros.`,
      });
      refetch();
      refetchHistorico();
      refetchEstoque();
    },
    onError: (error) => {
      setResultado({
        tipo: "erro",
        mensagem: `❌ Erro ao distribuir estoque: ${error.message}`,
      });
    },
  });

  const handleDistribuir = () => {
    setResultado(null);
    distribuirTodos.mutate();
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  const corretoresElegiveis = estatisticas?.filter((c) => c.elegivel) || [];
  const corretoresNaoElegiveis = estatisticas?.filter((c) => !c.elegivel) || [];

  return (
    <DashboardLayout>
      <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Controle de Distribuição</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie a distribuição automática de leads para corretores
          </p>
        </div>
        <Button
          onClick={handleDistribuir}
          disabled={distribuirTodos.isPending || corretoresElegiveis.length === 0}
          size="lg"
        >
          {distribuirTodos.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Distribuindo...
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" />
              Distribuir Agora
            </>
          )}
        </Button>
      </div>

      {/* Feedback de resultado */}
      {resultado && (
        <Alert variant={resultado.tipo === "sucesso" ? "default" : "destructive"}>
          <AlertDescription>{resultado.mensagem}</AlertDescription>
        </Alert>
      )}

      {/* Cards de resumo */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Corretores</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{estatisticas?.length || 0}</div>
            <p className="text-xs text-muted-foreground">Cadastrados no sistema</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Corretores Elegíveis</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{corretoresElegiveis.length}</div>
            <p className="text-xs text-muted-foreground">Podem receber novos leads</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Corretores Não Elegíveis</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{corretoresNaoElegiveis.length}</div>
            <p className="text-xs text-muted-foreground">Não podem receber leads</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Estoque de Leads</CardTitle>
            <Package className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{estoque?.totalEmEstoque || 0}</div>
            <p className="text-xs text-muted-foreground">Aguardando distribuição</p>
          </CardContent>
        </Card>
      </div>

      {/* Detalhes do Estoque */}
      {estoque && estoque.totalEmEstoque > 0 && (
        <Card className="border-orange-200 bg-orange-50/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-orange-600" />
                  Estoque de Leads
                </CardTitle>
                <CardDescription>
                  {estoque.totalEmEstoque} lead{estoque.totalEmEstoque !== 1 ? 's' : ''} aguardando distribuição
                </CardDescription>
              </div>
              <Button
                onClick={() => distribuirEstoque.mutate()}
                disabled={distribuirEstoque.isPending}
                variant="outline"
                className="border-orange-600 text-orange-600 hover:bg-orange-600 hover:text-white"
              >
                {distribuirEstoque.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Distribuindo...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Distribuir Estoque
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Fila Normal</p>
                <p className="text-2xl font-bold text-orange-600">{estoque.porFila.normal}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Fila Foco</p>
                <p className="text-2xl font-bold text-orange-600">{estoque.porFila.foco}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Mais Antigo</p>
                <p className="text-sm font-medium">
                  {estoque.maisAntigo ? new Date(estoque.maisAntigo).toLocaleString('pt-BR') : 'N/A'}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Média de Tentativas</p>
                <p className="text-2xl font-bold">{estoque.tentativasMedia}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabela de corretores elegíveis */}
      {corretoresElegiveis.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Corretores Elegíveis</CardTitle>
            <CardDescription>
              Corretores que podem receber novos leads (status presente + regras atendidas)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Corretor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total Leads</TableHead>
                  <TableHead className="text-right">Em Atendimento</TableHead>
                  <TableHead className="text-right">Aguardando</TableHead>
                  <TableHead>Elegibilidade</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {corretoresElegiveis.map((corretor) => (
                  <TableRow key={corretor.id}>
                    <TableCell className="font-medium">
                      <div>
                        <div>{corretor.nome}</div>
                        <div className="text-xs text-muted-foreground">{corretor.email}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="default" className="bg-green-600">
                        <UserCheck className="mr-1 h-3 w-3" />
                        Presente
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{corretor.leadsTrabalhados}</TableCell>
                    <TableCell className="text-right">
                      <span className="text-green-600 font-medium">
                        {(corretor as any).aguardandoLeads ?? (corretor.totalLeads - corretor.leadsTrabalhados)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="default" className="bg-green-600">
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                        Elegível
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Tabela de corretores não elegíveis */}
      {corretoresNaoElegiveis.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Corretores Não Elegíveis</CardTitle>
            <CardDescription>
              Corretores que não podem receber novos leads no momento
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Corretor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Em Atendimento</TableHead>
                  <TableHead className="text-right">Aguardando</TableHead>
                  <TableHead>Motivo do Bloqueio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {corretoresNaoElegiveis.map((corretor) => {
                  const motivo = (corretor as any).motivoBloqueio || (corretor.status !== "presente" ? "Ausente" : "Aguardando distribuição");
                  return (
                    <TableRow key={corretor.id}>
                      <TableCell className="font-medium">
                        <div>
                          <div>{corretor.nome}</div>
                          <div className="text-xs text-muted-foreground">{corretor.email}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={
                            corretor.status === "presente"
                              ? "bg-green-600 text-white"
                              : "bg-gray-600 text-white"
                          }
                        >
                          {corretor.status === "presente" ? (
                            <UserCheck className="mr-1 h-3 w-3" />
                          ) : (
                            <UserX className="mr-1 h-3 w-3" />
                          )}
                          {corretor.status === "presente" ? "Presente" : "Ausente"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{corretor.leadsTrabalhados}</TableCell>
                      <TableCell className="text-right">
                        <span className={
                          ((corretor as any).aguardandoLeads ?? 0) >= 20
                            ? "text-red-600 font-semibold"
                            : "text-yellow-600 font-medium"
                        }>
                          {(corretor as any).aguardandoLeads ?? (corretor.totalLeads - corretor.leadsTrabalhados)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="destructive">
                          <XCircle className="mr-1 h-3 w-3" />
                          {motivo}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Histórico de Distribuições */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Histórico de Distribuições
          </CardTitle>
          <CardDescription>
            Últimas 20 distribuições realizadas
          </CardDescription>
        </CardHeader>
        <CardContent>
          {historico && historico.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Lead</TableHead>
                  <TableHead>Corretor</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Motivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historico.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        {item.createdAt ? new Date(item.createdAt).toLocaleString('pt-BR') : '-'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{item.leadNome || 'Lead removido'}</div>
                        <div className="text-xs text-muted-foreground">{item.leadTelefone || '-'}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div>{item.corretorNome || 'Corretor removido'}</div>
                        <div className="text-xs text-muted-foreground">{item.corretorEmail || '-'}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={item.tipo === 'automatica' ? 'default' : 'secondary'}>
                        {item.tipo === 'automatica' ? 'Automática' : item.tipo === 'manual' ? 'Manual' : 'Inicial'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                      {item.motivo || '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              Nenhuma distribuição realizada ainda
            </p>
          )}
        </CardContent>
      </Card>

      {/* Seção de Redistribuição de Leads Parados */}
      <Card className="border-orange-200 bg-orange-50/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-orange-900">
            <AlertTriangle className="h-5 w-5" />
            Redistribuição de Leads Parados
          </CardTitle>
          <CardDescription>
            Identifique e redistribua leads sem interação nos últimos 2 dias
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <LeadsParadosSection />
        </CardContent>
      </Card>

      {/* Informações sobre as regras */}
      <Card>
        <CardHeader>
          <CardTitle>Regras de Elegibilidade</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
            <div>
              <p className="font-medium">Status Presente</p>
              <p className="text-sm text-muted-foreground">
                Corretor deve estar com status "Presente" no sistema
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
            <div>
              <p className="font-medium">Lote Inicial Garantido (40 leads)</p>
              <p className="text-sm text-muted-foreground">
                Corretores com menos de 40 leads sempre recebem novos leads
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
            <div>
              <p className="font-medium">Máximo de 20 Leads Aguardando</p>
              <p className="text-sm text-muted-foreground">
                Corretores com 40+ leads só recebem mais quando tiverem menos de 20 leads aguardando atendimento
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      </div>
    </DashboardLayout>
  );
}

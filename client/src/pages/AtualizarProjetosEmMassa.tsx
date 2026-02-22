import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, RefreshCw, Database, AlertTriangle } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export default function AtualizarProjetosEmMassa() {
  const [executando, setExecutando] = useState(false);
  const [resultado, setResultado] = useState<any>(null);

  // Query de estatísticas
  const { data: stats, isLoading: loadingStats, refetch: refetchStats } = trpc.updateProjetos.stats.useQuery();

  // Mutation de atualização
  const executarMutation = trpc.updateProjetos.executar.useMutation({
    onSuccess: (data) => {
      setResultado(data);
      setExecutando(false);
      refetchStats();
    },
    onError: (error) => {
      console.error("Erro ao atualizar projetos:", error);
      setExecutando(false);
    },
  });

  const handleExecutar = () => {
    if (!confirm("Tem certeza que deseja atualizar os projetos em massa? Esta operação irá buscar os projetos na planilha Google Sheets e atualizar todos os leads que estão sem projeto.")) {
      return;
    }

    setExecutando(true);
    setResultado(null);
    executarMutation.mutate();
  };

  if (loadingStats) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center">
          <RefreshCw className="h-6 w-6 animate-spin mr-2" />
          <span>Carregando estatísticas...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Atualização em Massa de Projetos</h1>
        <p className="text-muted-foreground">
          Preenche o campo "Projeto" dos leads que foram importados sem essa informação, buscando os dados na planilha Google Sheets.
        </p>
      </div>

      {/* Estatísticas */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total sem Projeto</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total || 0}</div>
            <p className="text-xs text-muted-foreground">Leads sem projetoCustom</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Com Telefone/Email</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats?.comTelefoneOuEmail || 0}</div>
            <p className="text-xs text-muted-foreground">Podem ser atualizados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Apenas Telefone</CardTitle>
            <Database className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats?.comTelefone || 0}</div>
            <p className="text-xs text-muted-foreground">Têm telefone</p>
          </CardContent>
        </Card>
      </div>

      {/* Card de Ação */}
      <Card>
        <CardHeader>
          <CardTitle>Executar Atualização</CardTitle>
          <CardDescription>
            Esta ferramenta irá:
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Buscar todos os leads sem projeto</li>
              <li>Consultar a planilha Google Sheets usando <strong>telefone</strong> e <strong>email</strong> para localizar o projeto</li>
              <li>Atualizar o campo "Projeto" (projetoCustom) de cada lead encontrado</li>
              <li>Gerar um relatório detalhado da operação</li>
            </ul>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {stats && stats.comTelefoneOuEmail > 0 ? (
            <>
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>{stats.comTelefoneOuEmail} leads</strong> podem ser atualizados com base em telefone ou email.
                  {stats.total - stats.comTelefoneOuEmail > 0 && (
                    <span className="block mt-1 text-yellow-600">
                      Atenção: {stats.total - stats.comTelefoneOuEmail} leads não possuem telefone nem email e não poderão ser atualizados.
                    </span>
                  )}
                </AlertDescription>
              </Alert>

              <Button 
                onClick={handleExecutar} 
                disabled={executando}
                size="lg"
                className="w-full"
              >
                {executando ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Atualizando...
                  </>
                ) : (
                  <>
                    <Database className="mr-2 h-4 w-4" />
                    Executar Atualização em Massa
                  </>
                )}
              </Button>
            </>
          ) : (
            <Alert>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription>
                Não há leads pendentes de atualização. Todos os leads com telefone ou email já possuem projeto cadastrado.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Resultado da Atualização */}
      {resultado && (
        <Card>
          <CardHeader>
            <CardTitle>Resultado da Atualização</CardTitle>
            <CardDescription>Relatório detalhado da operação</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Resumo */}
            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Total Processados</p>
                <p className="text-2xl font-bold">{resultado.total}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Atualizados</p>
                <p className="text-2xl font-bold text-green-600">{resultado.atualizados}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Não Encontrados</p>
                <p className="text-2xl font-bold text-yellow-600">{resultado.naoEncontrados}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Erros</p>
                <p className="text-2xl font-bold text-red-600">{resultado.erros}</p>
              </div>
            </div>

            {/* Barra de Progresso */}
            {resultado.total > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Taxa de Sucesso</span>
                  <span className="font-medium">
                    {((resultado.atualizados / resultado.total) * 100).toFixed(1)}%
                  </span>
                </div>
                <Progress 
                  value={(resultado.atualizados / resultado.total) * 100} 
                  className="h-2"
                />
              </div>
            )}

            {/* Detalhes (primeiros 10) */}
            {resultado.details && resultado.details.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-semibold">Detalhes (primeiros 10 registros)</h3>
                <div className="border rounded-lg overflow-hidden">
                  <div className="max-h-96 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted sticky top-0">
                        <tr>
                          <th className="text-left p-2">Lead</th>
                          <th className="text-left p-2">Telefone</th>
                          <th className="text-left p-2">Email</th>
                          <th className="text-left p-2">Status</th>
                          <th className="text-left p-2">Projeto/Mensagem</th>
                        </tr>
                      </thead>
                      <tbody>
                        {resultado.details.slice(0, 10).map((detail: any, idx: number) => (
                          <tr key={idx} className="border-t">
                            <td className="p-2">{detail.nome}</td>
                            <td className="p-2 font-mono text-xs">{detail.telefone || "-"}</td>
                            <td className="p-2 font-mono text-xs">{detail.email || "-"}</td>
                            <td className="p-2">
                              {detail.status === "success" && (
                                <Badge variant="default" className="bg-green-600">
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Sucesso
                                </Badge>
                              )}
                              {detail.status === "not_found" && (
                                <Badge variant="secondary" className="bg-yellow-600">
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                  Não Encontrado
                                </Badge>
                              )}
                              {detail.status === "error" && (
                                <Badge variant="destructive">
                                  <AlertCircle className="h-3 w-3 mr-1" />
                                  Erro
                                </Badge>
                              )}
                            </td>
                            <td className="p-2 text-xs">
                              {detail.projeto || detail.message || "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                {resultado.details.length > 10 && (
                  <p className="text-xs text-muted-foreground text-center">
                    Mostrando 10 de {resultado.details.length} registros
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

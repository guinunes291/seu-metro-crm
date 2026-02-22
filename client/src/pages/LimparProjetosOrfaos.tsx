import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, RefreshCw, Trash2, AlertTriangle } from "lucide-react";

export default function LimparProjetosOrfaos() {
  const [executando, setExecutando] = useState(false);
  const [resultado, setResultado] = useState<any>(null);

  // Query de identificação
  const { data: stats, isLoading: loadingStats, refetch: refetchStats } = trpc.limparProjetos.identificar.useQuery();

  // Mutation de limpeza
  const limparMutation = trpc.limparProjetos.executar.useMutation({
    onSuccess: (data) => {
      setResultado(data);
      setExecutando(false);
      refetchStats();
    },
    onError: (error) => {
      console.error("Erro ao limpar projetos:", error);
      setExecutando(false);
    },
  });

  const handleExecutar = () => {
    if (!stats || stats.orfaos === 0) {
      return;
    }

    if (!confirm(`Tem certeza que deseja remover ${stats.orfaos} projetos órfãos? Esta operação é IRREVERSÍVEL!`)) {
      return;
    }

    setExecutando(true);
    setResultado(null);
    limparMutation.mutate();
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
        <h1 className="text-3xl font-bold mb-2">Limpeza de Projetos Órfãos</h1>
        <p className="text-muted-foreground">
          Remove projetos que não possuem leads associados. Útil para limpar projetos criados automaticamente durante importações antigas.
        </p>
      </div>

      {/* Estatísticas */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Projetos</CardTitle>
            <Trash2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total || 0}</div>
            <p className="text-xs text-muted-foreground">Projetos cadastrados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Com Leads</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats?.comLeads || 0}</div>
            <p className="text-xs text-muted-foreground">Projetos em uso</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Órfãos (Sem Leads)</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats?.orfaos || 0}</div>
            <p className="text-xs text-muted-foreground">Podem ser removidos</p>
          </CardContent>
        </Card>
      </div>

      {/* Card de Ação */}
      <Card>
        <CardHeader>
          <CardTitle>Executar Limpeza</CardTitle>
          <CardDescription>
            Esta ferramenta irá:
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Identificar todos os projetos que não possuem leads associados</li>
              <li>Remover permanentemente esses projetos da base de dados</li>
              <li>Gerar um relatório detalhado da operação</li>
            </ul>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {stats && stats.orfaos > 0 ? (
            <>
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Atenção!</strong> Esta operação é <strong>IRREVERSÍVEL</strong>. 
                  {stats.orfaos} projetos órfãos serão removidos permanentemente.
                </AlertDescription>
              </Alert>

              <Button 
                onClick={handleExecutar} 
                disabled={executando}
                variant="destructive"
                size="lg"
                className="w-full"
              >
                {executando ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Removendo...
                  </>
                ) : (
                  <>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Remover {stats.orfaos} Projetos Órfãos
                  </>
                )}
              </Button>
            </>
          ) : (
            <Alert>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription>
                Não há projetos órfãos para remover. Todos os projetos cadastrados possuem leads associados.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Lista de Projetos Órfãos */}
      {stats && stats.listaOrfaos && stats.listaOrfaos.length > 0 && !resultado && (
        <Card>
          <CardHeader>
            <CardTitle>Projetos que serão removidos</CardTitle>
            <CardDescription>Lista completa de projetos órfãos</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden">
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      <th className="text-left p-2">ID</th>
                      <th className="text-left p-2">Nome</th>
                      <th className="text-left p-2">Cidade</th>
                      <th className="text-left p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.listaOrfaos.map((projeto: any) => (
                      <tr key={projeto.id} className="border-t">
                        <td className="p-2 font-mono text-xs">{projeto.id}</td>
                        <td className="p-2">{projeto.nome}</td>
                        <td className="p-2">{projeto.cidade}</td>
                        <td className="p-2">
                          <Badge variant="secondary">{projeto.status}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resultado da Limpeza */}
      {resultado && (
        <Card>
          <CardHeader>
            <CardTitle>Resultado da Limpeza</CardTitle>
            <CardDescription>Relatório detalhado da operação</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Resumo */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Projetos Removidos</p>
                <p className="text-2xl font-bold text-green-600">{resultado.removidos}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Erros</p>
                <p className="text-2xl font-bold text-red-600">{resultado.erros}</p>
              </div>
            </div>

            {/* Detalhes */}
            {resultado.detalhes && resultado.detalhes.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-semibold">Detalhes</h3>
                <div className="border rounded-lg overflow-hidden">
                  <div className="max-h-96 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted sticky top-0">
                        <tr>
                          <th className="text-left p-2">ID</th>
                          <th className="text-left p-2">Nome</th>
                          <th className="text-left p-2">Status</th>
                          <th className="text-left p-2">Mensagem</th>
                        </tr>
                      </thead>
                      <tbody>
                        {resultado.detalhes.map((detail: any, idx: number) => (
                          <tr key={idx} className="border-t">
                            <td className="p-2 font-mono text-xs">{detail.id}</td>
                            <td className="p-2">{detail.nome}</td>
                            <td className="p-2">
                              {detail.status === "success" ? (
                                <Badge variant="default" className="bg-green-600">
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Removido
                                </Badge>
                              ) : (
                                <Badge variant="destructive">
                                  <AlertCircle className="h-3 w-3 mr-1" />
                                  Erro
                                </Badge>
                              )}
                            </td>
                            <td className="p-2 text-xs">{detail.message || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

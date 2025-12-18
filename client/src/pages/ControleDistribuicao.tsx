import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, UserCheck, UserX, CheckCircle2, XCircle, Play } from "lucide-react";

export default function ControleDistribuicao() {
  const [resultado, setResultado] = useState<{
    tipo: "sucesso" | "erro";
    mensagem: string;
  } | null>(null);

  // Buscar estatísticas de distribuição
  const { data: estatisticas, isLoading, refetch } = trpc.distribution.getEstatisticas.useQuery();

  // Mutation para distribuir todos os leads
  const distribuirTodos = trpc.distribution.distribuirTodos.useMutation({
    onSuccess: (data) => {
      setResultado({
        tipo: "sucesso",
        mensagem: `✅ Distribuição concluída! ${data.success} leads distribuídos com sucesso${data.failed > 0 ? `, ${data.failed} falharam` : ""}.`,
      });
      refetch();
    },
    onError: (error) => {
      setResultado({
        tipo: "erro",
        mensagem: `❌ Erro na distribuição: ${error.message}`,
      });
    },
  });

  const handleDistribuir = () => {
    setResultado(null);
    distribuirTodos.mutate();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const corretoresElegiveis = estatisticas?.filter((c) => c.elegivel) || [];
  const corretoresNaoElegiveis = estatisticas?.filter((c) => !c.elegivel) || [];

  return (
    <div className="container mx-auto py-8 space-y-6">
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
      <div className="grid gap-4 md:grid-cols-3">
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
      </div>

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
                  <TableHead className="text-right">Trabalhados</TableHead>
                  <TableHead className="text-right">Taxa de Trabalho</TableHead>
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
                    <TableCell className="text-right">{corretor.totalLeads}</TableCell>
                    <TableCell className="text-right">{corretor.leadsTrabalhados}</TableCell>
                    <TableCell className="text-right">
                      {(corretor.taxaTrabalho * 100).toFixed(0)}%
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
                  <TableHead className="text-right">Total Leads</TableHead>
                  <TableHead className="text-right">Trabalhados</TableHead>
                  <TableHead className="text-right">Taxa de Trabalho</TableHead>
                  <TableHead>Motivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {corretoresNaoElegiveis.map((corretor) => {
                  let motivo = "";
                  if (corretor.status !== "presente") {
                    motivo = "Ausente";
                  } else if (corretor.totalLeads >= 30 && corretor.taxaTrabalho < 0.6) {
                    motivo = "Taxa < 60%";
                  } else {
                    motivo = "Outro";
                  }

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
                      <TableCell className="text-right">{corretor.totalLeads}</TableCell>
                      <TableCell className="text-right">{corretor.leadsTrabalhados}</TableCell>
                      <TableCell className="text-right">
                        {(corretor.taxaTrabalho * 100).toFixed(0)}%
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
              <p className="font-medium">Mínimo de 30 Leads Garantido</p>
              <p className="text-sm text-muted-foreground">
                Corretores com menos de 30 leads sempre recebem novos leads
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
            <div>
              <p className="font-medium">Taxa de Trabalho de 60%</p>
              <p className="text-sm text-muted-foreground">
                Corretores com 30+ leads devem ter trabalhado pelo menos 60% deles
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Loader2, CheckCircle2, XCircle, ExternalLink, RefreshCw, Database, TrendingUp, Users, FileBarChart2 } from "lucide-react";
import { toast } from "sonner";

export default function SincronizacaoBI() {
  const [syncingDRE, setSyncingDRE] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncingContratos, setSyncingContratos] = useState(false);
  const [syncingMetricas, setSyncingMetricas] = useState(false);
  const [syncingPerformance, setSyncingPerformance] = useState(false);

  const { data: connectionStatus } = trpc.biSync.testConnection.useQuery();
  const { data: spreadsheetInfo } = trpc.biSync.getSpreadsheetUrl.useQuery();

  const syncAllMutation = trpc.biSync.syncAll.useMutation({
    onSuccess: (data) => {
      toast({
        title: "Sincronização completa!",
        description: data.message,
      });
      setSyncing(false);
    },
    onError: (error) => {
      toast({
        title: "Erro na sincronização",
        description: error.message,
        variant: "destructive",
      });
      setSyncing(false);
    },
  });

  const syncContratosMutation = trpc.biSync.syncContratos.useMutation({
    onSuccess: (data) => {
      toast({
        title: "Contratos sincronizados!",
        description: data.message,
      });
      setSyncingContratos(false);
    },
    onError: (error) => {
      toast({
        title: "Erro ao sincronizar contratos",
        description: error.message,
        variant: "destructive",
      });
      setSyncingContratos(false);
    },
  });

  const syncMetricasMutation = trpc.biSync.syncMetricas.useMutation({
    onSuccess: (data) => {
      toast({
        title: "Métricas sincronizadas!",
        description: data.message,
      });
      setSyncingMetricas(false);
    },
    onError: (error) => {
      toast({
        title: "Erro ao sincronizar métricas",
        description: error.message,
        variant: "destructive",
      });
      setSyncingMetricas(false);
    },
  });

  const syncPerformanceMutation = trpc.biSync.syncPerformance.useMutation({
    onSuccess: (data) => {
      toast({
        title: "Performance sincronizada!",
        description: data.message,
      });
      setSyncingPerformance(false);
    },
    onError: (error) => {
      toast({
        title: "Erro ao sincronizar performance",
        description: error.message,
        variant: "destructive",
      });
      setSyncingPerformance(false);
    },
  });

  const handleSyncAll = () => {
    setSyncing(true);
    syncAllMutation.mutate();
  };

  const handleSyncContratos = () => {
    setSyncingContratos(true);
    syncContratosMutation.mutate();
  };

  const handleSyncMetricas = () => {
    setSyncingMetricas(true);
    syncMetricasMutation.mutate({ dias: 90 });
  };

  const handleSyncPerformance = () => {
    setSyncingPerformance(true);
    syncPerformanceMutation.mutate();
  };
  const syncDREMutation = trpc.backup.sincronizarDRE.useMutation({
    onSuccess: (data) => {
      if (data?.success) {
        toast.success(`Planilha DRE sincronizada! ${data.totalContratos ?? 0} contratos ativos exportados.`);
      } else {
        toast.error(`Erro ao sincronizar DRE: ${data?.error ?? 'Erro desconhecido'}`);
      }
      setSyncingDRE(false);
    },
    onError: (error) => {
      toast.error(`Erro ao sincronizar DRE: ${error.message}`);
      setSyncingDRE(false);
    },
  });
  const handleSyncDRE = () => {
    setSyncingDRE(true);
    syncDREMutation.mutate();
  };
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Sincronização BI</h1>
          <p className="text-muted-foreground mt-2">
            Sincronize dados do CRM com Google Sheets para análise no Power BI, Looker Studio e outras ferramentas
          </p>
        </div>

        {/* Status da Conexão */}
        <Card>
          <CardHeader>
            <CardTitle>Status da Conexão</CardTitle>
            <CardDescription>Verifique se a conexão com Google Sheets está funcionando</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              {connectionStatus?.success ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <span className="text-sm">{connectionStatus.message}</span>
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-red-600" />
                  <span className="text-sm">
                    {connectionStatus?.message || "Verificando conexão..."}
                  </span>
                </>
              )}
            </div>

            {spreadsheetInfo && (
              <div className="mt-4">
                <Button variant="outline" size="sm" asChild>
                  <a href={spreadsheetInfo.url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Abrir Planilha no Google Sheets
                  </a>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sincronização Completa */}
        <Card>
          <CardHeader>
            <CardTitle>Sincronização Completa</CardTitle>
            <CardDescription>
              Sincroniza todos os dados (Contratos, Métricas Diárias e Performance dos Corretores)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleSyncAll} disabled={syncing} size="lg">
              {syncing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sincronizando...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Sincronizar Tudo
                </>
              )}
            </Button>
            <p className="text-sm text-muted-foreground mt-3">
              A sincronização automática roda a cada 1 hora. Use este botão para forçar uma sincronização imediata.
            </p>
          </CardContent>
        </Card>

        {/* Sincronizações Individuais */}
        <div className="grid gap-6 md:grid-cols-3">
          {/* Contratos */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Contratos
              </CardTitle>
              <CardDescription>Sincroniza todos os contratos fechados</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={handleSyncContratos}
                disabled={syncingContratos}
                variant="outline"
                className="w-full"
              >
                {syncingContratos ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sincronizando...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Sincronizar
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground mt-3">
                Atualiza a aba "Contratos" com todos os contratos fechados, incluindo VGV, corretor, cliente e projeto.
              </p>
            </CardContent>
          </Card>

          {/* Métricas Diárias */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Métricas Diárias
              </CardTitle>
              <CardDescription>Sincroniza métricas dos últimos 90 dias</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={handleSyncMetricas}
                disabled={syncingMetricas}
                variant="outline"
                className="w-full"
              >
                {syncingMetricas ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sincronizando...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Sincronizar
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground mt-3">
                Atualiza a aba "Métricas Diárias" com KPIs agregados por dia, incluindo taxas de conversão.
              </p>
            </CardContent>
          </Card>

          {/* Performance Corretores */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Performance
              </CardTitle>
              <CardDescription>Sincroniza performance dos corretores</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={handleSyncPerformance}
                disabled={syncingPerformance}
                variant="outline"
                className="w-full"
              >
                {syncingPerformance ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sincronizando...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Sincronizar
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground mt-3">
                Atualiza a aba "Performance Corretores" com métricas individuais, VGV total e taxas de conversão.
              </p>
            </CardContent>
          </Card>
        </div>
        {/* Sincronização Planilha DRE */}
        <Card className="border-green-200 dark:border-green-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileBarChart2 className="h-5 w-5 text-green-600" />
              Planilha DRE
            </CardTitle>
            <CardDescription>
              Sincroniza todos os contratos com a planilha DRE do Google Sheets (aba Lançamentos)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleSyncDRE} disabled={syncingDRE} className="bg-green-600 hover:bg-green-700 text-white">
              {syncingDRE ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sincronizando DRE...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Sincronizar Planilha DRE Agora
                </>
              )}
            </Button>
            <p className="text-sm text-muted-foreground mt-3">
              Exporta todos os contratos ativos e distratados para a aba <strong>Lançamentos</strong> da planilha DRE, incluindo VGV, comissões brutas/líquidas, impostos e rateio por corretor/gerente/superintendente. A sincronização automática ocorre a cada 1 hora e também é disparada automaticamente ao criar, editar ou distratar um contrato.
            </p>
            <div className="mt-4 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
              <p className="text-xs text-green-700 dark:text-green-400 font-medium">
                ✅ Sincronização automática ativa — a cada 1 hora e ao criar/editar contratos
              </p>
            </div>
          </CardContent>
        </Card>
        {/* Dashboards Looker Studio */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Dashboards Looker Studio
            </CardTitle>
            <CardDescription>Dashboards visuais e interativos para análise em tempo real</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent transition-colors">
                <div>
                  <h4 className="font-semibold text-sm">Performance Geral</h4>
                  <p className="text-xs text-muted-foreground">KPIs principais, funil de vendas e evolução temporal</p>
                </div>
                <Button size="sm" variant="outline" asChild>
                  <a href="https://lookerstudio.google.com/create" target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Criar
                  </a>
                </Button>
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent transition-colors">
                <div>
                  <h4 className="font-semibold text-sm">Análise de Equipes</h4>
                  <p className="text-xs text-muted-foreground">Comparação entre equipes, metas e ranking</p>
                </div>
                <Button size="sm" variant="outline" asChild>
                  <a href="https://lookerstudio.google.com/create" target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Criar
                  </a>
                </Button>
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent transition-colors">
                <div>
                  <h4 className="font-semibold text-sm">Performance Individual</h4>
                  <p className="text-xs text-muted-foreground">Métricas detalhadas de cada corretor</p>
                </div>
                <Button size="sm" variant="outline" asChild>
                  <a href="https://lookerstudio.google.com/create" target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Criar
                  </a>
                </Button>
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent transition-colors">
                <div>
                  <h4 className="font-semibold text-sm">Análise de Projetos</h4>
                  <p className="text-xs text-muted-foreground">VGV por projeto e leads por empreendimento</p>
                </div>
                <Button size="sm" variant="outline" asChild>
                  <a href="https://lookerstudio.google.com/create" target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Criar
                  </a>
                </Button>
              </div>
            </div>

            <div className="bg-muted p-4 rounded-lg">
              <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                <Database className="h-4 w-4" />
                Guia Completo de Configuração
              </h4>
              <p className="text-xs text-muted-foreground mb-3">
                Consulte o guia detalhado com passo a passo, campos calculados, componentes recomendados e dicas de design.
              </p>
              <Button size="sm" variant="secondary" asChild className="w-full">
                <a href="/docs/looker-studio-dashboards.md" target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Ver Documentação Completa
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Instruções de Integração */}
        <Card>
          <CardHeader>
            <CardTitle>Como Integrar com Outras Ferramentas de BI</CardTitle>
            <CardDescription>Conecte o Google Sheets ao Power BI ou outras ferramentas</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Power BI</h3>
              <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Abra o Power BI Desktop</li>
                <li>Clique em "Obter Dados" → "Web"</li>
                <li>Cole a URL da planilha Google Sheets</li>
                <li>Selecione as abas que deseja importar (Contratos, Métricas Diárias, Performance Corretores)</li>
                <li>Configure a atualização automática em "Atualizar" → "Agendar atualização"</li>
              </ol>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Looker Studio (Google Data Studio)</h3>
              <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Acesse <a href="https://lookerstudio.google.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">lookerstudio.google.com</a></li>
                <li>Clique em "Criar" → "Fonte de dados"</li>
                <li>Selecione "Google Sheets"</li>
                <li>Escolha a planilha sincronizada</li>
                <li>Selecione as abas e crie seus relatórios visuais</li>
              </ol>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Excel / Google Sheets</h3>
              <p className="text-sm text-muted-foreground">
                Você pode trabalhar diretamente na planilha Google Sheets ou importá-la para o Excel usando "Dados" → "De Outras Fontes" → "Do Google Sheets".
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

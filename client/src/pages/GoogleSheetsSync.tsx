import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, CheckCircle2, XCircle, RefreshCw, ExternalLink, FileSpreadsheet, Zap, Settings } from "lucide-react";
import { toast } from "sonner";

export default function GoogleSheetsSync() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);

  // Queries
  const { data: connectionStatus, isLoading: isTestingConnection, refetch: refetchConnection } = 
    trpc.sheetsSync.testConnection.useQuery(undefined, {
      retry: false,
    });

  const { data: spreadsheetInfo } = trpc.sheetsSync.getSpreadsheetUrl.useQuery();

  // Mutations
  const initializeMutation = trpc.sheetsSync.initialize.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      refetchConnection();
    },
    onError: (error) => {
      toast.error(`Erro ao inicializar: ${error.message}`);
    },
  });

  const syncAllMutation = trpc.sheetsSync.syncAll.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success(data.message);
      } else {
        toast.error(data.message);
      }
    },
    onError: (error) => {
      toast.error(`Erro na sincronização: ${error.message}`);
    },
  });

  const handleInitialize = async () => {
    setIsInitializing(true);
    try {
      await initializeMutation.mutateAsync();
    } finally {
      setIsInitializing(false);
    }
  };

  const handleSyncAll = async () => {
    setIsSyncing(true);
    try {
      await syncAllMutation.mutateAsync();
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="container py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <FileSpreadsheet className="h-8 w-8 text-green-600" />
          Sincronização com Google Sheets
        </h1>
        <p className="text-muted-foreground mt-2">
          Configure a exportação automática de leads para uma planilha do Google Sheets
        </p>
      </div>

      {/* Status da Conexão */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Status da Conexão
          </CardTitle>
          <CardDescription>
            Verifique se a conexão com a planilha está funcionando
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isTestingConnection ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Testando conexão...
            </div>
          ) : connectionStatus?.success ? (
            <Alert className="border-green-500 bg-green-50 dark:bg-green-950/20">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <AlertTitle className="text-green-700 dark:text-green-400">Conectado</AlertTitle>
              <AlertDescription className="text-green-600 dark:text-green-300">
                {connectionStatus.message}
              </AlertDescription>
            </Alert>
          ) : (
            <Alert variant="destructive">
              <XCircle className="h-5 w-5" />
              <AlertTitle>Erro de Conexão</AlertTitle>
              <AlertDescription>
                {connectionStatus?.message || "Não foi possível conectar à planilha. Verifique se o Service Account tem acesso."}
              </AlertDescription>
            </Alert>
          )}

          <div className="mt-4 flex gap-3">
            <Button 
              variant="outline" 
              onClick={() => refetchConnection()}
              disabled={isTestingConnection}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isTestingConnection ? 'animate-spin' : ''}`} />
              Testar Novamente
            </Button>

            {spreadsheetInfo?.url && (
              <Button variant="outline" asChild>
                <a href={spreadsheetInfo.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Abrir Planilha
                </a>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Ações */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Inicializar Planilha */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Inicializar Planilha
            </CardTitle>
            <CardDescription>
              Cria a aba "Leads" e adiciona os cabeçalhos das colunas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Execute esta ação apenas uma vez para preparar a planilha. 
              Se a planilha já estiver configurada, esta ação não terá efeito.
            </p>
            <Button 
              onClick={handleInitialize}
              disabled={isInitializing || !connectionStatus?.success}
              className="w-full"
            >
              {isInitializing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Inicializando...
                </>
              ) : (
                <>
                  <Settings className="h-4 w-4 mr-2" />
                  Inicializar Planilha
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Sincronizar Todos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Sincronizar Todos os Leads
            </CardTitle>
            <CardDescription>
              Exporta todos os leads do sistema para a planilha
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Esta ação irá limpar os dados existentes na planilha e reescrever 
              todos os leads do sistema. Use com cuidado.
            </p>
            <Button 
              onClick={handleSyncAll}
              disabled={isSyncing || !connectionStatus?.success}
              className="w-full"
              variant="default"
            >
              {isSyncing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sincronizando...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Sincronizar Agora
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Informações */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Estrutura da Planilha</CardTitle>
          <CardDescription>
            Colunas que serão exportadas para o Google Sheets
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
            {[
              "ID",
              "Data Criação",
              "Nome",
              "Email",
              "Telefone",
              "CPF",
              "Origem",
              "Projeto Interesse",
              "Corretor",
              "Status",
              "Data Distribuição",
              "Último Contato",
              "Observações",
              "Campanha",
              "Faixa de Renda",
            ].map((col) => (
              <div 
                key={col} 
                className="bg-muted px-3 py-2 rounded-md text-sm text-center"
              >
                {col}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Nota sobre sincronização automática */}
      <Alert className="mt-6">
        <Zap className="h-4 w-4" />
        <AlertTitle>Sincronização Automática</AlertTitle>
        <AlertDescription>
          Novos leads criados no sistema serão automaticamente adicionados à planilha. 
          Para atualizações em leads existentes, use o botão "Sincronizar Agora".
        </AlertDescription>
      </Alert>
    </div>
  );
}

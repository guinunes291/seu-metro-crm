import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { FileSpreadsheet, Upload, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useState } from "react";
import { Progress } from "@/components/ui/progress";

export default function ImportarSheets() {
  const [sheetUrl, setSheetUrl] = useState("");
  const [selectedTab, setSelectedTab] = useState("MASTER_LEADS");
  const [importResult, setImportResult] = useState<any>(null);

  const validateMutation = trpc.sheets.validateUrl.useQuery(
    { url: sheetUrl },
    { enabled: false }
  );

  const listTabsMutation = trpc.sheets.listTabs.useQuery(
    { url: sheetUrl },
    { enabled: false }
  );

  const importMutation = trpc.sheets.import.useMutation();
  const syncMutation = trpc.sheets.sync.useMutation();

  const handleValidate = async () => {
    if (!sheetUrl) {
      toast.error("Por favor, insira a URL da planilha");
      return;
    }

    try {
      await validateMutation.refetch();
      await listTabsMutation.refetch();
      toast.success("Planilha validada com sucesso!");
    } catch (error: any) {
      toast.error(error.message || "Erro ao validar planilha");
    }
  };

  const handleImport = async () => {
    if (!sheetUrl) {
      toast.error("Por favor, insira a URL da planilha");
      return;
    }

    try {
      const range = `${selectedTab}!A:H`;
      const result = await importMutation.mutateAsync({
        url: sheetUrl,
        range,
      });

      setImportResult(result);
      toast.success(
        `Importação concluída! ${result.imported} leads importados, ${result.duplicates} duplicatas ignoradas.`
      );
    } catch (error: any) {
      toast.error(error.message || "Erro ao importar leads");
    }
  };

  const handleSync = async () => {
    if (!sheetUrl) {
      toast.error("Por favor, insira a URL da planilha");
      return;
    }

    try {
      const range = `${selectedTab}!A:H`;
      const result = await syncMutation.mutateAsync({
        url: sheetUrl,
        range,
      });

      setImportResult(result);
      toast.success(
        `Sincronização concluída! ${result.imported} novos leads importados.`
      );
    } catch (error: any) {
      toast.error(error.message || "Erro ao sincronizar leads");
    }
  };

  const successRate = importResult
    ? Math.round((importResult.imported / importResult.total) * 100)
    : 0;

  return (
    <DashboardLayout>
      <div className="container py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Importar Leads do Google Sheets</h1>
          <p className="text-muted-foreground mt-2">
            Importe leads automaticamente da sua planilha do Google Sheets
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Configuração */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5" />
                Configuração da Importação
              </CardTitle>
              <CardDescription>
                Configure a URL e aba da planilha para importar
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="sheetUrl">URL da Planilha do Google Sheets</Label>
                <Input
                  id="sheetUrl"
                  type="url"
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  value={sheetUrl}
                  onChange={(e) => setSheetUrl(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  A planilha deve estar com compartilhamento público
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tab">Aba da Planilha</Label>
                <Select value={selectedTab} onValueChange={setSelectedTab}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a aba" />
                  </SelectTrigger>
                  <SelectContent>
                    {listTabsMutation.data?.tabs.map((tab) => (
                      <SelectItem key={tab} value={tab}>
                        {tab}
                      </SelectItem>
                    )) || (
                      <>
                        <SelectItem value="MASTER_LEADS">MASTER_LEADS</SelectItem>
                        <SelectItem value="Leads para distribuição">
                          Leads para distribuição
                        </SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={handleValidate}
                variant="outline"
                className="w-full"
                disabled={validateMutation.isFetching}
              >
                Validar Planilha
              </Button>

              <div className="flex gap-2">
                <Button
                  onClick={handleImport}
                  className="flex-1"
                  disabled={importMutation.isPending || !sheetUrl}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Importar Todos
                </Button>

                <Button
                  onClick={handleSync}
                  variant="secondary"
                  className="flex-1"
                  disabled={syncMutation.isPending || !sheetUrl}
                >
                  Sincronizar Novos
                </Button>
              </div>

              <div className="text-xs text-muted-foreground space-y-1">
                <p>• <strong>Importar Todos:</strong> Importa todos os leads da planilha</p>
                <p>• <strong>Sincronizar Novos:</strong> Importa apenas leads novos (ignora duplicatas)</p>
              </div>
            </CardContent>
          </Card>

          {/* Resultado */}
          <Card>
            <CardHeader>
              <CardTitle>Resultado da Importação</CardTitle>
              <CardDescription>
                Estatísticas e detalhes da última importação
              </CardDescription>
            </CardHeader>
            <CardContent>
              {importResult ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Total de Linhas</p>
                      <p className="text-2xl font-bold">{importResult.total}</p>
                    </div>

                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Importados</p>
                      <p className="text-2xl font-bold text-green-600">
                        {importResult.imported}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Duplicatas</p>
                      <p className="text-2xl font-bold text-yellow-600">
                        {importResult.duplicates}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Erros</p>
                      <p className="text-2xl font-bold text-red-600">
                        {importResult.errors}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Taxa de Sucesso</span>
                      <span className="font-medium">{successRate}%</span>
                    </div>
                    <Progress value={successRate} />
                  </div>

                  {/* Detalhes */}
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    <p className="text-sm font-medium">Detalhes:</p>
                    {importResult.details.slice(0, 10).map((detail: any, index: number) => (
                      <div
                        key={index}
                        className="flex items-start gap-2 text-sm p-2 rounded-lg bg-muted/50"
                      >
                        {detail.status === "imported" && (
                          <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />
                        )}
                        {detail.status === "duplicate" && (
                          <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
                        )}
                        {detail.status === "error" && (
                          <XCircle className="h-4 w-4 text-red-600 mt-0.5" />
                        )}
                        <div className="flex-1">
                          <p className="font-medium">
                            Linha {detail.row}: {detail.nome}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {detail.message}
                          </p>
                        </div>
                      </div>
                    ))}
                    {importResult.details.length > 10 && (
                      <p className="text-xs text-muted-foreground text-center">
                        ... e mais {importResult.details.length - 10} registros
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <FileSpreadsheet className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-sm text-muted-foreground">
                    Nenhuma importação realizada ainda
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Instruções */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Como Importar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <ol className="list-decimal list-inside space-y-2">
              <li>
                Abra sua planilha do Google Sheets e clique em <strong>"Compartilhar"</strong>
              </li>
              <li>
                Configure o compartilhamento para <strong>"Qualquer pessoa com o link"</strong>
              </li>
              <li>
                Copie a URL da planilha e cole no campo acima
              </li>
              <li>
                Selecione a aba que contém os leads (geralmente <strong>MASTER_LEADS</strong>)
              </li>
              <li>
                Clique em <strong>"Validar Planilha"</strong> para verificar o acesso
              </li>
              <li>
                Escolha entre <strong>"Importar Todos"</strong> ou <strong>"Sincronizar Novos"</strong>
              </li>
            </ol>

            <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <p className="font-medium text-blue-900 dark:text-blue-100">
                💡 Dica: Use "Sincronizar Novos" para importar apenas leads que ainda não estão no sistema
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

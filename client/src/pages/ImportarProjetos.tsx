import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { FileSpreadsheet, Upload, CheckCircle2, XCircle, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";

export default function ImportarProjetos() {
  const [sheetUrl, setSheetUrl] = useState("");
  const [sheetName, setSheetName] = useState("GERAL");
  const [syncMode, setSyncMode] = useState<"all" | "new">("new");
  const [importResult, setImportResult] = useState<any>(null);
  const [isImporting, setIsImporting] = useState(false);

  const importMutation = trpc.projects.importFromSheets.useMutation();

  const handleImport = async () => {
    if (!sheetUrl.trim()) {
      toast.error("Por favor, insira a URL da planilha");
      return;
    }

    setIsImporting(true);
    setImportResult(null);

    try {
      const result = await importMutation.mutateAsync({
        sheetUrl,
        sheetName,
        syncMode,
      });

      setImportResult(result);

      if (result.imported > 0) {
        toast.success(`${result.imported} projetos importados com sucesso!`);
      } else if (result.duplicates > 0) {
        toast.info("Nenhum projeto novo encontrado");
      } else if (result.errors > 0) {
        toast.error("Houve erros durante a importação");
      }
    } catch (error: any) {
      toast.error(error.message || "Erro ao importar projetos");
      console.error("Erro na importação:", error);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="container max-w-7xl py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Importar Projetos do Google Sheets</h1>
          <p className="text-muted-foreground">
            Importe projetos automaticamente da sua planilha do Google Sheets
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Configuração da Importação */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5" />
                <CardTitle>Configuração da Importação</CardTitle>
              </div>
              <CardDescription>
                Configure a URL e aba da planilha para importar
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="sheetUrl">URL da Planilha do Google Sheets</Label>
                <Input
                  id="sheetUrl"
                  type="url"
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  value={sheetUrl}
                  onChange={(e) => setSheetUrl(e.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                  A planilha deve estar com compartilhamento público
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sheetName">Aba da Planilha</Label>
                <Input
                  id="sheetName"
                  type="text"
                  placeholder="GERAL"
                  value={sheetName}
                  onChange={(e) => setSheetName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Modo de Sincronização</Label>
                <Select value={syncMode} onValueChange={(value: "all" | "new") => setSyncMode(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">Sincronizar Novos</SelectItem>
                    <SelectItem value="all">Importar Todos</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  onClick={handleImport}
                  disabled={isImporting || !sheetUrl.trim()}
                  className="flex-1"
                >
                  {isImporting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Importando...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      {syncMode === "all" ? "Importar Todos" : "Sincronizar Novos"}
                    </>
                  )}
                </Button>
              </div>

              <div className="space-y-2 pt-4 border-t">
                <p className="text-sm font-medium">Explicação dos modos:</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>
                    <strong>Importar Todos:</strong> Importa todos os projetos da planilha
                  </li>
                  <li>
                    <strong>Sincronizar Novos:</strong> Importa apenas projetos novos (ignora duplicatas)
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Resultado da Importação */}
          <Card>
            <CardHeader>
              <CardTitle>Resultado da Importação</CardTitle>
              <CardDescription>
                Estatísticas e detalhes da última importação
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!importResult ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <FileSpreadsheet className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-sm text-muted-foreground">
                    Nenhuma importação realizada ainda
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Total de Linhas</p>
                      <p className="text-2xl font-bold">{importResult.totalRows}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Importados</p>
                      <p className="text-2xl font-bold text-green-600">{importResult.imported}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Duplicatas</p>
                      <p className="text-2xl font-bold text-orange-600">{importResult.duplicates}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Erros</p>
                      <p className="text-2xl font-bold text-red-600">{importResult.errors}</p>
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <p className="text-sm font-medium mb-2">Taxa de Sucesso</p>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{
                          width: `${(importResult.imported / importResult.totalRows) * 100}%`,
                        }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {Math.round((importResult.imported / importResult.totalRows) * 100)}%
                    </p>
                  </div>

                  {importResult.details && importResult.details.length > 0 && (
                    <div className="pt-4 border-t">
                      <p className="text-sm font-medium mb-2">Detalhes:</p>
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {importResult.details.slice(0, 10).map((detail: any, index: number) => (
                          <Alert key={index} variant={detail.status === "error" ? "destructive" : "default"}>
                            <div className="flex items-start gap-2">
                              {detail.status === "success" && (
                                <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />
                              )}
                              {detail.status === "duplicate" && (
                                <AlertCircle className="h-4 w-4 text-orange-600 mt-0.5" />
                              )}
                              {detail.status === "error" && (
                                <XCircle className="h-4 w-4 text-red-600 mt-0.5" />
                              )}
                              <div className="flex-1">
                                <AlertDescription className="text-xs">
                                  <strong>Linha {detail.row}:</strong> {detail.nome}
                                  {detail.message && (
                                    <span className="block text-muted-foreground mt-1">
                                      {detail.message}
                                    </span>
                                  )}
                                </AlertDescription>
                              </div>
                            </div>
                          </Alert>
                        ))}
                        {importResult.details.length > 10 && (
                          <p className="text-xs text-muted-foreground text-center">
                            ... e mais {importResult.details.length - 10} itens
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Como Importar */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Como Importar</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal list-inside space-y-2 text-sm">
              <li>Abra sua planilha do Google Sheets e clique em <strong>"Compartilhar"</strong></li>
              <li>Configure o compartilhamento para <strong>"Qualquer pessoa com o link"</strong></li>
              <li>Copie a URL da planilha e cole no campo acima</li>
              <li>Selecione a aba que contém os projetos (geralmente <strong>GERAL</strong>)</li>
              <li>Clique em <strong>"Validar Planilha"</strong> para verificar o acesso</li>
              <li>Escolha entre <strong>"Importar Todos"</strong> ou <strong>"Sincronizar Novos"</strong></li>
            </ol>

            <Alert className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Dica:</strong> Use "Sincronizar Novos" para importar apenas projetos que ainda não estão no sistema
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

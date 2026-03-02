import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, FileText, CheckCircle, XCircle, AlertCircle } from "lucide-react";


export default function ImportarCSV() {

  const [file, setFile] = useState<File | null>(null);
  const [csvContent, setCsvContent] = useState<string>("");
  const [preview, setPreview] = useState<any>(null);
  const [mapping, setMapping] = useState<any>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<any>(null);

  const previewQuery = trpc.csv.preview.useQuery;
  const importMutation = trpc.csv.import.useMutation();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setResult(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      setCsvContent(content);

      try {
        const response = await fetch('/api/trpc/csv.preview?input=' + encodeURIComponent(JSON.stringify({ content })));
        const previewData = await response.json();
        if (previewData.error) throw new Error(previewData.error.message);
        setPreview(previewData);
        setMapping(previewData.mapping);
      } catch (error: any) {
        alert('Erro ao processar CSV: ' + error.message);
      }
    };
    reader.readAsText(selectedFile);
  };

  const handleImport = async () => {
    if (!csvContent || !mapping) return;

    setImporting(true);
    try {
      const importResult = await importMutation.mutateAsync({
        content: csvContent,
        mapping,
        delimiter: preview?.delimiter,
      });

      setResult(importResult);

      if (importResult.success) {
        alert(`Importação concluída! ${importResult.imported} leads importados.`);
      } else {
        alert(`Importação com erros: ${importResult.imported} importados, ${importResult.errors} erros.`);
      }
    } catch (error: any) {
      alert('Erro na importação: ' + error.message);
    } finally {
      setImporting(false);
    }
  };

  const updateMapping = (field: string, columnIndex: number | null) => {
    setMapping({
      ...mapping,
      [field]: columnIndex,
    });
  };

  return (
    <div className="container py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Importar Leads via CSV</h1>
        <p className="text-muted-foreground mt-2">
          Importe seus leads em massa através de um arquivo CSV. O sistema detecta automaticamente o formato.
        </p>
      </div>

      {!preview && !result && (
        <Card>
          <CardHeader>
            <CardTitle>Selecione o arquivo CSV</CardTitle>
            <CardDescription>
              O sistema detecta automaticamente o delimitador (vírgula, ponto-e-vírgula ou tab) e o encoding.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border-2 border-dashed rounded-lg p-12 text-center">
              <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <div className="mb-4">
                <label htmlFor="csv-upload" className="cursor-pointer">
                  <Button asChild>
                    <span>Selecionar Arquivo CSV</span>
                  </Button>
                  <input
                    id="csv-upload"
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                </label>
              </div>
              <p className="text-sm text-muted-foreground">
                Arraste um arquivo ou clique para selecionar
              </p>
            </div>

            <Alert className="mt-6">
              <FileText className="h-4 w-4" />
              <AlertDescription>
                <strong>Formato esperado:</strong> O arquivo deve conter pelo menos as colunas de <strong>Nome</strong> e <strong>Telefone</strong>.
                Outras colunas opcionais: Email, Origem, Observações, <strong>Projeto</strong> (salvo como texto no card do lead).
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}

      {preview && !result && (
        <Card>
          <CardHeader>
            <CardTitle>Preview do Arquivo</CardTitle>
            <CardDescription>
              Arquivo: <strong>{file?.name}</strong> • 
              Delimitador: <strong>{preview.delimiter === ',' ? 'Vírgula' : preview.delimiter === ';' ? 'Ponto-e-vírgula' : 'Tab'}</strong> • 
              Total: <strong>{preview.totalRows} linhas</strong>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="font-semibold mb-3">Mapeamento de Colunas</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium">Nome *</label>
                  <Select
                    value={mapping.nome?.toString() || "none"}
                    onValueChange={(v) => updateMapping('nome', v === 'none' ? null : parseInt(v))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma</SelectItem>
                      {preview.headers.map((header: string, idx: number) => (
                        <SelectItem key={idx} value={idx.toString()}>
                          {header}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium">Telefone *</label>
                  <Select
                    value={mapping.telefone?.toString() || "none"}
                    onValueChange={(v) => updateMapping('telefone', v === 'none' ? null : parseInt(v))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma</SelectItem>
                      {preview.headers.map((header: string, idx: number) => (
                        <SelectItem key={idx} value={idx.toString()}>
                          {header}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium">Email</label>
                  <Select
                    value={mapping.email?.toString() || "none"}
                    onValueChange={(v) => updateMapping('email', v === 'none' ? null : parseInt(v))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma</SelectItem>
                      {preview.headers.map((header: string, idx: number) => (
                        <SelectItem key={idx} value={idx.toString()}>
                          {header}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium">Origem</label>
                  <Select
                    value={mapping.origem?.toString() || "none"}
                    onValueChange={(v) => updateMapping('origem', v === 'none' ? null : parseInt(v))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma</SelectItem>
                      {preview.headers.map((header: string, idx: number) => (
                        <SelectItem key={idx} value={idx.toString()}>
                          {header}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium">Observações</label>
                  <Select
                    value={mapping.observacoes?.toString() || "none"}
                    onValueChange={(v) => updateMapping('observacoes', v === 'none' ? null : parseInt(v))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma</SelectItem>
                      {preview.headers.map((header: string, idx: number) => (
                        <SelectItem key={idx} value={idx.toString()}>
                          {header}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium">Projeto / Empreendimento</label>
                  <Select
                    value={mapping.projeto?.toString() ?? "none"}
                    onValueChange={(v) => updateMapping('projeto', v === 'none' ? null : parseInt(v))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma</SelectItem>
                      {preview.headers.map((header: string, idx: number) => (
                        <SelectItem key={idx} value={idx.toString()}>
                          {header}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">Salvo como texto no card do lead — não cria projetos no sistema</p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-3">Preview (primeiras 10 linhas)</h3>
              <div className="border rounded-lg overflow-auto max-h-96">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {preview.headers.map((header: string, idx: number) => (
                        <TableHead key={idx}>{header}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.preview.map((row: string[], idx: number) => (
                      <TableRow key={idx}>
                        {row.map((cell: string, cellIdx: number) => (
                          <TableCell key={cellIdx}>{cell}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={handleImport}
                disabled={importing || mapping.nome === undefined || mapping.telefone === undefined}
                className="flex-1"
              >
                {importing ? "Importando..." : `Importar ${preview.totalRows} Leads`}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setPreview(null);
                  setFile(null);
                  setCsvContent("");
                }}
              >
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Resultado da Importação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <div className="border rounded-lg p-4">
                <div className="flex items-center gap-2 text-green-600 mb-2">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-semibold">Importados</span>
                </div>
                <div className="text-3xl font-bold">{result.imported}</div>
              </div>

              <div className="border rounded-lg p-4">
                <div className="flex items-center gap-2 text-yellow-600 mb-2">
                  <AlertCircle className="h-5 w-5" />
                  <span className="font-semibold">Ignorados</span>
                </div>
                <div className="text-3xl font-bold">{result.skipped}</div>
              </div>

              <div className="border rounded-lg p-4">
                <div className="flex items-center gap-2 text-red-600 mb-2">
                  <XCircle className="h-5 w-5" />
                  <span className="font-semibold">Erros</span>
                </div>
                <div className="text-3xl font-bold">{result.errors}</div>
              </div>
            </div>

            {result.details.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3">Detalhes (primeiras 100 linhas)</h3>
                <div className="border rounded-lg overflow-auto max-h-96">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Linha</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Mensagem</TableHead>
                        <TableHead>Dados</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.details.map((detail: any, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell>{detail.row}</TableCell>
                          <TableCell>
                            {detail.status === 'imported' && (
                              <span className="text-green-600 font-medium">Importado</span>
                            )}
                            {detail.status === 'skipped' && (
                              <span className="text-yellow-600 font-medium">Ignorado</span>
                            )}
                            {detail.status === 'error' && (
                              <span className="text-red-600 font-medium">Erro</span>
                            )}
                          </TableCell>
                          <TableCell>{detail.message}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {detail.data && JSON.stringify(detail.data)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                onClick={() => {
                  setResult(null);
                  setPreview(null);
                  setFile(null);
                  setCsvContent("");
                }}
                className="flex-1"
              >
                Importar Outro Arquivo
              </Button>
              <Button
                variant="outline"
                onClick={() => window.location.href = '/leads'}
              >
                Ver Meus Leads
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

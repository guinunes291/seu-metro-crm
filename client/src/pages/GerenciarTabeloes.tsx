import { useState, useRef } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  FileText, Upload, Link2, RefreshCw, Loader2, CheckCircle2,
  XCircle, Clock, AlertCircle, ChevronDown, ChevronUp, Building2,
} from 'lucide-react';
import { toast } from 'sonner';

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const ANO_ATUAL = new Date().getFullYear();
const ANOS = Array.from({ length: 4 }, (_, i) => ANO_ATUAL - 1 + i);

type UploadMode = 'url' | 'file';

type StatusInfo = {
  icon: React.ReactNode;
  label: string;
  color: string;
};

function getStatusInfo(status: string): StatusInfo {
  switch (status) {
    case 'concluido':
      return { icon: <CheckCircle2 className="h-4 w-4" />, label: 'Concluído', color: 'text-green-600 bg-green-50 border-green-200' };
    case 'processando':
      return { icon: <Loader2 className="h-4 w-4 animate-spin" />, label: 'Processando...', color: 'text-blue-600 bg-blue-50 border-blue-200' };
    case 'pendente':
      return { icon: <Clock className="h-4 w-4" />, label: 'Pendente', color: 'text-yellow-600 bg-yellow-50 border-yellow-200' };
    case 'erro':
      return { icon: <XCircle className="h-4 w-4" />, label: 'Erro', color: 'text-red-600 bg-red-50 border-red-200' };
    default:
      return { icon: <AlertCircle className="h-4 w-4" />, label: status, color: 'text-gray-600 bg-gray-50 border-gray-200' };
  }
}

function NovoTabelaoForm({ construtoraId, onSuccess }: { construtoraId: number; onSuccess: () => void }) {
  const [mode, setMode] = useState<UploadMode>('url');
  const [mes, setMes] = useState(String(new Date().getMonth() + 1));
  const [ano, setAno] = useState(String(ANO_ATUAL));
  const [driveUrl, setDriveUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const createAndProcessMutation = trpc.tabeloes.createAndProcess.useMutation({
    onSuccess: () => {
      toast.success('Processamento iniciado — acompanhe o status na lista abaixo');
      setDriveUrl('');
      onSuccess();
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const handleUrlSubmit = () => {
    if (!driveUrl.trim()) {
      toast.error('Informe a URL do Google Drive');
      return;
    }
    createAndProcessMutation.mutate({
      construtoraId,
      mes: parseInt(mes),
      ano: parseInt(ano),
      driveUrl: driveUrl.trim(),
    });
  };

  const handleFileSubmit = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) { toast.error('Selecione um arquivo PDF'); return; }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('construtoraId', String(construtoraId));
      formData.append('mes', mes);
      formData.append('ano', ano);

      const res = await fetch('/upload-tabelao', { method: 'POST', body: formData, credentials: 'include' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Erro desconhecido' }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      toast.success('PDF enviado — processamento iniciado em background');
      if (fileRef.current) fileRef.current.value = '';
      onSuccess();
    } catch (err) {
      toast.error(`Erro no upload: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
    } finally {
      setUploading(false);
    }
  };

  const isPending = createAndProcessMutation.isPending || uploading;

  return (
    <div className="space-y-3 pt-3 border-t border-dashed">
      <div className="flex gap-2">
        <Select value={mes} onValueChange={setMes}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Mês" />
          </SelectTrigger>
          <SelectContent>
            {MESES.map((m, i) => (
              <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={ano} onValueChange={setAno}>
          <SelectTrigger className="w-[100px]">
            <SelectValue placeholder="Ano" />
          </SelectTrigger>
          <SelectContent>
            {ANOS.map((a) => (
              <SelectItem key={a} value={String(a)}>{a}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex border rounded-md overflow-hidden">
          <button
            className={`px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1.5 ${mode === 'url' ? 'bg-purple-600 text-white' : 'hover:bg-muted text-muted-foreground'}`}
            onClick={() => setMode('url')}
          >
            <Link2 className="h-3 w-3" /> Drive URL
          </button>
          <button
            className={`px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1.5 ${mode === 'file' ? 'bg-purple-600 text-white' : 'hover:bg-muted text-muted-foreground'}`}
            onClick={() => setMode('file')}
          >
            <Upload className="h-3 w-3" /> Upload PDF
          </button>
        </div>
      </div>

      {mode === 'url' ? (
        <div className="flex gap-2">
          <Input
            placeholder="https://drive.google.com/file/d/... (compartilhado como qualquer pessoa com o link)"
            value={driveUrl}
            onChange={(e) => setDriveUrl(e.target.value)}
            className="text-sm"
          />
          <Button
            onClick={handleUrlSubmit}
            disabled={isPending}
            size="sm"
            className="bg-purple-600 hover:bg-purple-700 shrink-0"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Processar'}
          </Button>
        </div>
      ) : (
        <div className="flex gap-2">
          <Input
            ref={fileRef}
            type="file"
            accept="application/pdf"
            className="text-sm cursor-pointer"
          />
          <Button
            onClick={handleFileSubmit}
            disabled={isPending}
            size="sm"
            className="bg-purple-600 hover:bg-purple-700 shrink-0"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          </Button>
        </div>
      )}

      {mode === 'url' && (
        <p className="text-xs text-muted-foreground">
          Certifique-se que o arquivo no Google Drive está compartilhado como "Qualquer pessoa com o link pode visualizar".
        </p>
      )}
    </div>
  );
}

function ConstrutoraCard({
  construtora,
  tabeloesData,
  onRefetch,
}: {
  construtora: { id: number; nome: string };
  tabeloesData: Array<{ tabelao: any; construtora: any }>;
  onRefetch: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const reprocessMutation = trpc.tabeloes.process.useMutation({
    onSuccess: () => { toast.success('Reprocessamento iniciado'); onRefetch(); },
    onError: (err) => toast.error(err.message),
  });

  const meusTabeloes = tabeloesData.filter((t) => t.tabelao.construtoraId === construtora.id);

  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <button
          className="w-full flex items-center justify-between"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-center gap-3">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            <div className="text-left">
              <p className="font-semibold">{construtora.nome}</p>
              <p className="text-xs text-muted-foreground">
                {meusTabeloes.length} tabelão(ões) registrado(s)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {meusTabeloes.some((t) => t.tabelao.statusProcessamento === 'concluido') && (
              <Badge className="bg-green-100 text-green-700 text-xs">✓ Processado</Badge>
            )}
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </button>

        {expanded && (
          <div className="mt-4 space-y-3">
            {/* Existing tabelões */}
            {meusTabeloes.length > 0 && (
              <div className="space-y-2">
                {meusTabeloes.map(({ tabelao }) => {
                  const st = getStatusInfo(tabelao.statusProcessamento);
                  return (
                    <div key={tabelao.id} className={`flex items-start justify-between p-3 rounded-lg border text-sm ${st.color}`}>
                      <div className="flex items-start gap-2">
                        {st.icon}
                        <div>
                          <p className="font-medium">
                            {MESES[tabelao.mes - 1]}/{tabelao.ano}
                            <span className="ml-2 font-normal opacity-75">{st.label}</span>
                          </p>
                          {tabelao.totalProjetos != null && (
                            <p className="text-xs opacity-75">
                              {tabelao.totalProjetos} projetos extraídos
                            </p>
                          )}
                          {tabelao.mensagemErro && (
                            <p className="text-xs mt-1 opacity-90 max-w-sm">{tabelao.mensagemErro}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1.5 shrink-0 ml-2">
                        {(tabelao.statusProcessamento === 'erro' || tabelao.statusProcessamento === 'concluido') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            disabled={reprocessMutation.isPending}
                            onClick={() => reprocessMutation.mutate({ id: tabelao.id })}
                          >
                            <RefreshCw className="h-3 w-3 mr-1" />
                            Reprocessar
                          </Button>
                        )}
                        {tabelao.s3PdfUrl && (
                          <a href={tabelao.s3PdfUrl} target="_blank" rel="noopener noreferrer">
                            <Button variant="ghost" size="sm" className="h-7 text-xs">
                              <FileText className="h-3 w-3 mr-1" /> PDF
                            </Button>
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add new tabelão */}
            {showForm ? (
              <NovoTabelaoForm
                construtoraId={construtora.id}
                onSuccess={() => { setShowForm(false); onRefetch(); }}
              />
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="w-full border-dashed text-muted-foreground hover:text-foreground"
                onClick={() => setShowForm(true)}
              >
                <Upload className="h-3.5 w-3.5 mr-2" />
                Adicionar tabelão
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function GerenciarTabeloes() {
  const construtorasQuery = trpc.construtoras.list.useQuery({ apenasAtivas: true });
  const tabeloesQuery = trpc.tabeloes.list.useQuery({});
  const processAllMutation = trpc.tabeloes.processAll.useMutation({
    onSuccess: () => { toast.success('Processamento em lote iniciado'); tabeloesQuery.refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const isLoading = construtorasQuery.isPending || tabeloesQuery.isPending;

  const refetchAll = () => {
    construtorasQuery.refetch();
    tabeloesQuery.refetch();
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <FileText className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Gerenciar Tabelões</h1>
            <p className="text-sm text-muted-foreground">
              Importe tabelões das construtoras via Google Drive ou upload direto de PDF
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={refetchAll} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => processAllMutation.mutate()}
            disabled={processAllMutation.isPending}
          >
            {processAllMutation.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null}
            Processar pendentes
          </Button>
        </div>
      </div>

      {/* Instructions */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="pt-4 pb-4">
          <p className="text-sm font-medium text-blue-900 mb-1">Como importar tabelões</p>
          <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
            <li>Abra a construtora desejada clicando no card</li>
            <li>Clique em "Adicionar tabelão" e selecione mês/ano</li>
            <li>
              <strong>Drive URL:</strong> Cole o link do Google Drive compartilhado como
              "Qualquer pessoa com o link pode visualizar"
            </li>
            <li>
              <strong>Upload PDF:</strong> Selecione o arquivo PDF diretamente do computador (até 50 MB)
            </li>
            <li>O Gemini lê o PDF e extrai automaticamente todos os projetos e tipologias</li>
          </ol>
        </CardContent>
      </Card>

      {/* Status summary */}
      {tabeloesQuery.data && tabeloesQuery.data.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          {['concluido', 'processando', 'pendente', 'erro'].map((status) => {
            const count = tabeloesQuery.data!.filter((t: any) => t.tabelao.statusProcessamento === status).length;
            const st = getStatusInfo(status);
            return (
              <Card key={status} className={`border ${st.color}`}>
                <CardContent className="pt-3 pb-3 text-center">
                  <div className={`flex justify-center mb-1 ${st.color.split(' ')[0]}`}>{st.icon}</div>
                  <p className="text-2xl font-bold">{count}</p>
                  <p className="text-xs">{st.label}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Construtoras list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-3">
          {(construtorasQuery.data ?? []).map((c: any) => (
            <ConstrutoraCard
              key={c.id}
              construtora={c}
              tabeloesData={tabeloesQuery.data ?? []}
              onRefetch={() => setTimeout(() => tabeloesQuery.refetch(), 1000)}
            />
          ))}
          {(construtorasQuery.data ?? []).length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <Building2 className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">Nenhuma construtora cadastrada.</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Cadastre construtoras antes de importar tabelões.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

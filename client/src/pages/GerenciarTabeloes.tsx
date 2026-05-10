import { useState, useRef } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  FileText, Upload, Link2, RefreshCw, Loader2, CheckCircle2,
  XCircle, Clock, AlertCircle, ChevronDown, ChevronUp, Building2,
  Plus, FolderOpen, ArrowRight, Info,
} from 'lucide-react';
import { toast } from 'sonner';

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
const ANO_ATUAL = new Date().getFullYear();
const ANOS = Array.from({ length: 4 }, (_, i) => ANO_ATUAL - 1 + i);
const MES_ATUAL = new Date().getMonth() + 1;

// ─── Status helpers ────────────────────────────────────────────────────────────

type StatusInfo = { icon: React.ReactNode; label: string; color: string };
function getStatusInfo(status: string): StatusInfo {
  switch (status) {
    case 'concluido':  return { icon: <CheckCircle2 className="h-4 w-4" />, label: 'Concluído',     color: 'text-green-600 bg-green-50 border-green-200' };
    case 'processando':return { icon: <Loader2 className="h-4 w-4 animate-spin" />, label: 'Processando...', color: 'text-blue-600 bg-blue-50 border-blue-200' };
    case 'pendente':   return { icon: <Clock className="h-4 w-4" />, label: 'Pendente',      color: 'text-yellow-600 bg-yellow-50 border-yellow-200' };
    case 'erro':       return { icon: <XCircle className="h-4 w-4" />, label: 'Erro',          color: 'text-red-600 bg-red-50 border-red-200' };
    default:           return { icon: <AlertCircle className="h-4 w-4" />, label: status,        color: 'text-gray-600 bg-gray-50 border-gray-200' };
  }
}

// ─── MesSeletor / AnoSeletor ───────────────────────────────────────────────────

function MesSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[140px]"><SelectValue placeholder="Mês" /></SelectTrigger>
      <SelectContent>
        {MESES.map((m, i) => <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
function AnoSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[100px]"><SelectValue placeholder="Ano" /></SelectTrigger>
      <SelectContent>{ANOS.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}</SelectContent>
    </Select>
  );
}

// ─── Drive Folder Import ───────────────────────────────────────────────────────

type DriveFile = { id: string; name: string; mimeType: string; construtoraHint: string };
type FileMapped = DriveFile & { construtoraId: number | null; construtoraLabel: string };

function ImportarDePasta({
  construtoras,
  onSuccess,
}: {
  construtoras: Array<{ id: number; nome: string }>;
  onSuccess: () => void;
}) {
  const [folderUrl, setFolderUrl] = useState('');
  const [mes, setMes] = useState(String(MES_ATUAL));
  const [ano, setAno] = useState(String(ANO_ATUAL));
  const [files, setFiles] = useState<FileMapped[]>([]);
  const [step, setStep] = useState<'form' | 'review' | 'done'>('form');

  const testMutation = trpc.tabeloes.testDriveFolder.useMutation({
    onSuccess: (data) => {
      const mapped: FileMapped[] = data.files.map((f: DriveFile) => {
        const hint = f.construtoraHint.toLowerCase();
        const match = construtoras.find(c => c.nome.toLowerCase().includes(hint) || hint.includes(c.nome.toLowerCase()));
        return {
          ...f,
          construtoraId: match?.id ?? null,
          construtoraLabel: match?.nome ?? f.construtoraHint,
        };
      });
      setFiles(mapped);
      setStep('review');
    },
    onError: (err) => toast.error(err.message),
  });

  const importMutation = trpc.tabeloes.importFromDriveFolder.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      if (data.erros.length) data.erros.forEach((e: string) => toast.error(e));
      setStep('done');
      onSuccess();
    },
    onError: (err) => toast.error(err.message),
  });

  const createConstrutoraMutation = trpc.construtoras.create.useMutation({
    onSuccess: (data, vars) => {
      toast.success(`Construtora "${vars.nome}" criada`);
      onSuccess(); // refetch construtoras
    },
    onError: (err) => toast.error(err.message),
  });

  const handleVerificar = () => {
    if (!folderUrl.trim()) { toast.error('Cole a URL da pasta'); return; }
    testMutation.mutate({ folderUrl: folderUrl.trim() });
  };

  const handleImportar = () => {
    const arquivos = files
      .filter(f => f.construtoraId != null)
      .map(f => ({ driveFileId: f.id, nomeArquivo: f.name, construtoraId: f.construtoraId! }));

    if (!arquivos.length) { toast.error('Associe pelo menos um arquivo a uma construtora'); return; }

    importMutation.mutate({ folderUrl, mes: parseInt(mes), ano: parseInt(ano), arquivos });
  };

  const updateFileConstrutora = (fileId: string, construtoraId: number, label: string) => {
    setFiles(prev => prev.map(f => f.id === fileId ? { ...f, construtoraId, construtoraLabel: label } : f));
  };

  if (step === 'done') {
    return (
      <div className="text-center py-6">
        <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto mb-3" />
        <p className="font-semibold text-green-700">Importação iniciada!</p>
        <p className="text-sm text-muted-foreground mt-1">
          Os tabelões estão sendo processados em background. Acompanhe o status nos cards abaixo.
        </p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => { setStep('form'); setFiles([]); setFolderUrl(''); }}>
          Importar outra pasta
        </Button>
      </div>
    );
  }

  if (step === 'review') {
    const semConstrutora = files.filter(f => f.construtoraId == null);
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">{files.length} PDF(s) encontrado(s) — confira as construtoras abaixo:</p>
          <Button variant="ghost" size="sm" onClick={() => setStep('form')}>Voltar</Button>
        </div>

        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {files.map(f => (
            <div key={f.id} className="flex items-center gap-2 p-2 bg-muted/40 rounded-lg">
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              <p className="text-xs flex-1 truncate" title={f.name}>{f.name}</p>
              <Select
                value={f.construtoraId != null ? String(f.construtoraId) : ''}
                onValueChange={(v) => {
                  if (v === '__new__') {
                    createConstrutoraMutation.mutate({ nome: f.construtoraHint });
                  } else {
                    const c = construtoras.find(c => c.id === parseInt(v));
                    if (c) updateFileConstrutora(f.id, c.id, c.nome);
                  }
                }}
              >
                <SelectTrigger className={`w-[180px] text-xs h-8 ${f.construtoraId == null ? 'border-orange-400' : ''}`}>
                  <SelectValue placeholder="Selecionar..." />
                </SelectTrigger>
                <SelectContent>
                  {construtoras.map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>
                  ))}
                  <SelectItem value="__new__" className="text-blue-600">
                    + Criar "{f.construtoraHint}"
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>

        {semConstrutora.length > 0 && (
          <p className="text-xs text-orange-600 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            {semConstrutora.length} arquivo(s) sem construtora — serão ignorados na importação.
          </p>
        )}

        <div className="flex items-center gap-3 pt-1">
          <div className="flex gap-2">
            <MesSelect value={mes} onChange={setMes} />
            <AnoSelect value={ano} onChange={setAno} />
          </div>
          <Button
            className="bg-green-600 hover:bg-green-700 ml-auto"
            onClick={handleImportar}
            disabled={importMutation.isPending || files.every(f => f.construtoraId == null)}
          >
            {importMutation.isPending
              ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
              : <ArrowRight className="h-4 w-4 mr-2" />
            }
            Importar {files.filter(f => f.construtoraId != null).length} tabelões
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-900 flex gap-2">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <div>
          <strong>Pré-requisito:</strong> Compartilhe a pasta do Drive com o e-mail da conta de serviço:
          <br />
          <code className="text-xs bg-amber-100 px-1 py-0.5 rounded font-mono select-all">
            crm-sheets-sync@seu-metro-quadrado-crm.iam.gserviceaccount.com
          </code>
          <span className="ml-2 text-amber-700">(acesso Visualizador)</span>
        </div>
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="Cole o link da pasta do Google Drive..."
          value={folderUrl}
          onChange={(e) => setFolderUrl(e.target.value)}
          className="text-sm"
        />
        <Button
          onClick={handleVerificar}
          disabled={testMutation.isPending || !folderUrl.trim()}
          className="shrink-0"
        >
          {testMutation.isPending
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <><FolderOpen className="h-4 w-4 mr-1.5" />Verificar pasta</>
          }
        </Button>
      </div>
    </div>
  );
}

// ─── NovoTabelaoForm (por construtora individual) ─────────────────────────────

type UploadMode = 'url' | 'file';

function NovoTabelaoForm({ construtoraId, onSuccess }: { construtoraId: number; onSuccess: () => void }) {
  const [mode, setMode] = useState<UploadMode>('url');
  const [mes, setMes] = useState(String(MES_ATUAL));
  const [ano, setAno] = useState(String(ANO_ATUAL));
  const [driveUrl, setDriveUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const createAndProcessMutation = trpc.tabeloes.createAndProcess.useMutation({
    onSuccess: () => {
      toast.success('Processamento iniciado');
      setDriveUrl('');
      onSuccess();
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const handleUrlSubmit = () => {
    if (!driveUrl.trim()) { toast.error('Informe a URL'); return; }
    createAndProcessMutation.mutate({ construtoraId, mes: parseInt(mes), ano: parseInt(ano), driveUrl: driveUrl.trim() });
  };

  const handleFileSubmit = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) { toast.error('Selecione um PDF'); return; }
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
      toast.success('PDF enviado — processando em background');
      if (fileRef.current) fileRef.current.value = '';
      onSuccess();
    } catch (err) {
      toast.error(`Erro no upload: ${err instanceof Error ? err.message : 'Erro'}`);
    } finally {
      setUploading(false);
    }
  };

  const isPending = createAndProcessMutation.isPending || uploading;

  return (
    <div className="space-y-3 pt-3 border-t border-dashed">
      <div className="flex gap-2">
        <MesSelect value={mes} onChange={setMes} />
        <AnoSelect value={ano} onChange={setAno} />
        <div className="flex border rounded-md overflow-hidden">
          <button className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-colors ${mode === 'url' ? 'bg-purple-600 text-white' : 'hover:bg-muted text-muted-foreground'}`} onClick={() => setMode('url')}>
            <Link2 className="h-3 w-3" /> URL
          </button>
          <button className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-colors ${mode === 'file' ? 'bg-purple-600 text-white' : 'hover:bg-muted text-muted-foreground'}`} onClick={() => setMode('file')}>
            <Upload className="h-3 w-3" /> PDF
          </button>
        </div>
      </div>
      {mode === 'url' ? (
        <div className="flex gap-2">
          <Input placeholder="https://drive.google.com/file/d/..." value={driveUrl} onChange={e => setDriveUrl(e.target.value)} className="text-sm" />
          <Button onClick={handleUrlSubmit} disabled={isPending} size="sm" className="bg-purple-600 hover:bg-purple-700 shrink-0">
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Processar'}
          </Button>
        </div>
      ) : (
        <div className="flex gap-2">
          <Input ref={fileRef} type="file" accept="application/pdf" className="text-sm cursor-pointer" />
          <Button onClick={handleFileSubmit} disabled={isPending} size="sm" className="bg-purple-600 hover:bg-purple-700 shrink-0">
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── ConstrutoraCard ──────────────────────────────────────────────────────────

function ConstrutoraCard({ construtora, tabeloesData, onRefetch }: {
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

  const meusTabeloes = tabeloesData.filter(t => t.tabelao.construtoraId === construtora.id);
  const hasProcessed = meusTabeloes.some(t => t.tabelao.statusProcessamento === 'concluido');

  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <button className="w-full flex items-center justify-between" onClick={() => setExpanded(!expanded)}>
          <div className="flex items-center gap-3">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            <div className="text-left">
              <p className="font-semibold">{construtora.nome}</p>
              <p className="text-xs text-muted-foreground">{meusTabeloes.length} tabelão(ões)</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hasProcessed && <Badge className="bg-green-100 text-green-700 text-xs">✓ Processado</Badge>}
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </button>

        {expanded && (
          <div className="mt-4 space-y-2">
            {meusTabeloes.map(({ tabelao }) => {
              const st = getStatusInfo(tabelao.statusProcessamento);
              return (
                <div key={tabelao.id} className={`flex items-start justify-between p-3 rounded-lg border text-sm ${st.color}`}>
                  <div className="flex items-start gap-2">
                    {st.icon}
                    <div>
                      <p className="font-medium">{MESES[tabelao.mes - 1]}/{tabelao.ano} <span className="font-normal opacity-75">{st.label}</span></p>
                      {tabelao.totalProjetos != null && <p className="text-xs opacity-75">{tabelao.totalProjetos} projetos</p>}
                      {tabelao.mensagemErro && <p className="text-xs mt-1 opacity-90 max-w-sm">{tabelao.mensagemErro}</p>}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0 ml-2">
                    {(tabelao.statusProcessamento === 'erro' || tabelao.statusProcessamento === 'concluido') && (
                      <Button variant="ghost" size="sm" className="h-7 text-xs" disabled={reprocessMutation.isPending}
                        onClick={() => reprocessMutation.mutate({ id: tabelao.id })}>
                        <RefreshCw className="h-3 w-3 mr-1" /> Reprocessar
                      </Button>
                    )}
                    {tabelao.s3PdfUrl && (
                      <a href={tabelao.s3PdfUrl} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="sm" className="h-7 text-xs"><FileText className="h-3 w-3 mr-1" /> PDF</Button>
                      </a>
                    )}
                  </div>
                </div>
              );
            })}

            {showForm
              ? <NovoTabelaoForm construtoraId={construtora.id} onSuccess={() => { setShowForm(false); onRefetch(); }} />
              : <Button variant="outline" size="sm" className="w-full border-dashed text-muted-foreground hover:text-foreground" onClick={() => setShowForm(true)}>
                  <Upload className="h-3.5 w-3.5 mr-2" /> Adicionar tabelão
                </Button>
            }
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── NovaConstrutora ──────────────────────────────────────────────────────────

function NovaConstrutora({ onSuccess }: { onSuccess: () => void }) {
  const [nome, setNome] = useState('');
  const createMutation = trpc.construtoras.create.useMutation({
    onSuccess: () => { toast.success('Construtora cadastrada'); setNome(''); onSuccess(); },
    onError: (err) => toast.error(err.message),
  });
  return (
    <div className="flex gap-2">
      <Input placeholder="Nome da construtora (ex: Cyrela, MRV, Tenda...)" value={nome}
        onChange={e => setNome(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && nome.trim() && createMutation.mutate({ nome: nome.trim() })}
        className="text-sm" />
      <Button onClick={() => nome.trim() && createMutation.mutate({ nome: nome.trim() })}
        disabled={!nome.trim() || createMutation.isPending} size="sm" className="shrink-0">
        {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
      </Button>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function GerenciarTabeloes() {
  const [showNovaConstrutora, setShowNovaConstrutora] = useState(false);
  const [showDriveImport, setShowDriveImport] = useState(false);

  const construtorasQuery = trpc.construtoras.list.useQuery({ apenasAtivas: true });
  const tabeloesQuery = trpc.tabeloes.list.useQuery({});
  const processAllMutation = trpc.tabeloes.processAll.useMutation({
    onSuccess: () => { toast.success('Processamento em lote iniciado'); tabeloesQuery.refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const isLoading = construtorasQuery.isPending || tabeloesQuery.isPending;
  const refetchAll = () => { construtorasQuery.refetch(); tabeloesQuery.refetch(); };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <FileText className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Gerenciar Tabelões</h1>
            <p className="text-sm text-muted-foreground">Importe via pasta do Drive ou upload individual por construtora</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={refetchAll} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} /> Atualizar
          </Button>
          <Button size="sm" onClick={() => { setShowDriveImport(v => !v); setShowNovaConstrutora(false); }}
            className="bg-blue-600 hover:bg-blue-700">
            <FolderOpen className="h-4 w-4 mr-1.5" /> Importar do Drive
          </Button>
          <Button size="sm" variant="outline" onClick={() => { setShowNovaConstrutora(v => !v); setShowDriveImport(false); }}>
            <Plus className="h-4 w-4 mr-1.5" /> Nova construtora
          </Button>
          <Button size="sm" variant="outline" onClick={() => processAllMutation.mutate()} disabled={processAllMutation.isPending}>
            {processAllMutation.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Processar pendentes
          </Button>
        </div>
      </div>

      {/* Drive folder import panel */}
      {showDriveImport && (
        <Card className="border-blue-300">
          <CardContent className="pt-5 pb-5">
            <p className="font-semibold mb-4 flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-blue-600" />
              Importar pasta do Google Drive
            </p>
            <ImportarDePasta
              construtoras={construtorasQuery.data ?? []}
              onSuccess={() => { refetchAll(); setShowDriveImport(false); }}
            />
          </CardContent>
        </Card>
      )}

      {/* Nova construtora panel */}
      {showNovaConstrutora && (
        <Card className="border-purple-200 bg-purple-50">
          <CardContent className="pt-4 pb-4">
            <p className="text-sm font-medium text-purple-900 mb-2">Cadastrar nova construtora</p>
            <NovaConstrutora onSuccess={() => { construtorasQuery.refetch(); setShowNovaConstrutora(false); }} />
          </CardContent>
        </Card>
      )}

      {/* Status summary */}
      {tabeloesQuery.data && tabeloesQuery.data.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          {['concluido', 'processando', 'pendente', 'erro'].map(status => {
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
              <CardContent className="py-8 px-6">
                <div className="text-center mb-5">
                  <Building2 className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                  <p className="font-medium">Nenhuma construtora cadastrada.</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Use "Importar do Drive" para importar automaticamente, ou cadastre manualmente abaixo.
                  </p>
                </div>
                <NovaConstrutora onSuccess={() => construtorasQuery.refetch()} />
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

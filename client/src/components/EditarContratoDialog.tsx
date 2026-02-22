import { useState, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Save, Upload, X, FileText, Paperclip } from "lucide-react";
import { storagePut } from "@/lib/storage";

interface EditarContratoDialogProps {
  contratoId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export default function EditarContratoDialog({
  contratoId,
  open,
  onOpenChange,
  onSuccess,
}: EditarContratoDialogProps) {
  // Buscar dados do contrato
  const { data: contrato, isLoading: loadingContrato } = trpc.dashboard.getContratoParaEdicao.useQuery(
    { contratoId: contratoId! },
    { enabled: !!contratoId && open }
  );

  // Buscar opções para selects
  const { data: opcoes, isLoading: loadingOpcoes } = trpc.dashboard.opcoesContrato.useQuery(
    undefined,
    { enabled: open }
  );

  // Estado do formulário
  const [corretorId, setCorretorId] = useState<number | undefined>();
  const [clienteNome, setClienteNome] = useState("");
  const [clienteTelefone, setClienteTelefone] = useState("");
  const [clienteEmail, setClienteEmail] = useState("");
  const [projectId, setProjectId] = useState<number | null>(null);
  const [projetoCustom, setProjetoCustom] = useState("");
  const [valorVenda, setValorVenda] = useState("");
  const [dataVenda, setDataVenda] = useState("");
  const [equipeId, setEquipeId] = useState<number | null>(null);
  const [projetoMode, setProjetoMode] = useState<"select" | "custom">("select");
  const [novosAnexos, setNovosAnexos] = useState<File[]>([]);
  const [uploadingAnexos, setUploadingAnexos] = useState(false);

  // Preencher formulário quando os dados carregarem
  useEffect(() => {
    if (contrato) {
      setCorretorId(contrato.corretorId);
      setClienteNome(contrato.clienteNome);
      setClienteTelefone(contrato.clienteTelefone);
      setClienteEmail(contrato.clienteEmail);
      setProjectId(contrato.projectId);
      setProjetoCustom(contrato.projetoCustom || "");
      setValorVenda(contrato.valorVenda.toLocaleString("pt-BR"));
      setDataVenda(contrato.dataVenda ? new Date(contrato.dataVenda).toISOString().split("T")[0] : "");
      setEquipeId(contrato.corretorEquipeId ?? null);
      setProjetoMode(contrato.projectId ? "select" : "custom");
    }
  }, [contrato]);

  // Quando muda o corretor, atualizar a equipe automaticamente
  useEffect(() => {
    if (corretorId && opcoes) {
      const corretor = opcoes.corretores.find((c) => c.id === corretorId);
      if (corretor) {
        setEquipeId(corretor.equipeId ?? null);
      }
    }
  }, [corretorId, opcoes]);

  // Mutation para atualizar
  const utils = trpc.useUtils();
  const atualizarMutation = trpc.dashboard.atualizarContrato.useMutation({
    onSuccess: () => {
      toast.success("Contrato atualizado com sucesso!");
      utils.dashboard.contratosFechados.invalidate();
      utils.dashboard.vgvPorEquipeProjeto.invalidate();
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (err) => {
      toast.error(`Erro ao atualizar: ${err.message}`);
    },
  });

  const handleSave = async () => {
    if (!contratoId) return;

    // Upload dos novos anexos primeiro
    let anexosUrls: string[] = [];
    if (novosAnexos.length > 0) {
      setUploadingAnexos(true);
      try {
        const uploadPromises = novosAnexos.map(async (file) => {
          const formData = new FormData();
          formData.append('file', file);
          const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData,
          });
          if (!response.ok) throw new Error('Falha no upload');
          const data = await response.json();
          return data.url;
        });
        anexosUrls = await Promise.all(uploadPromises);
      } catch (error) {
        toast.error('Erro ao fazer upload dos anexos');
        setUploadingAnexos(false);
        return;
      }
      setUploadingAnexos(false);
    }

    const dados: Record<string, any> = {
      contratoId,
    };

    // Adicionar novos anexos aos existentes
    if (anexosUrls.length > 0) {
      const anexosExistentes = contrato?.anexos || [];
      dados.anexos = [...anexosExistentes, ...anexosUrls];
    }

    if (corretorId !== contrato?.corretorId) dados.corretorId = corretorId;
    if (clienteNome !== contrato?.clienteNome) dados.clienteNome = clienteNome;
    if (clienteTelefone !== contrato?.clienteTelefone) dados.clienteTelefone = clienteTelefone;
    if (clienteEmail !== contrato?.clienteEmail) dados.clienteEmail = clienteEmail;
    
    if (projetoMode === "select") {
      if (projectId !== contrato?.projectId) dados.projectId = projectId;
    } else {
      if (projetoCustom !== contrato?.projetoCustom) {
        dados.projetoCustom = projetoCustom || null;
        dados.projectId = null;
      }
    }

    const valorNum = parseFloat(valorVenda.replace(/\./g, "").replace(",", "."));
    if (!isNaN(valorNum) && valorNum !== contrato?.valorVenda) {
      dados.valorVenda = valorNum;
    }

    if (dataVenda) {
      const novaData = new Date(dataVenda + "T12:00:00");
      const dataOriginal = contrato?.dataVenda ? new Date(contrato.dataVenda) : null;
      if (!dataOriginal || novaData.toDateString() !== dataOriginal.toDateString()) {
        dados.dataVenda = novaData.toISOString();
      }
    }

    if (equipeId !== (contrato?.corretorEquipeId ?? null)) {
      dados.equipeCorretorId = equipeId;
    }

    atualizarMutation.mutate(dados as any);
  };

  const formatValorInput = (value: string) => {
    // Remove tudo que não é número
    const numbers = value.replace(/\D/g, "");
    if (!numbers) return "";
    // Formata como número inteiro com separador de milhares
    return parseInt(numbers).toLocaleString("pt-BR");
  };

  const isLoading = loadingContrato || loadingOpcoes;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Contrato</DialogTitle>
          <DialogDescription>
            Altere os dados do contrato. As mudanças serão salvas no banco de dados.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {/* Corretor */}
            <div className="space-y-2">
              <Label htmlFor="corretor">Corretor</Label>
              <Select
                value={corretorId?.toString() || ""}
                onValueChange={(val) => setCorretorId(parseInt(val))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o corretor" />
                </SelectTrigger>
                <SelectContent>
                  {opcoes?.corretores.map((c) => (
                    <SelectItem key={c.id} value={c.id.toString()}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Equipe */}
            <div className="space-y-2">
              <Label htmlFor="equipe">Equipe de Vendas</Label>
              <Select
                value={equipeId?.toString() || "sem_equipe"}
                onValueChange={(val) => setEquipeId(val === "sem_equipe" ? null : parseInt(val))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a equipe" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sem_equipe">Sem equipe</SelectItem>
                  {opcoes?.equipes.map((e) => (
                    <SelectItem key={e.id} value={e.id.toString()}>
                      {e.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Cliente Nome */}
            <div className="space-y-2">
              <Label htmlFor="clienteNome">Nome do Cliente</Label>
              <Input
                id="clienteNome"
                value={clienteNome}
                onChange={(e) => setClienteNome(e.target.value)}
                placeholder="Nome do cliente"
              />
            </div>

            {/* Cliente Telefone */}
            <div className="space-y-2">
              <Label htmlFor="clienteTelefone">Telefone do Cliente</Label>
              <Input
                id="clienteTelefone"
                value={clienteTelefone}
                onChange={(e) => setClienteTelefone(e.target.value)}
                placeholder="(11) 99999-9999"
              />
            </div>

            {/* Cliente Email */}
            <div className="space-y-2">
              <Label htmlFor="clienteEmail">Email do Cliente</Label>
              <Input
                id="clienteEmail"
                value={clienteEmail}
                onChange={(e) => setClienteEmail(e.target.value)}
                placeholder="email@exemplo.com"
                type="email"
              />
            </div>

            {/* Projeto */}
            <div className="space-y-2">
              <Label>Projeto</Label>
              <div className="flex gap-2 mb-2">
                <Button
                  type="button"
                  variant={projetoMode === "select" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setProjetoMode("select")}
                >
                  Selecionar
                </Button>
                <Button
                  type="button"
                  variant={projetoMode === "custom" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setProjetoMode("custom")}
                >
                  Digitar
                </Button>
              </div>
              {projetoMode === "select" ? (
                <Select
                  value={projectId?.toString() || "nenhum"}
                  onValueChange={(val) => setProjectId(val === "nenhum" ? null : parseInt(val))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o projeto" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nenhum">Não informado</SelectItem>
                    {opcoes?.projetos.map((p) => (
                      <SelectItem key={p.id} value={p.id.toString()}>
                        {p.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={projetoCustom}
                  onChange={(e) => setProjetoCustom(e.target.value)}
                  placeholder="Nome do projeto"
                />
              )}
            </div>

            {/* Valor (VGV) */}
            <div className="space-y-2">
              <Label htmlFor="valorVenda">Valor (VGV)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                  R$
                </span>
                <Input
                  id="valorVenda"
                  value={valorVenda}
                  onChange={(e) => setValorVenda(formatValorInput(e.target.value))}
                  placeholder="0"
                  className="pl-10"
                />
              </div>
            </div>

            {/* Data da Venda */}
            <div className="space-y-2">
              <Label htmlFor="dataVenda">Data da Venda</Label>
              <Input
                id="dataVenda"
                type="date"
                value={dataVenda}
                onChange={(e) => setDataVenda(e.target.value)}
              />
            </div>

            {/* Anexos Existentes */}
            {contrato?.anexos && contrato.anexos.length > 0 && (
              <div className="space-y-2">
                <Label>Anexos Existentes</Label>
                <div className="flex flex-wrap gap-2">
                  {contrato.anexos.map((anexo: string, idx: number) => {
                    const fileName = anexo.split('/').pop() || `Anexo ${idx + 1}`;
                    return (
                      <a
                        key={idx}
                        href={anexo}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md text-sm hover:bg-muted/80 transition-colors"
                      >
                        <FileText className="h-4 w-4" />
                        <span className="max-w-[200px] truncate">{fileName}</span>
                      </a>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Novos Anexos */}
            <div className="space-y-2">
              <Label htmlFor="anexos">Adicionar Novos Anexos</Label>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById('file-input-edit')?.click()}
                    disabled={uploadingAnexos}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Selecionar Arquivos
                  </Button>
                  <input
                    id="file-input-edit"
                    type="file"
                    multiple
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                    className="hidden"
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      setNovosAnexos(prev => [...prev, ...files]);
                      e.target.value = '';
                    }}
                  />
                  <span className="text-xs text-muted-foreground">
                    PDF, DOC, DOCX, JPG, PNG (máx. 10MB cada)
                  </span>
                </div>

                {novosAnexos.length > 0 && (
                  <div className="space-y-2">
                    {novosAnexos.map((file, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2 bg-muted rounded-md"
                      >
                        <div className="flex items-center gap-2">
                          <Paperclip className="h-4 w-4" />
                          <span className="text-sm">{file.name}</span>
                          <span className="text-xs text-muted-foreground">
                            ({(file.size / 1024 / 1024).toFixed(2)} MB)
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setNovosAnexos(prev => prev.filter((_, i) => i !== idx));
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={atualizarMutation.isPending || isLoading}
          >
            {atualizarMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Salvar Alterações
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

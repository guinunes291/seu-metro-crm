import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { Loader2, Upload, X, FileText } from 'lucide-react';

interface CriarContratoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CriarContratoDialog({ open, onOpenChange, onSuccess }: CriarContratoDialogProps) {
  const utils = trpc.useUtils();
  
  // Estados do formulário
  const [corretorId, setCorretorId] = useState<number | null>(null);
  const [clienteNome, setClienteNome] = useState('');
  const [clienteTelefone, setClienteTelefone] = useState('');
  const [clienteEmail, setClienteEmail] = useState('');
  const [projectId, setProjectId] = useState<number | null>(null);
  const [projetoCustom, setProjetoCustom] = useState('');
  const [valorVenda, setValorVenda] = useState('');
  const [percentualComissao, setPercentualComissao] = useState('3.50');
  const [percentualCorretor, setPercentualCorretor] = useState('1.85');
  const [percentualGerente, setPercentualGerente] = useState('0.50');
  const [percentualSuperintendente, setPercentualSuperintendente] = useState('0.30');
  const [dataVenda, setDataVenda] = useState(new Date().toISOString().split('T')[0]);
  const [observacoes, setObservacoes] = useState('');
  const [usarProjetoCustom, setUsarProjetoCustom] = useState(false);
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);

  // Queries
  const { data: opcoes, isLoading: loadingOpcoes } = trpc.dashboard.opcoesContrato.useQuery();

  // Mutation
  const criarMutation = trpc.dashboard.criarContrato.useMutation({
    onSuccess: () => {
      toast.success('Contrato criado com sucesso!');
      utils.dashboard.contratosFechados.invalidate();
      utils.dashboard.vgvPorEquipeProjeto.invalidate();
      utils.dashboard.get.invalidate();
      onSuccess();
      limparFormulario();
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(`Erro ao criar contrato: ${error.message}`);
    },
  });

  // Limpar formulário ao fechar
  useEffect(() => {
    if (!open) {
      limparFormulario();
    }
  }, [open]);

  const limparFormulario = () => {
    setCorretorId(null);
    setClienteNome('');
    setClienteTelefone('');
    setClienteEmail('');
    setProjectId(null);
    setProjetoCustom('');
    setValorVenda('');
    setPercentualComissao('3.50');
    setPercentualCorretor('1.85');
    setPercentualGerente('0.50');
    setPercentualSuperintendente('0.30');
    setDataVenda(new Date().toISOString().split('T')[0]);
    setObservacoes('');
    setUsarProjetoCustom(false);
    setArquivos([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!corretorId) {
      toast.error('Selecione um corretor');
      return;
    }

    if (!clienteNome || !clienteTelefone || !clienteEmail) {
      toast.error('Preencha todos os campos do cliente');
      return;
    }

    if (!usarProjetoCustom && !projectId) {
      toast.error('Selecione um projeto ou digite manualmente');
      return;
    }

    if (usarProjetoCustom && !projetoCustom.trim()) {
      toast.error('Digite o nome do projeto');
      return;
    }

    const valorNumerico = parseFloat(valorVenda.replace(/[^\d,]/g, '').replace(',', '.'));
    if (isNaN(valorNumerico) || valorNumerico <= 0) {
      toast.error('Digite um valor válido');
      return;
    }

    // Upload de arquivos se houver
    let anexosUrls: string[] = [];
    if (arquivos.length > 0) {
      setUploadingFiles(true);
      try {
        const uploadPromises = arquivos.map(async (arquivo) => {
          const formData = new FormData();
          formData.append('file', arquivo);
          
          const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData,
          });
          
          if (!response.ok) {
            throw new Error(`Erro ao fazer upload de ${arquivo.name}`);
          }
          
          const data = await response.json();
          return data.url;
        });
        
        anexosUrls = await Promise.all(uploadPromises);
      } catch (error) {
        toast.error('Erro ao fazer upload dos arquivos');
        setUploadingFiles(false);
        return;
      } finally {
        setUploadingFiles(false);
      }
    }

    const percentualNumerico = parseFloat(percentualComissao.replace(',', '.'));
    if (isNaN(percentualNumerico) || percentualNumerico <= 0 || percentualNumerico > 100) {
      toast.error('Digite um percentual válido (0-100)');
      return;
    }

    const percentualCorretorNumerico = parseFloat(percentualCorretor.replace(',', '.'));
    if (isNaN(percentualCorretorNumerico) || percentualCorretorNumerico < 0 || percentualCorretorNumerico > 100) {
      toast.error('Digite um percentual de corretor válido (0-100)');
      return;
    }

    const percentualGerenteNumerico = parseFloat(percentualGerente.replace(',', '.'));
    if (isNaN(percentualGerenteNumerico) || percentualGerenteNumerico < 0 || percentualGerenteNumerico > 100) {
      toast.error('Digite um percentual de gerente válido (0-100)');
      return;
    }

    const percentualSuperintendenteNumerico = parseFloat(percentualSuperintendente.replace(',', '.'));
    if (isNaN(percentualSuperintendenteNumerico) || percentualSuperintendenteNumerico < 0 || percentualSuperintendenteNumerico > 100) {
      toast.error('Digite um percentual de superintendente válido (0-100)');
      return;
    }

    criarMutation.mutate({
      corretorId,
      clienteNome,
      clienteTelefone,
      clienteEmail,
      projectId: usarProjetoCustom ? null : projectId,
      projetoCustom: usarProjetoCustom ? projetoCustom : '',
      valorVenda: valorNumerico,
      percentualComissao: percentualNumerico,
      percentualCorretor: percentualCorretorNumerico,
      percentualGerente: percentualGerenteNumerico,
      percentualSuperintendente: percentualSuperintendenteNumerico,
      dataVenda,
      observacoes,
      anexos: anexosUrls,
    });
  };

  const formatarValor = (valor: string) => {
    const numero = parseFloat(valor.replace(/[^\d,]/g, '').replace(',', '.'));
    if (isNaN(numero)) return '';
    return numero.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handleValorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valor = e.target.value.replace(/[^\d,]/g, '');
    setValorVenda(valor);
  };

  const handleValorBlur = () => {
    if (valorVenda) {
      setValorVenda(formatarValor(valorVenda));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Criar Novo Contrato</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Corretor */}
          <div className="space-y-2">
            <Label htmlFor="corretor">Corretor *</Label>
            <Select
              value={corretorId?.toString() || ''}
              onValueChange={(value) => setCorretorId(Number(value))}
              disabled={loadingOpcoes}
            >
              <SelectTrigger id="corretor">
                <SelectValue placeholder="Selecione o corretor" />
              </SelectTrigger>
              <SelectContent>
                {opcoes?.corretores.map((corretor) => (
                  <SelectItem key={corretor.id} value={corretor.id.toString()}>
                    {corretor.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Cliente */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="clienteNome">Nome do Cliente *</Label>
              <Input
                id="clienteNome"
                value={clienteNome}
                onChange={(e) => setClienteNome(e.target.value)}
                placeholder="Nome completo"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="clienteTelefone">Telefone *</Label>
              <Input
                id="clienteTelefone"
                value={clienteTelefone}
                onChange={(e) => setClienteTelefone(e.target.value)}
                placeholder="(11) 99999-9999"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="clienteEmail">Email *</Label>
              <Input
                id="clienteEmail"
                type="email"
                value={clienteEmail}
                onChange={(e) => setClienteEmail(e.target.value)}
                placeholder="email@exemplo.com"
                required
              />
            </div>
          </div>

          {/* Projeto */}
          <div className="space-y-2">
            <Label>Projeto *</Label>
            <div className="flex items-center gap-2 mb-2">
              <Button
                type="button"
                variant={!usarProjetoCustom ? 'default' : 'outline'}
                size="sm"
                onClick={() => setUsarProjetoCustom(false)}
              >
                Selecionar
              </Button>
              <Button
                type="button"
                variant={usarProjetoCustom ? 'default' : 'outline'}
                size="sm"
                onClick={() => setUsarProjetoCustom(true)}
              >
                Digitar
              </Button>
            </div>
            {!usarProjetoCustom ? (
              <Select
                value={projectId?.toString() || ''}
                onValueChange={(value) => setProjectId(Number(value))}
                disabled={loadingOpcoes}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o projeto" />
                </SelectTrigger>
                <SelectContent>
                  {opcoes?.projetos.map((projeto) => (
                    <SelectItem key={projeto.id} value={projeto.id.toString()}>
                      {projeto.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={projetoCustom}
                onChange={(e) => setProjetoCustom(e.target.value)}
                placeholder="Digite o nome do projeto"
                required={usarProjetoCustom}
              />
            )}
          </div>

          {/* Valor e Data */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="valorVenda">Valor (VGV) *</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">R$</span>
                <Input
                  id="valorVenda"
                  value={valorVenda}
                  onChange={handleValorChange}
                  onBlur={handleValorBlur}
                  placeholder="0,00"
                  className="pl-10"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dataVenda">Data da Venda *</Label>
              <Input
                id="dataVenda"
                type="date"
                value={dataVenda}
                onChange={(e) => setDataVenda(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Percentuais de Comissão */}
          <div className="space-y-2">
            <Label className="text-base font-semibold">Percentuais de Comissão</Label>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="percentualComissao">Imobiliária *</Label>
                <div className="relative">
                  <Input
                    id="percentualComissao"
                    value={percentualComissao}
                    onChange={(e) => setPercentualComissao(e.target.value.replace(/[^\d,]/g, ''))}
                    placeholder="3,50"
                    className="pr-8"
                    required
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="percentualCorretor">Corretor *</Label>
                <div className="relative">
                  <Input
                    id="percentualCorretor"
                    value={percentualCorretor}
                    onChange={(e) => setPercentualCorretor(e.target.value.replace(/[^\d,]/g, ''))}
                    placeholder="1,85"
                    className="pr-8"
                    required
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="percentualGerente">Gerente *</Label>
                <div className="relative">
                  <Input
                    id="percentualGerente"
                    value={percentualGerente}
                    onChange={(e) => setPercentualGerente(e.target.value.replace(/[^\d,]/g, ''))}
                    placeholder="0,50"
                    className="pr-8"
                    required
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="percentualSuperintendente">Superintendente *</Label>
                <div className="relative">
                  <Input
                    id="percentualSuperintendente"
                    value={percentualSuperintendente}
                    onChange={(e) => setPercentualSuperintendente(e.target.value.replace(/[^\d,]/g, ''))}
                    placeholder="0,30"
                    className="pr-8"
                    required
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Imobiliária: 3-4% | Corretor: 1,6-2% | Gerente: 0,5% | Superintendente: 0,3%</p>
          </div>

          {/* Observações */}
          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Informações adicionais sobre o contrato"
              rows={3}
            />
          </div>

          {/* Upload de Arquivos */}
          <div className="space-y-2">
            <Label htmlFor="arquivos">Anexar Documentos</Label>
            <div className="border-2 border-dashed rounded-lg p-4 hover:border-primary/50 transition-colors">
              <input
                id="arquivos"
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  setArquivos(prev => [...prev, ...files]);
                  e.target.value = ''; // Limpar input para permitir adicionar o mesmo arquivo novamente
                }}
                className="hidden"
              />
              <label
                htmlFor="arquivos"
                className="flex flex-col items-center justify-center cursor-pointer"
              >
                <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground text-center">
                  Clique para adicionar arquivos
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  PDF, DOC, DOCX, JPG, PNG (máx. 10MB cada)
                </p>
              </label>
            </div>
            
            {/* Lista de arquivos selecionados */}
            {arquivos.length > 0 && (
              <div className="space-y-2 mt-3">
                <p className="text-sm font-medium">Arquivos selecionados ({arquivos.length}):</p>
                <div className="space-y-1">
                  {arquivos.map((arquivo, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 bg-muted rounded-md"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span className="text-sm truncate">{arquivo.name}</span>
                        <span className="text-xs text-muted-foreground flex-shrink-0">
                          ({(arquivo.size / 1024).toFixed(1)} KB)
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setArquivos(prev => prev.filter((_, i) => i !== index));
                        }}
                        className="h-6 w-6 p-0 flex-shrink-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={criarMutation.isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={criarMutation.isPending}>
              {criarMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar Contrato
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

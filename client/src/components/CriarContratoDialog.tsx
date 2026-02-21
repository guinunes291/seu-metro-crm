import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

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
  const [dataVenda, setDataVenda] = useState(new Date().toISOString().split('T')[0]);
  const [observacoes, setObservacoes] = useState('');
  const [usarProjetoCustom, setUsarProjetoCustom] = useState(false);

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
    setDataVenda(new Date().toISOString().split('T')[0]);
    setObservacoes('');
    setUsarProjetoCustom(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
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

    criarMutation.mutate({
      corretorId,
      clienteNome,
      clienteTelefone,
      clienteEmail,
      projectId: usarProjetoCustom ? null : projectId,
      projetoCustom: usarProjetoCustom ? projetoCustom : '',
      valorVenda: valorNumerico,
      dataVenda,
      observacoes,
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

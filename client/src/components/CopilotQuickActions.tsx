import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Bot, 
  Loader2, 
  Copy, 
  Check,
  Sparkles,
  Phone,
  HelpCircle,
  AlertTriangle,
  DollarSign,
  Clock,
  GraduationCap,
  Home,
  X
} from 'lucide-react';
import { Streamdown } from 'streamdown';
import { toast } from 'sonner';

type QuickActionMode = 'briefing' | 'primeiro_contato' | 'qualificacao' | 'objecoes' | 'credito' | 'followup' | 'treinamento' | 'recomendar';

interface QuickAction {
  mode: QuickActionMode;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    mode: 'briefing',
    label: 'Briefing',
    description: 'Análise completa do perfil do lead',
    icon: <Sparkles className="h-4 w-4" />,
    color: 'bg-purple-500 hover:bg-purple-600'
  },
  {
    mode: 'primeiro_contato',
    label: '1º Contato',
    description: 'Scripts para WhatsApp e ligação',
    icon: <Phone className="h-4 w-4" />,
    color: 'bg-blue-500 hover:bg-blue-600'
  },
  {
    mode: 'qualificacao',
    label: 'Qualificação',
    description: 'Perguntas para qualificar o cliente',
    icon: <HelpCircle className="h-4 w-4" />,
    color: 'bg-green-500 hover:bg-green-600'
  },
  {
    mode: 'objecoes',
    label: 'Objeções',
    description: 'Contra-argumentos personalizados',
    icon: <AlertTriangle className="h-4 w-4" />,
    color: 'bg-orange-500 hover:bg-orange-600'
  },
  {
    mode: 'credito',
    label: 'Crédito',
    description: 'Análise de financiamento e FGTS',
    icon: <DollarSign className="h-4 w-4" />,
    color: 'bg-emerald-500 hover:bg-emerald-600'
  },
  {
    mode: 'followup',
    label: 'Follow-up',
    description: 'Mensagens de acompanhamento',
    icon: <Clock className="h-4 w-4" />,
    color: 'bg-yellow-500 hover:bg-yellow-600'
  },
  {
    mode: 'treinamento',
    label: 'Treinamento',
    description: 'Explicações sobre MCMV, FGTS, etc',
    icon: <GraduationCap className="h-4 w-4" />,
    color: 'bg-indigo-500 hover:bg-indigo-600'
  },
  {
    mode: 'recomendar',
    label: 'Recomendar Imóveis',
    description: 'Sugere imóveis do catálogo real',
    icon: <Home className="h-4 w-4" />,
    color: 'bg-rose-500 hover:bg-rose-600'
  }
];

interface CopilotQuickActionsProps {
  leadId: number;
  leadNome: string;
  compact?: boolean;
}

// Formulário de dados para recomendação de imóveis
interface RecomendacaoForm {
  rendaFamiliar: string;
  tipoRenda: string;
  entradaDisponivel: string;
  fgts: boolean;
  valorFgts: string;
  primeiroImovel: boolean;
  regiaoDesejada: string;
  prioridades: string;
}

export function CopilotQuickActions({ leadId, leadNome, compact = false }: CopilotQuickActionsProps) {
  const [selectedAction, setSelectedAction] = useState<QuickAction | null>(null);
  const [additionalContext, setAdditionalContext] = useState('');
  const [response, setResponse] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  
  // Estado para formulário de recomendação
  const [recomendacaoForm, setRecomendacaoForm] = useState<RecomendacaoForm>({
    rendaFamiliar: '',
    tipoRenda: '',
    entradaDisponivel: '',
    fgts: false,
    valorFgts: '',
    primeiroImovel: true,
    regiaoDesejada: '',
    prioridades: ''
  });
  
  const quickActionMutation = trpc.copilot.quickAction.useMutation();
  const recomendarMutation = trpc.copilot.recomendarImoveis.useMutation();
  
  const handleAction = async (action: QuickAction) => {
    setSelectedAction(action);
    setResponse(null);
    setAdditionalContext('');
    // Reset form de recomendação
    if (action.mode === 'recomendar') {
      setRecomendacaoForm({
        rendaFamiliar: '',
        tipoRenda: '',
        entradaDisponivel: '',
        fgts: false,
        valorFgts: '',
        primeiroImovel: true,
        regiaoDesejada: '',
        prioridades: ''
      });
    }
  };
  
  const executeAction = async () => {
    if (!selectedAction) return;
    
    try {
      if (selectedAction.mode === 'recomendar') {
        // Usar mutation específica para recomendação
        const result = await recomendarMutation.mutateAsync({
          leadId,
          dadosAdicionais: {
            rendaFamiliar: recomendacaoForm.rendaFamiliar ? parseFloat(recomendacaoForm.rendaFamiliar.replace(/\D/g, '')) : undefined,
            tipoRenda: recomendacaoForm.tipoRenda || undefined,
            entradaDisponivel: recomendacaoForm.entradaDisponivel ? parseFloat(recomendacaoForm.entradaDisponivel.replace(/\D/g, '')) : undefined,
            fgts: recomendacaoForm.fgts,
            valorFgts: recomendacaoForm.valorFgts ? parseFloat(recomendacaoForm.valorFgts.replace(/\D/g, '')) : undefined,
            primeiroImovel: recomendacaoForm.primeiroImovel,
            regiaoDesejada: recomendacaoForm.regiaoDesejada || undefined,
            prioridades: recomendacaoForm.prioridades || undefined
          }
        });
        setResponse(result.response);
      } else {
        // Usar mutation padrão para outras ações
        const result = await quickActionMutation.mutateAsync({
          leadId,
          mode: selectedAction.mode,
          additionalContext: additionalContext || undefined
        });
        setResponse(result.response);
      }
    } catch (error) {
      console.error('Erro ao executar ação:', error);
      toast.error('Erro ao processar ação. Tente novamente.');
    }
  };
  
  const handleCopy = async () => {
    if (response) {
      await navigator.clipboard.writeText(response);
      setCopied(true);
      toast.success('Copiado para a área de transferência!');
      setTimeout(() => setCopied(false), 2000);
    }
  };
  
  const handleClose = () => {
    setSelectedAction(null);
    setResponse(null);
    setAdditionalContext('');
  };
  
  const formatCurrency = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (!numbers) return '';
    return new Intl.NumberFormat('pt-BR').format(parseInt(numbers));
  };

  const isPending = quickActionMutation.isPending || recomendarMutation.isPending;

  // Renderiza o formulário de recomendação de imóveis
  const renderRecomendacaoForm = () => (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Preencha os dados do lead para receber recomendações de imóveis do catálogo real da Seu Metro Quadrado.
      </p>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="rendaFamiliar">Renda Familiar (R$)</Label>
          <Input
            id="rendaFamiliar"
            placeholder="Ex: 8.000"
            value={recomendacaoForm.rendaFamiliar}
            onChange={(e) => setRecomendacaoForm(prev => ({
              ...prev,
              rendaFamiliar: formatCurrency(e.target.value)
            }))}
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="tipoRenda">Tipo de Renda</Label>
          <Select 
            value={recomendacaoForm.tipoRenda} 
            onValueChange={(value) => setRecomendacaoForm(prev => ({ ...prev, tipoRenda: value }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="CLT">CLT</SelectItem>
              <SelectItem value="Autônomo">Autônomo</SelectItem>
              <SelectItem value="MEI">MEI</SelectItem>
              <SelectItem value="Empresário">Empresário</SelectItem>
              <SelectItem value="Aposentado">Aposentado</SelectItem>
              <SelectItem value="Servidor Público">Servidor Público</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="entradaDisponivel">Entrada Disponível (R$)</Label>
          <Input
            id="entradaDisponivel"
            placeholder="Ex: 10.000"
            value={recomendacaoForm.entradaDisponivel}
            onChange={(e) => setRecomendacaoForm(prev => ({
              ...prev,
              entradaDisponivel: formatCurrency(e.target.value)
            }))}
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="regiaoDesejada">Região Desejada</Label>
          <Select 
            value={recomendacaoForm.regiaoDesejada} 
            onValueChange={(value) => setRecomendacaoForm(prev => ({ ...prev, regiaoDesejada: value }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="norte">Zona Norte</SelectItem>
              <SelectItem value="sul">Zona Sul</SelectItem>
              <SelectItem value="leste">Zona Leste</SelectItem>
              <SelectItem value="oeste">Zona Oeste</SelectItem>
              <SelectItem value="centro">Centro</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="flex items-center justify-between p-3 border rounded-lg">
          <div>
            <Label htmlFor="fgts">Possui FGTS?</Label>
            <p className="text-xs text-muted-foreground">Pode usar para entrada</p>
          </div>
          <Switch
            id="fgts"
            checked={recomendacaoForm.fgts}
            onCheckedChange={(checked) => setRecomendacaoForm(prev => ({ ...prev, fgts: checked }))}
          />
        </div>
        
        <div className="flex items-center justify-between p-3 border rounded-lg">
          <div>
            <Label htmlFor="primeiroImovel">1º Imóvel?</Label>
            <p className="text-xs text-muted-foreground">Nunca teve imóvel</p>
          </div>
          <Switch
            id="primeiroImovel"
            checked={recomendacaoForm.primeiroImovel}
            onCheckedChange={(checked) => setRecomendacaoForm(prev => ({ ...prev, primeiroImovel: checked }))}
          />
        </div>
      </div>
      
      {recomendacaoForm.fgts && (
        <div className="space-y-2">
          <Label htmlFor="valorFgts">Valor do FGTS (R$)</Label>
          <Input
            id="valorFgts"
            placeholder="Ex: 20.000"
            value={recomendacaoForm.valorFgts}
            onChange={(e) => setRecomendacaoForm(prev => ({
              ...prev,
              valorFgts: formatCurrency(e.target.value)
            }))}
          />
        </div>
      )}
      
      <div className="space-y-2">
        <Label htmlFor="prioridades">Prioridades do Cliente</Label>
        <Input
          id="prioridades"
          placeholder="Ex: vaga, sacada, lazer, perto do metrô"
          value={recomendacaoForm.prioridades}
          onChange={(e) => setRecomendacaoForm(prev => ({ ...prev, prioridades: e.target.value }))}
        />
      </div>
      
      <Button
        onClick={executeAction}
        disabled={isPending}
        className="w-full bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700"
      >
        {isPending ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Buscando no catálogo...
          </>
        ) : (
          <>
            <Home className="h-4 w-4 mr-2" />
            Recomendar Imóveis
          </>
        )}
      </Button>
    </div>
  );

  // Renderiza o formulário padrão para outras ações
  const renderDefaultForm = () => (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {selectedAction?.description}
      </p>
      
      <div>
        <label className="text-sm font-medium">
          Informação adicional (opcional):
        </label>
        <Textarea
          value={additionalContext}
          onChange={(e) => setAdditionalContext(e.target.value)}
          placeholder="Ex: O cliente mencionou que tem pressa, está com restrição no nome..."
          className="mt-1"
          rows={3}
        />
      </div>
      
      <Button
        onClick={executeAction}
        disabled={isPending}
        className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
      >
        {isPending ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Processando...
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4 mr-2" />
            Gerar Resposta
          </>
        )}
      </Button>
    </div>
  );

  if (compact) {
    return (
      <>
        <div className="flex flex-wrap gap-1">
          {QUICK_ACTIONS.map((action) => (
            <Button
              key={action.mode}
              variant="outline"
              size="sm"
              className={`h-7 px-2 text-xs ${action.mode === 'recomendar' ? 'border-rose-300 text-rose-600 hover:bg-rose-50' : ''}`}
              onClick={() => handleAction(action)}
            >
              {action.icon}
              <span className="ml-1">{action.label}</span>
            </Button>
          ))}
        </div>
        
        <Dialog open={!!selectedAction} onOpenChange={(open) => !open && handleClose()}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-purple-600" />
                SMQ Copilot - {selectedAction?.label}
                <Badge variant="secondary">{leadNome}</Badge>
              </DialogTitle>
            </DialogHeader>
            
            {!response ? (
              selectedAction?.mode === 'recomendar' ? renderRecomendacaoForm() : renderDefaultForm()
            ) : (
              <div className="space-y-4">
                <ScrollArea className="h-[400px] border rounded-lg p-4">
                  <Streamdown>{response}</Streamdown>
                </ScrollArea>
                
                <div className="flex gap-2">
                  <Button
                    onClick={handleCopy}
                    variant="outline"
                    className="flex-1"
                  >
                    {copied ? (
                      <>
                        <Check className="h-4 w-4 mr-2 text-green-600" />
                        Copiado!
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-2" />
                        Copiar Resposta
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={() => setResponse(null)}
                    variant="outline"
                  >
                    Nova Consulta
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Bot className="h-4 w-4 text-purple-600" />
            SMQ Copilot - Ações Rápidas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2">
            {QUICK_ACTIONS.map((action) => (
              <Button
                key={action.mode}
                variant="outline"
                className={`h-auto py-2 px-3 flex flex-col items-start gap-1 hover:border-purple-300 ${
                  action.mode === 'recomendar' ? 'col-span-2 border-rose-200 hover:border-rose-400 bg-rose-50/50' : ''
                }`}
                onClick={() => handleAction(action)}
              >
                <div className="flex items-center gap-2">
                  <div className={`p-1 rounded ${action.color} text-white`}>
                    {action.icon}
                  </div>
                  <span className="font-medium text-sm">{action.label}</span>
                  {action.mode === 'recomendar' && (
                    <Badge variant="secondary" className="ml-auto text-xs">
                      Catálogo Real
                    </Badge>
                  )}
                </div>
                <span className="text-xs text-muted-foreground text-left">
                  {action.description}
                </span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
      
      <Dialog open={!!selectedAction} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-purple-600" />
              SMQ Copilot - {selectedAction?.label}
              <Badge variant="secondary">{leadNome}</Badge>
            </DialogTitle>
          </DialogHeader>
          
          {!response ? (
            selectedAction?.mode === 'recomendar' ? renderRecomendacaoForm() : renderDefaultForm()
          ) : (
            <div className="space-y-4">
              <ScrollArea className="h-[400px] border rounded-lg p-4">
                <Streamdown>{response}</Streamdown>
              </ScrollArea>
              
              <div className="flex gap-2">
                <Button
                  onClick={handleCopy}
                  variant="outline"
                  className="flex-1"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4 mr-2 text-green-600" />
                      Copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      Copiar Resposta
                    </>
                  )}
                </Button>
                <Button
                  onClick={() => setResponse(null)}
                  variant="outline"
                >
                  Nova Consulta
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export default CopilotQuickActions;

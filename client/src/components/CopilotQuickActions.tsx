import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  X
} from 'lucide-react';
import { Streamdown } from 'streamdown';
import { toast } from 'sonner';

type QuickActionMode = 'briefing' | 'primeiro_contato' | 'qualificacao' | 'objecoes' | 'credito' | 'followup' | 'treinamento';

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
  }
];

interface CopilotQuickActionsProps {
  leadId: number;
  leadNome: string;
  compact?: boolean;
}

export function CopilotQuickActions({ leadId, leadNome, compact = false }: CopilotQuickActionsProps) {
  const [selectedAction, setSelectedAction] = useState<QuickAction | null>(null);
  const [additionalContext, setAdditionalContext] = useState('');
  const [response, setResponse] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  
  const quickActionMutation = trpc.copilot.quickAction.useMutation();
  
  const handleAction = async (action: QuickAction) => {
    setSelectedAction(action);
    setResponse(null);
    setAdditionalContext('');
  };
  
  const executeAction = async () => {
    if (!selectedAction) return;
    
    try {
      const result = await quickActionMutation.mutateAsync({
        leadId,
        mode: selectedAction.mode,
        additionalContext: additionalContext || undefined
      });
      
      setResponse(result.response);
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

  if (compact) {
    return (
      <>
        <div className="flex flex-wrap gap-1">
          {QUICK_ACTIONS.map((action) => (
            <Button
              key={action.mode}
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => handleAction(action)}
            >
              {action.icon}
              <span className="ml-1">{action.label}</span>
            </Button>
          ))}
        </div>
        
        <Dialog open={!!selectedAction} onOpenChange={(open) => !open && handleClose()}>
          <DialogContent className="max-w-2xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-purple-600" />
                SMQ Copilot - {selectedAction?.label}
                <Badge variant="secondary">{leadNome}</Badge>
              </DialogTitle>
            </DialogHeader>
            
            {!response ? (
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
                  disabled={quickActionMutation.isPending}
                  className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                >
                  {quickActionMutation.isPending ? (
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
                className="h-auto py-2 px-3 flex flex-col items-start gap-1 hover:border-purple-300"
                onClick={() => handleAction(action)}
              >
                <div className="flex items-center gap-2">
                  <div className={`p-1 rounded ${action.color} text-white`}>
                    {action.icon}
                  </div>
                  <span className="font-medium text-sm">{action.label}</span>
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
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-purple-600" />
              SMQ Copilot - {selectedAction?.label}
              <Badge variant="secondary">{leadNome}</Badge>
            </DialogTitle>
          </DialogHeader>
          
          {!response ? (
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
                disabled={quickActionMutation.isPending}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
              >
                {quickActionMutation.isPending ? (
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

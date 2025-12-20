import { useState, useRef, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { 
  Bot, 
  Send, 
  User, 
  Loader2, 
  X, 
  Minimize2, 
  Maximize2,
  Sparkles,
  MessageSquare,
  Phone,
  HelpCircle,
  AlertTriangle,
  DollarSign,
  Clock,
  GraduationCap
} from 'lucide-react';
import { Streamdown } from 'streamdown';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

type CopilotMode = 'briefing' | 'primeiro_contato' | 'qualificacao' | 'objecoes' | 'credito' | 'followup' | 'treinamento' | 'chat';

interface SMQCopilotChatProps {
  leadId?: number;
  leadNome?: string;
  isOpen?: boolean;
  onClose?: () => void;
  defaultMode?: CopilotMode;
}

const MODE_INFO: Record<CopilotMode, { label: string; icon: React.ReactNode; color: string }> = {
  chat: { label: 'Chat Livre', icon: <MessageSquare className="h-4 w-4" />, color: 'bg-gray-500' },
  briefing: { label: 'Briefing', icon: <Sparkles className="h-4 w-4" />, color: 'bg-purple-500' },
  primeiro_contato: { label: '1º Contato', icon: <Phone className="h-4 w-4" />, color: 'bg-blue-500' },
  qualificacao: { label: 'Qualificação', icon: <HelpCircle className="h-4 w-4" />, color: 'bg-green-500' },
  objecoes: { label: 'Objeções', icon: <AlertTriangle className="h-4 w-4" />, color: 'bg-orange-500' },
  credito: { label: 'Crédito', icon: <DollarSign className="h-4 w-4" />, color: 'bg-emerald-500' },
  followup: { label: 'Follow-up', icon: <Clock className="h-4 w-4" />, color: 'bg-yellow-500' },
  treinamento: { label: 'Treinamento', icon: <GraduationCap className="h-4 w-4" />, color: 'bg-indigo-500' },
};

export function SMQCopilotChat({ 
  leadId, 
  leadNome,
  isOpen = true, 
  onClose,
  defaultMode = 'chat'
}: SMQCopilotChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<CopilotMode>(defaultMode);
  const [isMinimized, setIsMinimized] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const chatMutation = trpc.copilot.chat.useMutation();
  
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || chatMutation.isPending) return;
    
    const userMessage: Message = { role: 'user', content: input };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    
    try {
      const result = await chatMutation.mutateAsync({
        messages: newMessages,
        leadId,
        mode
      });
      
      setMessages([...newMessages, { role: 'assistant', content: result.response }]);
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      setMessages([
        ...newMessages, 
        { role: 'assistant', content: '❌ Erro ao processar sua mensagem. Tente novamente.' }
      ]);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) return null;

  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          onClick={() => setIsMinimized(false)}
          className="rounded-full h-14 w-14 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 shadow-lg"
        >
          <Bot className="h-6 w-6" />
        </Button>
      </div>
    );
  }

  return (
    <Card className="fixed bottom-4 right-4 w-[420px] h-[600px] z-50 shadow-2xl border-2 border-purple-200 flex flex-col">
      <CardHeader className="bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-t-lg py-3 px-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            <CardTitle className="text-base font-semibold">SMQ Copilot</CardTitle>
            {leadNome && (
              <Badge variant="secondary" className="bg-white/20 text-white text-xs">
                {leadNome}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-white hover:bg-white/20"
              onClick={() => setIsMinimized(true)}
            >
              <Minimize2 className="h-4 w-4" />
            </Button>
            {onClose && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-white hover:bg-white/20"
                onClick={onClose}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        
        {/* Mode selector */}
        <div className="flex flex-wrap gap-1 mt-2">
          {(Object.keys(MODE_INFO) as CopilotMode[]).map((m) => (
            <Button
              key={m}
              variant={mode === m ? 'secondary' : 'ghost'}
              size="sm"
              className={`h-6 px-2 text-xs ${mode === m ? 'bg-white text-purple-700' : 'text-white hover:bg-white/20'}`}
              onClick={() => setMode(m)}
            >
              {MODE_INFO[m].icon}
              <span className="ml-1">{MODE_INFO[m].label}</span>
            </Button>
          ))}
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
              <Bot className="h-12 w-12 mb-4 text-purple-300" />
              <p className="text-sm font-medium">Olá! Sou o SMQ Copilot 👋</p>
              <p className="text-xs mt-1">
                Estou aqui para te ajudar a vender mais!
              </p>
              <p className="text-xs mt-2 text-purple-600">
                Selecione um modo acima ou digite sua dúvida.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'assistant' && (
                    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 flex items-center justify-center">
                      <Bot className="h-4 w-4 text-white" />
                    </div>
                  )}
                  <div
                    className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                      msg.role === 'user'
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-100 text-gray-900'
                    }`}
                  >
                    {msg.role === 'assistant' ? (
                      <Streamdown>{msg.content}</Streamdown>
                    ) : (
                      msg.content
                    )}
                  </div>
                  {msg.role === 'user' && (
                    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center">
                      <User className="h-4 w-4 text-gray-600" />
                    </div>
                  )}
                </div>
              ))}
              {chatMutation.isPending && (
                <div className="flex gap-2 justify-start">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 flex items-center justify-center">
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                  <div className="bg-gray-100 rounded-lg px-3 py-2">
                    <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>
        
        <div className="p-3 border-t flex-shrink-0">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Digite sua dúvida..."
              disabled={chatMutation.isPending}
              className="flex-1"
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || chatMutation.isPending}
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
            >
              {chatMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Componente de botão flutuante para abrir o chat
export function SMQCopilotButton({ 
  leadId, 
  leadNome,
  className 
}: { 
  leadId?: number; 
  leadNome?: string;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        className={`bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 ${className}`}
      >
        <Bot className="h-4 w-4 mr-2" />
        SMQ Copilot
      </Button>
      
      {isOpen && (
        <SMQCopilotChat
          leadId={leadId}
          leadNome={leadNome}
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  );
}

export default SMQCopilotChat;

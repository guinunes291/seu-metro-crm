// SMQ Copilot - Chat Flutuante Persistente
// Componente que fica visível em todas as páginas do CRM

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { 
  MessageCircle, 
  X, 
  Minimize2, 
  Maximize2, 
  Send, 
  Loader2, 
  Sparkles,
  User,
  Bot,
  GraduationCap,
  Phone,
  ClipboardList,
  Shield,
  CreditCard,
  Clock,
  Building2
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Streamdown } from "streamdown";

type Message = {
  role: "system" | "user" | "assistant";
  content: string;
};

type CopilotMode = 
  | 'briefing'
  | 'primeiro_contato'
  | 'qualificacao'
  | 'objecoes'
  | 'credito'
  | 'followup'
  | 'treinamento'
  | 'recomendar'
  | 'chat';

interface ModeOption {
  id: CopilotMode;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const MODE_OPTIONS: ModeOption[] = [
  { id: 'chat', label: 'Chat Livre', icon: <MessageCircle className="h-4 w-4" />, description: 'Conversa geral' },
  { id: 'treinamento', label: 'Treinamento', icon: <GraduationCap className="h-4 w-4" />, description: 'Aprenda sobre MCMV, FGTS, etc.' },
  { id: 'primeiro_contato', label: '1º Contato', icon: <Phone className="h-4 w-4" />, description: 'Scripts para primeiro contato' },
  { id: 'qualificacao', label: 'Qualificação', icon: <ClipboardList className="h-4 w-4" />, description: 'Perguntas para qualificar' },
  { id: 'objecoes', label: 'Objeções', icon: <Shield className="h-4 w-4" />, description: 'Contra-argumentos' },
  { id: 'credito', label: 'Crédito', icon: <CreditCard className="h-4 w-4" />, description: 'Análise de crédito' },
  { id: 'followup', label: 'Follow-up', icon: <Clock className="h-4 w-4" />, description: 'Mensagens de retorno' },
  { id: 'recomendar', label: 'Recomendar', icon: <Building2 className="h-4 w-4" />, description: 'Sugerir imóveis' },
];

export function SMQCopilotFloating() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [selectedMode, setSelectedMode] = useState<CopilotMode>('chat');
  const [showModeSelector, setShowModeSelector] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Mutation para chat com o Copilot
  const chatMutation = trpc.copilot.chat.useMutation({
    onSuccess: (data) => {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: data.response
      }]);
      scrollToBottom();
    },
    onError: (error) => {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: `❌ Erro: ${error.message}`
      }]);
    }
  });

  // Scroll para o final
  const scrollToBottom = () => {
    setTimeout(() => {
      const viewport = scrollAreaRef.current?.querySelector(
        '[data-radix-scroll-area-viewport]'
      ) as HTMLDivElement;
      if (viewport) {
        viewport.scrollTo({
          top: viewport.scrollHeight,
          behavior: 'smooth'
        });
      }
    }, 100);
  };

  // Enviar mensagem
  const handleSend = () => {
    const trimmedInput = input.trim();
    if (!trimmedInput || chatMutation.isPending) return;

    const userMessage: Message = { role: "user", content: trimmedInput };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");

    // Chamar API
    chatMutation.mutate({
      messages: newMessages.map(m => ({ role: m.role, content: m.content })),
      mode: selectedMode
    });

    scrollToBottom();
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Limpar conversa
  const clearChat = () => {
    setMessages([]);
    setSelectedMode('chat');
  };

  // Selecionar modo
  const selectMode = (mode: CopilotMode) => {
    setSelectedMode(mode);
    setShowModeSelector(false);
    
    // Adicionar mensagem do sistema indicando o modo
    if (mode !== 'chat') {
      const modeOption = MODE_OPTIONS.find(m => m.id === mode);
      setMessages(prev => [...prev, {
        role: "assistant",
        content: `🎯 **Modo ${modeOption?.label} ativado**\n\n${modeOption?.description}. Como posso ajudar?`
      }]);
    }
  };

  // Botão flutuante quando fechado
  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50 bg-primary hover:bg-primary/90"
        size="icon"
      >
        <Bot className="h-6 w-6" />
        <span className="sr-only">Abrir SMQ Copilot</span>
      </Button>
    );
  }

  // Chat minimizado
  if (isMinimized) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <div className="bg-card border rounded-lg shadow-lg p-3 flex items-center gap-3">
          <Bot className="h-5 w-5 text-primary" />
          <span className="font-medium text-sm">SMQ Copilot</span>
          {messages.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {messages.filter(m => m.role !== 'system').length}
            </Badge>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setIsMinimized(false)}
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setIsOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  // Chat aberto completo
  return (
    <div className="fixed bottom-6 right-6 z-50 w-[400px] max-w-[calc(100vw-48px)]">
      <div className="bg-card border rounded-lg shadow-2xl flex flex-col h-[500px] max-h-[calc(100vh-100px)]">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b bg-primary/5 rounded-t-lg">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Bot className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">SMQ Copilot</h3>
              <p className="text-xs text-muted-foreground">Seu assistente de vendas</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={clearChat}
              title="Limpar conversa"
            >
              <span className="text-xs">🗑️</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setIsMinimized(true)}
            >
              <Minimize2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setIsOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Mode Selector */}
        <div className="p-2 border-b">
          <div className="flex items-center gap-2">
            <Button
              variant={showModeSelector ? "secondary" : "outline"}
              size="sm"
              className="text-xs h-7"
              onClick={() => setShowModeSelector(!showModeSelector)}
            >
              {MODE_OPTIONS.find(m => m.id === selectedMode)?.icon}
              <span className="ml-1">{MODE_OPTIONS.find(m => m.id === selectedMode)?.label}</span>
            </Button>
            {selectedMode !== 'chat' && (
              <Badge variant="secondary" className="text-xs">
                Modo ativo
              </Badge>
            )}
          </div>
          
          {showModeSelector && (
            <div className="mt-2 grid grid-cols-2 gap-1">
              {MODE_OPTIONS.map((mode) => (
                <Button
                  key={mode.id}
                  variant={selectedMode === mode.id ? "secondary" : "ghost"}
                  size="sm"
                  className="justify-start text-xs h-8"
                  onClick={() => selectMode(mode.id)}
                >
                  {mode.icon}
                  <span className="ml-1 truncate">{mode.label}</span>
                </Button>
              ))}
            </div>
          )}
        </div>

        {/* Messages Area */}
        <div ref={scrollAreaRef} className="flex-1 overflow-hidden">
          {messages.filter(m => m.role !== 'system').length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center p-4 text-center">
              <Sparkles className="h-10 w-10 text-primary/20 mb-3" />
              <p className="text-sm text-muted-foreground mb-2">
                Olá! Sou o SMQ Copilot 👋
              </p>
              <p className="text-xs text-muted-foreground">
                Posso ajudar com scripts de vendas, qualificação de leads, análise de crédito e muito mais!
              </p>
              <div className="mt-4 flex flex-wrap gap-1 justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => {
                    setInput("Como funciona o MCMV?");
                    textareaRef.current?.focus();
                  }}
                >
                  MCMV
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => {
                    setInput("Como usar FGTS na compra?");
                    textareaRef.current?.focus();
                  }}
                >
                  FGTS
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => {
                    setInput("Dicas para primeiro contato");
                    textareaRef.current?.focus();
                  }}
                >
                  1º Contato
                </Button>
              </div>
            </div>
          ) : (
            <ScrollArea className="h-full">
              <div className="flex flex-col space-y-3 p-3">
                {messages.filter(m => m.role !== 'system').map((message, index) => (
                  <div
                    key={index}
                    className={cn(
                      "flex gap-2",
                      message.role === "user"
                        ? "justify-end"
                        : "justify-start"
                    )}
                  >
                    {message.role === "assistant" && (
                      <div className="h-6 w-6 shrink-0 rounded-full bg-primary/10 flex items-center justify-center">
                        <Bot className="h-3 w-3 text-primary" />
                      </div>
                    )}

                    <div
                      className={cn(
                        "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      )}
                    >
                      {message.role === "assistant" ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none text-xs">
                          <Streamdown>{message.content}</Streamdown>
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap text-xs">
                          {message.content}
                        </p>
                      )}
                    </div>

                    {message.role === "user" && (
                      <div className="h-6 w-6 shrink-0 rounded-full bg-secondary flex items-center justify-center">
                        <User className="h-3 w-3" />
                      </div>
                    )}
                  </div>
                ))}

                {chatMutation.isPending && (
                  <div className="flex items-start gap-2">
                    <div className="h-6 w-6 shrink-0 rounded-full bg-primary/10 flex items-center justify-center">
                      <Bot className="h-3 w-3 text-primary" />
                    </div>
                    <div className="rounded-lg bg-muted px-3 py-2">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Input Area */}
        <div className="p-3 border-t bg-background/50">
          <div className="flex gap-2 items-end">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Digite sua mensagem..."
              className="flex-1 max-h-20 resize-none min-h-[36px] text-sm"
              rows={1}
            />
            <Button
              onClick={handleSend}
              size="icon"
              disabled={!input.trim() || chatMutation.isPending}
              className="shrink-0 h-9 w-9"
            >
              {chatMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

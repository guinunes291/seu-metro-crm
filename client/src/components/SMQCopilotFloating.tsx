// SMQ Copilot - Chat Flutuante Persistente
// Componente que fica visível em todas as páginas do CRM
// Integrado com contexto de leads para respostas personalizadas

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
  Building2,
  UserCircle,
  XCircle
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Streamdown } from "streamdown";
import { useCopilot } from "@/contexts/CopilotContext";

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
  // Contexto do Copilot para receber lead selecionado
  const { selectedLead, clearLeadContext, isOpen, setIsOpen } = useCopilot();
  
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [selectedMode, setSelectedMode] = useState<CopilotMode>('chat');
  const [showModeSelector, setShowModeSelector] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Referência para o lead anterior (para detectar mudanças)
  const previousLeadRef = useRef<number | null>(null);

  // Quando um lead é selecionado, adicionar mensagem de contexto
  useEffect(() => {
    if (selectedLead && selectedLead.id !== previousLeadRef.current) {
      previousLeadRef.current = selectedLead.id;
      
      // Adicionar mensagem de contexto do lead
      const contextMessage: Message = {
        role: "assistant",
        content: `👤 **Lead Selecionado: ${selectedLead.nome}**\n\n` +
          `📱 **Telefone:** ${selectedLead.telefone || 'Não informado'}\n` +
          `📧 **Email:** ${selectedLead.email || 'Não informado'}\n` +
          `📊 **Status:** ${selectedLead.status}\n` +
          (selectedLead.projeto ? `🏠 **Projeto:** ${selectedLead.projeto}\n` : '') +
          (selectedLead.faixaRenda ? `💰 **Faixa de Renda:** ${selectedLead.faixaRenda}\n` : '') +
          (selectedLead.campanha ? `📢 **Campanha:** ${selectedLead.campanha}\n` : '') +
          (selectedLead.diasFollowupConsecutivos !== undefined ? `📅 **Follow-up:** Dia ${selectedLead.diasFollowupConsecutivos} de 5\n` : '') +
          `\n_Agora posso te ajudar com scripts personalizados para este lead!_`
      };
      
      setMessages(prev => [...prev, contextMessage]);
      scrollToBottom();
    }
  }, [selectedLead]);

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

    // Chamar API com contexto do lead se disponível
    chatMutation.mutate({
      messages: newMessages.map(m => ({ role: m.role === 'system' ? 'user' : m.role, content: m.content })),
      mode: selectedMode,
      leadId: selectedLead?.id
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
    clearLeadContext();
    previousLeadRef.current = null;
  };

  // Selecionar modo
  const selectMode = (mode: CopilotMode) => {
    setSelectedMode(mode);
    setShowModeSelector(false);
    
    // Adicionar mensagem do sistema indicando o modo
    if (mode !== 'chat') {
      const modeOption = MODE_OPTIONS.find(m => m.id === mode);
      let modeMessage = `🎯 **Modo ${modeOption?.label} ativado**\n\n${modeOption?.description}.`;
      
      // Se tem lead selecionado, mencionar
      if (selectedLead) {
        modeMessage += `\n\n_Contexto: ${selectedLead.nome}_`;
      }
      
      modeMessage += `\n\nComo posso ajudar?`;
      
      setMessages(prev => [...prev, {
        role: "assistant",
        content: modeMessage
      }]);
    }
  };

  // Botão flutuante quando fechado
  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50",
          selectedLead 
            ? "bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700" 
            : "bg-primary hover:bg-primary/90"
        )}
        size="icon"
      >
        <Bot className="h-6 w-6" />
        {selectedLead && (
          <span className="absolute -top-1 -right-1 h-4 w-4 bg-green-500 rounded-full border-2 border-white" />
        )}
        <span className="sr-only">Abrir SMQ Copilot</span>
      </Button>
    );
  }

  // Chat minimizado
  if (isMinimized) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <div className={cn(
          "border rounded-lg shadow-lg p-3 flex items-center gap-3",
          selectedLead ? "bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200" : "bg-card"
        )}>
          <Bot className={cn("h-5 w-5", selectedLead ? "text-purple-600" : "text-primary")} />
          <div className="flex flex-col">
            <span className="font-medium text-sm">SMQ Copilot</span>
            {selectedLead && (
              <span className="text-xs text-purple-600">{selectedLead.nome}</span>
            )}
          </div>
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
        <div className={cn(
          "flex items-center justify-between p-3 border-b rounded-t-lg",
          selectedLead 
            ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white" 
            : "bg-primary/5"
        )}>
          <div className="flex items-center gap-2">
            <div className={cn(
              "h-8 w-8 rounded-full flex items-center justify-center",
              selectedLead ? "bg-white/20" : "bg-primary/10"
            )}>
              <Bot className={cn("h-4 w-4", selectedLead ? "text-white" : "text-primary")} />
            </div>
            <div>
              <h3 className={cn("font-semibold text-sm", selectedLead ? "text-white" : "")}>SMQ Copilot</h3>
              <p className={cn("text-xs", selectedLead ? "text-white/80" : "text-muted-foreground")}>
                {selectedLead ? selectedLead.nome : "Seu assistente de vendas"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {selectedLead && (
              <Button
                variant="ghost"
                size="icon"
                className={cn("h-8 w-8", selectedLead ? "text-white hover:bg-white/20" : "")}
                onClick={clearLeadContext}
                title="Remover contexto do lead"
              >
                <XCircle className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className={cn("h-8 w-8", selectedLead ? "text-white hover:bg-white/20" : "")}
              onClick={clearChat}
              title="Limpar conversa"
            >
              <span className="text-xs">🗑️</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={cn("h-8 w-8", selectedLead ? "text-white hover:bg-white/20" : "")}
              onClick={() => setIsMinimized(true)}
            >
              <Minimize2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={cn("h-8 w-8", selectedLead ? "text-white hover:bg-white/20" : "")}
              onClick={() => setIsOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Lead Context Badge */}
        {selectedLead && (
          <div className="px-3 py-2 bg-purple-50 border-b border-purple-100">
            <div className="flex items-center gap-2 text-xs text-purple-700">
              <UserCircle className="h-4 w-4" />
              <span className="font-medium">{selectedLead.nome}</span>
              <span className="text-purple-500">•</span>
              <span>{selectedLead.status}</span>
              {selectedLead.projeto && (
                <>
                  <span className="text-purple-500">•</span>
                  <span>{selectedLead.projeto}</span>
                </>
              )}
            </div>
          </div>
        )}

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
                {selectedLead 
                  ? `Estou pronto para ajudar com ${selectedLead.nome}!`
                  : "Posso ajudar com scripts de vendas, qualificação de leads, análise de crédito e muito mais!"
                }
              </p>
              <div className="mt-4 flex flex-wrap gap-1 justify-center">
                {selectedLead ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => selectMode('primeiro_contato')}
                    >
                      1º Contato
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => selectMode('qualificacao')}
                    >
                      Qualificar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => selectMode('followup')}
                    >
                      Follow-up
                    </Button>
                  </>
                ) : (
                  <>
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
                        setInput("Me dê um script de primeiro contato");
                        textareaRef.current?.focus();
                      }}
                    >
                      1º Contato
                    </Button>
                  </>
                )}
              </div>
            </div>
          ) : (
            <ScrollArea className="h-full p-4">
              <div className="space-y-4">
                {messages.filter(m => m.role !== 'system').map((message, index) => (
                  <div
                    key={index}
                    className={cn(
                      "flex gap-2",
                      message.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    {message.role === "assistant" && (
                      <div className="flex-shrink-0 h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
                        <Bot className="h-4 w-4 text-primary" />
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
                        <Streamdown>{message.content}</Streamdown>
                      ) : (
                        message.content
                      )}
                    </div>
                    {message.role === "user" && (
                      <div className="flex-shrink-0 h-7 w-7 rounded-full bg-primary flex items-center justify-center">
                        <User className="h-4 w-4 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                ))}
                {chatMutation.isPending && (
                  <div className="flex gap-2 justify-start">
                    <div className="flex-shrink-0 h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                    <div className="bg-muted rounded-lg px-3 py-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Input Area */}
        <div className="p-3 border-t">
          <div className="flex gap-2">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={selectedLead ? `Pergunte sobre ${selectedLead.nome}...` : "Digite sua mensagem..."}
              className="min-h-[40px] max-h-[120px] resize-none"
              rows={1}
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || chatMutation.isPending}
              size="icon"
              className="h-10 w-10 flex-shrink-0"
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

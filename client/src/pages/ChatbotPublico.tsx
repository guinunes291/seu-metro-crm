import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Send, Bot, User, Loader2, Home } from "lucide-react";

interface Message {
  role: "bot" | "user";
  message: string;
  timestamp: string;
}

export default function ChatbotPublico() {
  const [sessionId, setSessionId] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Mutation para iniciar conversa
  const iniciarConversa = trpc.chatbot.iniciar.useMutation({
    onSuccess: (data) => {
      if (data) {
        setSessionId(data.sessionId);
        // Buscar histórico inicial
        const historico = data.historico ? JSON.parse(data.historico) : [];
        setMessages(historico);
      }
    }
  });

  // Mutation para enviar mensagem
  const enviarMensagem = trpc.chatbot.enviarMensagem.useMutation({
    onSuccess: (data) => {
      setIsTyping(false);
      if (data.conversa?.historico) {
        const historico = JSON.parse(data.conversa.historico);
        setMessages(historico);
      }
    },
    onError: () => {
      setIsTyping(false);
    }
  });

  // Iniciar conversa ao carregar
  useEffect(() => {
    const savedSession = localStorage.getItem("chatbot_session");
    if (savedSession) {
      setSessionId(savedSession);
      // Buscar conversa existente
      // Por simplicidade, vamos iniciar uma nova
    }
    
    iniciarConversa.mutate({
      origem: window.location.href,
      dispositivo: /Mobi|Android/i.test(navigator.userAgent) ? "mobile" : "desktop"
    });
  }, []);

  // Salvar sessionId
  useEffect(() => {
    if (sessionId) {
      localStorage.setItem("chatbot_session", sessionId);
    }
  }, [sessionId]);

  // Scroll para última mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || !sessionId || isTyping) return;

    const userMessage = input.trim();
    setInput("");
    setIsTyping(true);

    // Adicionar mensagem do usuário localmente
    setMessages(prev => [...prev, {
      role: "user",
      message: userMessage,
      timestamp: new Date().toISOString()
    }]);

    enviarMensagem.mutate({
      sessionId,
      mensagem: userMessage
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col">
      {/* Header */}
      <div className="bg-slate-800/80 border-b border-slate-700 p-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
            <Home className="h-5 w-5 text-amber-500" />
          </div>
          <div>
            <h1 className="font-bold text-white">Seu Metro Quadrado</h1>
            <p className="text-xs text-green-400 flex items-center gap-1">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              Online agora
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-2xl mx-auto space-y-4">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`flex items-start gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                msg.role === "bot" ? "bg-amber-500/20" : "bg-blue-500/20"
              }`}>
                {msg.role === "bot" ? (
                  <Bot className="h-4 w-4 text-amber-500" />
                ) : (
                  <User className="h-4 w-4 text-blue-500" />
                )}
              </div>
              <Card className={`max-w-[80%] p-3 ${
                msg.role === "bot" 
                  ? "bg-slate-700/50 border-slate-600" 
                  : "bg-blue-600/20 border-blue-500/30"
              }`}>
                <p className="text-slate-200 whitespace-pre-wrap">{msg.message}</p>
              </Card>
            </div>
          ))}

          {isTyping && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center">
                <Bot className="h-4 w-4 text-amber-500" />
              </div>
              <Card className="bg-slate-700/50 border-slate-600 p-3">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </Card>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="bg-slate-800/80 border-t border-slate-700 p-4">
        <div className="max-w-2xl mx-auto flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Digite sua mensagem..."
            className="flex-1 bg-slate-700 border-slate-600 text-white placeholder:text-slate-400"
            disabled={isTyping || !sessionId}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isTyping || !sessionId}
            className="bg-amber-500 hover:bg-amber-600"
          >
            {isTyping ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="text-center text-xs text-slate-500 mt-2">
          Atendimento 24 horas • Seu Metro Quadrado
        </p>
      </div>
    </div>
  );
}

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle2,
  XCircle,
  ArrowRight,
  ArrowLeft,
  Phone,
  MessageSquare,
  Zap,
  Trophy,
  Clock,
  Filter,
  PhoneCall,
  PhoneOff,
  CalendarCheck,
  Send,
  ThumbsDown,
  Home,
  User,
  Info,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import DashboardLayout from "@/components/DashboardLayout";
import { Link } from "wouter";

type BlocoAtivo = "follow_up" | "ligacoes";

// ============================================================================
// BLOCO FOCO EM LIGAÇÕES
// ============================================================================
function BlocoFocoLigacoes() {
  const { user } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showDetalhes, setShowDetalhes] = useState(false);
  const [observacoes, setObservacoes] = useState("");
  const [filtro, setFiltro] = useState<"todos" | "aguardando" | "em_atendimento" | "agendado" | "follow_up_hoje">("todos");
  const [processedCount, setProcessedCount] = useState(0);
  const [startTime] = useState(Date.now());

  const { data: leads, isLoading, refetch } = trpc.leads.getLeadsParaBlitz.useQuery(
    { filtro, limit: 100 },
    { enabled: !!user, refetchOnWindowFocus: false }
  );

  const registrarInteracao = trpc.leads.registrarInteracaoBlitz.useMutation({
    onSuccess: () => {
      setObservacoes("");
      setShowDetalhes(false);
      refetch();
      setProcessedCount((p) => p + 1);
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const currentLead = leads?.[currentIndex];
  const totalLeads = leads?.length || 0;
  const progress = totalLeads > 0 ? ((currentIndex + 1) / totalLeads) * 100 : 0;
  const elapsedMin = Math.floor((Date.now() - startTime) / 60000);
  const avgTime = processedCount > 0 ? elapsedMin / processedCount : 0;
  const estimatedRemaining = Math.ceil((totalLeads - currentIndex - 1) * avgTime);

  const handleNext = useCallback(() => {
    if (currentIndex < totalLeads - 1) {
      setCurrentIndex((i) => i + 1);
      setObservacoes("");
      setShowDetalhes(false);
    }
  }, [currentIndex, totalLeads]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
      setObservacoes("");
      setShowDetalhes(false);
    }
  }, [currentIndex]);

  const handleRegistrar = useCallback(
    (
      tipo: "ligacao" | "whatsapp" | "outro",
      resultado: "contato_realizado" | "nao_atendeu" | "agendamento" | "proposta_enviada" | "recusou" | "outro",
      novoStatus?: string
    ) => {
      if (!currentLead) return;
      registrarInteracao.mutate({
        leadId: currentLead.id,
        tipo,
        resultado,
        observacoes: observacoes || undefined,
        novoStatus: novoStatus as any,
      });
      setTimeout(() => {
        if (currentIndex < totalLeads - 1) setCurrentIndex((i) => i + 1);
      }, 300);
    },
    [currentLead, observacoes, currentIndex, totalLeads, registrarInteracao]
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;
      switch (e.key) {
        case "ArrowRight":
        case "n":
          e.preventDefault();
          handleNext();
          break;
        case "ArrowLeft":
        case "p":
          e.preventDefault();
          handlePrev();
          break;
        case "1":
          e.preventDefault();
          handleRegistrar("ligacao", "contato_realizado", "em_atendimento");
          break;
        case "2":
          e.preventDefault();
          handleRegistrar("ligacao", "nao_atendeu");
          break;
        case "3":
          e.preventDefault();
          handleRegistrar("ligacao", "agendamento", "agendado");
          break;
        case "4":
          e.preventDefault();
          handleRegistrar("whatsapp", "contato_realizado", "em_atendimento");
          break;
        case "d":
          e.preventDefault();
          setShowDetalhes((v) => !v);
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleNext, handlePrev, handleRegistrar]);

  const statusLabels: Record<string, { label: string; color: string }> = {
    aguardando_atendimento: { label: "Aguardando", color: "bg-yellow-100 text-yellow-800" },
    em_atendimento: { label: "Em Atendimento", color: "bg-blue-100 text-blue-800" },
    agendado: { label: "Agendado", color: "bg-purple-100 text-purple-800" },
    visita_realizada: { label: "Visita Realizada", color: "bg-green-100 text-green-800" },
    analise_credito: { label: "Análise de Crédito", color: "bg-orange-100 text-orange-800" },
    novo: { label: "Novo", color: "bg-gray-100 text-gray-800" },
  };

  const faixaRendaLabels: Record<string, string> = {
    ate_2: "Até R$ 2.000",
    "2_a_4": "R$ 2.000 – R$ 4.000",
    "4_a_8": "R$ 4.000 – R$ 8.000",
    acima_8: "Acima de R$ 8.000",
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!leads || leads.length === 0) {
    return (
      <div className="text-center py-16">
        <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
        <h3 className="text-xl font-bold mb-2">Nenhum lead para ligar agora</h3>
        <p className="text-muted-foreground mb-6">
          {filtro === "todos"
            ? "Sua carteira está em dia!"
            : "Nenhum lead encontrado com este filtro."}
        </p>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>
    );
  }

  const lead = currentLead!;
  const statusInfo = statusLabels[lead.status] || { label: lead.status, color: "bg-gray-100 text-gray-800" };
  const whatsappLink = `https://wa.me/55${lead.telefone?.replace(/\D/g, "")}`;
  const diasSemContato = lead.ultimoContato
    ? Math.floor((Date.now() - new Date(lead.ultimoContato).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className="space-y-4">
      {/* Progresso */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <div className="flex justify-between text-sm text-muted-foreground mb-1">
            <span>
              Lead {currentIndex + 1} de {totalLeads}
            </span>
            <span>
              {processedCount} registrados
              {estimatedRemaining > 0 ? ` · ~${estimatedRemaining}min` : ""}
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
        <Button variant="ghost" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Filtros rápidos */}
      <div className="flex gap-2 flex-wrap">
        {[
          { value: "todos", label: "Todos" },
          { value: "aguardando", label: "Aguardando" },
          { value: "em_atendimento", label: "Em Atendimento" },
          { value: "agendado", label: "Agendados" },
          { value: "follow_up_hoje", label: "Follow-up Hoje" },
        ].map((f) => (
          <button
            key={f.value}
            onClick={() => {
              setFiltro(f.value as any);
              setCurrentIndex(0);
            }}
            className={cn(
              "px-3 py-1 rounded-full text-sm font-medium transition-colors",
              filtro === f.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Card do lead */}
      <Card className="p-0 overflow-hidden border-2 border-primary/20">
        <div className="p-6 bg-gradient-to-r from-primary/5 to-transparent">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-bold truncate">{lead.nome}</h2>
                  <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", statusInfo.color)}>
                    {statusInfo.label}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3 mt-3">
                <a
                  href={`tel:${lead.telefone}`}
                  className="flex items-center gap-2 text-2xl font-mono font-bold text-primary hover:underline"
                >
                  <Phone className="h-5 w-5" />
                  {lead.telefone}
                </a>
                <a
                  href={whatsappLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-sm text-green-600 hover:underline"
                >
                  <MessageSquare className="h-4 w-4" />
                  WhatsApp
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
            <div className="text-right space-y-1 flex-shrink-0">
              {lead.timerAtivo && (
                <Badge variant="destructive" className="text-xs">
                  <Clock className="h-3 w-3 mr-1" />
                  Timer ativo
                </Badge>
              )}
              {diasSemContato !== null && (
                <div
                  className={cn(
                    "text-xs font-medium",
                    diasSemContato > 3 ? "text-red-600" : "text-muted-foreground"
                  )}
                >
                  {diasSemContato === 0 ? "Contato hoje" : `${diasSemContato}d sem contato`}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-3 mt-4">
            {(lead.projetoNome || lead.projetoCustom) && (
              <div className="flex items-center gap-1 text-sm">
                <Home className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{lead.projetoNome || lead.projetoCustom}</span>
              </div>
            )}
            {lead.faixaRenda && (
              <div className="text-sm text-muted-foreground">
                Renda: {faixaRendaLabels[lead.faixaRenda] || lead.faixaRenda}
              </div>
            )}
            {lead.origem && (
              <Badge variant="outline" className="text-xs">
                {lead.origem.replace(/_/g, " ")}
              </Badge>
            )}
            {lead.campanha && (
              <Badge variant="outline" className="text-xs text-purple-700 border-purple-300">
                {lead.campanha}
              </Badge>
            )}
          </div>
        </div>

        {lead.observacoes && (
          <div className="px-6 py-3 bg-amber-50 border-t border-amber-100">
            <button
              className="flex items-center gap-2 text-sm font-medium text-amber-800 w-full text-left"
              onClick={() => setShowDetalhes((v) => !v)}
            >
              <Info className="h-4 w-4" />
              Observações anteriores
              {showDetalhes ? (
                <ChevronUp className="h-3 w-3 ml-auto" />
              ) : (
                <ChevronDown className="h-3 w-3 ml-auto" />
              )}
              <kbd className="ml-1 text-xs bg-amber-100 px-1.5 py-0.5 rounded">D</kbd>
            </button>
            {showDetalhes && <p className="mt-2 text-sm text-amber-900">{lead.observacoes}</p>}
          </div>
        )}

        <div className="p-6 space-y-4 border-t">
          <Textarea
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder="Observação rápida (opcional)..."
            className="min-h-[60px] text-sm resize-none"
          />

          <div className="grid grid-cols-2 gap-3">
            <Button
              size="lg"
              className="h-16 bg-green-600 hover:bg-green-700 text-white flex-col gap-1"
              onClick={() => handleRegistrar("ligacao", "contato_realizado", "em_atendimento")}
              disabled={registrarInteracao.isLoading}
            >
              <div className="flex items-center gap-2">
                <PhoneCall className="h-5 w-5" />
                <span className="font-bold">Atendeu</span>
              </div>
              <kbd className="text-xs bg-white/20 px-2 py-0.5 rounded">1</kbd>
            </Button>

            <Button
              size="lg"
              variant="destructive"
              className="h-16 flex-col gap-1"
              onClick={() => handleRegistrar("ligacao", "nao_atendeu")}
              disabled={registrarInteracao.isLoading}
            >
              <div className="flex items-center gap-2">
                <PhoneOff className="h-5 w-5" />
                <span className="font-bold">Não Atendeu</span>
              </div>
              <kbd className="text-xs bg-white/20 px-2 py-0.5 rounded">2</kbd>
            </Button>

            <Button
              size="lg"
              className="h-16 bg-purple-600 hover:bg-purple-700 text-white flex-col gap-1"
              onClick={() => handleRegistrar("ligacao", "agendamento", "agendado")}
              disabled={registrarInteracao.isLoading}
            >
              <div className="flex items-center gap-2">
                <CalendarCheck className="h-5 w-5" />
                <span className="font-bold">Agendou Visita</span>
              </div>
              <kbd className="text-xs bg-white/20 px-2 py-0.5 rounded">3</kbd>
            </Button>

            <Button
              size="lg"
              className="h-16 bg-blue-600 hover:bg-blue-700 text-white flex-col gap-1"
              onClick={() => handleRegistrar("whatsapp", "contato_realizado", "em_atendimento")}
              disabled={registrarInteracao.isLoading}
            >
              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                <span className="font-bold">Enviou WhatsApp</span>
              </div>
              <kbd className="text-xs bg-white/20 px-2 py-0.5 rounded">4</kbd>
            </Button>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => handleRegistrar("ligacao", "proposta_enviada", "analise_credito")}
              disabled={registrarInteracao.isLoading}
            >
              <Send className="h-4 w-4 mr-1" />
              Proposta Enviada
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
              onClick={() => handleRegistrar("ligacao", "recusou", "perdido")}
              disabled={registrarInteracao.isLoading}
            >
              <ThumbsDown className="h-4 w-4 mr-1" />
              Desistiu
            </Button>
            <Link href={`/leads/${lead.id}`}>
              <Button variant="outline" size="sm">
                <ExternalLink className="h-4 w-4 mr-1" />
                Ver lead
              </Button>
            </Link>
          </div>
        </div>
      </Card>

      {/* Navegação */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={handlePrev} disabled={currentIndex === 0}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Anterior
          <kbd className="ml-2 text-xs bg-muted px-1.5 py-0.5 rounded">←</kbd>
        </Button>
        <span className="text-sm text-muted-foreground">
          {currentIndex + 1} / {totalLeads}
        </span>
        <Button variant="outline" onClick={handleNext} disabled={currentIndex >= totalLeads - 1}>
          Próximo
          <kbd className="mr-2 text-xs bg-muted px-1.5 py-0.5 rounded">→</kbd>
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>

      <Card className="p-4 bg-muted/40">
        <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
          Atalhos de Teclado
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs text-muted-foreground">
          <div>
            <kbd className="px-1.5 py-0.5 bg-background rounded border">1</kbd> Atendeu
          </div>
          <div>
            <kbd className="px-1.5 py-0.5 bg-background rounded border">2</kbd> Não Atendeu
          </div>
          <div>
            <kbd className="px-1.5 py-0.5 bg-background rounded border">3</kbd> Agendou
          </div>
          <div>
            <kbd className="px-1.5 py-0.5 bg-background rounded border">4</kbd> WhatsApp
          </div>
          <div>
            <kbd className="px-1.5 py-0.5 bg-background rounded border">←/→</kbd> Navegar
          </div>
          <div>
            <kbd className="px-1.5 py-0.5 bg-background rounded border">D</kbd> Ver obs.
          </div>
        </div>
      </Card>
    </div>
  );
}

// ============================================================================
// BLOCO FOLLOW-UP DO DIA
// ============================================================================
function BlocoFollowUp() {
  const { user } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [observacoes, setObservacoes] = useState("");
  const [startTime] = useState(Date.now());
  const [processedCount, setProcessedCount] = useState(0);
  const [showFiltros, setShowFiltros] = useState(false);
  const [ordenacao, setOrdenacao] = useState<
    "mais_antigos" | "mais_recentes" | "menos_tentativas" | "mais_tentativas"
  >("mais_antigos");

  const {
    data: followUps,
    isLoading,
    refetch,
  } = trpc.followUps.getFollowUpsDoDiaExpandido.useQuery(
    { ordenacao },
    { enabled: !!user, refetchOnWindowFocus: false }
  );

  const registrarFollowUp = trpc.followUps.registrarTentativa.useMutation({
    onSuccess: () => {
      refetch();
      setProcessedCount((p) => p + 1);
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const currentLead = followUps?.[currentIndex];
  const totalLeads = followUps?.length || 0;
  const progress = totalLeads > 0 ? ((currentIndex + 1) / totalLeads) * 100 : 0;
  const elapsedMinutes = Math.floor((Date.now() - startTime) / 60000);
  const avgTime = processedCount > 0 ? elapsedMinutes / processedCount : 0;
  const estimatedRemaining = Math.ceil((totalLeads - currentIndex - 1) * avgTime);

  const handleNext = useCallback(() => {
    if (currentIndex < totalLeads - 1) {
      setCurrentIndex((i) => i + 1);
      setObservacoes("");
    }
  }, [currentIndex, totalLeads]);

  const handlePrevious = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
      setObservacoes("");
    }
  }, [currentIndex]);

  const handleRegistrar = useCallback(
    (resultado: "respondeu" | "nao_atendeu") => {
      if (!currentLead) return;
      registrarFollowUp.mutate({
        followUpId: currentLead.id,
        resultado,
        observacao: observacoes || undefined,
      });
      setTimeout(() => {
        if (currentIndex < totalLeads - 1) setCurrentIndex((i) => i + 1);
      }, 300);
    },
    [currentLead, observacoes, currentIndex, totalLeads, registrarFollowUp]
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowRight" || e.key === "Enter") {
        e.preventDefault();
        handleNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        handlePrevious();
      } else if (e.key === "1") {
        e.preventDefault();
        handleRegistrar("respondeu");
      } else if (e.key === "2") {
        e.preventDefault();
        handleRegistrar("nao_atendeu");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleNext, handlePrevious, handleRegistrar]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!followUps || followUps.length === 0) {
    return (
      <div className="text-center py-16">
        <Trophy className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
        <h3 className="text-xl font-bold mb-2">Todos os follow-ups concluídos!</h3>
        <p className="text-muted-foreground">Nenhum lead pendente de follow-up hoje.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3 text-center">
          <div className="text-2xl font-bold text-primary">{totalLeads}</div>
          <div className="text-xs text-muted-foreground">Pendentes</div>
        </Card>
        <Card className="p-3 text-center">
          <div className="text-2xl font-bold text-green-600">{processedCount}</div>
          <div className="text-xs text-muted-foreground">Registrados</div>
        </Card>
        <Card className="p-3 text-center">
          <div className="text-2xl font-bold text-orange-600">
            {estimatedRemaining > 0 ? `${estimatedRemaining}m` : "—"}
          </div>
          <div className="text-xs text-muted-foreground">Estimativa</div>
        </Card>
      </div>

      <div className="flex justify-between text-sm text-muted-foreground mb-1">
        <span>
          Lead {currentIndex + 1} de {totalLeads}
        </span>
        <button
          onClick={() => setShowFiltros((v) => !v)}
          className="flex items-center gap-1 hover:text-foreground"
        >
          <Filter className="h-3 w-3" /> Filtros
        </button>
      </div>
      <Progress value={progress} className="h-2" />

      {showFiltros && (
        <Card className="p-4">
          <label className="text-xs font-medium mb-1 block">Ordenação</label>
          <select
            value={ordenacao}
            onChange={(e) => {
              setOrdenacao(e.target.value as any);
              setCurrentIndex(0);
            }}
            className="w-full border rounded-md text-sm p-1.5"
          >
            <option value="mais_antigos">Mais antigos</option>
            <option value="mais_recentes">Mais recentes</option>
            <option value="menos_tentativas">Menos tentativas</option>
            <option value="mais_tentativas">Mais tentativas</option>
          </select>
        </Card>
      )}

      {currentLead && (
        <>
          <Card className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold mb-2">{currentLead.leadNome}</h2>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="text-base">
                    <Phone className="h-4 w-4 mr-1" />
                    {currentLead.leadTelefone}
                  </Badge>
                  {currentLead.leadEmail && (
                    <Badge variant="outline" className="text-base">
                      {currentLead.leadEmail}
                    </Badge>
                  )}
                </div>
              </div>
              <Badge variant="secondary" className="text-lg px-4 py-2">
                Follow-up do Dia
              </Badge>
            </div>

            {currentLead.leadObservacoes && (
              <div className="bg-muted p-4 rounded-lg mb-4">
                <p className="text-sm text-muted-foreground mb-1">Observações anteriores:</p>
                <p className="text-sm">{currentLead.leadObservacoes}</p>
              </div>
            )}

            <div>
              <label className="text-sm font-medium mb-2 block">Observações (opcional)</label>
              <Textarea
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Digite observações sobre este contato..."
                className="min-h-[80px]"
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-4 mt-4">
              <Button
                size="lg"
                className="h-20 text-lg"
                onClick={() => handleRegistrar("respondeu")}
                disabled={registrarFollowUp.isLoading}
              >
                <CheckCircle2 className="h-6 w-6 mr-2" />
                Respondeu
                <kbd className="ml-auto px-2 py-1 text-xs bg-background/50 rounded">1</kbd>
              </Button>
              <Button
                size="lg"
                variant="destructive"
                className="h-20 text-lg"
                onClick={() => handleRegistrar("nao_atendeu")}
                disabled={registrarFollowUp.isLoading}
              >
                <XCircle className="h-6 w-6 mr-2" />
                Não Respondeu
                <kbd className="ml-auto px-2 py-1 text-xs bg-background/50 rounded">2</kbd>
              </Button>
            </div>
          </Card>

          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={handlePrevious} disabled={currentIndex === 0}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Anterior
              <kbd className="ml-2 px-2 py-1 text-xs bg-muted rounded">←</kbd>
            </Button>
            <span className="text-sm text-muted-foreground">Use as setas para navegar</span>
            <Button
              variant="outline"
              onClick={handleNext}
              disabled={currentIndex === totalLeads - 1}
            >
              Próximo
              <kbd className="mr-2 px-2 py-1 text-xs bg-muted rounded">→</kbd>
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </>
      )}

      <Card className="p-4 bg-muted/50">
        <p className="text-sm font-medium mb-2">Atalhos de Teclado:</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-muted-foreground">
          <div>
            <kbd className="px-2 py-1 bg-background rounded">1</kbd> Respondeu
          </div>
          <div>
            <kbd className="px-2 py-1 bg-background rounded">2</kbd> Não Respondeu
          </div>
          <div>
            <kbd className="px-2 py-1 bg-background rounded">←</kbd> Anterior
          </div>
          <div>
            <kbd className="px-2 py-1 bg-background rounded">→</kbd> Próximo
          </div>
        </div>
      </Card>
    </div>
  );
}

// ============================================================================
// PÁGINA PRINCIPAL
// ============================================================================
export default function ModoBlitz() {
  const [blocoAtivo, setBlocoAtivo] = useState<BlocoAtivo>("ligacoes");

  const blocos = [
    {
      id: "ligacoes" as BlocoAtivo,
      icon: PhoneCall,
      title: "Foco em Ligações",
      description:
        "Processe sua carteira com atalhos de teclado — nome, telefone, projeto e ações em uma tela",
      color: "text-green-600",
      bg: "bg-green-50 border-green-200",
    },
    {
      id: "follow_up" as BlocoAtivo,
      icon: MessageSquare,
      title: "Follow-up do Dia",
      description: "Registre tentativas de contato dos leads pendentes de hoje",
      color: "text-blue-600",
      bg: "bg-blue-50 border-blue-200",
    },
  ];

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-yellow-100 flex items-center justify-center">
            <Zap className="h-5 w-5 text-yellow-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Modo Blitz</h1>
            <p className="text-sm text-muted-foreground">
              Selecione um bloco de foco para começar
            </p>
          </div>
        </div>

        {/* Seletor de blocos */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {blocos.map((bloco) => {
            const Icon = bloco.icon;
            const isActive = blocoAtivo === bloco.id;
            return (
              <button
                key={bloco.id}
                onClick={() => setBlocoAtivo(bloco.id)}
                className={cn(
                  "p-4 rounded-xl border-2 text-left transition-all",
                  isActive
                    ? "border-primary bg-primary/5"
                    : `${bloco.bg} hover:border-primary/40`
                )}
              >
                <div
                  className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center mb-2",
                    isActive ? "bg-primary" : bloco.bg
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4",
                      isActive ? "text-primary-foreground" : bloco.color
                    )}
                  />
                </div>
                <div
                  className={cn(
                    "font-semibold text-sm mb-1",
                    isActive ? "text-primary" : "text-foreground"
                  )}
                >
                  {bloco.title}
                </div>
                <div className="text-xs text-muted-foreground leading-snug">
                  {bloco.description}
                </div>
              </button>
            );
          })}
        </div>

        {blocoAtivo === "ligacoes" && <BlocoFocoLigacoes />}
        {blocoAtivo === "follow_up" && <BlocoFollowUp />}
      </div>
    </DashboardLayout>
  );
}

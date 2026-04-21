import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progresimport {
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
  BookOpen,
  Copy,
  Timer,
  TrendingUp,
  Star,
} from "lucide-react";,
  Timer,
  Star,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import DashboardLayout from "@/components/DashboardLayout";
import { Link } from "wouter";

type BlocoAtivo = "follow_up" | "ligacoes";

// ============================================================================
// SCRIPTS DINÂMICOS POR ESTÁGIO
// ============================================================================
const SCRIPTS_POR_ESTAGIO: Record<string, { titulo: string; script: string; dica: string }> = {
  aguardando_atendimento: {
    titulo: "Primeiro Contato — Lead Novo",
    script: `"Oi, [Nome]! Tudo bem? Aqui é [Seu Nome] da [Empresa]. Vi que você demonstrou interesse em conhecer nossos apartamentos do programa Minha Casa Minha Vida. Tenho algumas opções incríveis disponíveis! Você tem 2 minutinhos para eu te contar mais?"`,
    dica: "Ligue em até 5 minutos após o lead chegar — a chance de atendimento cai 80% após 1 hora.",
  },
  em_atendimento: {
    titulo: "Lead em Atendimento — Qualificação",
    script: `"[Nome], para eu te mostrar a melhor opção, preciso entender melhor sua situação. Você tem FGTS disponível? Qual é sua renda familiar aproximada? E você está pensando em comprar para morar ou investir? Com essas informações consigo montar uma simulação personalizada pra você agora."`,
    dica: "Foque em qualificar renda, FGTS e urgência. Sem essas 3 informações, não agende visita.",
  },
  agendado: {
    titulo: "Visita Agendada — Confirmação",
    script: `"Oi [Nome]! Aqui é [Seu Nome]. Só passando para confirmar nossa visita [dia] às [hora] no [Empreendimento]. Você consegue comparecer? Precisa de alguma informação antes? Lembre de trazer RG e CPF para já aproveitarmos e fazer a simulação no local!"`,
    dica: "Confirme no D-2 e no D-1. Visitas sem confirmação têm 60% de no-show.",
  },
  visita_realizada: {
    titulo: "Pós-Visita — Follow-up 24h",
    script: `"Oi [Nome]! Tudo bem? Aqui é [Seu Nome]. O que você achou do apartamento? Ficou com alguma dúvida? Posso te enviar a simulação de financiamento personalizada agora para você ver como fica a parcela. Qual e-mail prefere receber?"`,
    dica: "Entre em contato em até 24h após a visita. O interesse está no pico — não deixe esfriar.",
  },
  analise_credito: {
    titulo: "Análise de Crédito — Acompanhamento",
    script: `"Oi [Nome]! Aqui é [Seu Nome]. Estou acompanhando sua análise de crédito e quero garantir que tudo corra bem. Você já reuniu os documentos que pedi? [RG, CPF, comprovante de renda, extrato do FGTS]. Posso te ajudar com algum deles?"`,
    dica: "Acompanhe cada documento. Análises paradas por falta de doc são as que mais caem.",
  },
  proposta_enviada: {
    titulo: "Proposta Enviada — Tirar Dúvidas",
    script: `"Oi [Nome]! Você recebeu a proposta que enviei? Quero garantir que ficou tudo claro. Tem alguma dúvida sobre o valor da entrada, parcela ou documentação? Posso explicar cada detalhe agora mesmo."`,
    dica: "Ligue em 48h após enviar a proposta. Silêncio não é rejeição — é dúvida não respondida.",
  },
  default: {
    titulo: "Script de Contato",
    script: `"Oi [Nome]! Aqui é [Seu Nome]. Tudo bem? Estou entrando em contato sobre seu interesse em nossos imóveis. Você tem um momento para conversarmos?"`,
    dica: "Personalize a abordagem com o nome do cliente e o projeto de interesse sempre que possível.",
  },
};

function ScriptDinamico({ status }: { status: string }) {
  const [aberto, setAberto] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const script = SCRIPTS_POR_ESTAGIO[status] || SCRIPTS_POR_ESTAGIO.default;

  const copiar = () => {
    navigator.clipboard.writeText(script.script.replace(/"/g, ""));
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setAberto((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 bg-indigo-50 hover:bg-indigo-100 transition-colors text-left"
      >
        <BookOpen className="h-4 w-4 text-indigo-600 flex-shrink-0" />
        <span className="text-sm font-semibold text-indigo-800 flex-1">{script.titulo}</span>
        {aberto ? (
          <ChevronUp className="h-4 w-4 text-indigo-500" />
        ) : (
          <ChevronDown className="h-4 w-4 text-indigo-500" />
        )}
      </button>
      {aberto && (
        <div className="p-4 bg-white space-y-3">
          <div className="relative">
            <p className="text-sm text-gray-700 leading-relaxed italic pr-8">{script.script}</p>
            <button
              onClick={copiar}
              className="absolute top-0 right-0 p-1 text-gray-400 hover:text-indigo-600 transition-colors"
              title="Copiar script"
            >
              {copiado ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
          </div>
          <div className="flex items-start gap-2 bg-amber-50 rounded-md p-3">
            <Star className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800">{script.dica}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// RESUMO DA SESSÃO
// ============================================================================
function ResumoDaSessao({
  processedCount,
  startTime,
  atendimentos,
  naoAtendimentos,
  agendamentos,
  onReiniciar,
}: {
  processedCount: number;
  startTime: number;
  atendimentos: number;
  naoAtendimentos: number;
  agendamentos: number;
  onReiniciar: () => void;
}) {
  const elapsedMin = Math.max(1, Math.floor((Date.now() - startTime) / 60000));
  const avgTime = processedCount > 0 ? (elapsedMin / processedCount).toFixed(1) : "—";
  const taxaAtendimento = processedCount > 0 ? Math.round((atendimentos / processedCount) * 100) : 0;

  const mensagem =
    taxaAtendimento >= 50
      ? "Excelente sessão! Sua taxa de atendimento está acima da média."
      : agendamentos > 0
      ? `Você agendou ${agendamentos} visita${agendamentos > 1 ? "s" : ""} nessa sessão. Continue!"
      : "Sessão concluída. Persista — o próximo atendimento pode ser a venda do mês!";

  return (
    <div className="text-center py-8 space-y-6">
      <div className="w-16 h-16 rounded-full bg-yellow-100 flex items-center justify-center mx-auto">
        <Trophy className="h-8 w-8 text-yellow-600" />
      </div>
      <div>
        <h3 className="text-xl font-bold mb-1">Sessão Concluída!</h3>
        <p className="text-muted-foreground text-sm">{mensagem}</p>
      </div>
      <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto">
        <div className="bg-muted/50 rounded-xl p-4 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Timer className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-bold">{elapsedMin}min</div>
          <div className="text-xs text-muted-foreground">Tempo total</div>
        </div>
        <div className="bg-muted/50 rounded-xl p-4 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <PhoneCall className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-bold">{processedCount}</div>
          <div className="text-xs text-muted-foreground">Leads processados</div>
        </div>
        <div className="bg-green-50 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{atendimentos}</div>
          <div className="text-xs text-muted-foreground">Atenderam</div>
        </div>
        <div className="bg-purple-50 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-purple-600">{agendamentos}</div>
          <div className="text-xs text-muted-foreground">Agendamentos</div>
        </div>
        <div className="col-span-2 bg-blue-50 rounded-xl p-4 text-center">
          <div className="flex items-center justify-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            <div className="text-2xl font-bold text-blue-600">{taxaAtendimento}%</div>
          </div>
          <div className="text-xs text-muted-foreground">Taxa de atendimento · {avgTime}min/lead</div>
        </div>
      </div>
      <button
        onClick={onReiniciar}
        className="flex items-center gap-2 mx-auto px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
      >
        <RefreshCw className="h-4 w-4" />
        Nova sessão
      </button>
    </div>
  );
}

// ============================================================================
// SCRIPTS DINÂMICOS POR ESTÁGIO
// ============================================================================
const SCRIPTS_POR_ESTAGIO: Record<string, { titulo: string; script: string; dica: string }> = {
  aguardando_atendimento: {
    titulo: "Primeiro Contato — Lead Novo",
    script: `"Oi [NOME], tudo bem? Aqui é [SEU NOME] do Seu Metro Quadrado! Vi que você demonstrou interesse em [PROJETO/imóvel] — queria entender melhor o que você está buscando. Tem 2 minutinhos agora?"`,
    dica: "Ligue em até 5 minutos após receber o lead. A taxa de conversão cai 80% após 30 minutos.",
  },
  em_atendimento: {
    titulo: "Lead em Atendimento — Qualificação",
    script: `"[NOME], queria dar continuidade à nossa conversa! Você chegou a pensar mais sobre o [PROJETO]? Posso te ajudar a simular o financiamento para você ver se cabe no seu bolso — leva só 5 minutos."`,
    dica: "Foque em qualificar renda, FGTS e urgência. Pergunte: 'Você está buscando para morar ou investir?'",
  },
  agendado: {
    titulo: "Visita Agendada — Confirmação",
    script: `"Oi [NOME]! Tudo certo para nossa visita [DIA] às [HORA]? Queria confirmar para garantir que tudo esteja preparado para você. O endereço é [ENDEREÇO] — você consegue chegar tranquilo?"`,
    dica: "Confirme no D-2 e no D-1. Envie o endereço no WhatsApp com link do Google Maps.",
  },
  visita_realizada: {
    titulo: "Pós-Visita — Follow-up em 24h",
    script: `"Oi [NOME]! O que você achou do [PROJETO]? Fiquei pensando na sua situação e acho que conseguimos encaixar muito bem no seu orçamento. Posso te mandar uma simulação personalizada agora?"`,
    dica: "Entre em contato em até 24h após a visita. A proposta deve ser enviada enquanto a visita ainda está fresca na memória.",
  },
  analise_credito: {
    titulo: "Análise de Crédito — Acompanhamento",
    script: `"Oi [NOME]! Estou acompanhando sua análise de crédito — já temos algumas informações. Você tem um momento para conversarmos sobre os próximos passos do seu financiamento?"`,
    dica: "Acompanhe cada documento. O cliente precisa sentir que você está do lado dele durante todo o processo.",
  },
  novo: {
    titulo: "Lead Novo — Abordagem Inicial",
    script: `"Oi [NOME], tudo bem? Aqui é [SEU NOME] do Seu Metro Quadrado! Você demonstrou interesse em imóveis na nossa plataforma. Posso te ajudar a encontrar a melhor opção para o seu perfil?"`,
    dica: "Seja rápido e direto. Apresente-se, identifique o interesse e proponha um próximo passo concreto.",
  },
  default: {
    titulo: "Script de Reativação",
    script: `"Oi [NOME]! Aqui é [SEU NOME] do Seu Metro Quadrado. Temos novidades sobre [PROJETO] que podem te interessar — surgiu uma condição especial que acho que encaixa no que você estava buscando. Posso te contar?"`,
    dica: "Use um novo ângulo a cada reativação: nova condição, nova unidade disponível, história de outro cliente.",
  },
};

// ============================================================================
// PAINEL DE RESUMO DA SESSÃO
// ============================================================================
function ResumoDaSessao({
  processedCount,
  startTime,
  atendidos,
  naoAtendidos,
  agendados,
  onReiniciar,
}: {
  processedCount: number;
  startTime: number;
  atendidos: number;
  naoAtendidos: number;
  agendados: number;
  onReiniciar: () => void;
}) {
  const elapsedMin = Math.max(1, Math.floor((Date.now() - startTime) / 60000));
  const avgTime = processedCount > 0 ? (elapsedMin / processedCount).toFixed(1) : "—";
  const taxaAtendimento = processedCount > 0 ? Math.round((atendidos / processedCount) * 100) : 0;

  const getMensagem = () => {
    if (processedCount === 0) return "Nenhuma ligação registrada nesta sessão.";
    if (taxaAtendimento >= 50) return `Excelente sessão! Taxa de atendimento de ${taxaAtendimento}% — acima da média do mercado.`;
    if (taxaAtendimento >= 30) return `Boa sessão! ${atendidos} clientes atendidos. Continue ligando — a consistência é o segredo.`;
    return `${processedCount} ligações feitas. Cada 'não atendeu' te aproxima do próximo 'sim'. Persista!`;
  };

  return (
    <div className="space-y-4">
      <div className="text-center py-6">
        <div className="w-16 h-16 rounded-full bg-yellow-100 flex items-center justify-center mx-auto mb-4">
          <Trophy className="h-8 w-8 text-yellow-600" />
        </div>
        <h3 className="text-xl font-bold mb-1">Sessão Concluída!</h3>
        <p className="text-sm text-muted-foreground">{getMensagem()}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4 text-center">
          <div className="text-3xl font-bold text-primary">{processedCount}</div>
          <div className="text-xs text-muted-foreground mt-1">Ligações registradas</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-3xl font-bold text-blue-600">{elapsedMin}min</div>
          <div className="text-xs text-muted-foreground mt-1">Tempo total</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-3xl font-bold text-green-600">{atendidos}</div>
          <div className="text-xs text-muted-foreground mt-1">Atendidos</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-3xl font-bold text-purple-600">{agendados}</div>
          <div className="text-xs text-muted-foreground mt-1">Agendamentos</div>
        </Card>
      </div>

      <Card className="p-4 bg-muted/40">
        <div className="flex items-center gap-3">
          <Timer className="h-5 w-5 text-muted-foreground" />
          <div>
            <div className="text-sm font-medium">Média por ligação: {avgTime} min</div>
            <div className="text-xs text-muted-foreground">
              Taxa de atendimento: {taxaAtendimento}%
              {taxaAtendimento >= 40 ? " ✓ Acima da média" : " — Meta: 40%"}
            </div>
          </div>
        </div>
      </Card>

      <Button className="w-full" onClick={onReiniciar}>
        <RefreshCw className="h-4 w-4 mr-2" />
        Iniciar Nova Sessão
      </Button>
    </div>
  );
}

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
  const [atendimentos, setAtendimentos] = useState(0);
  const [naoAtendimentos, setNaoAtendimentos] = useState(0);
  const [agendamentos, setAgendamentos] = useState(0);
  const [sessaoConcluida, setSessaoConcluida] = useState(false);
  const [atendidos, setAtendidos] = useState(0);
  const [naoAtendidos, setNaoAtendidos] = useState(0);
  const [agendados, setAgendados] = useState(0);
  const [sessaoConcluida, setSessaoConcluida] = useState(false);
  const [showScript, setShowScript] = useState(false);

  const { data: leads, isLoading, refetch } = trpc.leads.getLeadsParaBlitz.useQuery(
    { filtro, limit: 100 },
    { enabled: !!user, refetchOnWindowFocus: false }
  )  const registrarInteracao = trpc.leads.registrarInteracaoBlitz.useMutation({
    onSuccess: (_, variables) => {
      setObservacoes("");
      setShowDetalhes(false);
      refetch();
      setProcessedCount((p) => p + 1);
      if (variables.resultado === "contato_realizado") setAtendimentos((p) => p + 1);
      if (variables.resultado === "nao_atendeu") setNaoAtendimentos((p) => p + 1);
      if (variables.resultado === "agendamento") setAgendamentos((p) => p + 1);
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });tato_realizado") setAtendidos((p) => p + 1);
      if (vars.resultado === "nao_atendeu") setNaoAtendidos((p) => p + 1);
      if (vars.resultado === "agendamento") { setAtendidos((p) => p + 1); setAgendados((p) => p + 1); }
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
        case "s":
          e.preventDefault();
          setShowScript((v) => !v);
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
    if (processedCount > 0 || sessaoConcluida) {
      return (
        <ResumoDaSessao
          processedCount={processedCount}
          startTime={startTime}
          atendidos={atendidos}
          naoAtendidos={naoAtendidos}
          agendados={agendados}
          onReiniciar={() => {
            setSessaoConcluida(false);
            setProcessedCount(0);
            setAtendidos(0);
            setNaoAtendidos(0);
            setAgendados(0);
            setCurrentIndex(0);
            refetch();
            if (sessaoConcluida || (!isLoading && leads && leads.length === 0 && processedCount > 0)) {
    return (
      <ResumoDaSessao
        processedCount={processedCount}
        startTime={startTime}
        atendimentos={atendimentos}
        naoAtendimentos={naoAtendimentos}
        agendamentos={agendamentos}
        onReiniciar={() => {
          setSessaoConcluida(false);
          setProcessedCount(0);
          setAtendimentos(0);
          setNaoAtendimentos(0);
          setAgendamentos(0);
          setCurrentIndex(0);
          refetch();
        }}
      />
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
  }rificar se chegou ao final da lista
  if (currentIndex >= totalLeads && processedCount > 0) {
    return (
      <ResumoDaSessao
        processedCount={processedCount}
        startTime={startTime}
        atendidos={atendidos}
        naoAtendidos={naoAtendidos}
        agendados={agendados}
        onReiniciar={() => {
          setSessaoConcluida(false);
          setProcessedCount(0);
          setAtendidos(0);
          setNaoAtendidos(0);
          setAgendados(0);
          setCurrentIndex(0);
          refetch();
        }}
      />
    );
  }

  const lead = currentLead!;
  const statusInfo = statusLabels[lead.status] || { label: lead.status, color: "bg-gray-100 text-gray-800" };
  const whatsappLink = `https://wa.me/55${lead.telefone?.replace(/\D/g, "")}`;
  const diasSemContato = lead.ultimoContato
    ? Math.floor((Date.now() - new Date(lead.ultimoContato).getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const scriptEstagio = SCRIPTS_POR_ESTAGIO[lead.status] || SCRIPTS_POR_ESTAGIO.default;

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

        {/* Script dinâmico por estágio */}
        <div className="px-6 py-3 bg-blue-50 border-t border-blue-100">
          <button
            className="flex items-center gap-2 text-sm font-medium text-blue-800 w-full text-left"
            onClick={() => setShowScript((v) => !v)}
          >
            <BookOpen className="h-4 w-4" />
            {scriptEstagio.titulo}
            {showScript ? (
              <ChevronUp className="h-3 w-3 ml-auto" />
            ) : (
              <ChevronDown className="h-3 w-3 ml-auto" />
            )}
            <kbd className="ml-1 text-xs bg-blue-100 px-1.5 py-0.5 rounded">S</kbd>
          </button>
          {showScript && (
            <div className="mt-3 space-y-2">
              <div className="relative bg-white rounded-lg p-3 border border-blue-200">
                <p className="text-sm text-blue-900 italic leading-relaxed">{scriptEstagio.script}</p>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(scriptEstagio.script.replace(/\[NOME\]/g, lead.nome || "cliente"));
                    toast.success("Script copiado!");
                  }}
                  className="absolute top-2 right-2 p-1 rounded hover:bg-blue-50"
                  title="Copiar script"
                >
                  <Copy className="h-3.5 w-3.5 text-blue-400" />
                </button>
              </div>
              <div className="flex items-start gap-2 text-xs text-blue-700">
                <Star className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-yellow-500" />
                <span>{scriptEstagio.dica}</span>
              </div>
            </div>
          )}
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

        <div className="px-6 py-3 border-t">
          <ScriptDinamico status={lead.status} />
        </div>

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
        <Button
          variant="outline"
          onClick={() => {
            if (currentIndex >= totalLeads - 1) {
              setSessaoConcluida(true);
            } else {
              handleNext();
            }
          }}
        >
          {currentIndex >= totalLeads - 1 ? "Encerrar sessão" : "Próximo"}
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
          <div>
            <kbd className="px-1.5 py-0.5 bg-background rounded border">S</kbd> Ver script
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

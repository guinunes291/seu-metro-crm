import { useState } from "react";
import { useLocation } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { gerarLinkWhatsApp } from "@/lib/whatsapp";
import {
  Zap,
  Phone,
  MessageCircle,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  FileText,
  TrendingUp,
  RefreshCw,
} from "lucide-react";

// ============================================================================
// MENSAGENS PRONTAS POR ESTÁGIO
// ============================================================================

const MENSAGENS_PRONTAS: Record<string, Array<{ label: string; texto: string }>> = {
  aguardando_atendimento: [
    {
      label: "Primeiro Contato (Facebook)",
      texto: `Olá, {nome}! Tudo bem? 😊 Vi que você demonstrou interesse em imóveis em São Paulo. Sou corretor(a) da Seu Metro Quadrado e estou aqui para te ajudar a encontrar o imóvel ideal. Posso te passar mais informações?`,
    },
    {
      label: "Primeiro Contato (Indicação)",
      texto: `Olá, {nome}! Tudo bem? 😊 Recebi seu contato através de uma indicação. Sou corretor(a) da Seu Metro Quadrado e adoraria te ajudar a realizar o sonho da casa própria. Tem um minutinho para conversar?`,
    },
    {
      label: "Reativação Rápida",
      texto: `Olá, {nome}! Tudo bem? 😊 Passando para verificar se você ainda tem interesse em imóveis em São Paulo. Temos ótimas opções com entrada facilitada e parcelas que cabem no seu bolso. Posso te apresentar?`,
    },
  ],
  em_atendimento: [
    {
      label: "Qualificação de Renda",
      texto: `Olá, {nome}! Tudo bem? 😊 Para te indicar o melhor imóvel, preciso entender melhor seu perfil. Qual é a sua renda familiar mensal? Com isso consigo calcular exatamente qual seria sua parcela e qual empreendimento se encaixa melhor para você.`,
    },
    {
      label: "Convite para Visita",
      texto: `Olá, {nome}! Tudo bem? 😊 Tenho ótimas novidades sobre os empreendimentos que conversamos! Que tal agendar uma visita para você conhecer pessoalmente? Tenho horários disponíveis essa semana. Qual dia fica melhor para você?`,
    },
    {
      label: "Follow-up D+2",
      texto: `Olá, {nome}! Tudo bem? 😊 Passando para compartilhar uma simulação personalizada para o seu perfil. Calculei que com sua renda, você pode adquirir um imóvel com parcelas a partir de R$ 800/mês. Posso te enviar os detalhes?`,
    },
    {
      label: "Reativação D+5",
      texto: `Olá, {nome}! Tudo bem? 😊 Sei que você está avaliando suas opções, e quero te contar uma novidade: acabamos de lançar um novo empreendimento com condições especiais para quem fechar esse mês. Posso te apresentar?`,
    },
    {
      label: "Última Tentativa D+10",
      texto: `Olá, {nome}! Tudo bem? 😊 Tentei entrar em contato algumas vezes e sei que você está ocupado(a). Quero deixar registrado que estou à disposição sempre que você quiser retomar a conversa sobre o imóvel. Um abraço!`,
    },
  ],
  agendado: [
    {
      label: "Confirmação D-2",
      texto: `Olá, {nome}! Tudo bem? 😊 Passando para confirmar nossa visita marcada para {data}. Você ainda consegue comparecer? Caso precise reagendar, é só me avisar com antecedência. Estou ansioso(a) para te mostrar o empreendimento!`,
    },
    {
      label: "Confirmação D-1",
      texto: `Olá, {nome}! Tudo bem? 😊 Amanhã é o grande dia da nossa visita! 🏠 Confirmo que estarei te esperando às {hora}. Lembre-se de trazer um documento com foto. Qualquer dúvida, pode me chamar. Até amanhã!`,
    },
    {
      label: "Lembrete no Dia",
      texto: `Bom dia, {nome}! 😊 Hoje é o dia da nossa visita! Te espero às {hora}. Endereço: [endereço do empreendimento]. Qualquer imprevisto, me avisa. Até logo!`,
    },
  ],
  visita_realizada: [
    {
      label: "Follow-up Pós-Visita (24h)",
      texto: `Olá, {nome}! Tudo bem? 😊 Foi um prazer te receber ontem! Espero que tenha gostado do empreendimento. Preparei uma proposta personalizada para você. Posso te enviar agora para você analisar com calma?`,
    },
    {
      label: "Envio de Proposta",
      texto: `Olá, {nome}! Tudo bem? 😊 Conforme combinado, segue a proposta personalizada para você. Com sua renda, a parcela ficaria em torno de R$ [valor]. A entrada pode ser parcelada em até [x] vezes. Posso te ligar para explicar os detalhes?`,
    },
  ],
  proposta_enviada: [
    {
      label: "Follow-up Proposta (48h)",
      texto: `Olá, {nome}! Tudo bem? 😊 Enviei a proposta há alguns dias e queria saber se você teve a oportunidade de analisar. Tem alguma dúvida que posso esclarecer? Estou à disposição para te ajudar a tomar a melhor decisão.`,
    },
    {
      label: "Urgência (Últimas Unidades)",
      texto: `Olá, {nome}! Tudo bem? 😊 Preciso te avisar que as unidades do empreendimento que conversamos estão quase todas reservadas. Restam apenas [x] unidades com as condições que te apresentei. Posso reservar a sua agora?`,
    },
    {
      label: "Tirar Objeções",
      texto: `Olá, {nome}! Tudo bem? 😊 Sei que uma decisão como essa envolve muita análise. Quero te ajudar a tirar qualquer dúvida que ainda tenha. O que está te impedindo de avançar? Posso resolver qualquer questão que surgir.`,
    },
  ],
  analise_credito: [
    {
      label: "Acompanhamento de Análise",
      texto: `Olá, {nome}! Tudo bem? 😊 Passando para informar que sua análise de crédito está em andamento. Assim que tiver novidades, te aviso imediatamente. Tem alguma dúvida sobre o processo?`,
    },
    {
      label: "Documentação Pendente",
      texto: `Olá, {nome}! Tudo bem? 😊 Para agilizar sua análise de crédito, preciso de [documento pendente]. Você consegue me enviar hoje? Quanto mais rápido recebermos, mais rápido conseguimos aprovar seu financiamento.`,
    },
  ],
};

// ============================================================================
// HELPERS
// ============================================================================

function tempoRelativo(data: Date | string | null): string {
  if (!data) return "";
  const diff = Date.now() - new Date(data).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 60) return `${min}min atrás`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h atrás`;
  return `${Math.floor(h / 24)}d atrás`;
}

function minutosRestantes(timestamp: Date | string | null): number {
  if (!timestamp) return 0;
  const TIMER_MIN = 30;
  const elapsed = (Date.now() - new Date(timestamp).getTime()) / 60000;
  return Math.max(0, Math.round(TIMER_MIN - elapsed));
}

// ============================================================================
// COMPONENTE CARD DE LEAD
// ============================================================================

function LeadCard({
  lead,
  urgente,
  timerMin,
}: {
  lead: { id: number; nome: string; telefone: string; status: string; origem?: string | null; timestampRecebimento?: Date | string | null; createdAt?: Date | string | null; updatedAt?: Date | string | null };
  urgente?: boolean;
  timerMin?: number;
}) {
  const [, navigate] = useLocation();
  const [showMensagens, setShowMensagens] = useState(false);
  const mensagens = MENSAGENS_PRONTAS[lead.status] ?? MENSAGENS_PRONTAS["em_atendimento"];

  function copiarMensagem(texto: string) {
    const personalizado = texto
      .replace("{nome}", lead.nome.split(" ")[0])
      .replace("{data}", "em breve")
      .replace("{hora}", "no horário combinado");
    navigator.clipboard.writeText(personalizado);
    toast.success("Mensagem copiada!", { description: "Cole no WhatsApp do cliente." });
  }

  const whatsappUrl = gerarLinkWhatsApp(lead.telefone, lead.nome);

  return (
    <div
      className={`rounded-xl border p-4 space-y-3 transition-all ${
        urgente
          ? "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20"
          : "border-border bg-card"
      }`}
    >
      {/* Header do card */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm truncate">{lead.nome}</span>
            {urgente && timerMin !== undefined && (
              <Badge variant="destructive" className="text-xs shrink-0">
                <Clock className="h-3 w-3 mr-1" />
                {timerMin}min
              </Badge>
            )}
            {lead.origem && (
              <Badge variant="outline" className="text-xs shrink-0">
                {lead.origem === "facebook_ads" ? "Facebook" : lead.origem}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {lead.telefone}
            {lead.createdAt && ` · ${tempoRelativo(lead.createdAt)}`}
            {lead.updatedAt && !lead.createdAt && ` · ${tempoRelativo(lead.updatedAt)}`}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="outline" className="h-8 px-2 text-green-600 border-green-200 hover:bg-green-50">
              <MessageCircle className="h-3.5 w-3.5" />
            </Button>
          </a>
          <Button
            size="sm"
            variant="outline"
            className="h-8 px-2"
            onClick={() => navigate(`/leads?id=${lead.id}`)}
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Mensagens prontas */}
      <div>
        <button
          onClick={() => setShowMensagens(!showMensagens)}
          className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
        >
          <FileText className="h-3.5 w-3.5" />
          Mensagens prontas
          {showMensagens ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>

        {showMensagens && (
          <div className="mt-2 space-y-2">
            {mensagens.map((m, i) => (
              <div key={i} className="rounded-lg border bg-muted/30 p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-foreground">{m.label}</span>
                  <button
                    onClick={() => copiarMensagem(m.texto)}
                    className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
                  >
                    <Copy className="h-3 w-3" />
                    Copiar
                  </button>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                  {m.texto.replace("{nome}", lead.nome.split(" ")[0])}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// COMPONENTE CARD DE AGENDAMENTO
// ============================================================================

function AgendamentoCard({
  ag,
}: {
  ag: {
    id: number;
    leadId: number;
    leadNome: string;
    leadTelefone: string;
    horaAgendamento: string;
    status: string;
    projetoCustom?: string | null;
  };
}) {
  const [, navigate] = useLocation();
  const whatsappUrl = gerarLinkWhatsApp(ag.leadTelefone, ag.leadNome);

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/20 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">{ag.leadNome}</span>
            <Badge className="text-xs bg-blue-600 text-white shrink-0">
              <Clock className="h-3 w-3 mr-1" />
              {ag.horaAgendamento}
            </Badge>
          </div>
          {ag.projetoCustom && (
            <p className="text-xs text-muted-foreground mt-0.5">{ag.projetoCustom}</p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="outline" className="h-8 px-2 text-green-600 border-green-200 hover:bg-green-50">
              <MessageCircle className="h-3.5 w-3.5" />
            </Button>
          </a>
          <Button
            size="sm"
            variant="outline"
            className="h-8 px-2"
            onClick={() => navigate(`/leads?id=${ag.leadId}`)}
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// PÁGINA PRINCIPAL
// ============================================================================

export default function ModeFoco() {
  const { data, isLoading, refetch } = trpc.meuNegocio.getFocoDoDia.useQuery(undefined, {
    refetchInterval: 2 * 60_000, // 2 min — reduzido de 60s para economizar recursos
  });

  const totalItens =
    (data?.leadsTimer.length ?? 0) +
    (data?.leadsAguardando.length ?? 0) +
    (data?.agendamentosHoje.length ?? 0) +
    (data?.propostasAguardando.length ?? 0) +
    (data?.analiseParada.length ?? 0);

  return (
    <DashboardLayout>
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
              <Zap className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Modo Foco do Dia</h1>
              <p className="text-sm text-muted-foreground">
                Suas prioridades de hoje · {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>

        {/* Resumo de contadores */}
        {data && (
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20 p-3 text-center">
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">{data.totalUrgente}</div>
              <div className="text-xs text-red-600/80 dark:text-red-400/80 font-medium mt-0.5">Urgente</div>
            </div>
            <div className="rounded-xl border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/20 p-3 text-center">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{data.totalHoje}</div>
              <div className="text-xs text-blue-600/80 dark:text-blue-400/80 font-medium mt-0.5">Visitas hoje</div>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20 p-3 text-center">
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{data.totalAtencao}</div>
              <div className="text-xs text-amber-600/80 dark:text-amber-400/80 font-medium mt-0.5">Atenção</div>
            </div>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />
            ))}
          </div>
        )}

        {/* Tudo em dia */}
        {!isLoading && totalItens === 0 && (
          <div className="rounded-xl border border-dashed p-12 text-center">
            <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-green-500" />
            <h3 className="font-semibold text-lg">Tudo em dia!</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Nenhuma ação urgente pendente agora. Aproveite para prospectar novos clientes.
            </p>
          </div>
        )}

        {/* SEÇÃO 1: Leads com timer ativo */}
        {(data?.leadsTimer.length ?? 0) > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              <h2 className="font-semibold text-sm text-red-600 dark:text-red-400 uppercase tracking-wide">
                Timer ativo — contato imediato
              </h2>
              <Badge variant="destructive" className="ml-auto">{data!.leadsTimer.length}</Badge>
            </div>
            <div className="space-y-3">
              {data!.leadsTimer.map((lead) => (
                <LeadCard
                  key={lead.id}
                  lead={lead}
                  urgente
                  timerMin={minutosRestantes(lead.timestampRecebimento)}
                />
              ))}
            </div>
          </section>
        )}

        {/* SEÇÃO 2: Leads aguardando atendimento */}
        {(data?.leadsAguardando.length ?? 0) > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <div className="h-2 w-2 rounded-full bg-orange-500" />
              <h2 className="font-semibold text-sm text-orange-600 dark:text-orange-400 uppercase tracking-wide">
                Aguardando primeiro contato
              </h2>
              <Badge className="ml-auto bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300 border-0">
                {data!.leadsAguardando.length}
              </Badge>
            </div>
            <div className="space-y-3">
              {data!.leadsAguardando.map((lead) => (
                <LeadCard key={lead.id} lead={lead} />
              ))}
            </div>
          </section>
        )}

        {/* SEÇÃO 3: Agendamentos de hoje */}
        {(data?.agendamentosHoje.length ?? 0) > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <div className="h-2 w-2 rounded-full bg-blue-500" />
              <h2 className="font-semibold text-sm text-blue-600 dark:text-blue-400 uppercase tracking-wide">
                Visitas de hoje
              </h2>
              <Badge className="ml-auto bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 border-0">
                {data!.agendamentosHoje.length}
              </Badge>
            </div>
            <div className="space-y-3">
              {data!.agendamentosHoje.map((ag) => (
                <AgendamentoCard key={ag.id} ag={ag} />
              ))}
            </div>
          </section>
        )}

        {/* SEÇÃO 4: Propostas aguardando resposta */}
        {(data?.propostasAguardando.length ?? 0) > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <div className="h-2 w-2 rounded-full bg-amber-500" />
              <h2 className="font-semibold text-sm text-amber-600 dark:text-amber-400 uppercase tracking-wide">
                Propostas sem resposta (+48h)
              </h2>
              <Badge className="ml-auto bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300 border-0">
                {data!.propostasAguardando.length}
              </Badge>
            </div>
            <div className="space-y-3">
              {data!.propostasAguardando.map((lead) => (
                <LeadCard key={lead.id} lead={lead} />
              ))}
            </div>
          </section>
        )}

        {/* SEÇÃO 5: Análises paradas */}
        {(data?.analiseParada.length ?? 0) > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <div className="h-2 w-2 rounded-full bg-purple-500" />
              <h2 className="font-semibold text-sm text-purple-600 dark:text-purple-400 uppercase tracking-wide">
                Análises de crédito paradas (+3 dias)
              </h2>
              <Badge className="ml-auto bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300 border-0">
                {data!.analiseParada.length}
              </Badge>
            </div>
            <div className="space-y-3">
              {data!.analiseParada.map((lead) => (
                <LeadCard key={lead.id} lead={lead} />
              ))}
            </div>
          </section>
        )}
      </div>
    </DashboardLayout>
  );
}

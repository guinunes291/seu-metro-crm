import { useLocation } from "wouter";
import { Lightbulb, ArrowRight, X, TrendingDown, Clock, AlertTriangle } from "lucide-react";
import { useState } from "react";

// ============================================================================
// TIPOS
// ============================================================================

export interface MentorAlert {
  /** Identificador único para persistir o dismiss */
  id: string;
  /** Nível de urgência */
  level: "warning" | "danger" | "info";
  /** Ícone customizado (opcional) */
  icon?: React.ReactNode;
  /** Título curto */
  title: string;
  /** Texto explicativo */
  message: string;
  /** Qual aba do guia abrir (1-6) */
  guideTab: number;
  /** Label do botão CTA */
  ctaLabel?: string;
}

interface SmartMentorBannerProps {
  alerts: MentorAlert[];
}

// ============================================================================
// CORES POR NÍVEL
// ============================================================================

const LEVEL_STYLES = {
  danger: {
    wrapper: "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800",
    icon: "text-red-500",
    title: "text-red-700 dark:text-red-400",
    message: "text-red-600 dark:text-red-300",
    badge: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
    btn: "bg-red-600 hover:bg-red-700 text-white",
    dot: "bg-red-500",
  },
  warning: {
    wrapper: "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800",
    icon: "text-amber-500",
    title: "text-amber-700 dark:text-amber-400",
    message: "text-amber-600 dark:text-amber-300",
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
    btn: "bg-amber-500 hover:bg-amber-600 text-white",
    dot: "bg-amber-500",
  },
  info: {
    wrapper: "bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800",
    icon: "text-blue-500",
    title: "text-blue-700 dark:text-blue-400",
    message: "text-blue-600 dark:text-blue-300",
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
    btn: "bg-blue-600 hover:bg-blue-700 text-white",
    dot: "bg-blue-500",
  },
};

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function SmartMentorBanner({ alerts }: SmartMentorBannerProps) {
  const [, navigate] = useLocation();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const visible = alerts.filter((a) => !dismissed.has(a.id));

  if (visible.length === 0) return null;

  // Mostra apenas o alerta mais crítico (danger > warning > info)
  const sorted = [...visible].sort((a, b) => {
    const order = { danger: 0, warning: 1, info: 2 };
    return order[a.level] - order[b.level];
  });

  const alert = sorted[0];
  const styles = LEVEL_STYLES[alert.level];

  const DefaultIcon =
    alert.level === "danger"
      ? AlertTriangle
      : alert.level === "warning"
      ? TrendingDown
      : Lightbulb;

  function handleCta() {
    navigate(`/meu-negocio/como-avaliar?tab=${alert.guideTab}`);
  }

  function handleDismiss() {
    setDismissed((prev) => new Set([...prev, alert.id]));
  }

  return (
    <div className={`relative flex items-start gap-3 rounded-xl border px-4 py-3 mb-4 ${styles.wrapper}`}>
      {/* Dot pulsante */}
      <span className={`mt-1 flex-shrink-0 h-2 w-2 rounded-full ${styles.dot} animate-pulse`} />

      {/* Ícone */}
      <div className={`flex-shrink-0 mt-0.5 ${styles.icon}`}>
        {alert.icon ?? <DefaultIcon className="h-4 w-4" />}
      </div>

      {/* Conteúdo */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold leading-tight ${styles.title}`}>
          {alert.title}
        </p>
        <p className={`text-xs mt-0.5 leading-snug ${styles.message}`}>
          {alert.message}
        </p>
      </div>

      {/* CTA */}
      <button
        onClick={handleCta}
        className={`flex-shrink-0 flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${styles.btn}`}
      >
        {alert.ctaLabel ?? "Ver dica"}
        <ArrowRight className="h-3 w-3" />
      </button>

      {/* Dismiss */}
      <button
        onClick={handleDismiss}
        className={`flex-shrink-0 p-1 rounded-md opacity-60 hover:opacity-100 transition-opacity ${styles.icon}`}
        aria-label="Fechar"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      {/* Badge contador (se houver mais alertas) */}
      {visible.length > 1 && (
        <span className={`absolute top-2 right-10 text-xs px-1.5 py-0.5 rounded-full font-medium ${styles.badge}`}>
          +{visible.length - 1}
        </span>
      )}
    </div>
  );
}

// ============================================================================
// HOOK — gera alertas para o MeuDashboard
// ============================================================================

export function useDashboardAlerts(progresso: {
  leads?: { atual: number; meta: number };
  agendamentos?: { atual: number; meta: number };
  visitas?: { atual: number; meta: number };
  propostas?: { atual: number; meta: number };
  vendas?: { atual: number; meta: number };
  receita?: { atual: number; meta: number };
} | null): MentorAlert[] {
  if (!progresso) return [];

  const alerts: MentorAlert[] = [];
  const diasRestantes = (() => {
    const hoje = new Date();
    const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    return ultimoDia.getDate() - hoje.getDate();
  })();

  // Receita abaixo de 30% da meta com menos de 20 dias restantes
  if (
    progresso.receita &&
    progresso.receita.meta > 0 &&
    progresso.receita.atual / progresso.receita.meta < 0.3 &&
    diasRestantes < 20
  ) {
    alerts.push({
      id: "receita-baixa",
      level: "danger",
      icon: <TrendingDown className="h-4 w-4" />,
      title: "Receita muito abaixo da meta",
      message: `Você está em ${Math.round((progresso.receita.atual / progresso.receita.meta) * 100)}% da meta com ${diasRestantes} dias restantes. Revise seu funil agora.`,
      guideTab: 1,
      ctaLabel: "Como recuperar",
    });
  }

  // Visitas abaixo de 50% da meta
  if (
    progresso.visitas &&
    progresso.visitas.meta > 0 &&
    progresso.visitas.atual / progresso.visitas.meta < 0.5 &&
    diasRestantes < 15
  ) {
    alerts.push({
      id: "visitas-baixas",
      level: "warning",
      icon: <Clock className="h-4 w-4" />,
      title: "Visitas abaixo do esperado",
      message: `Você realizou ${progresso.visitas.atual} de ${progresso.visitas.meta} visitas. Sem visitas, não há vendas — veja como acelerar.`,
      guideTab: 2,
      ctaLabel: "Ver estratégia",
    });
  }

  // Agendamentos abaixo de 40% da meta
  if (
    progresso.agendamentos &&
    progresso.agendamentos.meta > 0 &&
    progresso.agendamentos.atual / progresso.agendamentos.meta < 0.4 &&
    diasRestantes < 20
  ) {
    alerts.push({
      id: "agendamentos-baixos",
      level: "warning",
      title: "Agendamentos abaixo da meta",
      message: `Você agendou ${progresso.agendamentos.atual} de ${progresso.agendamentos.meta}. Seu pipeline pode secar em breve — entenda o que fazer.`,
      guideTab: 2,
      ctaLabel: "Ver pipeline",
    });
  }

  // Leads recebidos zerados
  if (
    progresso.leads &&
    progresso.leads.atual === 0 &&
    diasRestantes < 25
  ) {
    alerts.push({
      id: "sem-leads",
      level: "info",
      title: "Nenhum lead recebido ainda",
      message: "Você ainda não recebeu leads este mês. Verifique seu status de presença e se está na fila de distribuição.",
      guideTab: 1,
      ctaLabel: "Entender o dashboard",
    });
  }

  return alerts;
}

// ============================================================================
// HOOK — gera alertas para o Follow-up
// ============================================================================

export function useFollowUpAlerts(pendentes: number): MentorAlert[] {
  const alerts: MentorAlert[] = [];

  if (pendentes > 10) {
    alerts.push({
      id: "followup-acumulado",
      level: "danger",
      icon: <AlertTriangle className="h-4 w-4" />,
      title: `${pendentes} follow-ups acumulados`,
      message: "Leads sem contato por mais de 24h têm 3x menos chance de converter. Priorize os mais antigos primeiro.",
      guideTab: 3,
      ctaLabel: "Ver estratégia de follow-up",
    });
  } else if (pendentes > 5) {
    alerts.push({
      id: "followup-alto",
      level: "warning",
      title: `${pendentes} follow-ups pendentes hoje`,
      message: "Não deixe acumular. Cada dia sem contato reduz a chance de conversão. Veja a cadência ideal.",
      guideTab: 3,
      ctaLabel: "Ver cadência",
    });
  }

  return alerts;
}

// ============================================================================
// HOOK — gera alertas para Minha Evolução
// ============================================================================

export function useEvolucaoAlerts(tendencia: {
  leadsUltimo: number;
  leadsAnterior: number;
  vendasUltimo: number;
  vendasAnterior: number;
} | null): MentorAlert[] {
  if (!tendencia) return [];

  const alerts: MentorAlert[] = [];

  // Queda de leads recebidos
  if (
    tendencia.leadsAnterior > 0 &&
    tendencia.leadsUltimo < tendencia.leadsAnterior * 0.7
  ) {
    alerts.push({
      id: "queda-leads",
      level: "warning",
      title: "Queda no volume de leads",
      message: `Você recebeu ${tendencia.leadsUltimo} leads este mês vs ${tendencia.leadsAnterior} no mês anterior (-${Math.round((1 - tendencia.leadsUltimo / tendencia.leadsAnterior) * 100)}%). Verifique seu status de presença.`,
      guideTab: 6,
      ctaLabel: "Entender minha evolução",
    });
  }

  // Queda de vendas
  if (
    tendencia.vendasAnterior > 0 &&
    tendencia.vendasUltimo < tendencia.vendasAnterior
  ) {
    alerts.push({
      id: "queda-vendas",
      level: "warning",
      title: "Vendas abaixo do mês anterior",
      message: `${tendencia.vendasUltimo} venda(s) este mês vs ${tendencia.vendasAnterior} no mês anterior. Veja onde seu funil está perdendo.`,
      guideTab: 6,
      ctaLabel: "Analisar evolução",
    });
  }

  return alerts;
}

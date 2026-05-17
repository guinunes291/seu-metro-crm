import { trpc } from "../../lib/trpc.js";
import { useCurrentUser } from "../../hooks/useCurrentUser.js";
import { useSSE } from "../../hooks/useSSE.js";
import { LEAD_STATUS_LABELS, LEAD_STATUS_COLORS } from "../../lib/utils.js";
import { LEAD_STATUSES } from "../../../../shared/const.js";

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="bg-white rounded-xl border p-4">
      <p className="text-sm text-gray-500 font-medium">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${color ?? "text-gray-900"}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useCurrentUser();
  const utils = trpc.useUtils();

  const { data: stats } = trpc.leads.stats.useQuery(undefined, { staleTime: 60_000 });
  const { data: notificacoes } = trpc.notificacoes.list.useQuery(undefined, { staleTime: 30_000 });

  useSSE({
    lead_recebido: () => { utils.leads.stats.invalidate().catch(() => {}); },
    ia_priorizacao_diaria: () => { utils.notificacoes.list.invalidate().catch(() => {}); },
  });

  const priorizacao = notificacoes?.find((n) => n.tipo === "ia_priorizacao" && !n.lida);
  const prioridades = priorizacao ? (() => {
    try { return JSON.parse(priorizacao.mensagem) as Array<{ leadId: number; leadNome: string; motivo: string; acao: string }>; }
    catch { return []; }
  })() : [];

  const markRead = trpc.notificacoes.markRead.useMutation({
    onSuccess: () => utils.notificacoes.list.invalidate().catch(() => {}),
  });

  const totalAtivos = stats
    ? LEAD_STATUSES
        .filter((s) => !["perdido", "contrato_fechado", "pos_venda"].includes(s))
        .reduce((sum, s) => sum + (stats[s] ?? 0), 0)
    : 0;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Olá, {user?.name?.split(" ")[0]} 👋
        </h1>
        <p className="text-gray-500 text-sm mt-0.5">
          {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Ativos" value={totalAtivos} color="text-blue-600" />
        <StatCard label="Em Atendimento" value={stats?.em_atendimento ?? 0} color="text-orange-600" />
        <StatCard label="Agendados" value={stats?.agendado ?? 0} color="text-indigo-600" />
        <StatCard
          label="Contratos"
          value={stats?.contrato_fechado ?? 0}
          color="text-green-600"
        />
      </div>

      {/* Funil */}
      <div className="bg-white rounded-xl border p-5">
        <h2 className="font-semibold text-gray-900 mb-4">Funil de Vendas</h2>
        <div className="space-y-2">
          {LEAD_STATUSES.filter((s) => (stats?.[s] ?? 0) > 0).map((s) => {
            const count = stats?.[s] ?? 0;
            const pct = totalAtivos > 0 ? Math.round((count / totalAtivos) * 100) : 0;
            return (
              <div key={s} className="flex items-center gap-3">
                <span className="text-xs text-gray-500 w-32 shrink-0 text-right">
                  {LEAD_STATUS_LABELS[s]}
                </span>
                <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-gray-700 w-8 text-right">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* IA Priorização */}
      {prioridades.length > 0 && (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-blue-900">🤖 IA — Leads Prioritários Hoje</h2>
            <button
              onClick={() => markRead.mutate({ id: priorizacao!.id })}
              className="text-xs text-blue-600 hover:underline"
            >
              Marcar como lido
            </button>
          </div>
          <div className="space-y-2">
            {prioridades.map((p, i) => (
              <div key={p.leadId} className="bg-white rounded-lg p-3 shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold shrink-0">
                    {i + 1}
                  </span>
                  <span className="font-medium text-sm text-gray-900">{p.leadNome}</span>
                </div>
                <p className="text-xs text-gray-500 mt-1 ml-7">{p.motivo}</p>
                <p className="text-xs text-blue-700 mt-0.5 ml-7 font-medium">→ {p.acao}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Status breakdown */}
      <div className="bg-white rounded-xl border p-5">
        <h2 className="font-semibold text-gray-900 mb-4">Leads por Status</h2>
        <div className="flex flex-wrap gap-2">
          {LEAD_STATUSES.map((s) => (
            <span
              key={s}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${LEAD_STATUS_COLORS[s]}`}
            >
              {LEAD_STATUS_LABELS[s]}
              <span className="font-bold">{stats?.[s] ?? 0}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

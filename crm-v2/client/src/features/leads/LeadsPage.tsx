import { useState } from "react";
import { useLeads, useLeadSearch, useLeadStats } from "./useLeads.js";
import LeadCard from "./LeadCard.js";
import { LEAD_STATUSES } from "../../../../shared/const.js";
import { LEAD_STATUS_LABELS } from "../../lib/utils.js";
import type { LeadStatus } from "../../../../shared/const.js";

export default function LeadsPage() {
  const [statusFilter, setStatusFilter] = useState<LeadStatus | undefined>();
  const [showLixeira, setShowLixeira] = useState(false);
  const [searchMode, setSearchMode] = useState(false);

  const { leads, total, isLoading, updateStatus, registrarInteracao, moveToLixeira } = useLeads({
    status: statusFilter,
    naLixeira: showLixeira,
  });

  const { query, setQuery, results, isFetching: searchFetching } = useLeadSearch();
  const { data: stats } = useLeadStats();

  const displayLeads = searchMode && query.length >= 2 ? results : leads;

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
          <p className="text-sm text-gray-500">{total} lead{total !== 1 ? "s" : ""} na carteira</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => { setSearchMode(!searchMode); setQuery(""); }}
            className="px-3 py-2 text-sm bg-white border rounded-lg hover:bg-gray-50 transition-colors"
          >
            {searchMode ? "✕ Fechar" : "🔍 Buscar"}
          </button>
        </div>
      </div>

      {/* Stats strip */}
      {stats && !searchMode && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setStatusFilter(undefined)}
            className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              !statusFilter ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
            }`}
          >
            Todos ({Object.values(stats).reduce((a, b) => a + b, 0)})
          </button>
          {LEAD_STATUSES.filter((s) => (stats[s] ?? 0) > 0).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s === statusFilter ? undefined : s)}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                statusFilter === s
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
              }`}
            >
              {LEAD_STATUS_LABELS[s]} ({stats[s]})
            </button>
          ))}
        </div>
      )}

      {/* Search */}
      {searchMode && (
        <div className="relative">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome, telefone ou e-mail..."
            className="w-full px-4 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {searchFetching && (
            <span className="absolute right-3 top-3 text-gray-400 text-xs">Buscando...</span>
          )}
        </div>
      )}

      {/* Lixeira toggle */}
      {!searchMode && (
        <button
          onClick={() => setShowLixeira(!showLixeira)}
          className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
        >
          {showLixeira ? "← Voltar" : "🗑️ Ver Lixeira"}
        </button>
      )}

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border p-4 animate-pulse h-24" />
          ))}
        </div>
      ) : displayLeads.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-2">📭</p>
          <p className="font-medium">Nenhum lead encontrado</p>
          {statusFilter && (
            <button
              onClick={() => setStatusFilter(undefined)}
              className="mt-2 text-sm text-blue-600 hover:underline"
            >
              Limpar filtro
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {displayLeads.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              onUpdateStatus={(id, status) =>
                updateStatus({ id, status: status as LeadStatus })
              }
              onRegistrarInteracao={(leadId, tipo, resultado) =>
                registrarInteracao({ leadId, tipo: tipo as "ligacao" | "whatsapp" | "email" | "sms" | "visita" | "nota" | "outro", resultado })
              }
              onMoveToLixeira={(id) => moveToLixeira({ id })}
            />
          ))}
        </div>
      )}
    </div>
  );
}

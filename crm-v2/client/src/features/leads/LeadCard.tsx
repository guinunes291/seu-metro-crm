import { useState } from "react";
import { cn, formatPhone, diasDesde, LEAD_STATUS_LABELS, LEAD_STATUS_COLORS, TEMPERATURA_COLORS } from "../../lib/utils.js";
import { LEAD_STATUSES } from "../../../../shared/const.js";
import type { useLeads } from "./useLeads.js";

type Lead = ReturnType<typeof useLeads>["leads"][number];

interface Props {
  lead: Lead;
  onUpdateStatus: (leadId: number, status: string) => void;
  onRegistrarInteracao: (leadId: number, tipo: string, resultado: string) => void;
  onMoveToLixeira: (leadId: number) => void;
}

export default function LeadCard({ lead, onUpdateStatus, onRegistrarInteracao, onMoveToLixeira }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [interacaoTipo, setInteracaoTipo] = useState("ligacao");
  const [interacaoTexto, setInteracaoTexto] = useState("");

  const diasSem = diasDesde(lead.ultimaInteracao ?? lead.createdAt);
  const isUrgente = diasSem >= 2 && !["contrato_fechado", "perdido", "pos_venda"].includes(lead.status);

  return (
    <div
      className={cn(
        "bg-white rounded-xl border p-4 hover:shadow-md transition-shadow",
        isUrgente && "border-l-4 border-l-red-400"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-gray-900 truncate">{lead.nome}</h3>
            {lead.temperatura && (
              <span className={cn("text-xs", TEMPERATURA_COLORS[lead.temperatura])}>
                {lead.temperatura === "quente" ? "🔥" : lead.temperatura === "morno" ? "🌡️" : "❄️"}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-0.5">{formatPhone(lead.telefone)}</p>
          {lead.projetoNome && (
            <p className="text-xs text-blue-600 mt-0.5">🏗️ {lead.projetoNome}</p>
          )}
        </div>

        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", LEAD_STATUS_COLORS[lead.status])}>
            {LEAD_STATUS_LABELS[lead.status] ?? lead.status}
          </span>
          {diasSem > 0 && (
            <span className={cn("text-xs", diasSem >= 3 ? "text-red-500" : "text-gray-400")}>
              {diasSem}d sem contato
            </span>
          )}
        </div>
      </div>

      {lead.observacoes && (
        <p className="text-xs text-gray-500 mt-2 line-clamp-2">{lead.observacoes}</p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 mt-3 flex-wrap">
        <a
          href={`https://wa.me/55${lead.telefone.replace(/\D/g, "")}`}
          target="_blank"
          rel="noreferrer"
          className="text-xs px-2 py-1 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors"
        >
          WhatsApp
        </a>
        <a
          href={`tel:${lead.telefone}`}
          className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
        >
          Ligar
        </a>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs px-2 py-1 bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-100 transition-colors ml-auto"
        >
          {expanded ? "▲ Fechar" : "▼ Ações"}
        </button>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t space-y-3">
          {/* Change status */}
          <div>
            <label className="text-xs text-gray-500 font-medium block mb-1">Alterar Status</label>
            <div className="flex flex-wrap gap-1">
              {LEAD_STATUSES.filter((s) => s !== lead.status).slice(0, 6).map((s) => (
                <button
                  key={s}
                  onClick={() => onUpdateStatus(lead.id, s)}
                  className="text-xs px-2 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
                >
                  {LEAD_STATUS_LABELS[s] ?? s}
                </button>
              ))}
            </div>
          </div>

          {/* Registrar interação */}
          <div>
            <label className="text-xs text-gray-500 font-medium block mb-1">Registrar Interação</label>
            <div className="flex gap-2">
              <select
                value={interacaoTipo}
                onChange={(e) => setInteracaoTipo(e.target.value)}
                className="text-xs border rounded-lg px-2 py-1.5 bg-white"
              >
                {["ligacao", "whatsapp", "email", "nota", "visita"].map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <input
                value={interacaoTexto}
                onChange={(e) => setInteracaoTexto(e.target.value)}
                placeholder="Resultado / observação..."
                className="flex-1 text-xs border rounded-lg px-2 py-1.5"
              />
              <button
                onClick={() => {
                  if (!interacaoTexto.trim()) return;
                  onRegistrarInteracao(lead.id, interacaoTipo, interacaoTexto.trim());
                  setInteracaoTexto("");
                }}
                className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                OK
              </button>
            </div>
          </div>

          <button
            onClick={() => onMoveToLixeira(lead.id)}
            className="text-xs text-red-500 hover:text-red-700 transition-colors"
          >
            🗑️ Mover para Lixeira
          </button>
        </div>
      )}
    </div>
  );
}

import { useState } from "react";
import { QualificadorIA } from "./QualificadorIA";
import { ScriptWhatsAppIA } from "./ScriptWhatsAppIA";
import { Brain, MessageSquare } from "lucide-react";

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface Lead {
  id: number;
  nome: string;
  faixaRenda?: string | null;
  origem?: string | null;
  observacoes?: string | null;
  finalidadeImovel?: string | null;
  status?: string | null;
  projectId?: number | null;
  projetoCustom?: string | null;
}

interface ExecutandoComIAProps {
  lead: Lead;
  nomeEmpreendimento?: string; // nome resolvido do projeto
}

// ─── Ferramentas disponíveis ──────────────────────────────────────────────────

const FERRAMENTAS = [
  {
    id: "qualificador",
    label: "Qualificador",
    sublabel: "7 Dimensões",
    icon: Brain,
    color: "blue",
  },
  {
    id: "whatsapp",
    label: "Script WhatsApp",
    sublabel: "G.P.V.A.",
    icon: MessageSquare,
    color: "green",
  },
] as const;

type FerramentaId = typeof FERRAMENTAS[number]["id"];

// ─── Componente principal ─────────────────────────────────────────────────────

export function ExecutandoComIA({ lead, nomeEmpreendimento }: ExecutandoComIAProps) {
  const [ferramenta, setFerramenta] = useState<FerramentaId>("qualificador");

  return (
    <div className="space-y-4">
      {/* Barra de navegação das ferramentas */}
      <div className="flex gap-2 p-1 rounded-xl bg-muted/40 border">
        {FERRAMENTAS.map(f => {
          const Icon = f.icon;
          const isActive = ferramenta === f.id;
          const activeClass =
            f.color === "blue"
              ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
              : "bg-green-600 text-white shadow-md shadow-green-500/20";
          return (
            <button
              key={f.id}
              onClick={() => setFerramenta(f.id)}
              className={`flex items-center gap-2 flex-1 rounded-lg px-3 py-2.5 transition-all text-sm font-medium ${
                isActive ? activeClass : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              }`}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              <span className="leading-tight text-left">
                {f.label}
                <span
                  className={`block text-[10px] font-normal leading-none mt-0.5 ${
                    isActive ? "opacity-80" : "text-muted-foreground"
                  }`}
                >
                  {f.sublabel}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Conteúdo da ferramenta ativa */}
      <div>
        {ferramenta === "qualificador" && (
          <QualificadorIA
            lead={{
              id: lead.id,
              nome: lead.nome,
              faixaRenda: lead.faixaRenda,
              origem: lead.origem,
              observacoes: lead.observacoes,
              finalidadeImovel: lead.finalidadeImovel,
              status: lead.status,
            }}
          />
        )}
        {ferramenta === "whatsapp" && (
          <ScriptWhatsAppIA
            lead={{
              id: lead.id,
              nome: lead.nome,
              projetoCustom: lead.projetoCustom || undefined,
            }}
            nomeEmpreendimento={nomeEmpreendimento}
          />
        )}
      </div>
    </div>
  );
}

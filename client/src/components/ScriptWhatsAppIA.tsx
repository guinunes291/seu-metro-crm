import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { MessageSquare, Copy, Check, RefreshCw, ChevronRight } from "lucide-react";

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface Lead {
  id: number;
  nome: string;
  empreendimento?: string;
  projetoCustom?: string;
}

interface ScriptWhatsAppIAProps {
  lead: Lead;
  nomeEmpreendimento?: string; // nome resolvido do projeto
}

// ─── Dados estáticos ─────────────────────────────────────────────────────────

const STAGES = [
  { id: "novo_portal",       label: "Lead novo — portal",      emoji: "🆕" },
  { id: "novo_indicacao",    label: "Lead novo — indicação",   emoji: "🤝" },
  { id: "nao_respondeu",     label: "Não respondeu",           emoji: "👻" },
  { id: "confirmacao_visita",label: "Confirmar visita",        emoji: "📅" },
  { id: "visitou_esfriou",   label: "Visitou e esfriou",       emoji: "🧊" },
  { id: "base_fria",         label: "Base fria (30+ dias)",    emoji: "💤" },
  { id: "vou_pensar",        label: "Disse 'vou pensar'",      emoji: "🤔" },
  { id: "ultima_tentativa",  label: "Última tentativa",        emoji: "🎯" },
] as const;

type StageId = typeof STAGES[number]["id"];

const HOOKS = [
  { id: "nova_tabela",         label: "Nova tabela / condições" },
  { id: "nova_faixa",          label: "Nova faixa MCMV / subsídio" },
  { id: "novo_empreendimento", label: "Novo empreendimento" },
  { id: "prova_social",        label: "Prova social (família que fechou)" },
  { id: "sem_novidade",        label: "Sem novidade específica" },
] as const;

type HookId = typeof HOOKS[number]["id"];

// ─── Sub-componentes ─────────────────────────────────────────────────────────

function PhonePreview({ message, senderName }: { message: string; senderName: string }) {
  const initial = (senderName || "C").charAt(0).toUpperCase();
  const time = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="flex-shrink-0" style={{ width: 220 }}>
      {/* Corpo do celular */}
      <div
        className="rounded-[28px] p-2.5"
        style={{
          background: "#0a1628",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.07)",
        }}
      >
        {/* Notch */}
        <div
          className="mx-auto mb-2 rounded-b-xl"
          style={{ width: 64, height: 16, background: "#0a1628", boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.05)" }}
        />
        {/* Tela */}
        <div className="rounded-[20px] overflow-hidden" style={{ background: "#e5ddd5", minHeight: 320 }}>
          {/* Header WhatsApp */}
          <div className="flex items-center gap-2 px-3 py-2" style={{ background: "#075e54" }}>
            <div
              className="flex items-center justify-center rounded-full text-white text-xs font-bold flex-shrink-0"
              style={{ width: 28, height: 28, background: "#128c7e" }}
            >
              {initial}
            </div>
            <div>
              <div className="text-white text-[11px] font-semibold leading-tight">{senderName || "Corretor"}</div>
              <div className="text-[9px]" style={{ color: "rgba(255,255,255,0.55)" }}>online</div>
            </div>
          </div>
          {/* Área do chat */}
          <div
            className="p-2 flex-1"
            style={{
              minHeight: 260,
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23c5b8aa' fill-opacity='0.15'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }}
          >
            {message ? (
              <div
                className="rounded-[6px_6px_6px_2px] p-2 ml-1"
                style={{ background: "white", maxWidth: "90%", boxShadow: "0 1px 2px rgba(0,0,0,0.12)" }}
              >
                <p className="text-[10px] text-gray-900 leading-relaxed m-0 whitespace-pre-line" style={{ fontFamily: "'Segoe UI', sans-serif" }}>
                  {message}
                </p>
                <div className="text-[8px] text-gray-400 text-right mt-1">{time} ✓✓</div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-center p-4">
                <p className="text-[10px] text-gray-400">Preencha os dados e gere sua mensagem</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Mensagem copiada para a área de transferência!");
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Button size="sm" variant="outline" onClick={handleCopy} className="gap-1.5 text-xs">
      {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copiado!" : "Copiar"}
    </Button>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function ScriptWhatsAppIA({ lead, nomeEmpreendimento }: ScriptWhatsAppIAProps) {
  const { user } = useAuth();

  const [estagio, setEstagio] = useState<StageId | "">("");
  const [gancho, setGancho] = useState<HookId | "">("");
  const [indicador, setIndicador] = useState("");
  const [activeMsg, setActiveMsg] = useState<"principal" | "variacao">("principal");

  const gerarScript = trpc.ia.gerarScriptWhatsApp.useMutation();

  const empreendimento = nomeEmpreendimento || lead.projetoCustom || "";

  const handleGerar = () => {
    if (!estagio) {
      toast.error("Selecione o estágio do lead");
      return;
    }
    gerarScript.mutate({
      nomeCliente: lead.nome,
      estagio: estagio as StageId,
      gancho: gancho || undefined,
      empreendimento: empreendimento || undefined,
      indicador: indicador || undefined,
      nomeCorretor: user?.name || undefined,
    });
    setActiveMsg("principal");
  };

  const result = gerarScript.data;
  const loading = gerarScript.isPending;
  const error = gerarScript.error;

  return (
    <div className="space-y-5">
      {/* Cabeçalho */}
      <div className="flex items-center gap-3 pb-3 border-b">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-green-500/10">
          <MessageSquare className="h-5 w-5 text-green-600" />
        </div>
        <div>
          <h3 className="font-semibold text-sm">WhatsApp Script Pro</h3>
          <p className="text-xs text-muted-foreground">Gerador de mensagens MCMV com IA — fórmula G.P.V.A.</p>
        </div>
        <Badge variant="secondary" className="ml-auto text-[10px] bg-green-500/10 text-green-700 border-green-200">
          IA ativa
        </Badge>
      </div>

      {/* Dados pré-carregados */}
      <div className="rounded-lg bg-muted/40 border px-3 py-2.5 text-xs space-y-1">
        <p className="font-medium text-muted-foreground uppercase tracking-wide text-[10px] mb-1.5">Dados do lead (pré-carregados)</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          <span className="text-muted-foreground">Cliente:</span>
          <span className="font-medium">{lead.nome}</span>
          {empreendimento && (
            <>
              <span className="text-muted-foreground">Empreendimento:</span>
              <span className="font-medium">{empreendimento}</span>
            </>
          )}

          <span className="text-muted-foreground">Corretor:</span>
          <span className="font-medium">{user?.name || "—"}</span>
        </div>
      </div>

      {/* Seleção de estágio */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Estágio do lead *</p>
        <div className="grid grid-cols-4 gap-2">
          {STAGES.map(s => (
            <button
              key={s.id}
              onClick={() => setEstagio(s.id)}
              className={`rounded-xl p-2.5 text-center border transition-all text-xs ${
                estagio === s.id
                  ? "bg-green-500 border-green-500 text-white shadow-md shadow-green-500/20"
                  : "bg-muted/30 border-border hover:bg-muted/60"
              }`}
            >
              <div className="text-lg mb-1">{s.emoji}</div>
              <div className="font-medium leading-tight text-[10px]">{s.label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Gancho */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Gancho disponível</p>
        <div className="flex flex-wrap gap-2">
          {HOOKS.map(h => (
            <button
              key={h.id}
              onClick={() => setGancho(gancho === h.id ? "" : h.id)}
              className={`rounded-full px-3 py-1.5 text-xs border transition-all ${
                gancho === h.id
                  ? "bg-green-500/10 border-green-400 text-green-700 font-semibold"
                  : "bg-muted/30 border-border text-muted-foreground hover:bg-muted/60"
              }`}
            >
              {h.label}
            </button>
          ))}
        </div>
      </div>

      {/* Campo indicador (só aparece quando estágio é indicação) */}
      {estagio === "novo_indicacao" && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Nome de quem indicou</p>
          <input
            value={indicador}
            onChange={e => setIndicador(e.target.value)}
            placeholder="Ex: Maria"
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30"
          />
        </div>
      )}

      {/* Erro */}
      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs text-destructive">
          {error.message}
        </div>
      )}

      {/* Botão gerar */}
      <Button
        onClick={handleGerar}
        disabled={loading || !estagio}
        className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white"
      >
        {loading ? (
          <>
            <RefreshCw className="h-4 w-4 animate-spin" />
            Gerando com IA...
          </>
        ) : (
          <>
            <ChevronRight className="h-4 w-4" />
            Gerar mensagem com IA
          </>
        )}
      </Button>

      {/* Resultado */}
      {result && (
        <div className="space-y-4 pt-2">
          <div className="h-px bg-gradient-to-r from-transparent via-green-500/30 to-transparent" />

          <div className="flex gap-5 items-start flex-wrap">
            {/* Preview do celular */}
            <PhonePreview
              message={result[activeMsg]}
              senderName={user?.name || "Corretor"}
            />

            {/* Painel de mensagens */}
            <div className="flex-1 min-w-[220px] space-y-3">
              {/* Tabs principal / variação */}
              <div className="flex gap-2">
                {(["principal", "variacao"] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveMsg(tab)}
                    className={`rounded-lg px-3 py-1.5 text-xs border transition-all ${
                      activeMsg === tab
                        ? "bg-green-500/10 border-green-400 text-green-700 font-semibold"
                        : "bg-muted/30 border-border text-muted-foreground"
                    }`}
                  >
                    {tab === "principal" ? "📱 Principal" : "🔄 Variação"}
                  </button>
                ))}
              </div>

              {/* Caixa da mensagem */}
              <div className="rounded-xl border bg-muted/30 p-3 space-y-2">
                <p className="text-sm leading-relaxed whitespace-pre-line">{result[activeMsg]}</p>
                <div className="flex justify-end">
                  <CopyBtn text={result[activeMsg]} />
                </div>
              </div>

              {/* Orientação */}
              <div className="rounded-xl border border-green-200 bg-green-500/5 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-green-700 mb-1.5">💡 Orientação de uso</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{result.orientacao}</p>
              </div>

              {/* Próximos passos */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border bg-muted/20 p-2.5">
                  <p className="text-[10px] font-bold text-green-600 mb-1">✅ SE RESPONDER</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{result.proximo_passo_sim}</p>
                </div>
                <div className="rounded-xl border bg-muted/20 p-2.5">
                  <p className="text-[10px] font-bold text-amber-600 mb-1">⏳ SEM RESPOSTA</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{result.proximo_passo_nao}</p>
                </div>
              </div>

              {/* Nova mensagem */}
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs text-muted-foreground"
                onClick={() => {
                  gerarScript.reset();
                  setEstagio("");
                  setGancho("");
                  setIndicador("");
                }}
              >
                + Nova mensagem
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

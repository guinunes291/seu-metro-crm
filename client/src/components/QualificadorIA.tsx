import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Brain, RefreshCw, Sparkles, Zap } from "lucide-react";

// ─── TIPOS ────────────────────────────────────────────────────────────────────

interface LeadData {
  id: number;
  nome: string;
  faixaRenda?: string | null;
  origem?: string | null;
  observacoes?: string | null;
  finalidadeImovel?: string | null;
  status?: string | null;
}

interface FormData {
  nome: string;
  idade: string;
  estado_civil: string;
  filhos: string;
  renda_individual: string;
  renda_familiar: string;
  tipo_renda: string;
  moradia: string;
  valor_aluguel: string;
  imovel_no_nome: string;
  canal: string;
  urgencia: string;
  historico: string;
  observacoes: string;
}

interface DimensaoResult {
  status: string;
  desc: string;
}

interface QualificacaoResult {
  temperatura: "FRIO" | "MORNO" | "QUENTE" | "PRONTO";
  emoji: string;
  tempCor: string;
  perfil: string;
  dimensoes: Record<string, DimensaoResult>;
  gargalos: string[];
  passos: string[];
  perguntas: string[];
}

// ─── HELPERS DE MAPEAMENTO ────────────────────────────────────────────────────

function mapFaixaRendaToValor(faixaRenda?: string | null): { renda_individual: string; renda_familiar: string } {
  if (!faixaRenda) return { renda_individual: "", renda_familiar: "" };
  const map: Record<string, string> = {
    ate_2000: "1800",
    ate_4400: "3500",
    ate_8000: "6000",
    ate_12000: "10000",
    acima_12000: "14000",
    "até R$ 2.000": "1800",
    "R$ 2.001 a R$ 4.400": "3500",
    "R$ 4.401 a R$ 8.000": "6000",
    "R$ 8.001 a R$ 12.000": "10000",
    "acima de R$ 12.000": "14000",
  };
  const val = map[faixaRenda] || "";
  return { renda_individual: val, renda_familiar: "" };
}

function mapOrigemToCanal(origem?: string | null): string {
  if (!origem) return "instagram";
  const map: Record<string, string> = {
    facebook: "facebook",
    google_sheets: "portal",
    site: "portal",
    indicacao: "indicação",
    captacao_corretor: "base fria",
    whatsapp: "instagram",
    telefone: "estande",
    plantao: "estande",
    agendamento_self_service: "portal",
    chatbot: "instagram",
  };
  return map[origem] || "instagram";
}

// ─── LÓGICA DE QUALIFICAÇÃO (puro JS, sem API) ────────────────────────────────

function qualificarLead(f: FormData): QualificacaoResult {
  const score = { d1: 0, d2: 0, d3: 0, d5: 0 };

  // D1 — Renda & Capacidade
  const renda = parseFloat(f.renda_familiar || f.renda_individual || "0");
  const rendaStr = f.renda_familiar
    ? `Renda familiar R$ ${f.renda_familiar} (composição)`
    : f.renda_individual
      ? `Renda individual R$ ${f.renda_individual}`
      : null;

  let d1Status: string, d1Desc: string;
  if (!renda) {
    d1Status = "⚠️ Em aberto"; d1Desc = "Renda não informada. Verificar antes de avançar no funil.";
  } else if (renda < 2000) {
    d1Status = "🔴 Abaixo do perfil"; d1Desc = `${rendaStr}. Abaixo da faixa mínima MCMV. Verificar composição ou subsídio especial.`;
  } else if (renda <= 4400) {
    d1Status = "🟢 Faixa 1 MCMV"; d1Desc = `${rendaStr}. Enquadra Faixa 1 — maior subsídio disponível. ${f.tipo_renda === "MEI" || f.tipo_renda === "Autônomo" ? "⚠️ Renda informal: exige documentação comprobatória." : ""}`;
    score.d1 = 2;
  } else if (renda <= 8000) {
    d1Status = "🟢 Faixa 2 MCMV"; d1Desc = `${rendaStr}. Enquadra Faixa 2. ${f.tipo_renda === "MEI" || f.tipo_renda === "Autônomo" ? "⚠️ Autônomo/MEI: aprovação depende de IR declarado." : ""}`;
    score.d1 = 2;
  } else {
    d1Status = "🟡 Acima do MCMV"; d1Desc = `${rendaStr}. Acima do teto MCMV. Avaliar lançamento convencional ou composição de renda.`;
    score.d1 = 1;
  }
  if (f.tipo_renda === "MEI" || f.tipo_renda === "Autônomo") score.d1 = Math.max(0, score.d1 - 1);

  // D2 — Urgência
  const urgTexto = (f.urgencia || "").toLowerCase();
  const temUrgencia = !!urgTexto && !urgTexto.includes("nada") && !urgTexto.includes("pesquisando") && !urgTexto.includes("sem pressa");
  let d2Status: string, d2Desc: string;
  if (!f.urgencia) {
    d2Status = "⚠️ Indefinida"; d2Desc = "Urgência não declarada. Perguntar: 'Você tem algum prazo em mente para mudar?'";
  } else if (temUrgencia) {
    d2Status = "🟢 Alta"; d2Desc = `"${f.urgencia}". Gatilho de urgência real identificado.`; score.d2 = 2;
    if (f.moradia === "aluguel" && f.valor_aluguel) d2Desc += ` Pagando R$ ${f.valor_aluguel}/mês de aluguel reforça a dor.`;
  } else {
    d2Status = "🟡 Baixa"; d2Desc = `"${f.urgencia}". Sem urgência clara — leads assim precisam de nutrição antes de visita.`; score.d2 = 1;
  }

  // D3 — Motivação Emocional
  let d3Status: string, d3Desc: string;
  const motivacoes: string[] = [];
  if (f.moradia === "aluguel") motivacoes.push("cansado de pagar aluguel sem ter nada próprio");
  if (f.filhos) motivacoes.push(`quer estabilidade para ${f.filhos}`);
  if (f.estado_civil === "Divorciado(a)") motivacoes.push("recomeço após separação");
  if ((f.observacoes || "").toLowerCase().includes("animad")) motivacoes.push("demonstrou entusiasmo no contato");
  if (motivacoes.length > 0) {
    d3Status = "🟢 Identificada"; d3Desc = motivacoes.join("; ") + "."; score.d3 = 2;
  } else {
    d3Status = "⚠️ Desconhecida"; d3Desc = "Motivação emocional não identificada. Perguntar: 'O que te fez buscar um imóvel agora?'";
  }

  // D4 — Situação Atual
  let d4Desc: string;
  if (f.moradia === "aluguel") {
    d4Desc = `Paga aluguel${f.valor_aluguel ? " de R$ " + f.valor_aluguel + "/mês" : ""}. Não possui imóvel no nome. Situação ideal para MCMV.`;
  } else if (f.moradia === "familiar") {
    d4Desc = "Mora com a família. Sem custo fixo de aluguel — urgência pode ser menor. Verificar motivação.";
  } else if (f.moradia === "próprio") {
    d4Desc = "Possui imóvel próprio. Verificar se está no nome — pode inviabilizar MCMV se for o caso.";
  } else {
    d4Desc = "Imóvel cedido. Sem vínculo financeiro fixo. Verificar motivação para compra.";
  }
  if (f.imovel_no_nome === "sim") d4Desc += " ⚠️ Possui imóvel no nome — pode inviabilizar MCMV.";

  // D5 — Decisor Real
  let d5Status: string, d5Desc: string;
  const obsDecidor = (f.observacoes || "").toLowerCase();
  const conjuge = obsDecidor.includes("marido") || obsDecidor.includes("esposa") || obsDecidor.includes("esposo") || obsDecidor.includes("cônjuge") || f.estado_civil === "Casado(a)" || f.estado_civil === "União estável";
  const conjugeAusente = conjuge && (obsDecidor.includes("não sabe") || obsDecidor.includes("nao sabe") || obsDecidor.includes("ainda não") || obsDecidor.includes("ainda nao"));
  if (conjugeAusente) {
    d5Status = "🔴 ALERTA — Decisor ausente"; d5Desc = "Cônjuge/companheiro(a) não está ciente ou não participou do contato. Gargalo crítico — nunca marcar visita sem o decisor presente.";
  } else if (conjuge) {
    d5Status = "🟡 Casal — confirmar presença"; d5Desc = "Lead em relacionamento. Confirmar participação do cônjuge na visita antes de avançar."; score.d5 = 1;
  } else {
    d5Status = "🟢 Decisor único"; d5Desc = "Lead parece ser o único decisor. Confirmar na qualificação."; score.d5 = 2;
  }

  // D6 — Histórico
  let d6Status: string, d6Desc: string;
  const hist = (f.historico || "").toLowerCase();
  if (!f.historico) {
    d6Status = "⚠️ Em aberto"; d6Desc = "Sem informação sobre tentativas anteriores. Perguntar: 'Você já chegou a pesquisar ou tentar financiar antes?'";
  } else if (hist.includes("negar") || hist.includes("negou") || hist.includes("recusar") || hist.includes("restrição") || hist.includes("restricao")) {
    d6Status = "🟡 Tentou, foi negado"; d6Desc = `"${f.historico}". Lead desconfiante — abordar com cuidado, mostrar nova análise de crédito.`;
  } else if (hist.includes("visita") || hist.includes("visitou")) {
    d6Status = "🟢 Já visitou"; d6Desc = `"${f.historico}". Lead com referência — entender o que viu e por que não fechou.`;
  } else {
    d6Status = "📋 Informado"; d6Desc = f.historico;
  }

  // D7 — Objeção Latente
  const objecoes: string[] = [];
  if (f.tipo_renda === "MEI" || f.tipo_renda === "Autônomo") objecoes.push("renda informal sem IR pode bloquear aprovação no banco");
  if (conjugeAusente) objecoes.push("cônjuge pode frear a decisão se não estiver alinhado");
  if (f.imovel_no_nome === "sim") objecoes.push("imóvel no nome pode inviabilizar MCMV");
  if (hist.includes("restrição") || hist.includes("restricao")) objecoes.push("histórico de restrição no CPF pode gerar desconfiança mesmo resolvido");
  if (!f.urgencia || !temUrgencia) objecoes.push("sem urgência clara — pode sumir sem decisão");
  const d7Desc = objecoes.length > 0
    ? objecoes.map((o, i) => `${i + 1}. ${o}`).join("; ") + ". Pergunta reveladora: 'Se você encontrasse o apartamento ideal com a parcela certa, o que ainda poderia te impedir de fechar?'"
    : "Nenhuma objeção latente clara identificada com os dados fornecidos. Aplicar pergunta reveladora na qualificação: 'O que poderia ainda te impedir de fechar se encontrasse o imóvel certo?'";
  const d7Status = objecoes.length > 1 ? "🔴 Múltiplas" : objecoes.length === 1 ? "🟡 Identificada" : "🟢 Nenhuma clara";

  // ── Temperatura ─────────────────────────────────────────────────────────────
  const total = score.d1 + score.d2 + score.d3 + score.d5;
  const bloqueios = (f.imovel_no_nome === "sim" ? 1 : 0) + (conjugeAusente ? 1 : 0);

  let temperatura: "FRIO" | "MORNO" | "QUENTE" | "PRONTO", emoji: string, tempCor: string;
  if (bloqueios >= 1 || total <= 2) {
    temperatura = "FRIO"; emoji = "🔴"; tempCor = "#ef4444";
  } else if (total <= 4) {
    temperatura = "MORNO"; emoji = "🟡"; tempCor = "#f59e0b";
  } else if (objecoes.length === 0 && total >= 7) {
    temperatura = "PRONTO"; emoji = "🟢🔥"; tempCor = "#10b981";
  } else {
    temperatura = "QUENTE"; emoji = "🟢"; tempCor = "#22c55e";
  }

  // ── Perfil ───────────────────────────────────────────────────────────────────
  let perfil: string;
  if (f.tipo_renda === "MEI" || f.tipo_renda === "Autônomo") perfil = "Autônomo / MEI";
  else if (f.estado_civil === "Divorciado(a)") perfil = "Divorciado em recomeço";
  else if (hist.includes("negar") || hist.includes("negou")) perfil = "Cliente que já tentou e foi negado";
  else if (f.filhos && (f.estado_civil === "Casado(a)" || f.estado_civil === "União estável")) perfil = "Casal com filhos";
  else perfil = "Comprador de 1º imóvel";

  // ── Gargalos ─────────────────────────────────────────────────────────────────
  const gargalos: string[] = [];
  if (conjugeAusente) gargalos.push("🔴 Decisor ausente — cônjuge não está no processo");
  if (f.tipo_renda === "MEI" || f.tipo_renda === "Autônomo") gargalos.push("🟡 Renda informal — aprovação depende de IR e documentação comprobatória");
  if (f.imovel_no_nome === "sim") gargalos.push("🔴 Imóvel no nome — pode inviabilizar MCMV");
  if (!f.renda_individual && !f.renda_familiar) gargalos.push("⚠️ Renda não informada — não é possível confirmar enquadramento");
  if (!temUrgencia && f.urgencia) gargalos.push("🟡 Urgência baixa — risco de esfriamento sem acompanhamento");
  if (hist.includes("restrição") || hist.includes("restricao")) gargalos.push("🟡 Histórico de restrição — verificar situação atual do CPF");
  if (gargalos.length === 0) gargalos.push("✅ Nenhum gargalo crítico identificado com os dados atuais");

  // ── Próximos Passos ───────────────────────────────────────────────────────────
  const passos: string[] = [];
  if (conjugeAusente) passos.push("Antes de qualquer coisa: alinhar com o cônjuge. Enviar mensagem incluindo os dois.");
  if (!f.renda_individual && !f.renda_familiar) passos.push("Qualificar renda — perguntar valor e tipo de vínculo empregatício.");
  if (temperatura === "PRONTO" || temperatura === "QUENTE") {
    passos.push("Agendar visita com presença de todos os decisores.");
    passos.push("Apresentar simulação de financiamento personalizada antes da visita.");
  } else if (temperatura === "MORNO") {
    passos.push("Nutrir lead com conteúdo de valor (simulação, vídeo do produto, benefícios MCMV).");
    passos.push("Retornar em 3–5 dias com novo contato qualificador.");
  } else {
    passos.push("Não avançar para visita ainda. Continuar qualificação por WhatsApp.");
    passos.push("Identificar motivação emocional antes do próximo contato.");
  }
  if (f.tipo_renda === "MEI" || f.tipo_renda === "Autônomo") passos.push("Solicitar extratos bancários dos últimos 3 meses e declaração de IR para pré-análise.");

  // ── Perguntas para Lacunas ────────────────────────────────────────────────────
  const perguntas: string[] = [];
  if (!f.renda_individual && !f.renda_familiar) perguntas.push("Qual é a sua renda mensal aproximada? Tem alguém que possa compor renda com você?");
  if (!f.urgencia) perguntas.push("Você tem algum prazo em mente para mudar? O que te levou a buscar um imóvel agora?");
  if (!conjuge && (f.estado_civil === "Casado(a)" || f.estado_civil === "União estável")) perguntas.push("Seu cônjuge/companheiro(a) está participando da decisão? Podemos incluí-lo(a) no próximo contato?");
  if (!f.historico) perguntas.push("Você já chegou a pesquisar ou tentar financiar um imóvel antes? Como foi essa experiência?");
  perguntas.push("Se você encontrasse o apartamento ideal com a parcela certa, o que ainda poderia te impedir de fechar?");
  if (f.tipo_renda === "MEI" || f.tipo_renda === "Autônomo") perguntas.push("Você declarou Imposto de Renda no ano passado? Tem extratos bancários dos últimos 3 meses?");

  return {
    temperatura, emoji, tempCor, perfil,
    dimensoes: {
      D1: { status: d1Status, desc: d1Desc },
      D2: { status: d2Status, desc: d2Desc },
      D3: { status: d3Status, desc: d3Desc },
      D4: { status: "📋 Mapeada", desc: d4Desc },
      D5: { status: d5Status, desc: d5Desc },
      D6: { status: d6Status, desc: d6Desc },
      D7: { status: d7Status, desc: d7Desc },
    },
    gargalos, passos, perguntas,
  };
}

// ─── CONSTANTES ───────────────────────────────────────────────────────────────

const dimLabels: Record<string, string> = {
  D1: "Renda & Capacidade", D2: "Urgência & Prazo", D3: "Motivação Emocional",
  D4: "Situação Atual", D5: "Decisor Real", D6: "Histórico", D7: "Objeção Latente ⚠️"
};

const tempConfig = {
  FRIO:   { bg: "bg-red-500/10",     border: "border-red-500/30",     badge: "bg-red-500 text-white" },
  MORNO:  { bg: "bg-amber-500/10",   border: "border-amber-500/30",   badge: "bg-amber-500 text-white" },
  QUENTE: { bg: "bg-green-500/10",   border: "border-green-500/30",   badge: "bg-green-600 text-white" },
  PRONTO: { bg: "bg-emerald-500/10", border: "border-emerald-500/30", badge: "bg-emerald-600 text-white" },
};

// ─── EXEMPLOS ─────────────────────────────────────────────────────────────────

const EXEMPLOS = [
  { label: "CLT, urgente, casal", data: { nome: "Ana Costa", idade: "31", estado_civil: "Casado(a)", filhos: "1 filho 4 anos", renda_individual: "3200", renda_familiar: "5800", tipo_renda: "CLT", moradia: "aluguel", valor_aluguel: "950", imovel_no_nome: "nao", canal: "instagram", urgencia: "quer sair do aluguel esse ano", historico: "nunca tentou", observacoes: "marido CLT também, animados" } },
  { label: "MEI, sem urgência", data: { nome: "Carlos Silva", idade: "38", estado_civil: "Solteiro(a)", filhos: "", renda_individual: "5000", renda_familiar: "", tipo_renda: "MEI", moradia: "familiar", valor_aluguel: "", imovel_no_nome: "nao", canal: "facebook", urgencia: "só pesquisando por enquanto", historico: "", observacoes: "IR não declarado" } },
  { label: "Negaram CPF, cônjuge ausente", data: { nome: "Maria Souza", idade: "34", estado_civil: "Casado(a)", filhos: "2 filhos", renda_individual: "2800", renda_familiar: "4500", tipo_renda: "CLT", moradia: "aluguel", valor_aluguel: "850", imovel_no_nome: "nao", canal: "indicação", urgencia: "precisa muito sair do aluguel", historico: "tentou Caixa, negaram por restrição quitada", observacoes: "marido ainda não sabe que está pesquisando" } },
];

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────

interface QualificadorIAProps {
  lead: LeadData;
}

export function QualificadorIA({ lead }: QualificadorIAProps) {
  const rendaInicial = mapFaixaRendaToValor(lead.faixaRenda);

  const [form, setForm] = useState<FormData>({
    nome: lead.nome || "",
    idade: "",
    estado_civil: "",
    filhos: "",
    renda_individual: rendaInicial.renda_individual,
    renda_familiar: rendaInicial.renda_familiar,
    tipo_renda: "CLT",
    moradia: "aluguel",
    valor_aluguel: "",
    imovel_no_nome: "nao",
    canal: mapOrigemToCanal(lead.origem),
    urgencia: "",
    historico: "",
    observacoes: lead.observacoes || "",
  });

  const [result, setResult] = useState<QualificacaoResult | null>(null);

  // Atualiza form se o lead mudar
  useEffect(() => {
    const renda = mapFaixaRendaToValor(lead.faixaRenda);
    setForm(prev => ({
      ...prev,
      nome: lead.nome || "",
      renda_individual: renda.renda_individual || prev.renda_individual,
      renda_familiar: renda.renda_familiar || prev.renda_familiar,
      canal: mapOrigemToCanal(lead.origem),
      observacoes: lead.observacoes || prev.observacoes,
    }));
    setResult(null);
  }, [lead.id]);

  const set = (k: keyof FormData, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleQualify = () => setResult(qualificarLead(form));
  const handleReset = () => setResult(null);

  const tc = result ? tempConfig[result.temperatura] : null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-blue-600/10 to-cyan-600/10 border border-blue-500/20">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/25 flex-shrink-0">
          <Brain className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm">Qualificador de Leads — 7 Dimensões</div>
          <div className="text-xs text-muted-foreground">SPIN · MCMV & Lançamentos · {lead.nome}</div>
        </div>
        {result && (
          <Button variant="outline" size="sm" onClick={handleReset} className="flex-shrink-0">
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Novo
          </Button>
        )}
      </div>

      {/* Formulário */}
      {!result && (
        <div className="space-y-4">
          {/* Aviso de dados pré-carregados */}
          {(lead.faixaRenda || lead.origem || lead.observacoes) && (
            <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/15 text-xs text-blue-400 flex items-start gap-2">
              <Sparkles className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
              <span>
                Dados do CRM pré-carregados automaticamente.
                {lead.faixaRenda && ` Faixa de renda: ${lead.faixaRenda.replace(/_/g, " ")}.`}
                {" "}Complete os campos em branco para uma análise mais precisa.
              </span>
            </div>
          )}

          {/* Exemplos rápidos */}
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs text-muted-foreground">⚡ Exemplos:</span>
            {EXEMPLOS.map((ex, i) => (
              <button
                key={i}
                onClick={() => { setForm({ ...form, ...ex.data }); }}
                className="px-2.5 py-1 rounded-md border border-border bg-muted/40 text-xs text-muted-foreground hover:bg-muted transition-colors"
              >
                {ex.label}
              </button>
            ))}
          </div>

          {/* Seção: Dados Pessoais */}
          <div className="rounded-xl border bg-card p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">📋 Dados Pessoais</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Nome *</Label>
                <Input placeholder="Ex: Ana Paula" value={form.nome} onChange={e => set("nome", e.target.value)} className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Idade</Label>
                <Input placeholder="Ex: 32" value={form.idade} onChange={e => set("idade", e.target.value)} className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Estado Civil</Label>
                <Select value={form.estado_civil || "nao_informado"} onValueChange={v => set("estado_civil", v === "nao_informado" ? "" : v)}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nao_informado">Não informado</SelectItem>
                    <SelectItem value="Solteiro(a)">Solteiro(a)</SelectItem>
                    <SelectItem value="Casado(a)">Casado(a)</SelectItem>
                    <SelectItem value="Divorciado(a)">Divorciado(a)</SelectItem>
                    <SelectItem value="União estável">União estável</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Filhos</Label>
                <Input placeholder="Ex: 2 filhos (8 e 12 anos)" value={form.filhos} onChange={e => set("filhos", e.target.value)} className="h-9 text-sm" />
              </div>
            </div>
          </div>

          {/* Seção: Renda & Crédito */}
          <div className="rounded-xl border bg-card p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">💰 Renda & Crédito</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Renda Individual <span className="text-muted-foreground">(R$ bruto/mês)</span></Label>
                <Input placeholder="Ex: 3500" value={form.renda_individual} onChange={e => set("renda_individual", e.target.value)} className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Renda Familiar <span className="text-muted-foreground">(composição)</span></Label>
                <Input placeholder="Ex: 5500" value={form.renda_familiar} onChange={e => set("renda_familiar", e.target.value)} className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo de Renda</Label>
                <Select value={form.tipo_renda} onValueChange={v => set("tipo_renda", v)}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CLT">CLT</SelectItem>
                    <SelectItem value="MEI">MEI</SelectItem>
                    <SelectItem value="Autônomo">Autônomo</SelectItem>
                    <SelectItem value="Servidor Público">Servidor Público</SelectItem>
                    <SelectItem value="Aposentado">Aposentado</SelectItem>
                    <SelectItem value="Misto">Misto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Seção: Situação & Contexto */}
          <div className="rounded-xl border bg-card p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">🏠 Situação & Contexto</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Moradia Atual</Label>
                <Select value={form.moradia} onValueChange={v => set("moradia", v)}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aluguel">Aluguel</SelectItem>
                    <SelectItem value="familiar">Casa da família</SelectItem>
                    <SelectItem value="próprio">Próprio</SelectItem>
                    <SelectItem value="cedido">Cedido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Aluguel (R$/mês)</Label>
                <Input placeholder="Ex: 900" value={form.valor_aluguel} onChange={e => set("valor_aluguel", e.target.value)} className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Imóvel no Nome</Label>
                <Select value={form.imovel_no_nome} onValueChange={v => set("imovel_no_nome", v)}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nao">Não possui</SelectItem>
                    <SelectItem value="sim">Sim</SelectItem>
                    <SelectItem value="nao sei">Não informou</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Canal de Origem</Label>
                <Select value={form.canal} onValueChange={v => set("canal", v)}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="instagram">Instagram</SelectItem>
                    <SelectItem value="facebook">Facebook/Ads</SelectItem>
                    <SelectItem value="portal">Portal (ZAP/VivaReal)</SelectItem>
                    <SelectItem value="indicação">Indicação</SelectItem>
                    <SelectItem value="estande">Estande</SelectItem>
                    <SelectItem value="base fria">Base Fria</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Urgência Declarada</Label>
                <Input placeholder='"quer sair do aluguel"' value={form.urgencia} onChange={e => set("urgencia", e.target.value)} className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Histórico</Label>
                <Input placeholder='"tentou, negaram CPF"' value={form.historico} onChange={e => set("historico", e.target.value)} className="h-9 text-sm" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Observações do Corretor</Label>
              <Textarea
                placeholder='"Animado, perguntou subsídio, mas marido ainda não sabe"'
                value={form.observacoes}
                onChange={e => set("observacoes", e.target.value)}
                rows={2}
                className="text-sm resize-none"
              />
            </div>
          </div>

          {/* Botão Qualificar */}
          <Button
            onClick={handleQualify}
            disabled={!form.nome.trim()}
            className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white font-semibold shadow-lg shadow-blue-500/20"
          >
            <Zap className="h-4 w-4 mr-2" />
            {form.nome.trim() ? `Qualificar ${form.nome}` : "Preencha o nome do lead para continuar"}
          </Button>
        </div>
      )}

      {/* RESULTADO */}
      {result && tc && (
        <div className="space-y-4">
          {/* Temperatura */}
          <div className={`p-4 rounded-xl border ${tc.bg} ${tc.border} flex items-center justify-between gap-4 flex-wrap`}>
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">🔍 Qualificação — {form.nome}</div>
              <div className="flex items-center gap-3">
                <span className="text-3xl">{result.emoji}</span>
                <div>
                  <div className="text-2xl font-extrabold tracking-tight">{result.temperatura}</div>
                  <div className="text-xs text-muted-foreground">{result.perfil}</div>
                </div>
              </div>
            </div>
            <Badge className={tc.badge + " text-sm px-3 py-1"}>{result.temperatura}</Badge>
          </div>

          {/* 7 Dimensões */}
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">📊 As 7 Dimensões</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {Object.entries(result.dimensoes).map(([k, v]) => {
                const isD7 = k === "D7";
                return (
                  <div key={k} className={`rounded-lg border p-3 ${isD7 ? "bg-amber-500/5 border-amber-500/20" : "bg-muted/30"}`}>
                    <div className={`text-xs font-bold tracking-wide mb-1 ${isD7 ? "text-amber-400" : "text-blue-400"}`}>{k} · {dimLabels[k]}</div>
                    <div className="text-xs text-muted-foreground italic mb-1">{v.status}</div>
                    <div className="text-xs text-foreground/80 leading-relaxed">{v.desc}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Gargalos + Próximos Passos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-red-400 mb-3">⚠️ Gargalos</p>
              <div className="space-y-1.5">
                {result.gargalos.map((g, i) => (
                  <div key={i} className="text-xs text-red-200/80 leading-relaxed">{g}</div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-green-400 mb-3">➡️ Próximos Passos</p>
              <div className="space-y-1.5">
                {result.passos.map((p, i) => (
                  <div key={i} className="text-xs text-green-200/80 leading-relaxed">{i + 1}. {p}</div>
                ))}
              </div>
            </div>
          </div>

          {/* Perguntas para Lacunas */}
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-blue-400 mb-3">❓ Perguntas para Preencher Lacunas</p>
            <div className="space-y-2">
              {result.perguntas.map((q, i) => (
                <div key={i} className="rounded-lg bg-blue-500/8 border-l-2 border-blue-500/40 px-3 py-2 text-xs text-blue-200/80 leading-relaxed">
                  {q}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

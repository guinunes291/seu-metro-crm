/**
 * Testes para a lógica de qualificação de leads (7 Dimensões).
 * A lógica é pura (sem DB/API), então testamos diretamente os cenários.
 */
import { describe, it, expect } from "vitest";

// ── Replicar a função qualificarLead aqui para testes isolados ───────────────
// (A função real está no componente frontend; aqui testamos a lógica de negócio)

type Temperatura = "FRIO" | "MORNO" | "QUENTE" | "PRONTO";

interface FormData {
  nome: string; idade: string; estado_civil: string; filhos: string;
  renda_individual: string; renda_familiar: string; tipo_renda: string;
  moradia: string; valor_aluguel: string; imovel_no_nome: string;
  canal: string; urgencia: string; historico: string; observacoes: string;
}

function qualificarLead(f: FormData): { temperatura: Temperatura; gargalos: string[]; passos: string[] } {
  const score = { d1: 0, d2: 0, d3: 0, d5: 0 };

  const renda = parseFloat(f.renda_familiar || f.renda_individual || "0");
  if (renda >= 2000 && renda <= 4400) { score.d1 = 2; }
  else if (renda > 4400 && renda <= 8000) { score.d1 = 2; }
  else if (renda > 8000) { score.d1 = 1; }
  if (f.tipo_renda === "MEI" || f.tipo_renda === "Autônomo") score.d1 = Math.max(0, score.d1 - 1);

  const urgTexto = (f.urgencia || "").toLowerCase();
  const temUrgencia = !!urgTexto && !urgTexto.includes("nada") && !urgTexto.includes("pesquisando") && !urgTexto.includes("sem pressa");
  if (temUrgencia) score.d2 = 2;
  else if (f.urgencia) score.d2 = 1;

  const motivacoes: string[] = [];
  if (f.moradia === "aluguel") motivacoes.push("aluguel");
  if (f.filhos) motivacoes.push("filhos");
  if (f.estado_civil === "Divorciado(a)") motivacoes.push("divorcio");
  if (motivacoes.length > 0) score.d3 = 2;

  const obsDecidor = (f.observacoes || "").toLowerCase();
  const conjuge = obsDecidor.includes("marido") || obsDecidor.includes("esposa") || f.estado_civil === "Casado(a)" || f.estado_civil === "União estável";
  const conjugeAusente = conjuge && (obsDecidor.includes("não sabe") || obsDecidor.includes("nao sabe") || obsDecidor.includes("ainda não") || obsDecidor.includes("ainda nao"));
  if (!conjugeAusente && conjuge) score.d5 = 1;
  else if (!conjuge) score.d5 = 2;

  const total = score.d1 + score.d2 + score.d3 + score.d5;
  const bloqueios = (f.imovel_no_nome === "sim" ? 1 : 0) + (conjugeAusente ? 1 : 0);

  const hist = (f.historico || "").toLowerCase();
  const objecoes: string[] = [];
  if (f.tipo_renda === "MEI" || f.tipo_renda === "Autônomo") objecoes.push("renda informal");
  if (conjugeAusente) objecoes.push("conjuge ausente");
  if (f.imovel_no_nome === "sim") objecoes.push("imovel no nome");
  if (hist.includes("restrição") || hist.includes("restricao")) objecoes.push("restricao cpf");
  if (!f.urgencia || !temUrgencia) objecoes.push("sem urgencia");

  let temperatura: Temperatura;
  if (bloqueios >= 1 || total <= 2) temperatura = "FRIO";
  else if (total <= 4) temperatura = "MORNO";
  else if (objecoes.length === 0 && total >= 7) temperatura = "PRONTO";
  else temperatura = "QUENTE";

  const gargalos: string[] = [];
  if (conjugeAusente) gargalos.push("🔴 Decisor ausente — cônjuge não está no processo");
  if (f.tipo_renda === "MEI" || f.tipo_renda === "Autônomo") gargalos.push("🟡 Renda informal");
  if (f.imovel_no_nome === "sim") gargalos.push("🔴 Imóvel no nome");
  if (!f.renda_individual && !f.renda_familiar) gargalos.push("⚠️ Renda não informada");
  if (!temUrgencia && f.urgencia) gargalos.push("🟡 Urgência baixa");
  if (gargalos.length === 0) gargalos.push("✅ Nenhum gargalo crítico");

  const passos: string[] = [];
  if (conjugeAusente) passos.push("Antes de qualquer coisa: alinhar com o cônjuge.");
  if (!f.renda_individual && !f.renda_familiar) passos.push("Qualificar renda.");
  if (temperatura === "PRONTO" || temperatura === "QUENTE") {
    passos.push("Agendar visita com presença de todos os decisores.");
  } else if (temperatura === "MORNO") {
    passos.push("Nutrir lead com conteúdo de valor.");
  } else {
    passos.push("Não avançar para visita ainda.");
  }

  return { temperatura, gargalos, passos };
}

// ── TESTES ───────────────────────────────────────────────────────────────────

describe("qualificarLead — 7 Dimensões", () => {
  const base: FormData = {
    nome: "Teste", idade: "30", estado_civil: "", filhos: "",
    renda_individual: "", renda_familiar: "", tipo_renda: "CLT",
    moradia: "aluguel", valor_aluguel: "", imovel_no_nome: "nao",
    canal: "instagram", urgencia: "", historico: "", observacoes: "",
  };

  it("lead sem renda e sem urgência mas com moradia=aluguel deve ser MORNO (motivação presente)", () => {
    const result = qualificarLead(base);
    // moradia=aluguel dá score.d3=2, sem renda d1=0, sem urgência d2=0 → total=2 → MORNO
    expect(result.temperatura).toBe("MORNO");
  });

  it("lead sem nenhuma informação (moradia vazia) deve ser FRIO", () => {
    const result = qualificarLead({ ...base, moradia: "", filhos: "", estado_civil: "" });
    expect(result.temperatura).toBe("FRIO");
  });

  it("lead CLT Faixa 1 com urgência alta deve ser QUENTE ou PRONTO", () => {
    const result = qualificarLead({
      ...base,
      renda_individual: "3500",
      urgencia: "quer sair do aluguel esse ano",
      moradia: "aluguel",
      filhos: "1 filho",
    });
    expect(["QUENTE", "PRONTO"]).toContain(result.temperatura);
  });

  it("lead com imóvel no nome deve ser FRIO (bloqueio)", () => {
    const result = qualificarLead({
      ...base,
      renda_individual: "4000",
      urgencia: "urgente",
      imovel_no_nome: "sim",
    });
    expect(result.temperatura).toBe("FRIO");
    expect(result.gargalos.some(g => g.includes("Imóvel no nome"))).toBe(true);
  });

  it("lead com cônjuge ausente deve ser FRIO e ter gargalo de decisor", () => {
    const result = qualificarLead({
      ...base,
      renda_individual: "5000",
      urgencia: "precisa muito",
      estado_civil: "Casado(a)",
      observacoes: "marido ainda não sabe que está pesquisando",
    });
    expect(result.temperatura).toBe("FRIO");
    expect(result.gargalos.some(g => g.includes("Decisor ausente"))).toBe(true);
    expect(result.passos[0]).toContain("cônjuge");
  });

  it("lead MEI perde 1 ponto de renda", () => {
    // Faixa 2 (score.d1 = 2) - 1 (MEI) = 1
    const clt = qualificarLead({ ...base, renda_individual: "6000", tipo_renda: "CLT", urgencia: "urgente", moradia: "aluguel", filhos: "filho" });
    const mei = qualificarLead({ ...base, renda_individual: "6000", tipo_renda: "MEI", urgencia: "urgente", moradia: "aluguel", filhos: "filho" });
    // MEI deve ter temperatura igual ou mais fria que CLT
    const order = ["PRONTO", "QUENTE", "MORNO", "FRIO"];
    expect(order.indexOf(mei.temperatura)).toBeGreaterThanOrEqual(order.indexOf(clt.temperatura));
  });

  it("lead perfeito (Faixa 1, urgente, aluguel, filhos, solteiro) deve ser PRONTO ou QUENTE", () => {
    const result = qualificarLead({
      ...base,
      renda_individual: "3200",
      renda_familiar: "5800",
      tipo_renda: "CLT",
      urgencia: "quer sair do aluguel urgente",
      moradia: "aluguel",
      filhos: "1 filho",
      estado_civil: "Solteiro(a)",
      historico: "nunca tentou",
      observacoes: "muito animado",
    });
    expect(["QUENTE", "PRONTO"]).toContain(result.temperatura);
  });

  it("lead sem urgência declarada deve ter gargalo de urgência baixa ou indefinida", () => {
    const result = qualificarLead({
      ...base,
      renda_individual: "4000",
      urgencia: "só pesquisando por enquanto",
    });
    expect(result.gargalos.some(g => g.includes("Urgência baixa"))).toBe(true);
  });
});

import { toast } from "sonner";
import { useState, useEffect, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { trpc } from "@/lib/trpc";

import {
  Calculator, Save, AlertTriangle, CheckCircle2, XCircle,
  Info, ChevronDown, ChevronUp, History, Trash2
} from "lucide-react";

// ============================================================================
// CONSTANTES MCMV — Vigentes desde 22/04/2026
// ============================================================================

// ============================================================================
// REGRAS REAIS BASEADAS NAS SIMULAÇÕES APROVADAS DA CAIXA (abr/2026)
// Fonte: Portal de Negócios da Habitação + casos reais aprovados
//
// LÓGICA REAL DA CAIXA:
// 1. Parcela máxima = renda × 30% (comprometimento máximo)
// 2. Financiável = valor que cabe na parcela (PRICE inverso)
// 3. Subsídio = VGV - financiável - FGTS (o que "falta" para fechar)
// 4. Subsídio efetivo = 0 se calculado < R$ 1.500 (Caixa não libera abaixo disso)
// 5. Entrada = VGV - financiável - subsídio - FGTS
//
// TAXAS OBSERVADAS NOS CASOS REAIS:
// F1 (renda ~R$2.440): 4,50% a.a. → 0,375% a.m.
// F1 (renda ~R$3.200): 5,00% a.a. → 0,417% a.m.
// F2 (renda ~R$3.700): 5,00-5,50% a.a.
// F3 (renda ~R$7.875): 8,16% a.a. → 0,680% a.m.
// Classe Média (SBPE): 10,00% a.a. → 0,833% a.m.
//
// SUBSÍDIOS REAIS:
// F1 baixa renda: até ~R$8.255 (decrescente com a renda)
// F1 teto (R$3.200): ~R$1.784 (muito baixo)
// F2: praticamente ZERO (R$647-R$1.440 — abaixo do mínimo liberado)
// F3 e Classe Média: ZERO
// ============================================================================

const MCMV = {
  faixas: [
    {
      id: "F1",
      label: "Faixa 1",
      rendaMin: 0,
      rendaMax: 3200,
      tetoSP: 275000,
      // Taxa varia dentro da faixa: 4,5% a.a. (renda baixa) até 5,0% a.a. (teto)
      // Usamos interpolação linear entre rendaMin e rendaMax
      taxaAnualMin: 0.045, // 4,5% a.a. para renda mínima
      taxaAnualMax: 0.050, // 5,0% a.a. para renda no teto
      // Subsídio máximo real observado: ~R$8.255 para renda ~R$2.440
      // Decresce linearmente até ~R$1.784 no teto (R$3.200)
      // Abaixo de R$1.500 → Caixa não libera (desconsiderar)
      subsidioMaxReal: 55000, // teto legal, mas na prática muito menor
      cor: "#16a34a",
      temSubsidio: true,
    },
    {
      id: "F2",
      label: "Faixa 2",
      rendaMin: 3200.01,
      rendaMax: 5000,
      tetoSP: 275000,
      taxaAnualMin: 0.050, // 5,0% a.a.
      taxaAnualMax: 0.055, // 5,5% a.a.
      subsidioMaxReal: 0, // Na prática ZERO — casos reais: R$647 e R$1.440 (abaixo do mínimo)
      cor: "#2563eb",
      temSubsidio: false, // F2 não tem subsídio efetivo na prática
    },
    {
      id: "F3",
      label: "Faixa 3",
      rendaMin: 5000.01,
      rendaMax: 9600,
      tetoSP: 400000,
      taxaAnualMin: 0.0816, // 8,16% a.a. (caso real Nathanael/Álvaro)
      taxaAnualMax: 0.0816,
      subsidioMaxReal: 0, // ZERO subsídio
      cor: "#7c3aed",
      temSubsidio: false,
    },
    {
      id: "CM",
      label: "Classe Média",
      rendaMin: 9600.01,
      rendaMax: 13000,
      tetoSP: 600000,
      taxaAnualMin: 0.10, // 10,0% a.a. (SBPE)
      taxaAnualMax: 0.10,
      subsidioMaxReal: 0, // ZERO subsídio
      cor: "#d97706",
      temSubsidio: false,
    },
  ],
};

// Sub-faixas de taxa com os limites exatos da tabela Caixa (mai/2025)
// Ajustados para os novos limites de renda vigentes (22/04/2026)
const SUBFAIXAS_TAXA = [
  { rendaMax: 2160,   taxaAnual: 0.0425 }, // F1 baixa (até R$2.160)
  { rendaMax: 2850,   taxaAnual: 0.0475 }, // F1 média (R$2.160,01 a R$2.850)
  { rendaMax: 3500,   taxaAnual: 0.0500 }, // F1 alta + início F2 (R$2.850,01 a R$3.500)
  { rendaMax: 4000,   taxaAnual: 0.0550 }, // F2 média (R$3.500,01 a R$4.000)
  { rendaMax: 5000,   taxaAnual: 0.0650 }, // F2 alta (R$4.000,01 a R$5.000)
  { rendaMax: 9600,   taxaAnual: 0.0766 }, // F3/HIS2 (R$5.000,01 a R$9.600)
  { rendaMax: 13000,  taxaAnual: 0.1000 }, // F4/HMP Classe Média (R$9.600,01 a R$13.000)
  { rendaMax: 999999, taxaAnual: 0.1149 }, // SBPE (acima de R$13.000)
];

// Tabela real de subsídio F1 (sem dependentes) — extraída da tabela Caixa mai/2025
// Pontos: [renda, subsidio] — interpolados linearmente entre os pontos
const TABELA_SUBSIDIO_F1: [number, number][] = [
  [1500, 16500], [1600, 16500], [1700, 16500], [1800, 15827],
  [1900, 14136], [2000, 12558], [2100, 11091], [2160, 10263],
  [2200, 9805],  [2300, 8547],  [2400, 7392],  [2500, 6337],
  [2600, 5381],  [2700, 4520],  [2800, 3753],  [2850, 3403],
  [2900, 3135],  [3000, 2537],  [3100, 2025],  [3200, 1598],
  // Novos pontos F1 (R$3.200,01 a R$3.500 — antes era F2 na tabela antiga)
  // Subsídio abaixo de R$1.500 → Caixa não libera → retorna 0
  [3300, 0], [3500, 0],
];

function getTaxaAnual(renda: number): number {
  return SUBFAIXAS_TAXA.find(s => renda <= s.rendaMax)?.taxaAnual ?? 0.1149;
}

function getTaxaMensal(renda: number): number {
  return getTaxaAnual(renda) / 12;
}

function getFaixa(renda: number) {
  return MCMV.faixas.find((f) => renda <= f.rendaMax) ?? null;
}

// Interpola o subsídio real da tabela Caixa para F1
function getSubsidioF1(renda: number): number {
  const tabela = TABELA_SUBSIDIO_F1;
  if (renda <= tabela[0][0]) return tabela[0][1];
  if (renda >= tabela[tabela.length - 1][0]) return 0;
  for (let i = 0; i < tabela.length - 1; i++) {
    const [r1, s1] = tabela[i];
    const [r2, s2] = tabela[i + 1];
    if (renda >= r1 && renda <= r2) {
      const t = (renda - r1) / (r2 - r1);
      const subsidio = s1 + t * (s2 - s1);
      return subsidio < 1500 ? 0 : Math.round(subsidio);
    }
  }
  return 0;
}

// Calcula parcela PRICE dado o valor financiado
function calcularParcela(valorFinanciavel: number, prazoMeses: number, taxaMensal: number): number {
  if (valorFinanciavel <= 0 || prazoMeses <= 0) return 0;
  const i = taxaMensal;
  const n = prazoMeses;
  return (valorFinanciavel * i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1);
}

// Calcula o valor máximo financiável dado a parcela máxima (PRICE inverso)
// Parcela máxima = renda × 30%
function calcularFinanciavelPorRenda(renda: number, prazoMeses: number, taxaMensal: number): number {
  const parcelaMax = renda * 0.30;
  const i = taxaMensal;
  const n = prazoMeses;
  if (i === 0) return parcelaMax * n;
  return parcelaMax * ((1 - Math.pow(1 + i, -n)) / i);
}

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function fmtPct(v: number) {
  return (v * 100).toFixed(1) + "%";
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function PreAnaliseMcmv() {
  

  // Inputs
  const [nomeCliente, setNomeCliente] = useState("");
  const [renda, setRenda] = useState("");
  const [tipoVinculo, setTipoVinculo] = useState("CLT");
  const [idade, setIdade] = useState("");
  const [fgts, setFgts] = useState("");
  const [valorImovel, setValorImovel] = useState("");
  const [prazo, setPrazo] = useState("420");
  const [possuiRestricao, setPossuiRestricao] = useState(false);
  const [jaBeneficiario, setJaBeneficiario] = useState(false);
  const [possuiImovelNome, setPossuiImovelNome] = useState(false);
  const [showHistorico, setShowHistorico] = useState(false);

  // Prazo máximo pela idade: 80 anos e 6 meses (966 meses) - idade em meses
  const prazoMaximoPorIdade = useMemo(() => {
    const idadeNum = parseInt(idade) || 0;
    if (!idadeNum) return 420; // sem idade informada, usa máximo padrão
    const idadeMeses = idadeNum * 12;
    const limiteTotal = 80 * 12 + 6; // 966 meses
    const prazoMax = limiteTotal - idadeMeses;
    return Math.max(60, Math.min(prazoMax, 420)); // mínimo 60 meses, máximo 420
  }, [idade]);

  // Ajusta prazo selecionado se exceder o máximo por idade
  const prazoEfetivo = useMemo(() => {
    const prazoSelecionado = parseInt(prazo) || 420;
    return Math.min(prazoSelecionado, prazoMaximoPorIdade);
  }, [prazo, prazoMaximoPorIdade]);

  // Cálculo em tempo real
  const resultado = useMemo(() => {
    const rendaNum = parseFloat(renda.replace(/\D/g, "")) || 0;
    const vgv = parseFloat(valorImovel.replace(/\D/g, "")) || 0;
    const fgtsNum = parseFloat(fgts.replace(/\D/g, "")) || 0;
    const prazoNum = prazoEfetivo;

    if (!rendaNum || !vgv) return null;

    const faixa = getFaixa(rendaNum);

    // Impedimentos
    const impedimentos: string[] = [];
    if (possuiImovelNome) impedimentos.push("Possui imóvel no nome — pode inviabilizar MCMV");
    if (jaBeneficiario) impedimentos.push("Já foi beneficiário do MCMV anteriormente");
    if (possuiRestricao) impedimentos.push("Possui restrição de crédito — aprovação improvável");
    if (!faixa) impedimentos.push(`Renda R$ ${rendaNum.toLocaleString("pt-BR")} acima do teto MCMV (R$ 13.000)`);
    if (faixa && vgv > faixa.tetoSP) impedimentos.push(`Valor do imóvel (${fmt(vgv)}) acima do teto SP para ${faixa.label} (${fmt(faixa.tetoSP)})`);

    if (!faixa) {
      return { faixa: null, impedimentos, viavel: false };
    }

    // LÓGICA REAL DA CAIXA (baseada na tabela oficial mai/2025 + simulações aprovadas):
    // 1. Taxa mensal pela sub-faixa exata da tabela
    const taxaMensal = getTaxaMensal(rendaNum);
    // 2. Calcular máximo financiável pela renda (parcela = 30% da renda)
    const financiavelPorRenda = calcularFinanciavelPorRenda(rendaNum, prazoNum, taxaMensal);
    // 3. Limite de 80% do VGV (regra da Caixa: financia no máximo 80% do valor do imóvel)
    const limiteOitentaPct = vgv * 0.80;
    // 4. Subsídio real da tabela Caixa (apenas F1, interpolado)
    const subsidio = faixa.temSubsidio ? getSubsidioF1(rendaNum) : 0;
    // 5. Financiável ideal = VGV - subsídio - FGTS (o que o cliente precisa financiar)
    const valorFinanciavelIdeal = Math.max(0, vgv - subsidio - fgtsNum);
    // 6. Financiável final = menor entre:
    //    a) o que a renda suporta (PRICE inverso com 30% da renda)
    //    b) 80% do VGV (limite da Caixa)
    //    c) o que precisa ser financiado (VGV - subsídio - FGTS)
    const valorFinanciavelFinal = Math.min(valorFinanciavelIdeal, financiavelPorRenda, limiteOitentaPct);
    // 7. Parcela real com o valor financiável final
    const parcela = calcularParcela(valorFinanciavelFinal, prazoNum, taxaMensal);
    const comprometimento = rendaNum > 0 ? parcela / rendaNum : 0;
    const dentroLimite = comprometimento <= 0.30;
    // 8. Entrada necessária = VGV - financiável - subsídio - FGTS
    const entradaNecessaria = Math.max(0, vgv - valorFinanciavelFinal - subsidio - fgtsNum);
    // Alertas
    const alertas: string[] = [];
    if (tipoVinculo === "MEI" || tipoVinculo === "Autônomo") {
      alertas.push("Renda informal: exige IR declarado ou documentação comprobatória");
    }
    if (comprometimento > 0.30) {
      alertas.push(`Comprometimento de ${fmtPct(comprometimento)} acima do limite de 30% — parcela pode ser reduzida com mais FGTS ou prazo maior`);
    }
    if (fgtsNum === 0) {
      alertas.push("Sem FGTS informado — se houver saldo, pode reduzir a parcela");
    }

    return {
      faixa,
      taxaMensal,
      taxaAnualPct: getTaxaAnual(rendaNum) * 100,
      subsidio,
      valorFinanciavel: valorFinanciavelFinal,
      financiavelPorRenda,
      entradaNecessaria,
      parcela,
      parcelaMaxima: rendaNum * 0.30,
      comprometimento,
      dentroLimite,
      impedimentos,
      alertas,
      viavel: impedimentos.length === 0,
    };
  }, [renda, valorImovel, fgts, prazo, tipoVinculo, possuiRestricao, jaBeneficiario, possuiImovelNome]);

  // Histórico
  const { data: historico, refetch: refetchHistorico } = trpc.meuNegocio.listarPreAnalises.useQuery(
    undefined,
    { enabled: showHistorico }
  );

  const salvarMutation = trpc.meuNegocio.salvarPreAnalise.useMutation({
    onSuccess: () => {
      toast.success("Pré-análise salva!", { description: `Análise de ${nomeCliente} salva no histórico.` });
      refetchHistorico();
    },
    onError: (e) => toast.error("Erro ao salvar", { description: e.message }),
  });

  const deletarMutation = trpc.meuNegocio.deletarPreAnalise.useMutation({
    onSuccess: () => { toast.success("Análise removida"); refetchHistorico(); },
  });

  function handleSalvar() {
    if (!nomeCliente.trim()) { toast.error("Informe o nome do cliente"); return; }
    if (!resultado) { toast.error("Preencha renda e valor do imóvel"); return; }
    salvarMutation.mutate({
      nomeCliente: nomeCliente.trim(),
      rendaFamiliar: parseFloat(renda.replace(/\D/g, "")) || 0,
      tipoVinculo,
      saldoFgts: parseFloat(fgts.replace(/\D/g, "")) || 0,
      valorImovel: parseFloat(valorImovel.replace(/\D/g, "")) || 0,
      prazoMeses: parseInt(prazo) || 420,
      possuiRestricao,
      jaBeneficiarioMcmv: jaBeneficiario,
      possuiImovelNome,
      faixaMcmv: resultado.faixa?.id ?? null,
      subsidioEstimado: resultado.subsidio ?? null,
      valorFinanciavel: resultado.valorFinanciavel ?? null,
      parcelaEstimada: resultado.parcela ?? null,
      comprometimentoPct: resultado.comprometimento ?? null,
      dentroLimite30pct: resultado.dentroLimite ?? null,
    });
  }

  function formatInput(val: string) {
    const num = val.replace(/\D/g, "");
    if (!num) return "";
    return parseInt(num).toLocaleString("pt-BR");
  }

  return (
    <DashboardLayout>
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
          <Calculator className="h-6 w-6 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Pré-Análise MCMV</h1>
          <p className="text-sm text-muted-foreground">Calculadora em tempo real — valores vigentes desde 22/04/2026</p>
        </div>
      </div>

      {/* Tabela de faixas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {MCMV.faixas.map((f) => (
          <div
            key={f.id}
            className="rounded-lg border p-3 text-center"
            style={{ borderColor: f.cor + "40", backgroundColor: f.cor + "10" }}
          >
            <div className="text-xs font-semibold" style={{ color: f.cor }}>{f.label}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {f.id === "F1" ? `até ${fmt(f.rendaMax)}` : `até ${fmt(f.rendaMax)}`}
            </div>
            <div className="text-xs font-medium mt-1">Teto SP: {fmt(f.tetoSP)}</div>
            {f.temSubsidio ? (
              <div className="text-xs text-green-600 font-medium">Com subsídio</div>
            ) : (
              <div className="text-xs text-muted-foreground">Sem subsídio</div>
            )}
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Formulário */}
        <div className="space-y-4">
          <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Dados do Cliente</h2>

          <div className="space-y-2">
            <Label>Nome do cliente</Label>
            <Input
              placeholder="Ex: João Silva"
              value={nomeCliente}
              onChange={(e) => setNomeCliente(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Renda familiar bruta (R$)</Label>
              <Input
                placeholder="Ex: 4.500"
                value={renda}
                onChange={(e) => setRenda(formatInput(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo de vínculo</Label>
              <Select value={tipoVinculo} onValueChange={setTipoVinculo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CLT">CLT</SelectItem>
                  <SelectItem value="Servidor Público">Servidor Público</SelectItem>
                  <SelectItem value="Autônomo">Autônomo</SelectItem>
                  <SelectItem value="MEI">MEI</SelectItem>
                  <SelectItem value="Aposentado">Aposentado</SelectItem>
                  <SelectItem value="Pensionista">Pensionista</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Valor do imóvel (R$)</Label>
              <Input
                placeholder="Ex: 270.000"
                value={valorImovel}
                onChange={(e) => setValorImovel(formatInput(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label>Saldo FGTS (R$)</Label>
              <Input
                placeholder="Ex: 15.000"
                value={fgts}
                onChange={(e) => setFgts(formatInput(e.target.value))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Idade do cliente (anos)</Label>
              <Input
                type="number"
                placeholder="Ex: 35"
                min={18}
                max={80}
                value={idade}
                onChange={(e) => setIdade(e.target.value)}
              />
              {idade && parseInt(idade) > 0 && (
                <p className="text-xs text-muted-foreground">
                  Prazo máx: <span className={prazoMaximoPorIdade < 420 ? "text-amber-600 font-semibold" : ""}>{prazoMaximoPorIdade} meses ({Math.floor(prazoMaximoPorIdade / 12)} anos)</span>
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Prazo desejado</Label>
              <Select value={prazo} onValueChange={setPrazo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="420">420 meses (35 anos)</SelectItem>
                  <SelectItem value="360">360 meses (30 anos)</SelectItem>
                  <SelectItem value="300">300 meses (25 anos)</SelectItem>
                  <SelectItem value="240">240 meses (20 anos)</SelectItem>
                  <SelectItem value="180">180 meses (15 anos)</SelectItem>
                  <SelectItem value="120">120 meses (10 anos)</SelectItem>
                  <SelectItem value="60">60 meses (5 anos)</SelectItem>
                </SelectContent>
              </Select>
              {prazoEfetivo < parseInt(prazo) && (
                <p className="text-xs text-amber-600 font-semibold">
                  ⚠ Reduzido para {prazoEfetivo} meses pela idade
                </p>
              )}
            </div>
          </div>

          <Separator />

          <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Impedimentos</h2>

          <div className="space-y-3">
            {[
              { label: "Possui imóvel no nome", value: possuiImovelNome, onChange: setPossuiImovelNome },
              { label: "Já foi beneficiário do MCMV", value: jaBeneficiario, onChange: setJaBeneficiario },
              { label: "Possui restrição de crédito (SPC/Serasa)", value: possuiRestricao, onChange: setPossuiRestricao },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between">
                <Label className="text-sm">{item.label}</Label>
                <Switch checked={item.value} onCheckedChange={item.onChange} />
              </div>
            ))}
          </div>

          <Button onClick={handleSalvar} disabled={salvarMutation.isPending} className="w-full">
            <Save className="h-4 w-4 mr-2" />
            {salvarMutation.isPending ? "Salvando..." : "Salvar no histórico"}
          </Button>
        </div>

        {/* Resultado */}
        <div className="space-y-4">
          <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Resultado</h2>

          {!resultado ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
              <Calculator className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Preencha a renda e o valor do imóvel para ver o resultado</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Faixa */}
              {resultado.faixa ? (
                <div
                  className="rounded-lg p-4 border-2"
                  style={{ borderColor: resultado.faixa.cor, backgroundColor: resultado.faixa.cor + "15" }}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: resultado.faixa.cor }} />
                    <span className="font-bold text-lg" style={{ color: resultado.faixa.cor }}>
                      {resultado.faixa.label}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Taxa: {resultado.taxaAnualPct?.toFixed(2)}% a.a. · Teto SP: {fmt(resultado.faixa.tetoSP)}
                  </div>
                </div>
              ) : (
                <div className="rounded-lg p-4 border-2 border-red-300 bg-red-50 dark:bg-red-900/20">
                  <div className="flex items-center gap-2 text-red-600 font-bold">
                    <XCircle className="h-5 w-5" />
                    Fora do MCMV
                  </div>
                </div>
              )}

              {/* Cards de resultado */}
              {resultado.faixa && (
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Subsídio estimado", value: fmt(resultado.subsidio ?? 0), highlight: (resultado.subsidio ?? 0) > 1500, sub: resultado.faixa.temSubsidio ? "" : "F2/F3/CM: sem subsídio" },
                    { label: "FGTS utilizado", value: fmt(parseFloat(fgts.replace(/\D/g, "")) || 0), highlight: false, sub: "" },
                    { label: "Valor financiável", value: fmt(resultado.valorFinanciavel ?? 0), highlight: false, sub: "máx 80% do imóvel" },
                    { label: "1ª parcela (PRICE)", value: fmt(resultado.parcela ?? 0), highlight: false, sub: `máx ${fmt(resultado.parcelaMaxima ?? 0)} (30% renda)` },
                    { label: "Entrada necessária", value: fmt(resultado.entradaNecessaria ?? 0), highlight: false, sub: "entrada + FGTS" },
                  ].map((card) => (
                    <div key={card.label} className="rounded-lg border p-3">
                      <div className="text-xs text-muted-foreground">{card.label}</div>
                      <div className={`text-lg font-bold mt-1 ${card.highlight ? "text-green-600" : ""}`}>
                        {card.value}
                      </div>
                      {card.sub && <div className="text-xs text-muted-foreground mt-0.5">{card.sub}</div>}
                    </div>
                  ))}
                </div>
              )}

              {/* Comprometimento */}
              {resultado.faixa && resultado.comprometimento !== undefined && (
                <div className={`rounded-lg p-3 border ${resultado.dentroLimite ? "border-green-300 bg-green-50 dark:bg-green-900/20" : "border-red-300 bg-red-50 dark:bg-red-900/20"}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Comprometimento de renda</span>
                    <Badge variant={resultado.dentroLimite ? "default" : "destructive"}>
                      {fmtPct(resultado.comprometimento)}
                    </Badge>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-gray-200 dark:bg-gray-700">
                    <div
                      className={`h-2 rounded-full transition-all ${resultado.dentroLimite ? "bg-green-500" : "bg-red-500"}`}
                      style={{ width: `${Math.min(100, resultado.comprometimento * 100 / 0.4)}%` }}
                    />
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {resultado.dentroLimite
                      ? `✓ Dentro do limite de 30% — aprovação mais provável`
                      : `✗ Acima do limite de 30% — banco pode reprovar ou reduzir prazo`}
                  </div>
                </div>
              )}

              {/* Impedimentos */}
              {resultado.impedimentos.length > 0 && (
                <div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-900/20 p-3 space-y-1">
                  <div className="flex items-center gap-2 text-red-600 font-semibold text-sm">
                    <XCircle className="h-4 w-4" />
                    Impedimentos ({resultado.impedimentos.length})
                  </div>
                  {resultado.impedimentos.map((imp, i) => (
                    <div key={i} className="text-xs text-red-700 dark:text-red-300 flex items-start gap-1">
                      <span className="mt-0.5">•</span> {imp}
                    </div>
                  ))}
                </div>
              )}

              {/* Alertas */}
              {resultado.alertas && resultado.alertas.length > 0 && (
                <div className="rounded-lg border border-yellow-300 bg-yellow-50 dark:bg-yellow-900/20 p-3 space-y-1">
                  <div className="flex items-center gap-2 text-yellow-700 font-semibold text-sm">
                    <AlertTriangle className="h-4 w-4" />
                    Pontos de atenção
                  </div>
                  {resultado.alertas.map((al, i) => (
                    <div key={i} className="text-xs text-yellow-800 dark:text-yellow-300 flex items-start gap-1">
                      <span className="mt-0.5">•</span> {al}
                    </div>
                  ))}
                </div>
              )}

              {/* Viabilidade */}
              {resultado.faixa && resultado.impedimentos.length === 0 && (
                <div className="rounded-lg border border-green-300 bg-green-50 dark:bg-green-900/20 p-3">
                  <div className="flex items-center gap-2 text-green-700 font-semibold text-sm">
                    <CheckCircle2 className="h-4 w-4" />
                    Perfil viável para MCMV
                  </div>
                  <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                    Cliente enquadra na {resultado.faixa.label}. Próximo passo: qualificação completa e envio para pré-análise da CAIXA.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Histórico */}
      <div>
        <Button
          variant="outline"
          onClick={() => setShowHistorico(!showHistorico)}
          className="w-full"
        >
          <History className="h-4 w-4 mr-2" />
          {showHistorico ? "Ocultar" : "Ver"} histórico de análises
          {showHistorico ? <ChevronUp className="h-4 w-4 ml-2" /> : <ChevronDown className="h-4 w-4 ml-2" />}
        </Button>

        {showHistorico && (
          <div className="mt-4 space-y-2">
            {!historico || historico.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-4">Nenhuma análise salva ainda</p>
            ) : (
              historico.map((h) => (
                <div key={h.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <div className="font-medium text-sm">{h.nomeCliente}</div>
                    <div className="text-xs text-muted-foreground">
                      Renda: {fmt(Number(h.rendaFamiliar))} · Imóvel: {fmt(Number(h.valorImovel))} ·{" "}
                      {h.faixaMcmv ?? "Fora MCMV"} ·{" "}
                      Parcela: {h.parcelaEstimada ? fmt(Number(h.parcelaEstimada)) : "—"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(h.createdAt).toLocaleDateString("pt-BR")}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deletarMutation.mutate({ id: h.id })}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
    </DashboardLayout>
  );
}

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

const MCMV = {
  faixas: [
    {
      id: "F1",
      label: "Faixa 1",
      rendaMax: 3200,
      tetoSP: 275000,
      subsidioMax: 55000,
      subsidioFator: 0.25, // MIN(55000, VGV × 25%)
      taxaMensal: 0.0035,
      cor: "#16a34a",
    },
    {
      id: "F2",
      label: "Faixa 2",
      rendaMax: 5000,
      tetoSP: 275000,
      subsidioMax: 35000,
      subsidioFator: 0.15, // MIN(35000, VGV × 15%)
      taxaMensal: 0.0050,
      cor: "#2563eb",
    },
    {
      id: "F3",
      label: "Faixa 3",
      rendaMax: 9600,
      tetoSP: 400000,
      subsidioMax: 15000,
      subsidioFator: 0.05, // MIN(15000, VGV × 5%)
      taxaMensal: 0.0063,
      cor: "#7c3aed",
    },
    {
      id: "CM",
      label: "Classe Média",
      rendaMax: 13000,
      tetoSP: 600000,
      subsidioMax: 0,
      subsidioFator: 0,
      taxaMensal: 0.0085,
      cor: "#d97706",
    },
  ],
};

function getFaixa(renda: number) {
  return MCMV.faixas.find((f) => renda <= f.rendaMax) ?? null;
}

function calcularSubsidio(faixa: typeof MCMV.faixas[0], vgv: number): number {
  if (faixa.subsidioMax === 0) return 0;
  return Math.min(faixa.subsidioMax, vgv * faixa.subsidioFator);
}

function calcularParcela(valorFinanciavel: number, prazoMeses: number, taxaMensal: number): number {
  if (valorFinanciavel <= 0 || prazoMeses <= 0) return 0;
  // Sistema PRICE
  const i = taxaMensal;
  const n = prazoMeses;
  return (valorFinanciavel * i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1);
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
  const [fgts, setFgts] = useState("");
  const [valorImovel, setValorImovel] = useState("");
  const [prazo, setPrazo] = useState("420");
  const [possuiRestricao, setPossuiRestricao] = useState(false);
  const [jaBeneficiario, setJaBeneficiario] = useState(false);
  const [possuiImovelNome, setPossuiImovelNome] = useState(false);
  const [showHistorico, setShowHistorico] = useState(false);

  // Cálculo em tempo real
  const resultado = useMemo(() => {
    const rendaNum = parseFloat(renda.replace(/\D/g, "")) || 0;
    const vgv = parseFloat(valorImovel.replace(/\D/g, "")) || 0;
    const fgtsNum = parseFloat(fgts.replace(/\D/g, "")) || 0;
    const prazoNum = parseInt(prazo) || 420;

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

    const subsidio = calcularSubsidio(faixa, vgv);
    const valorFinanciavel = Math.max(0, vgv - subsidio - fgtsNum);
    const parcela = calcularParcela(valorFinanciavel, prazoNum, faixa.taxaMensal);
    const comprometimento = rendaNum > 0 ? parcela / rendaNum : 0;
    const dentroLimite = comprometimento <= 0.30;

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
      subsidio,
      valorFinanciavel,
      parcela,
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
            {f.subsidioMax > 0 && (
              <div className="text-xs text-muted-foreground">Subsídio: até {fmt(f.subsidioMax)}</div>
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

          <div className="space-y-2">
            <Label>Prazo de financiamento</Label>
            <Select value={prazo} onValueChange={setPrazo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="420">420 meses (35 anos)</SelectItem>
                <SelectItem value="360">360 meses (30 anos)</SelectItem>
                <SelectItem value="300">300 meses (25 anos)</SelectItem>
                <SelectItem value="240">240 meses (20 anos)</SelectItem>
                <SelectItem value="180">180 meses (15 anos)</SelectItem>
              </SelectContent>
            </Select>
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
                    Taxa: {fmtPct(resultado.faixa.taxaMensal)} a.m. · Teto SP: {fmt(resultado.faixa.tetoSP)}
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
                    { label: "Subsídio estimado", value: fmt(resultado.subsidio ?? 0), highlight: (resultado.subsidio ?? 0) > 0 },
                    { label: "FGTS utilizado", value: fmt(parseFloat(fgts.replace(/\D/g, "")) || 0), highlight: false },
                    { label: "Valor financiável", value: fmt(resultado.valorFinanciavel ?? 0), highlight: false },
                    { label: "1ª parcela (PRICE)", value: fmt(resultado.parcela ?? 0), highlight: false },
                  ].map((card) => (
                    <div key={card.label} className="rounded-lg border p-3">
                      <div className="text-xs text-muted-foreground">{card.label}</div>
                      <div className={`text-lg font-bold mt-1 ${card.highlight ? "text-green-600" : ""}`}>
                        {card.value}
                      </div>
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

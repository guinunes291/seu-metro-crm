import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { BarChart } from "@/components/charts/BarChart";
import { LineChart } from "@/components/charts/LineChart";
import { PieChart } from "@/components/charts/PieChart";
import { DataTable } from "@/components/charts/DataTable";
import { trpc } from "@/lib/trpc";
import { Loader2, Download, Save, Trash2, RotateCcw } from "lucide-react";
import { toast } from "sonner";

type Dimensao = "corretor" | "projeto" | "origem" | "mes";
type Metrica = "contagem" | "taxaConversao" | "vgv" | "tempoMedio";
type TipoVisualizacao = "barras" | "linhas" | "pizza" | "tabela";

type ConfigSalva = {
  id: string;
  nome: string;
  dimensao: Dimensao;
  metrica: Metrica;
  visualizacao: TipoVisualizacao;
  dataInicio: string;
  dataFim: string;
  criadoEm: string;
};

const STORAGE_KEY = "relatoriosSalvos";

function formatCurrencyCompact(val: number): string {
  if (val >= 1_000_000) return `R$ ${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `R$ ${(val / 1_000).toFixed(0)}k`;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);
}

function toDateString(d: Date): string {
  return d.toISOString().split("T")[0];
}

interface Props {
  defaultDataInicio?: Date;
  defaultDataFim?: Date;
}

export function CustomReportBuilder({ defaultDataInicio, defaultDataFim }: Props) {
  const hoje = new Date();
  const primeiroDiaMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

  const [dimensao, setDimensao] = useState<Dimensao>("corretor");
  const [metrica, setMetrica] = useState<Metrica>("contagem");
  const [visualizacao, setVisualizacao] = useState<TipoVisualizacao>("barras");
  const [dataInicio, setDataInicio] = useState<string>(
    defaultDataInicio ? toDateString(defaultDataInicio) : toDateString(primeiroDiaMes)
  );
  const [dataFim, setDataFim] = useState<string>(
    defaultDataFim ? toDateString(defaultDataFim) : toDateString(hoje)
  );
  const [configsSalvas, setConfigsSalvas] = useState<ConfigSalva[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    } catch {
      return [];
    }
  });

  const inputDatas = {
    dataInicio: new Date(dataInicio).toISOString(),
    dataFim: new Date(dataFim + "T23:59:59").toISOString(),
  };

  // All queries at top level — enabled flags prevent unnecessary fetches
  const qCorretor = trpc.relatorios.conversaoPorCorretor.useQuery(inputDatas, {
    enabled: dimensao === "corretor" && metrica !== "vgv",
  });
  const qCorretorVgv = trpc.relatorios.producaoPorCorretor.useQuery(inputDatas, {
    enabled: dimensao === "corretor" && metrica === "vgv",
  });
  const qProjeto = trpc.relatorios.conversaoPorProjeto.useQuery(inputDatas, {
    enabled: dimensao === "projeto",
  });
  const qOrigem = trpc.centralAnalises.origensConversao.useQuery(inputDatas, {
    enabled: dimensao === "origem",
  });
  const qEvolucao = trpc.centralAnalises.evolucaoTemporal.useQuery(
    { ...inputDatas, agrupamento: "mes" as const },
    { enabled: dimensao === "mes" }
  );

  const isLoading =
    qCorretor.isLoading ||
    qCorretorVgv.isLoading ||
    qProjeto.isLoading ||
    qOrigem.isLoading ||
    qEvolucao.isLoading;

  const processData = (): Array<{ nome: string; valor: number }> => {
    if (dimensao === "corretor") {
      if (metrica === "vgv") {
        return (qCorretorVgv.data ?? []).map((d: any) => ({
          nome: d.nome,
          valor: d.vgv / 100,
        }));
      }
      const d = qCorretor.data ?? [];
      if (metrica === "contagem") return d.map((r: any) => ({ nome: r.corretorNome, valor: r.totalLeads }));
      if (metrica === "taxaConversao") return d.map((r: any) => ({ nome: r.corretorNome, valor: r.taxaConversao }));
      if (metrica === "tempoMedio") return d.map((r: any) => ({ nome: r.corretorNome, valor: r.tempoMedioResposta }));
    }
    if (dimensao === "projeto") {
      const d = qProjeto.data ?? [];
      if (metrica === "contagem") return d.map((r: any) => ({ nome: r.projectNome, valor: r.totalLeads }));
      if (metrica === "taxaConversao") return d.map((r: any) => ({ nome: r.projectNome, valor: r.taxaConversao }));
    }
    if (dimensao === "origem") {
      const d = qOrigem.data ?? [];
      if (metrica === "contagem") return d.map((r: any) => ({ nome: r.origem || "Sem origem", valor: r.totalLeads }));
      if (metrica === "taxaConversao") return d.map((r: any) => ({ nome: r.origem || "Sem origem", valor: r.taxaConversao }));
      if (metrica === "vgv") return d.map((r: any) => ({ nome: r.origem || "Sem origem", valor: r.vgv / 100 }));
    }
    if (dimensao === "mes") {
      const d = qEvolucao.data ?? [];
      if (metrica === "contagem") return d.map((r: any) => ({ nome: r.periodo, valor: r.leads }));
      if (metrica === "taxaConversao")
        return d.map((r: any) => ({
          nome: r.periodo,
          valor: r.leads > 0 ? Math.round((r.contratos_val / r.leads) * 100) : 0,
        }));
      if (metrica === "vgv") return d.map((r: any) => ({ nome: r.periodo, valor: r.vgv / 100 }));
    }
    return [];
  };

  const data = processData();

  const getDimensaoLabel = (): string => {
    if (dimensao === "corretor") return "Corretor";
    if (dimensao === "projeto") return "Projeto";
    if (dimensao === "origem") return "Origem";
    return "Mês";
  };

  const getMetricaLabel = (): string => {
    if (metrica === "contagem") return "Qtd. de Leads";
    if (metrica === "taxaConversao") return "Taxa de Conversão (%)";
    if (metrica === "vgv") return "VGV (R$)";
    return "Tempo Médio de Resposta (h)";
  };

  const formatValue = (val: number): string => {
    if (metrica === "vgv") return formatCurrencyCompact(val);
    if (metrica === "taxaConversao") return `${val.toFixed(1)}%`;
    if (metrica === "tempoMedio") return `${val.toFixed(1)}h`;
    return val.toString();
  };

  const handleExport = () => {
    if (data.length === 0) {
      toast.error("Nenhum dado para exportar");
      return;
    }
    const header = [getDimensaoLabel(), getMetricaLabel()];
    const rows = data.map((d) => [d.nome, d.valor.toString()]);
    const csv = [header, ...rows].map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-${dimensao}-${metrica}-${dataInicio}-${dataFim}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("CSV exportado com sucesso!");
  };

  const handleSave = () => {
    const nome = prompt(
      "Nome do relatório:",
      `${getDimensaoLabel()} × ${getMetricaLabel()} (${dataInicio})`
    );
    if (!nome) return;
    const config: ConfigSalva = {
      id: crypto.randomUUID(),
      nome,
      dimensao,
      metrica,
      visualizacao,
      dataInicio,
      dataFim,
      criadoEm: new Date().toISOString(),
    };
    const novas = [config, ...configsSalvas].slice(0, 10);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(novas));
    setConfigsSalvas(novas);
    toast.success(`"${nome}" salvo!`);
  };

  const handleCarregar = (config: ConfigSalva) => {
    setDimensao(config.dimensao);
    setMetrica(config.metrica);
    setVisualizacao(config.visualizacao);
    setDataInicio(config.dataInicio);
    setDataFim(config.dataFim);
    toast.success(`Relatório "${config.nome}" carregado`);
  };

  const handleExcluir = (id: string) => {
    const novas = configsSalvas.filter((c) => c.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(novas));
    setConfigsSalvas(novas);
  };

  const title = `${getMetricaLabel()} por ${getDimensaoLabel()}`;

  const renderVisualizacao = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      );
    }
    if (!data || data.length === 0) {
      return (
        <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
          Nenhum dado disponível para esta combinação de filtros
        </div>
      );
    }
    switch (visualizacao) {
      case "barras":
        return (
          <BarChart
            data={data}
            dataKeys={[{ key: "valor", name: getMetricaLabel() }]}
            xAxisKey="nome"
            title={title}
            height={400}
          />
        );
      case "linhas":
        return (
          <LineChart
            data={data}
            dataKeys={[{ key: "valor", name: getMetricaLabel() }]}
            xAxisKey="nome"
            title={title}
            height={400}
          />
        );
      case "pizza":
        return (
          <PieChart
            data={data}
            dataKey="valor"
            nameKey="nome"
            title={title}
            height={400}
          />
        );
      case "tabela":
        return (
          <DataTable
            data={data}
            columns={[
              { key: "nome", label: getDimensaoLabel(), align: "left" },
              {
                key: "valor",
                label: getMetricaLabel(),
                align: "right",
                format: (val) => formatValue(val),
              },
            ]}
            title={title}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Criador de Relatórios Personalizados</CardTitle>
          <CardDescription>
            Escolha dimensão, métrica, período e visualização para montar seu relatório
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Dimensão / Métrica / Visualização */}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Dimensão (Eixo X)</Label>
              <Select value={dimensao} onValueChange={(v) => setDimensao(v as Dimensao)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="corretor">Corretor</SelectItem>
                  <SelectItem value="projeto">Projeto</SelectItem>
                  <SelectItem value="origem">Origem do Lead</SelectItem>
                  <SelectItem value="mes">Mês</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Métrica (Eixo Y)</Label>
              <Select value={metrica} onValueChange={(v) => setMetrica(v as Metrica)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="contagem">Contagem de Leads</SelectItem>
                  <SelectItem value="taxaConversao">Taxa de Conversão (%)</SelectItem>
                  <SelectItem value="vgv">VGV (Valor de Vendas)</SelectItem>
                  <SelectItem value="tempoMedio">Tempo Médio de Resposta</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Visualização</Label>
              <Select
                value={visualizacao}
                onValueChange={(v) => setVisualizacao(v as TipoVisualizacao)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="barras">Gráfico de Barras</SelectItem>
                  <SelectItem value="linhas">Gráfico de Linhas</SelectItem>
                  <SelectItem value="pizza">Gráfico de Pizza</SelectItem>
                  <SelectItem value="tabela">Tabela</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Período */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Data Início</Label>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <div className="space-y-2">
              <Label>Data Fim</Label>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          </div>

          {/* Ações */}
          <div className="flex gap-2 flex-wrap">
            <Button onClick={handleSave} variant="outline" size="sm">
              <Save className="mr-2 h-4 w-4" />
              Salvar Relatório
            </Button>
            <Button
              onClick={handleExport}
              variant="outline"
              size="sm"
              disabled={data.length === 0 || isLoading}
            >
              <Download className="mr-2 h-4 w-4" />
              Exportar CSV
            </Button>
          </div>

          {/* Resultado */}
          <div className="pt-4 border-t">{renderVisualizacao()}</div>
        </CardContent>
      </Card>

      {/* Relatórios salvos */}
      {configsSalvas.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Relatórios Salvos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {configsSalvas.map((config) => (
                <div
                  key={config.id}
                  className="flex items-center justify-between p-2.5 rounded-lg border bg-muted/30"
                >
                  <div>
                    <p className="text-sm font-medium">{config.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {config.dimensao} × {config.metrica} —{" "}
                      {new Date(config.criadoEm).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      onClick={() => handleCarregar(config)}
                    >
                      <RotateCcw className="h-3.5 w-3.5 mr-1" />
                      Carregar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => handleExcluir(config.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

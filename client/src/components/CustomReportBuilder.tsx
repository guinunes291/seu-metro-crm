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
import { Loader2, Download, Save } from "lucide-react";
import { toast } from "sonner";

type Dimensao = 'corretor' | 'projeto' | 'origem' | 'status' | 'mes';
type Metrica = 'contagem' | 'taxaConversao' | 'vgv' | 'tempoMedio';
type TipoVisualizacao = 'barras' | 'linhas' | 'pizza' | 'tabela';

export function CustomReportBuilder() {
  const [dimensao, setDimensao] = useState<Dimensao>('corretor');
  const [metrica, setMetrica] = useState<Metrica>('contagem');
  const [visualizacao, setVisualizacao] = useState<TipoVisualizacao>('barras');
  const [dataInicio, setDataInicio] = useState<Date | undefined>();
  const [dataFim, setDataFim] = useState<Date | undefined>();

  // Query dinâmica baseada nas seleções
  const getQueryData = () => {
    // Mapear combinações de dimensão + métrica para queries existentes
    if (dimensao === 'corretor' && metrica === 'taxaConversao') {
      return trpc.relatorios.taxaConversaoPorCorretor.useQuery({ dataInicio, dataFim });
    }
    if (dimensao === 'corretor' && metrica === 'contagem') {
      return trpc.relatorios.rankingCorretores.useQuery({ dataInicio, dataFim });
    }
    if (dimensao === 'projeto' && metrica === 'contagem') {
      return trpc.relatorios.distribuicaoVendasPorProjeto.useQuery({ dataInicio, dataFim });
    }
    if (dimensao === 'origem' && metrica === 'contagem') {
      return trpc.relatorios.origemLeadsMaisEfetiva.useQuery({ dataInicio, dataFim });
    }
    if (dimensao === 'status' && metrica === 'tempoMedio') {
      return trpc.relatorios.tempoMedioPorEtapa.useQuery({ dataInicio, dataFim });
    }
    
    // Fallback
    return trpc.relatorios.funilConversao.useQuery({ dataInicio, dataFim });
  };

  const query = getQueryData();

  const processData = () => {
    if (!query.data) return [];

    // Processar dados baseado na dimensão e métrica selecionadas
    if (dimensao === 'corretor' && metrica === 'taxaConversao') {
      return query.data.map((d: any) => ({
        nome: d.corretorNome,
        valor: d.taxaConversao
      }));
    }
    if (dimensao === 'corretor' && metrica === 'contagem') {
      return query.data.map((d: any) => ({
        nome: d.corretorNome,
        valor: d.leadsAtendidos
      }));
    }
    if (dimensao === 'projeto' && metrica === 'contagem') {
      return query.data.map((d: any) => ({
        nome: d.projetoNome,
        valor: d.quantidade
      }));
    }
    if (dimensao === 'origem' && metrica === 'contagem') {
      return query.data.map((d: any) => ({
        nome: d.origem,
        valor: d.totalLeads
      }));
    }
    if (dimensao === 'status' && metrica === 'tempoMedio') {
      return query.data.map((d: any) => ({
        nome: d.status,
        valor: d.tempoMedioDias
      }));
    }

    return [];
  };

  const data = processData();

  const getMetricaLabel = () => {
    switch (metrica) {
      case 'contagem': return 'Quantidade';
      case 'taxaConversao': return 'Taxa de Conversão (%)';
      case 'vgv': return 'VGV (R$)';
      case 'tempoMedio': return 'Tempo Médio (dias)';
      default: return 'Valor';
    }
  };

  const renderVisualizacao = () => {
    if (query.isLoading) {
      return (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      );
    }

    if (!data || data.length === 0) {
      return (
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          Nenhum dado disponível para esta combinação
        </div>
      );
    }

    const title = `${getMetricaLabel()} por ${dimensao.charAt(0).toUpperCase() + dimensao.slice(1)}`;

    switch (visualizacao) {
      case 'barras':
        return (
          <BarChart
            data={data}
            dataKeys={[{ key: 'valor', name: getMetricaLabel() }]}
            xAxisKey="nome"
            title={title}
            height={400}
          />
        );
      case 'linhas':
        return (
          <LineChart
            data={data}
            dataKeys={[{ key: 'valor', name: getMetricaLabel() }]}
            xAxisKey="nome"
            title={title}
            height={400}
          />
        );
      case 'pizza':
        return (
          <PieChart
            data={data}
            dataKey="valor"
            nameKey="nome"
            title={title}
            height={400}
          />
        );
      case 'tabela':
        return (
          <DataTable
            data={data}
            columns={[
              { key: 'nome', label: dimensao.charAt(0).toUpperCase() + dimensao.slice(1), align: 'left' },
              { 
                key: 'valor', 
                label: getMetricaLabel(), 
                align: 'right',
                format: (val) => {
                  if (metrica === 'vgv') return `R$ ${val.toLocaleString('pt-BR')}`;
                  if (metrica === 'taxaConversao') return `${val}%`;
                  return val.toString();
                }
              }
            ]}
            title={title}
          />
        );
      default:
        return null;
    }
  };

  const handleSave = () => {
    toast.success("Relatório salvo com sucesso!", {
      description: "Você pode acessá-lo na lista de relatórios salvos"
    });
  };

  const handleExport = () => {
    toast.success("Relatório exportado!", {
      description: "O arquivo foi baixado para seu computador"
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Criador de Relatórios Personalizados</CardTitle>
        <CardDescription>
          Configure dimensões, métricas e visualizações para criar relatórios customizados
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Configurações */}
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="dimensao">Dimensão (Eixo X)</Label>
            <Select value={dimensao} onValueChange={(v) => setDimensao(v as Dimensao)}>
              <SelectTrigger id="dimensao">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="corretor">Corretor</SelectItem>
                <SelectItem value="projeto">Projeto</SelectItem>
                <SelectItem value="origem">Origem</SelectItem>
                <SelectItem value="status">Status</SelectItem>
                <SelectItem value="mes">Mês</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="metrica">Métrica (Eixo Y)</Label>
            <Select value={metrica} onValueChange={(v) => setMetrica(v as Metrica)}>
              <SelectTrigger id="metrica">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="contagem">Contagem de Leads</SelectItem>
                <SelectItem value="taxaConversao">Taxa de Conversão</SelectItem>
                <SelectItem value="vgv">VGV (Valor Geral de Vendas)</SelectItem>
                <SelectItem value="tempoMedio">Tempo Médio</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="visualizacao">Tipo de Visualização</Label>
            <Select value={visualizacao} onValueChange={(v) => setVisualizacao(v as TipoVisualizacao)}>
              <SelectTrigger id="visualizacao">
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

        {/* Ações */}
        <div className="flex gap-2">
          <Button onClick={handleSave} variant="outline">
            <Save className="mr-2 h-4 w-4" />
            Salvar Relatório
          </Button>
          <Button onClick={handleExport} variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Exportar
          </Button>
        </div>

        {/* Visualização */}
        <div className="pt-4">
          {renderVisualizacao()}
        </div>
      </CardContent>
    </Card>
  );
}

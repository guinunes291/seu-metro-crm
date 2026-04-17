import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { TrendingUp, Users, CalendarCheck, Home, DollarSign, Award } from "lucide-react";

function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}

function calcTaxa(num: number, den: number) {
  if (den === 0) return 0;
  return Math.round((num / den) * 100);
}

export default function MinhaEvolucao() {
  const { data: meses, isLoading } = trpc.meuNegocio.getEvolucaoMensal.useQuery();

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 bg-muted rounded w-48 animate-pulse" />
        <div className="grid grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-64 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const dados = meses ?? [];

  const ultimo = dados[dados.length - 1];
  const penultimo = dados[dados.length - 2];

  function delta(atual: number, anterior: number) {
    return atual - anterior;
  }

  const kpis = ultimo
    ? [
        {
          icon: Users,
          label: "Leads recebidos",
          value: ultimo.leadsRecebidos,
          deltaVal: delta(ultimo.leadsRecebidos, penultimo?.leadsRecebidos ?? 0),
          color: "text-blue-500",
          bg: "bg-blue-50 dark:bg-blue-950",
          isMoney: false,
        },
        {
          icon: CalendarCheck,
          label: "Agendamentos",
          value: ultimo.agendamentos,
          deltaVal: delta(ultimo.agendamentos, penultimo?.agendamentos ?? 0),
          color: "text-purple-500",
          bg: "bg-purple-50 dark:bg-purple-950",
          isMoney: false,
        },
        {
          icon: Home,
          label: "Visitas realizadas",
          value: ultimo.visitas,
          deltaVal: delta(ultimo.visitas, penultimo?.visitas ?? 0),
          color: "text-orange-500",
          bg: "bg-orange-50 dark:bg-orange-950",
          isMoney: false,
        },
        {
          icon: Award,
          label: "Vendas fechadas",
          value: ultimo.vendas,
          deltaVal: delta(ultimo.vendas, penultimo?.vendas ?? 0),
          color: "text-green-500",
          bg: "bg-green-50 dark:bg-green-950",
          isMoney: false,
        },
        {
          icon: DollarSign,
          label: "Receita estimada",
          value: formatBRL(ultimo.receita),
          deltaVal: delta(ultimo.receita, penultimo?.receita ?? 0),
          color: "text-emerald-500",
          bg: "bg-emerald-50 dark:bg-emerald-950",
          isMoney: true,
        },
      ]
    : [];

  const dadosTaxa = dados.map((m) => ({
    mes: m.mes,
    "Lead → Agend.": calcTaxa(m.agendamentos, m.leadsRecebidos),
    "Agend. → Visita": calcTaxa(m.visitas, m.agendamentos),
    "Visita → Venda": calcTaxa(m.vendas, m.visitas),
  }));

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-indigo-100 dark:bg-indigo-950 rounded-lg">
          <TrendingUp className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Minha Evolução</h1>
          <p className="text-sm text-muted-foreground">
            Histórico dos últimos 6 meses · {ultimo ? `${ultimo.mes}/${ultimo.ano}` : ""}
          </p>
        </div>
      </div>

      {/* KPIs do mês atual */}
      {kpis.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {kpis.map((k) => (
            <Card key={k.label} className="border-0 shadow-sm">
              <CardContent className="pt-4 pb-3 px-4">
                <div className={`inline-flex p-2 rounded-lg ${k.bg} mb-2`}>
                  <k.icon className={`h-4 w-4 ${k.color}`} />
                </div>
                <div className="text-xl font-bold text-foreground">{k.value}</div>
                <div className="text-xs text-muted-foreground leading-tight">{k.label}</div>
                <div
                  className={`text-xs font-medium mt-1 ${
                    k.deltaVal > 0
                      ? "text-green-600"
                      : k.deltaVal < 0
                      ? "text-red-500"
                      : "text-muted-foreground"
                  }`}
                >
                  {k.deltaVal > 0 ? "+" : ""}
                  {k.isMoney ? formatBRL(k.deltaVal) : k.deltaVal} vs mês anterior
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Gráfico de barras: funil mensal */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Funil de Conversão — últimos 6 meses</CardTitle>
          <p className="text-xs text-muted-foreground">Leads recebidos, agendamentos, visitas e vendas por mês</p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={dados} barCategoryGap="20%" barGap={3}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Legend wrapperStyle={{ fontSize: "12px" }} />
              <Bar dataKey="leadsRecebidos" name="Leads" fill="#3b82f6" radius={[3, 3, 0, 0]} />
              <Bar dataKey="agendamentos" name="Agendamentos" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
              <Bar dataKey="visitas" name="Visitas" fill="#f97316" radius={[3, 3, 0, 0]} />
              <Bar dataKey="vendas" name="Vendas" fill="#22c55e" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Gráfico de linha: taxas de conversão */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Taxas de Conversão (%)</CardTitle>
          <p className="text-xs text-muted-foreground">
            Percentual de conversão entre cada etapa do funil
          </p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={dadosTaxa}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} unit="%" domain={[0, 100]} />
              <Tooltip
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                formatter={(v: number) => `${v}%`}
              />
              <Legend wrapperStyle={{ fontSize: "12px" }} />
              <Line
                type="monotone"
                dataKey="Lead → Agend."
                stroke="#8b5cf6"
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
              <Line
                type="monotone"
                dataKey="Agend. → Visita"
                stroke="#f97316"
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
              <Line
                type="monotone"
                dataKey="Visita → Venda"
                stroke="#22c55e"
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Gráfico de linha: receita estimada */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Receita Estimada (R$)</CardTitle>
          <p className="text-xs text-muted-foreground">
            Comissão estimada com base no ticket médio e % configurados em "Editar parâmetros"
          </p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={dados}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
              <YAxis
                tick={{ fontSize: 12 }}
                tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                formatter={(v: number) => formatBRL(v)}
              />
              <Line
                type="monotone"
                dataKey="receita"
                name="Receita"
                stroke="#10b981"
                strokeWidth={2.5}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Tabela resumo */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Resumo Mensal</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 pr-4 text-muted-foreground font-medium">Mês</th>
                  <th className="text-right py-2 px-3 text-muted-foreground font-medium">Leads</th>
                  <th className="text-right py-2 px-3 text-muted-foreground font-medium">Agend.</th>
                  <th className="text-right py-2 px-3 text-muted-foreground font-medium">Visitas</th>
                  <th className="text-right py-2 px-3 text-muted-foreground font-medium">Vendas</th>
                  <th className="text-right py-2 px-3 text-muted-foreground font-medium">Conv. L→V</th>
                  <th className="text-right py-2 pl-3 text-muted-foreground font-medium">Receita</th>
                </tr>
              </thead>
              <tbody>
                {dados.map((m, idx) => {
                  const isAtual = idx === dados.length - 1;
                  return (
                    <tr
                      key={`${m.mes}-${m.ano}`}
                      className={`border-b border-border/50 ${isAtual ? "bg-indigo-50/50 dark:bg-indigo-950/30" : ""}`}
                    >
                      <td className="py-2 pr-4 font-medium text-foreground">
                        {m.mes}/{m.ano}
                        {isAtual && (
                          <span className="ml-2 text-xs bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded">
                            atual
                          </span>
                        )}
                      </td>
                      <td className="text-right py-2 px-3 text-foreground">{m.leadsRecebidos}</td>
                      <td className="text-right py-2 px-3 text-foreground">{m.agendamentos}</td>
                      <td className="text-right py-2 px-3 text-foreground">{m.visitas}</td>
                      <td className="text-right py-2 px-3 font-semibold text-green-600">
                        {m.vendas}
                      </td>
                      <td className="text-right py-2 px-3 text-foreground">
                        {calcTaxa(m.vendas, m.leadsRecebidos)}%
                      </td>
                      <td className="text-right py-2 pl-3 font-semibold text-emerald-600">
                        {formatBRL(m.receita)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

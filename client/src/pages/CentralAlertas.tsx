import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle, Clock, Calendar, CreditCard, UserX, Phone,
  RefreshCw, ChevronDown, ChevronUp,
} from "lucide-react";
import { Link } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

function formatTempo(data: Date | string) {
  return formatDistanceToNow(new Date(data), { locale: ptBR, addSuffix: true });
}

type AlertaSecao = {
  key: string;
  titulo: string;
  descricao: string;
  icon: React.ReactNode;
  cor: string;
  bgCor: string;
  borda: string;
  items: any[];
  renderItem: (item: any) => React.ReactNode;
};

export default function CentralAlertas() {
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set(["followUpsVencidos", "leadsSemPrimeiroContato"]));
  const { data, isLoading, refetch, isFetching } = trpc.alertasGestor.lista.useQuery(undefined, {
    staleTime: 60_000,
    refetchInterval: 5 * 60 * 1000,
  });

  function toggle(key: string) {
    setExpandidos((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  const secoes: AlertaSecao[] = useMemo(() => {
    if (!data) return [];
    return [
      {
        key: "leadsSemPrimeiroContato",
        titulo: "Sem primeiro contato",
        descricao: "Leads aguardando atendimento há mais de 30 minutos sem contato",
        icon: <Phone className="h-5 w-5" />,
        cor: "text-red-600 dark:text-red-400",
        bgCor: "bg-red-50 dark:bg-red-950/30",
        borda: "border-red-200 dark:border-red-800",
        items: data.leadsSemPrimeiroContato,
        renderItem: (item: any) => (
          <div key={item.id} className="flex items-center justify-between gap-2 py-2 border-b last:border-0">
            <div>
              <p className="text-sm font-medium">{item.nome}</p>
              <p className="text-xs text-muted-foreground">{item.telefone} · {item.corretorNome ?? "Sem corretor"}</p>
            </div>
            <span className="text-xs text-red-600 dark:text-red-400 whitespace-nowrap">{formatTempo(item.createdAt)}</span>
          </div>
        ),
      },
      {
        key: "followUpsVencidos",
        titulo: "Follow-ups vencidos",
        descricao: "Follow-ups com data passada e ainda pendentes",
        icon: <Clock className="h-5 w-5" />,
        cor: "text-orange-600 dark:text-orange-400",
        bgCor: "bg-orange-50 dark:bg-orange-950/30",
        borda: "border-orange-200 dark:border-orange-800",
        items: data.followUpsVencidos,
        renderItem: (item: any) => (
          <div key={item.id} className="flex items-center justify-between gap-2 py-2 border-b last:border-0">
            <div>
              <p className="text-sm font-medium">{item.leadNome}</p>
              <p className="text-xs text-muted-foreground">{item.leadTelefone} · {item.corretorNome ?? "Sem corretor"}</p>
            </div>
            <span className="text-xs text-orange-600 dark:text-orange-400 whitespace-nowrap">{formatTempo(item.dataFollowUp)}</span>
          </div>
        ),
      },
      {
        key: "agendamentosSemConfirmacao",
        titulo: "Agendamentos de amanhã sem confirmação",
        descricao: "Agendamentos pendentes para amanhã que ainda não foram confirmados",
        icon: <Calendar className="h-5 w-5" />,
        cor: "text-yellow-600 dark:text-yellow-400",
        bgCor: "bg-yellow-50 dark:bg-yellow-950/30",
        borda: "border-yellow-200 dark:border-yellow-800",
        items: data.agendamentosSemConfirmacao,
        renderItem: (item: any) => (
          <div key={item.id} className="flex items-center justify-between gap-2 py-2 border-b last:border-0">
            <div>
              <p className="text-sm font-medium">{item.leadNome}</p>
              <p className="text-xs text-muted-foreground">{item.corretorNome ?? "Sem corretor"}</p>
            </div>
            <span className="text-xs text-yellow-600 dark:text-yellow-400 whitespace-nowrap">{item.horaAgendamento}</span>
          </div>
        ),
      },
      {
        key: "analisesSemRetorno",
        titulo: "Análises sem retorno há +5 dias",
        descricao: "Análises de crédito enviadas sem atualização de status por mais de 5 dias",
        icon: <CreditCard className="h-5 w-5" />,
        cor: "text-blue-600 dark:text-blue-400",
        bgCor: "bg-blue-50 dark:bg-blue-950/30",
        borda: "border-blue-200 dark:border-blue-800",
        items: data.analisesSemRetorno,
        renderItem: (item: any) => (
          <div key={item.id} className="flex items-center justify-between gap-2 py-2 border-b last:border-0">
            <div>
              <p className="text-sm font-medium">{item.leadNome}</p>
              <p className="text-xs text-muted-foreground">{item.corretorNome ?? "Sem corretor"}</p>
            </div>
            <span className="text-xs text-blue-600 dark:text-blue-400 whitespace-nowrap">{formatTempo(item.createdAt)}</span>
          </div>
        ),
      },
      {
        key: "corretoresSemAtividade",
        titulo: "Corretores sem atividade hoje",
        descricao: "Corretores com status 'presente' que ainda não registraram atividades",
        icon: <UserX className="h-5 w-5" />,
        cor: "text-purple-600 dark:text-purple-400",
        bgCor: "bg-purple-50 dark:bg-purple-950/30",
        borda: "border-purple-200 dark:border-purple-800",
        items: data.corretoresSemAtividade,
        renderItem: (item: any) => (
          <div key={item.id} className="flex items-center justify-between gap-2 py-2 border-b last:border-0">
            <p className="text-sm font-medium">{item.nome}</p>
            <Link href="/leads-por-corretor">
              <span className="text-xs text-primary hover:underline cursor-pointer">Ver leads</span>
            </Link>
          </div>
        ),
      },
    ];
  }, [data]);

  const totalAlertas = secoes.reduce((acc, s) => acc + s.items.length, 0);

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-4 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-orange-500" />
            <div>
              <h1 className="text-2xl font-bold">Central de Alertas</h1>
              <p className="text-sm text-muted-foreground">
                Situações que precisam da sua atenção agora
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {totalAlertas > 0 && (
              <Badge variant="destructive" className="text-sm px-3 py-1">
                {totalAlertas} alerta{totalAlertas !== 1 ? "s" : ""}
              </Badge>
            )}
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-2">
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </div>
        </div>

        {isLoading && (
          <div className="text-center py-12 text-muted-foreground">Carregando alertas...</div>
        )}

        {!isLoading && totalAlertas === 0 && (
          <Card className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20">
            <CardContent className="py-12 text-center">
              <p className="text-2xl mb-2">✅</p>
              <p className="font-semibold text-green-700 dark:text-green-400">Tudo em dia!</p>
              <p className="text-sm text-muted-foreground mt-1">Nenhum alerta ativo no momento.</p>
            </CardContent>
          </Card>
        )}

        {!isLoading && secoes.map((secao) => {
          if (!secao.items.length) return null;
          const aberto = expandidos.has(secao.key);
          return (
            <Card key={secao.key} className={`border ${secao.borda}`}>
              <CardHeader
                className={`cursor-pointer py-3 px-4 ${secao.bgCor} rounded-t-lg`}
                onClick={() => toggle(secao.key)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={secao.cor}>{secao.icon}</span>
                    <div>
                      <CardTitle className={`text-base ${secao.cor}`}>
                        {secao.titulo}
                        <Badge className={`ml-2 text-xs ${secao.bgCor} ${secao.cor} border ${secao.borda}`}>
                          {secao.items.length}
                        </Badge>
                      </CardTitle>
                      <p className="text-xs text-muted-foreground font-normal">{secao.descricao}</p>
                    </div>
                  </div>
                  {aberto ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </div>
              </CardHeader>
              {aberto && (
                <CardContent className="px-4 py-2">
                  {secao.items.map(secao.renderItem)}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </DashboardLayout>
  );
}

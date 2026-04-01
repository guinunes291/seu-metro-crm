import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, Users, TrendingUp, AlertCircle, Webhook, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";

export default function ControleLimites() {
  const [limitesLeads, setLimitesLeads] = useState<Record<number, number>>({});
  const [limitesWebhook, setLimitesWebhook] = useState<Record<number, number>>({});
  const [salvandoLeads, setSalvandoLeads] = useState<Record<number, boolean>>({});
  const [salvandoWebhook, setSalvandoWebhook] = useState<Record<number, boolean>>({});

  const { data: corretores, isLoading, refetch } = trpc.corretores.listarLimites.useQuery();
  
  const configurarLimiteLeads = trpc.corretores.configurarLimiteDiario.useMutation({
    onSuccess: () => {
      toast.success("Limite de distribuição atualizado", {
        description: "O limite diário de distribuição automática foi configurado com sucesso.",
      });
      refetch();
    },
    onError: (error) => {
      toast.error("Erro ao atualizar limite", {
        description: error.message,
      });
    },
  });

  const configurarLimiteWebhook = trpc.corretores.configurarLimiteWebhook.useMutation({
    onSuccess: () => {
      toast.success("Limite de webhook atualizado", {
        description: "O limite diário de webhook foi configurado com sucesso.",
      });
      refetch();
    },
    onError: (error) => {
      toast.error("Erro ao atualizar limite", {
        description: error.message,
      });
    },
  });

  const handleLimiteLeadsChange = (corretorId: number, valor: string) => {
    const numero = parseInt(valor) || 0;
    setLimitesLeads(prev => ({ ...prev, [corretorId]: numero }));
  };

  const handleLimiteWebhookChange = (corretorId: number, valor: string) => {
    const numero = parseInt(valor) || 0;
    setLimitesWebhook(prev => ({ ...prev, [corretorId]: numero }));
  };

  const handleSalvarLeads = async (corretorId: number, limiteAtual: number) => {
    const novoLimite = limitesLeads[corretorId] ?? limiteAtual;
    
    if (novoLimite < 0 || novoLimite > 200) {
      toast.error("Valor inválido", {
        description: "O limite deve estar entre 0 e 200 leads por dia.",
      });
      return;
    }

    setSalvandoLeads(prev => ({ ...prev, [corretorId]: true }));
    
    try {
      await configurarLimiteLeads.mutateAsync({
        corretorId,
        limite: novoLimite,
      });
    } finally {
      setSalvandoLeads(prev => ({ ...prev, [corretorId]: false }));
    }
  };

  const handleSalvarWebhook = async (corretorId: number, limiteAtual: number) => {
    const novoLimite = limitesWebhook[corretorId] ?? limiteAtual;
    
    if (novoLimite < 0 || novoLimite > 100) {
      toast.error("Valor inválido", {
        description: "O limite deve estar entre 0 e 100 leads por dia.",
      });
      return;
    }

    setSalvandoWebhook(prev => ({ ...prev, [corretorId]: true }));
    
    try {
      await configurarLimiteWebhook.mutateAsync({
        corretorId,
        limite: novoLimite,
      });
    } finally {
      setSalvandoWebhook(prev => ({ ...prev, [corretorId]: false }));
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  const totalCorretores = corretores?.length || 0;
  const corretoresPresentes = corretores?.filter(c => c.status === "presente").length || 0;
  const totalLeadsHoje = corretores?.reduce((acc, c) => acc + c.leadsRecebidosHoje, 0) || 0;
  const mediaLimiteLeads = totalCorretores > 0
    ? Math.round(corretores!.reduce((acc, c) => acc + c.limiteDiarioLeads, 0) / totalCorretores)
    : 0;
  const mediaLimiteWebhook = totalCorretores > 0
    ? Math.round(corretores!.reduce((acc, c) => acc + c.limiteDiarioWebhook, 0) / totalCorretores)
    : 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Cabeçalho */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Controle de Limites Diários</h1>
          <p className="text-muted-foreground mt-2">
            Configure limites separados para distribuição automática e webhook
          </p>
        </div>

        {/* Cards de Resumo */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Corretores</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalCorretores}</div>
              <p className="text-xs text-muted-foreground">
                {corretoresPresentes} presentes agora
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Leads Hoje</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalLeadsHoje}</div>
              <p className="text-xs text-muted-foreground">
                Distribuídos até agora
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Média Distribuição</CardTitle>
              <RefreshCw className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{mediaLimiteLeads}</div>
              <p className="text-xs text-muted-foreground">
                Leads/dia (automática)
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Média Webhook</CardTitle>
              <Webhook className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{mediaLimiteWebhook}</div>
              <p className="text-xs text-muted-foreground">
                Leads/dia (webhook)
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tabela de Corretores */}
        <Card>
          <CardHeader>
            <CardTitle>Configuração de Limites por Corretor</CardTitle>
            <CardDescription>
              Defina limites separados para distribuição automática (leads da base) e webhook (Facebook, formulários).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {corretores?.map((corretor) => {
                const limiteLeadsAtual = limitesLeads[corretor.corretorId] ?? corretor.limiteDiarioLeads;
                const limiteWebhookAtual = limitesWebhook[corretor.corretorId] ?? corretor.limiteDiarioWebhook;

                return (
                  <div
                    key={corretor.corretorId}
                    className="flex flex-col gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    {/* Linha 1: Avatar, Nome e Status */}
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={corretor.fotoUrl || undefined} />
                        <AvatarFallback>
                          {corretor.nome.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{corretor.nome}</p>
                        <p className="text-sm text-muted-foreground truncate">{corretor.email}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={corretor.status === "presente" ? "default" : "secondary"}>
                          {corretor.status === "presente" ? "Presente" : "Ausente"}
                        </Badge>
                        <div className="text-center min-w-[80px]">
                          <div className="text-lg font-bold">{corretor.leadsRecebidosHoje}</div>
                          <div className="text-xs text-muted-foreground">leads hoje</div>
                        </div>
                      </div>
                    </div>

                    {/* Linha 2: Controles de Limites */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-14">
                      {/* Limite de Distribuição Automática */}
                      <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                        <RefreshCw className="h-5 w-5 text-blue-500" />
                        <div className="flex-1">
                          <Label htmlFor={`limite-leads-${corretor.corretorId}`} className="text-xs font-medium">
                            Distribuição Automática
                          </Label>
                          <p className="text-xs text-muted-foreground">Leads da base (máx: 200)</p>
                        </div>
                        <Input
                          id={`limite-leads-${corretor.corretorId}`}
                          type="number"
                          min="0"
                          max="200"
                          value={limiteLeadsAtual}
                          onChange={(e) => handleLimiteLeadsChange(corretor.corretorId, e.target.value)}
                          className="w-20 text-center"
                        />
                        <Button
                          onClick={() => handleSalvarLeads(corretor.corretorId, corretor.limiteDiarioLeads)}
                          disabled={salvandoLeads[corretor.corretorId] || limiteLeadsAtual === corretor.limiteDiarioLeads}
                          size="sm"
                        >
                          {salvandoLeads[corretor.corretorId] ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Save className="h-4 w-4" />
                          )}
                        </Button>
                      </div>

                      {/* Limite de Webhook */}
                      <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                        <Webhook className="h-5 w-5 text-green-500" />
                        <div className="flex-1">
                          <Label htmlFor={`limite-webhook-${corretor.corretorId}`} className="text-xs font-medium">
                            Webhook
                          </Label>
                          <p className="text-xs text-muted-foreground">Facebook, formulários (máx: 100)</p>
                        </div>
                        <Input
                          id={`limite-webhook-${corretor.corretorId}`}
                          type="number"
                          min="0"
                          max="100"
                          value={limiteWebhookAtual}
                          onChange={(e) => handleLimiteWebhookChange(corretor.corretorId, e.target.value)}
                          className="w-20 text-center"
                        />
                        <Button
                          onClick={() => handleSalvarWebhook(corretor.corretorId, corretor.limiteDiarioWebhook)}
                          disabled={salvandoWebhook[corretor.corretorId] || limiteWebhookAtual === corretor.limiteDiarioWebhook}
                          size="sm"
                        >
                          {salvandoWebhook[corretor.corretorId] ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Save className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Informações Adicionais */}
        <Card>
          <CardHeader>
            <CardTitle>Como funciona?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-start gap-2">
              <RefreshCw className="h-4 w-4 mt-0.5 text-blue-500 flex-shrink-0" />
              <div>
                <strong className="text-foreground">Distribuição Automática:</strong> Limite para leads da base que são redistribuídos automaticamente. Corretores com 90% dos leads trabalhados e status "Presente" recebem leads até atingir este limite.
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Webhook className="h-4 w-4 mt-0.5 text-green-500 flex-shrink-0" />
              <div>
                <strong className="text-foreground">Webhook:</strong> Limite para leads que chegam via webhook (Facebook Lead Ads, formulários do site, etc.). Geralmente mais restrito que a distribuição automática.
              </div>
            </div>
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 text-orange-500 flex-shrink-0" />
              <div>
                Quando um corretor atinge qualquer um dos limites, ele para de receber leads daquele tipo até o próximo dia (reset à meia-noite).
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Users className="h-4 w-4 mt-0.5 text-purple-500 flex-shrink-0" />
              <div>
                Corretores com status "Ausente" não recebem leads, independente dos limites configurados.
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2, Users, Mail, Phone, AlertTriangle, CheckCircle2 } from "lucide-react";

export default function LimpezaDuplicatas() {
  const [selectedLeads, setSelectedLeads] = useState<Record<string, number[]>>({});
  const [merging, setMerging] = useState<string | null>(null);

  const { data: stats, isLoading: loadingStats } = trpc.duplicatas.stats.useQuery();
  const { data: gruposTelefone, isLoading: loadingTelefone, refetch: refetchTelefone } = trpc.duplicatas.listByTelefone.useQuery();
  const { data: gruposEmail, isLoading: loadingEmail, refetch: refetchEmail } = trpc.duplicatas.listByEmail.useQuery();
  const mergeMutation = trpc.duplicatas.merge.useMutation();

  const handleSelectLead = (grupoKey: string, leadId: number, isChecked: boolean) => {
    setSelectedLeads(prev => {
      const current = prev[grupoKey] || [];
      if (isChecked) {
        return { ...prev, [grupoKey]: [...current, leadId] };
      } else {
        return { ...prev, [grupoKey]: current.filter(id => id !== leadId) };
      }
    });
  };

  const handleMerge = async (grupoKey: string, leads: any[]) => {
    const selected = selectedLeads[grupoKey] || [];
    
    if (selected.length < 2) {
      toast({
        title: "Seleção inválida",
        description: "Selecione pelo menos 2 leads para mesclar",
        variant: "destructive",
      });
      return;
    }

    // Lead principal é o primeiro selecionado
    const leadPrincipalId = selected[0];
    const leadsDuplicadosIds = selected.slice(1);

    setMerging(grupoKey);

    try {
      const result = await mergeMutation.mutateAsync({
        leadPrincipalId,
        leadsDuplicadosIds,
      });

      if (result.success) {
        toast({
          title: "Mesclagem concluída",
          description: result.message,
        });

        // Limpar seleção
        setSelectedLeads(prev => {
          const newState = { ...prev };
          delete newState[grupoKey];
          return newState;
        });

        // Atualizar listas
        refetchTelefone();
        refetchEmail();
      } else {
        toast({
          title: "Erro ao mesclar",
          description: result.message,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro ao mesclar",
        description: error.message || "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setMerging(null);
    }
  };

  if (loadingStats) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="container py-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Limpeza de Duplicatas</h1>
          <p className="text-muted-foreground mt-2">
            Identifique e mescle leads duplicados mantendo o histórico completo
          </p>
        </div>

        {/* Estatísticas */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Grupos por Telefone</CardTitle>
              <Phone className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalGruposTelefone || 0}</div>
              <p className="text-xs text-muted-foreground">Telefones duplicados</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Grupos por Email</CardTitle>
              <Mail className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalGruposEmail || 0}</div>
              <p className="text-xs text-muted-foreground">Emails duplicados</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Duplicatas</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalLeadsDuplicados || 0}</div>
              <p className="text-xs text-muted-foreground">Leads para revisar</p>
            </CardContent>
          </Card>
        </div>

        {/* Alerta de instruções */}
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Como funciona:</strong> Selecione os leads que deseja mesclar em cada grupo. 
            O primeiro lead selecionado será mantido como principal, e os demais terão seu histórico 
            (agendamentos, follow-ups, observações) transferido para ele antes de serem movidos para a lixeira.
          </AlertDescription>
        </Alert>

        {/* Tabs de duplicatas */}
        <Tabs defaultValue="telefone" className="space-y-4">
          <TabsList>
            <TabsTrigger value="telefone">
              Por Telefone ({gruposTelefone?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="email">
              Por Email ({gruposEmail?.length || 0})
            </TabsTrigger>
          </TabsList>

          {/* Tab de telefone */}
          <TabsContent value="telefone" className="space-y-4">
            {loadingTelefone ? (
              <div className="flex items-center justify-center h-48">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : gruposTelefone && gruposTelefone.length > 0 ? (
              gruposTelefone.map((grupo, idx) => {
                const grupoKey = `tel-${idx}`;
                const selected = selectedLeads[grupoKey] || [];
                
                return (
                  <Card key={grupoKey}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Phone className="h-5 w-5" />
                        {grupo.valor}
                        <Badge variant="secondary">{grupo.totalLeads} duplicatas</Badge>
                      </CardTitle>
                      <CardDescription>
                        Selecione os leads para mesclar (o primeiro será mantido como principal)
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {grupo.leads.map((lead) => (
                        <div
                          key={lead.id}
                          className="flex items-start gap-3 p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                        >
                          <Checkbox
                            checked={selected.includes(lead.id)}
                            onCheckedChange={(checked) =>
                              handleSelectLead(grupoKey, lead.id, checked as boolean)
                            }
                          />
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{lead.nome}</span>
                              <Badge variant="outline">ID: {lead.id}</Badge>
                              {selected[0] === lead.id && (
                                <Badge variant="default">Principal</Badge>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground space-y-1">
                              <div>Email: {lead.email || "Não informado"}</div>
                              <div>Status: {lead.status}</div>
                              <div>Origem: {lead.origem}</div>
                              <div className="flex gap-4">
                                <span>Agendamentos: {lead.totalAgendamentos}</span>
                                <span>Follow-ups: {lead.totalFollowUps}</span>
                              </div>
                              <div className="text-xs">
                                Criado em: {new Date(lead.createdAt).toLocaleString("pt-BR")}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                      
                      <div className="flex justify-end">
                        <Button
                          onClick={() => handleMerge(grupoKey, grupo.leads)}
                          disabled={selected.length < 2 || merging === grupoKey}
                        >
                          {merging === grupoKey ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Mesclando...
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="mr-2 h-4 w-4" />
                              Mesclar Selecionados ({selected.length})
                            </>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center h-48">
                  <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
                  <p className="text-lg font-medium">Nenhuma duplicata encontrada por telefone</p>
                  <p className="text-sm text-muted-foreground">Todos os telefones são únicos</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Tab de email */}
          <TabsContent value="email" className="space-y-4">
            {loadingEmail ? (
              <div className="flex items-center justify-center h-48">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : gruposEmail && gruposEmail.length > 0 ? (
              gruposEmail.map((grupo, idx) => {
                const grupoKey = `email-${idx}`;
                const selected = selectedLeads[grupoKey] || [];
                
                return (
                  <Card key={grupoKey}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Mail className="h-5 w-5" />
                        {grupo.valor}
                        <Badge variant="secondary">{grupo.totalLeads} duplicatas</Badge>
                      </CardTitle>
                      <CardDescription>
                        Selecione os leads para mesclar (o primeiro será mantido como principal)
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {grupo.leads.map((lead) => (
                        <div
                          key={lead.id}
                          className="flex items-start gap-3 p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                        >
                          <Checkbox
                            checked={selected.includes(lead.id)}
                            onCheckedChange={(checked) =>
                              handleSelectLead(grupoKey, lead.id, checked as boolean)
                            }
                          />
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{lead.nome}</span>
                              <Badge variant="outline">ID: {lead.id}</Badge>
                              {selected[0] === lead.id && (
                                <Badge variant="default">Principal</Badge>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground space-y-1">
                              <div>Telefone: {lead.telefone}</div>
                              <div>Status: {lead.status}</div>
                              <div>Origem: {lead.origem}</div>
                              <div className="flex gap-4">
                                <span>Agendamentos: {lead.totalAgendamentos}</span>
                                <span>Follow-ups: {lead.totalFollowUps}</span>
                              </div>
                              <div className="text-xs">
                                Criado em: {new Date(lead.createdAt).toLocaleString("pt-BR")}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                      
                      <div className="flex justify-end">
                        <Button
                          onClick={() => handleMerge(grupoKey, grupo.leads)}
                          disabled={selected.length < 2 || merging === grupoKey}
                        >
                          {merging === grupoKey ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Mesclando...
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="mr-2 h-4 w-4" />
                              Mesclar Selecionados ({selected.length})
                            </>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center h-48">
                  <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
                  <p className="text-lg font-medium">Nenhuma duplicata encontrada por email</p>
                  <p className="text-sm text-muted-foreground">Todos os emails são únicos</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

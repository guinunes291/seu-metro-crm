import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { UserCircle, Phone, Mail, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useState } from "react";

export default function Distribuicao() {
  const { data: leadsNaoDistribuidos, isLoading: leadsLoading, refetch: refetchLeads } = trpc.distribution.getNaoDistribuidos.useQuery();
  const { data: corretores, isLoading: corretoresLoading } = trpc.corretores.list.useQuery();
  const distribuirMutation = trpc.distribution.distribuirManual.useMutation();
  
  const [selectedCorretor, setSelectedCorretor] = useState<Record<number, number>>({});

  const handleDistribuir = async (leadId: number) => {
    const corretorId = selectedCorretor[leadId];
    
    if (!corretorId) {
      toast.error("Selecione um corretor");
      return;
    }

    try {
      await distribuirMutation.mutateAsync({
        leadId,
        corretorId,
      });

      toast.success("Lead distribuído com sucesso!");
      refetchLeads();
      setSelectedCorretor(prev => {
        const newState = { ...prev };
        delete newState[leadId];
        return newState;
      });
    } catch (error) {
      toast.error("Erro ao distribuir lead");
    }
  };

  return (
    <DashboardLayout>
      <div className="container py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Distribuição de Leads</h1>
          <p className="text-muted-foreground mt-2">
            Gerencie a distribuição manual de leads para os corretores
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Leads não distribuídos */}
          <Card>
            <CardHeader>
              <CardTitle>Leads Aguardando Distribuição</CardTitle>
              <CardDescription>
                {leadsNaoDistribuidos?.length || 0} leads aguardando atribuição
              </CardDescription>
            </CardHeader>
            <CardContent>
              {leadsLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                </div>
              ) : leadsNaoDistribuidos && leadsNaoDistribuidos.length > 0 ? (
                <div className="space-y-4">
                  {leadsNaoDistribuidos.map((lead) => (
                    <div key={lead.id} className="border rounded-lg p-4 space-y-3">
                      <div>
                        <p className="font-medium">{lead.nome}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                          <Phone className="h-3 w-3" />
                          <span>{lead.telefone}</span>
                        </div>
                        {lead.email && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                            <Mail className="h-3 w-3" />
                            <span>{lead.email}</span>
                          </div>
                        )}
                        {lead.origem && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Origem: {lead.origem}
                          </p>
                        )}
                      </div>
                      
                      <div className="flex gap-2">
                        <Select
                          value={selectedCorretor[lead.id]?.toString() || ""}
                          onValueChange={(value) => setSelectedCorretor(prev => ({
                            ...prev,
                            [lead.id]: parseInt(value)
                          }))}
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Selecione um corretor" />
                          </SelectTrigger>
                          <SelectContent>
                            {corretores?.map((corretor) => (
                              <SelectItem key={corretor.id} value={corretor.id.toString()}>
                                {corretor.name} {corretor.status === "presente" && "✓"}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        
                        <Button
                          size="sm"
                          onClick={() => handleDistribuir(lead.id)}
                          disabled={!selectedCorretor[lead.id] || distribuirMutation.isPending}
                        >
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Nenhum lead aguardando distribuição</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Corretores disponíveis */}
          <Card>
            <CardHeader>
              <CardTitle>Corretores</CardTitle>
              <CardDescription>
                Status e disponibilidade dos corretores
              </CardDescription>
            </CardHeader>
            <CardContent>
              {corretoresLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                </div>
              ) : corretores && corretores.length > 0 ? (
                <div className="space-y-3">
                  {corretores.map((corretor) => (
                    <div key={corretor.id} className="flex items-center justify-between border rounded-lg p-3">
                      <div className="flex items-center gap-3">
                        <UserCircle className="h-8 w-8 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{corretor.name}</p>
                          {corretor.email && (
                            <p className="text-xs text-muted-foreground">{corretor.email}</p>
                          )}
                        </div>
                      </div>
                      <Badge variant={corretor.status === "presente" ? "default" : "secondary"}>
                        {corretor.status === "presente" ? "Presente" : "Ausente"}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Nenhum corretor cadastrado</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}

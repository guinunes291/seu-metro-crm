import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Building2, Check, X, Clock, MapPin, User, Calendar, Eye } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

export default function AprovarProjetos() {
  const { user } = useAuth();
  const { data: suggestions = [], isLoading, refetch } = trpc.projects.pendingSuggestions.useQuery();
  const approveMutation = trpc.projects.approveSuggestion.useMutation();
  const rejectMutation = trpc.projects.rejectSuggestion.useMutation();
  
  const [selectedSuggestion, setSelectedSuggestion] = useState<any>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const isGestor = user?.role === "gestor" || user?.role === "admin";

  if (!isGestor) {
    return (
      <DashboardLayout>
        <div className="container mx-auto p-6">
          <div className="text-center py-12">
            <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">Acesso Restrito</h2>
            <p className="text-muted-foreground">Apenas gestores podem aprovar sugestões de projetos.</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const handleApprove = async (id: number) => {
    try {
      await approveMutation.mutateAsync({ id });
      toast.success("Projeto aprovado e adicionado ao catálogo!");
      refetch();
      setDetailsOpen(false);
    } catch (error) {
      toast.error("Erro ao aprovar projeto");
    }
  };

  const handleReject = async (id: number) => {
    try {
      await rejectMutation.mutateAsync({ id });
      toast.success("Sugestão rejeitada");
      refetch();
      setDetailsOpen(false);
    } catch (error) {
      toast.error("Erro ao rejeitar sugestão");
    }
  };

  const openDetails = (suggestion: any) => {
    setSelectedSuggestion(suggestion);
    setDetailsOpen(true);
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <Building2 className="h-12 w-12 animate-pulse mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Carregando sugestões...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Aprovar Projetos</h1>
          <p className="text-muted-foreground mt-1">
            Revise e aprove sugestões de projetos enviadas pelos corretores
          </p>
        </div>

        {suggestions.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <Check className="h-12 w-12 mx-auto mb-4 text-green-500" />
                <h2 className="text-xl font-semibold mb-2">Tudo em dia!</h2>
                <p className="text-muted-foreground">
                  Não há sugestões de projetos pendentes para aprovação.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {suggestions.map((suggestion: any) => (
              <Card key={suggestion.id} className="border-amber-200 bg-amber-50/50">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Building2 className="h-5 w-5" />
                        {suggestion.nome}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        <span className="flex items-center gap-4 text-sm">
                          {suggestion.construtora && (
                            <span>{suggestion.construtora}</span>
                          )}
                          {suggestion.bairro && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {suggestion.bairro}
                            </span>
                          )}
                        </span>
                      </CardDescription>
                    </div>
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Pendente
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-4">
                    {suggestion.zona && (
                      <div>
                        <p className="text-xs text-muted-foreground">Zona</p>
                        <p className="font-medium capitalize">{suggestion.zona}</p>
                      </div>
                    )}
                    {suggestion.tipo && (
                      <div>
                        <p className="text-xs text-muted-foreground">Tipo</p>
                        <p className="font-medium uppercase">{suggestion.tipo}</p>
                      </div>
                    )}
                    {(suggestion.valorMinimo || suggestion.valorMaximo) && (
                      <div>
                        <p className="text-xs text-muted-foreground">Valor</p>
                        <p className="font-medium">
                          {suggestion.valorMinimo && suggestion.valorMaximo
                            ? `R$ ${suggestion.valorMinimo.toLocaleString('pt-BR')} - R$ ${suggestion.valorMaximo.toLocaleString('pt-BR')}`
                            : suggestion.valorMinimo
                            ? `A partir de R$ ${suggestion.valorMinimo.toLocaleString('pt-BR')}`
                            : `Até R$ ${suggestion.valorMaximo.toLocaleString('pt-BR')}`}
                        </p>
                      </div>
                    )}
                    {suggestion.dormitorios && (
                      <div>
                        <p className="text-xs text-muted-foreground">Dormitórios</p>
                        <p className="font-medium">{suggestion.dormitorios}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <User className="h-4 w-4" />
                      <span>Sugerido por: {suggestion.suggestedByName || "Corretor"}</span>
                      <Calendar className="h-4 w-4 ml-4" />
                      <span>{new Date(suggestion.createdAt).toLocaleDateString('pt-BR')}</span>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openDetails(suggestion)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Detalhes
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleReject(suggestion.id)}
                        disabled={rejectMutation.isPending}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Rejeitar
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleApprove(suggestion.id)}
                        disabled={approveMutation.isPending}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Aprovar
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Modal de Detalhes */}
        <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                {selectedSuggestion?.nome}
              </DialogTitle>
              <DialogDescription>
                Detalhes completos da sugestão de projeto
              </DialogDescription>
            </DialogHeader>
            
            {selectedSuggestion && (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Construtora</p>
                    <p className="font-medium">{selectedSuggestion.construtora || "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Bairro</p>
                    <p className="font-medium">{selectedSuggestion.bairro || "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Endereço</p>
                    <p className="font-medium">{selectedSuggestion.endereco || "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Zona</p>
                    <p className="font-medium capitalize">{selectedSuggestion.zona || "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Tipo</p>
                    <p className="font-medium uppercase">{selectedSuggestion.tipo || "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Dormitórios</p>
                    <p className="font-medium">{selectedSuggestion.dormitorios || "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Valor Mínimo</p>
                    <p className="font-medium">
                      {selectedSuggestion.valorMinimo 
                        ? `R$ ${selectedSuggestion.valorMinimo.toLocaleString('pt-BR')}`
                        : "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Valor Máximo</p>
                    <p className="font-medium">
                      {selectedSuggestion.valorMaximo 
                        ? `R$ ${selectedSuggestion.valorMaximo.toLocaleString('pt-BR')}`
                        : "-"}
                    </p>
                  </div>
                </div>
                
                {selectedSuggestion.descricao && (
                  <div>
                    <p className="text-sm text-muted-foreground">Descrição</p>
                    <p className="font-medium">{selectedSuggestion.descricao}</p>
                  </div>
                )}
                
                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button
                    variant="destructive"
                    onClick={() => handleReject(selectedSuggestion.id)}
                    disabled={rejectMutation.isPending}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Rejeitar Sugestão
                  </Button>
                  <Button
                    onClick={() => handleApprove(selectedSuggestion.id)}
                    disabled={approveMutation.isPending}
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Aprovar e Adicionar ao Catálogo
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

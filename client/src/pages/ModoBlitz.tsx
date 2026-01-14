import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle2,
  XCircle,
  ArrowRight,
  ArrowLeft,
  Phone,
  MessageSquare,
  Zap,
  Trophy,
  Clock,
  Filter,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import DashboardLayout from "@/components/DashboardLayout";

export default function ModoBlitz() {
  const { user } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [observacoes, setObservacoes] = useState("");
  const [startTime] = useState(Date.now());
  const [processedCount, setProcessedCount] = useState(0);
  const [showFiltros, setShowFiltros] = useState(false);
  
  // Estados de filtro
  const [ordenacao, setOrdenacao] = useState<"mais_antigos" | "mais_recentes" | "menos_tentativas" | "mais_tentativas">("mais_antigos");
  const [projetoId, setProjetoId] = useState<number | undefined>(undefined);
  const [origem, setOrigem] = useState<string | undefined>(undefined);

  // Buscar follow-ups do dia
  const { data: followUps, isLoading, refetch } = trpc.followUps.getFollowUpsDoDiaExpandido.useQuery(
    {
      ordenacao,
      projetoId,
      origem,
    },
    {
      enabled: !!user,
      refetchOnWindowFocus: false,
    }
  );

  // Mutation para registrar follow-up
  const registrarFollowUp = trpc.followUps.registrarTentativa.useMutation({
    onSuccess: () => {
      refetch();
      setProcessedCount((prev) => prev + 1);
    },
    onError: (error) => {
      toast.error(`Erro ao registrar follow-up: ${error.message}`);
    },
  });

  const currentLead = followUps?.[currentIndex];
  const totalLeads = followUps?.length || 0;
  const progress = totalLeads > 0 ? ((currentIndex + 1) / totalLeads) * 100 : 0;
  const elapsedMinutes = Math.floor((Date.now() - startTime) / 60000);
  const averageTimePerLead = processedCount > 0 ? elapsedMinutes / processedCount : 0;
  const estimatedTimeRemaining = Math.ceil((totalLeads - currentIndex - 1) * averageTimePerLead);

  // Atalhos de teclado
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement) return;

      if (e.key === "ArrowRight" || e.key === "Enter") {
        e.preventDefault();
        handleNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        handlePrevious();
      } else if (e.key === "1") {
        e.preventDefault();
        handleRegistrar("respondeu");
      } else if (e.key === "2") {
        e.preventDefault();
        handleRegistrar("nao_respondeu");
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [currentIndex, observacoes]);

  const handleRegistrar = useCallback(
    async (resultado: "respondeu" | "nao_respondeu") => {
      if (!currentLead) return;

      await registrarFollowUp.mutateAsync({
        followUpId: currentLead.id,
        resultado,
        observacao: observacoes || undefined,
      });

      // Limpar observações e avançar
      setObservacoes("");
      if (currentIndex < totalLeads - 1) {
        setCurrentIndex((prev) => prev + 1);
      } else {
        toast.success("🎉 Todos os follow-ups foram concluídos!");
      }
    },
    [currentLead, observacoes, currentIndex, totalLeads, registrarFollowUp]
  );

  const handleNext = () => {
    if (currentIndex < totalLeads - 1) {
      setCurrentIndex((prev) => prev + 1);
      setObservacoes("");
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      setObservacoes("");
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Carregando follow-ups...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!followUps || followUps.length === 0) {
    return (
      <DashboardLayout>
        <div className="container max-w-4xl py-8">
          <Card className="p-12 text-center">
            <Trophy className="mx-auto h-16 w-16 text-green-500 mb-4" />
            <h2 className="text-2xl font-bold mb-2">Parabéns!</h2>
            <p className="text-muted-foreground">
              Você não tem follow-ups pendentes para hoje.
            </p>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="container max-w-6xl py-8">
        {/* Header com estatísticas */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Zap className="h-8 w-8 text-yellow-500" />
                Modo Blitz
              </h1>
              <p className="text-muted-foreground">
                Processe follow-ups rapidamente com atalhos de teclado
              </p>
            </div>
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFiltros(!showFiltros)}
                className="gap-2"
              >
                <Filter className="h-4 w-4" />
                Filtros
                {(projetoId || origem || ordenacao !== "mais_antigos") && (
                  <Badge variant="secondary" className="ml-1">
                    {[projetoId ? 1 : 0, origem ? 1 : 0, ordenacao !== "mais_antigos" ? 1 : 0].reduce((a, b) => a + b, 0)}
                  </Badge>
                )}
              </Button>
              <div className="text-right">
                <div className="text-3xl font-bold text-primary">
                  {currentIndex + 1} / {totalLeads}
                </div>
                <p className="text-sm text-muted-foreground">Follow-ups</p>
              </div>
            </div>
          </div>

          {/* Barra de progresso */}
          <div className="space-y-2">
            <Progress value={progress} className="h-3" />
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {elapsedMinutes} min decorridos
                </span>
                {averageTimePerLead > 0 && (
                  <span>
                    ~{averageTimePerLead.toFixed(1)} min/lead
                  </span>
                )}
              </div>
              {estimatedTimeRemaining > 0 && (
                <span>
                  Tempo estimado restante: ~{estimatedTimeRemaining} min
                </span>
              )}
            </div>
          </div>
          
          {/* Painel de Filtros */}
          {showFiltros && (
            <Card className="p-4 mt-4 bg-muted/50">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  Filtros
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setOrdenacao("mais_antigos");
                    setProjetoId(undefined);
                    setOrigem(undefined);
                    setCurrentIndex(0);
                  }}
                >
                  <X className="h-4 w-4 mr-1" />
                  Limpar Filtros
                </Button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Ordenação */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Ordenação</label>
                  <select
                    value={ordenacao}
                    onChange={(e) => {
                      setOrdenacao(e.target.value as any);
                      setCurrentIndex(0);
                    }}
                    className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm"
                  >
                    <option value="mais_antigos">Leads mais antigos primeiro</option>
                    <option value="mais_recentes">Leads mais recentes primeiro</option>
                    <option value="menos_tentativas">Menos tentativas primeiro</option>
                    <option value="mais_tentativas">Mais tentativas primeiro</option>
                  </select>
                </div>
                
                {/* Projeto */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Projeto</label>
                  <select
                    value={projetoId || ""}
                    onChange={(e) => {
                      setProjetoId(e.target.value ? Number(e.target.value) : undefined);
                      setCurrentIndex(0);
                    }}
                    className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm"
                  >
                    <option value="">Todos os projetos</option>
                    {/* Projetos serão carregados dinamicamente */}
                  </select>
                </div>
                
                {/* Origem */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Origem</label>
                  <select
                    value={origem || ""}
                    onChange={(e) => {
                      setOrigem(e.target.value || undefined);
                      setCurrentIndex(0);
                    }}
                    className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm"
                  >
                    <option value="">Todas as origens</option>
                    <option value="facebook_ads">Facebook Ads</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="site">Site</option>
                    <option value="indicacao">Indicação</option>
                    <option value="outro">Outro</option>
                  </select>
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* Card principal do lead */}
        <Card className="p-8 mb-6">
          <div className="space-y-6">
            {/* Informações do lead */}
            <div>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-2xl font-bold mb-2">{currentLead.leadNome}</h2>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="text-base">
                      <Phone className="h-4 w-4 mr-1" />
                      {currentLead.leadTelefone}
                    </Badge>
                    {currentLead.leadEmail && (
                      <Badge variant="outline" className="text-base">
                        {currentLead.leadEmail}
                      </Badge>
                    )}
                  </div>
                </div>
                <Badge variant="secondary" className="text-lg px-4 py-2">
                  Tentativa {currentLead.tentativaAtual}/{currentLead.maxTentativas}
                </Badge>
              </div>

              {currentLead.leadObservacoes && (
                <div className="bg-muted p-4 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Observações anteriores:</p>
                  <p className="text-sm">{currentLead.leadObservacoes}</p>
                </div>
              )}
            </div>

            {/* Campo de observações */}
            <div>
              <label className="text-sm font-medium mb-2 block">
                Observações (opcional)
              </label>
              <Textarea
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Digite observações sobre este contato..."
                className="min-h-[100px]"
                autoFocus
              />
            </div>

            {/* Botões de ação */}
            <div className="grid grid-cols-2 gap-4">
              <Button
                size="lg"
                variant="default"
                className="h-20 text-lg"
                onClick={() => handleRegistrar("respondeu")}
                disabled={registrarFollowUp.isLoading}
              >
                <CheckCircle2 className="h-6 w-6 mr-2" />
                Respondeu
                <kbd className="ml-auto px-2 py-1 text-xs bg-background/50 rounded">1</kbd>
              </Button>
              <Button
                size="lg"
                variant="destructive"
                className="h-20 text-lg"
                onClick={() => handleRegistrar("nao_respondeu")}
                disabled={registrarFollowUp.isLoading}
              >
                <XCircle className="h-6 w-6 mr-2" />
                Não Respondeu
                <kbd className="ml-auto px-2 py-1 text-xs bg-background/50 rounded">2</kbd>
              </Button>
            </div>
          </div>
        </Card>

        {/* Navegação */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentIndex === 0}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Anterior
            <kbd className="ml-2 px-2 py-1 text-xs bg-muted rounded">←</kbd>
          </Button>

          <div className="text-sm text-muted-foreground">
            Use as setas do teclado para navegar
          </div>

          <Button
            variant="outline"
            onClick={handleNext}
            disabled={currentIndex === totalLeads - 1}
          >
            Próximo
            <kbd className="mr-2 px-2 py-1 text-xs bg-muted rounded">→</kbd>
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>

        {/* Atalhos de teclado */}
        <Card className="mt-6 p-4 bg-muted/50">
          <p className="text-sm font-medium mb-2">Atalhos de Teclado:</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-muted-foreground">
            <div><kbd className="px-2 py-1 bg-background rounded">1</kbd> Respondeu</div>
            <div><kbd className="px-2 py-1 bg-background rounded">2</kbd> Não Respondeu</div>
            <div><kbd className="px-2 py-1 bg-background rounded">←</kbd> Anterior</div>
            <div><kbd className="px-2 py-1 bg-background rounded">→</kbd> Próximo</div>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}

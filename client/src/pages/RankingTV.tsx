import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Trophy, Medal, Phone, Calendar, Eye, FileText, 
  DollarSign, TrendingUp, Maximize, RefreshCw, Users,
  Target, Award, Star, Zap
} from "lucide-react";
import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";

// Formatar valor em reais
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value / 100);
}

// Componente do pódio para os top 3
function Podium({ ranking }: { ranking: any[] }) {
  if (ranking.length === 0) return null;
  
  const top3 = ranking.slice(0, 3);
  const [segundo, primeiro, terceiro] = [top3[1], top3[0], top3[2]];
  
  return (
    <div className="flex items-end justify-center gap-4 mb-8">
      {/* 2º Lugar */}
      {segundo && (
        <div className="flex flex-col items-center animate-fade-in">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center text-2xl font-bold text-white shadow-lg">
              {segundo.corretorNome?.charAt(0) || "?"}
            </div>
            <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-gray-400 flex items-center justify-center">
              <Medal className="w-5 h-5 text-white" />
            </div>
          </div>
          <div className="mt-3 text-center">
            <p className="font-semibold text-lg">{segundo.corretorNome?.split(' ')[0]}</p>
            <p className="text-2xl font-bold text-gray-600">{segundo.pontuacaoTotal || segundo.totalPontos || 0}</p>
            <p className="text-xs text-muted-foreground">pontos</p>
          </div>
          <div className="w-24 h-32 bg-gradient-to-t from-gray-400 to-gray-300 rounded-t-lg mt-2 flex items-center justify-center">
            <span className="text-4xl font-bold text-white">2º</span>
          </div>
        </div>
      )}
      
      {/* 1º Lugar */}
      {primeiro && (
        <div className="flex flex-col items-center animate-fade-in">
          <div className="relative">
            <div className="w-28 h-28 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center text-3xl font-bold text-white shadow-xl ring-4 ring-yellow-300">
              {primeiro.corretorNome?.charAt(0) || "?"}
            </div>
            <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-full bg-yellow-500 flex items-center justify-center">
              <Trophy className="w-6 h-6 text-white" />
            </div>
          </div>
          <div className="mt-3 text-center">
            <p className="font-bold text-xl">{primeiro.corretorNome?.split(' ')[0]}</p>
            <p className="text-3xl font-bold text-yellow-600">{primeiro.pontuacaoTotal || primeiro.totalPontos || 0}</p>
            <p className="text-sm text-muted-foreground">pontos</p>
          </div>
          <div className="w-28 h-44 bg-gradient-to-t from-yellow-500 to-yellow-400 rounded-t-lg mt-2 flex items-center justify-center">
            <span className="text-5xl font-bold text-white">1º</span>
          </div>
        </div>
      )}
      
      {/* 3º Lugar */}
      {terceiro && (
        <div className="flex flex-col items-center animate-fade-in">
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-600 to-amber-800 flex items-center justify-center text-xl font-bold text-white shadow-lg">
              {terceiro.corretorNome?.charAt(0) || "?"}
            </div>
            <div className="absolute -bottom-2 -right-2 w-7 h-7 rounded-full bg-amber-700 flex items-center justify-center">
              <Award className="w-4 h-4 text-white" />
            </div>
          </div>
          <div className="mt-3 text-center">
            <p className="font-semibold">{terceiro.corretorNome?.split(' ')[0]}</p>
            <p className="text-xl font-bold text-amber-700">{terceiro.pontuacaoTotal || terceiro.totalPontos || 0}</p>
            <p className="text-xs text-muted-foreground">pontos</p>
          </div>
          <div className="w-20 h-24 bg-gradient-to-t from-amber-700 to-amber-600 rounded-t-lg mt-2 flex items-center justify-center">
            <span className="text-3xl font-bold text-white">3º</span>
          </div>
        </div>
      )}
    </div>
  );
}

// Componente de card de métrica individual
function MetricCard({ 
  icon: Icon, 
  label, 
  value, 
  meta, 
  color 
}: { 
  icon: any; 
  label: string; 
  value: number; 
  meta?: number; 
  color: string;
}) {
  const percentage = meta ? Math.min((value / meta) * 100, 100) : 0;
  const atingiuMeta = meta ? value >= meta : false;
  
  return (
    <div className={`p-4 rounded-xl ${atingiuMeta ? 'bg-green-50 border-2 border-green-500' : 'bg-card border'}`}>
      <div className="flex items-center gap-3 mb-2">
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <span className="font-medium text-sm">{label}</span>
        {atingiuMeta && <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold">{value}</span>
        {meta && <span className="text-sm text-muted-foreground">/ {meta}</span>}
      </div>
      {meta && (
        <Progress 
          value={percentage} 
          className={`mt-2 h-2 ${atingiuMeta ? '[&>div]:bg-green-500' : ''}`}
        />
      )}
    </div>
  );
}

// Componente de linha do ranking
function RankingRow({ 
  position, 
  corretor, 
  isDaily 
}: { 
  position: number; 
  corretor: any; 
  isDaily: boolean;
}) {
  const pontos = isDaily ? corretor.pontuacaoTotal : corretor.totalPontos;
  
  return (
    <div className={`flex items-center gap-4 p-4 rounded-xl transition-all ${
      position <= 3 ? 'bg-gradient-to-r from-primary/10 to-transparent' : 'bg-card'
    } border`}>
      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
        position === 1 ? 'bg-yellow-500 text-white' :
        position === 2 ? 'bg-gray-400 text-white' :
        position === 3 ? 'bg-amber-700 text-white' :
        'bg-muted text-muted-foreground'
      }`}>
        {position}º
      </div>
      
      <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-lg font-bold">
        {corretor.corretorNome?.charAt(0) || "?"}
      </div>
      
      <div className="flex-1">
        <p className="font-semibold">{corretor.corretorNome}</p>
        <div className="flex gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Phone className="w-3 h-3" />
            {isDaily ? corretor.ligacoesRealizadas : corretor.totalLigacoes || 0}
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {isDaily ? corretor.agendamentosConfirmados : corretor.totalAgendamentos || 0}
          </span>
          <span className="flex items-center gap-1">
            <Eye className="w-3 h-3" />
            {isDaily ? corretor.visitasRealizadas : corretor.totalVisitas || 0}
          </span>
          <span className="flex items-center gap-1">
            <FileText className="w-3 h-3" />
            {isDaily ? corretor.documentacoesRecolhidas : corretor.totalDocumentacoes || 0}
          </span>
        </div>
      </div>
      
      <div className="text-right">
        <p className="text-2xl font-bold text-primary">{pontos || 0}</p>
        <p className="text-xs text-muted-foreground">pontos</p>
      </div>
      
      <div className="text-right min-w-[100px]">
        <p className="text-lg font-semibold text-green-600">
          {formatCurrency(isDaily ? corretor.vgvDia : corretor.totalVgv || 0)}
        </p>
        <p className="text-xs text-muted-foreground">VGV</p>
      </div>
    </div>
  );
}

// Componente principal
export default function RankingTV() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTab, setActiveTab] = useState("dia");
  
  // Queries
  const { data: rankingDia, refetch: refetchDia } = trpc.ranking.dia.useQuery(undefined, {
    refetchInterval: 30000, // Atualiza a cada 30 segundos
  });
  
  const { data: rankingSemanal, refetch: refetchSemanal } = trpc.ranking.semanal.useQuery(undefined, {
    refetchInterval: 60000, // Atualiza a cada 60 segundos
  });
  
  const { data: rankingMensal, refetch: refetchMensal } = trpc.ranking.mensal.useQuery(undefined, {
    refetchInterval: 60000,
  });
  
  // Função para entrar em tela cheia
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };
  
  // Detectar saída do fullscreen
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);
  
  // Atualizar todos os rankings
  const refetchAll = () => {
    refetchDia();
    refetchSemanal();
    refetchMensal();
  };
  
  const currentRanking = activeTab === "dia" ? rankingDia : 
                         activeTab === "semana" ? rankingSemanal : 
                         rankingMensal;
  
  // Calcular totais do dia
  const totaisDia = rankingDia?.reduce((acc, curr) => ({
    ligacoes: acc.ligacoes + (curr.ligacoesRealizadas || 0),
    agendamentos: acc.agendamentos + (curr.agendamentosConfirmados || 0),
    visitas: acc.visitas + (curr.visitasRealizadas || 0),
    documentacoes: acc.documentacoes + (curr.documentacoesRecolhidas || 0),
    contratos: acc.contratos + (curr.contratosFechados || 0),
    vgv: acc.vgv + (curr.vgvDia || 0),
  }), { ligacoes: 0, agendamentos: 0, visitas: 0, documentacoes: 0, contratos: 0, vgv: 0 });
  
  const content = (
    <div className={`min-h-screen ${isFullscreen ? 'bg-background p-8' : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-primary/10">
            <Trophy className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Ranking de Produtividade</h1>
            <p className="text-muted-foreground">
              Atualizado em tempo real • {new Date().toLocaleDateString('pt-BR', { 
                weekday: 'long', 
                day: 'numeric', 
                month: 'long' 
              })}
            </p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={refetchAll}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={toggleFullscreen}>
            <Maximize className="w-4 h-4" />
          </Button>
        </div>
      </div>
      
      {/* Cards de resumo do dia */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <MetricCard 
          icon={Phone} 
          label="Ligações" 
          value={totaisDia?.ligacoes || 0} 
          color="bg-blue-500"
        />
        <MetricCard 
          icon={Calendar} 
          label="Agendamentos" 
          value={totaisDia?.agendamentos || 0} 
          color="bg-orange-500"
        />
        <MetricCard 
          icon={Eye} 
          label="Visitas" 
          value={totaisDia?.visitas || 0} 
          color="bg-purple-500"
        />
        <MetricCard 
          icon={FileText} 
          label="Documentações" 
          value={totaisDia?.documentacoes || 0} 
          color="bg-cyan-500"
        />
        <MetricCard 
          icon={Target} 
          label="Contratos" 
          value={totaisDia?.contratos || 0} 
          color="bg-green-500"
        />
        <Card className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-white/20">
                <DollarSign className="w-5 h-5" />
              </div>
              <span className="font-medium text-sm">VGV Total</span>
            </div>
            <p className="text-2xl font-bold">{formatCurrency(totaisDia?.vgv || 0)}</p>
          </CardContent>
        </Card>
      </div>
      
      {/* Tabs de período */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="dia" className="flex items-center gap-2">
            <Zap className="w-4 h-4" />
            Hoje
          </TabsTrigger>
          <TabsTrigger value="semana" className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Semana
          </TabsTrigger>
          <TabsTrigger value="mes" className="flex items-center gap-2">
            <Trophy className="w-4 h-4" />
            Mês
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="dia" className="space-y-6">
          {/* Pódio */}
          {rankingDia && rankingDia.length > 0 && (
            <Podium ranking={rankingDia} />
          )}
          
          {/* Lista completa */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Ranking Completo - Hoje
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {rankingDia?.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  Nenhuma atividade registrada hoje ainda.
                </p>
              )}
              {rankingDia?.map((corretor, index) => (
                <RankingRow 
                  key={corretor.corretorId} 
                  position={index + 1} 
                  corretor={corretor}
                  isDaily={true}
                />
              ))}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="semana" className="space-y-6">
          {rankingSemanal && rankingSemanal.length > 0 && (
            <Podium ranking={rankingSemanal} />
          )}
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Ranking Completo - Semana
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {rankingSemanal?.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  Nenhuma atividade registrada esta semana ainda.
                </p>
              )}
              {rankingSemanal?.map((corretor, index) => (
                <RankingRow 
                  key={corretor.corretorId} 
                  position={index + 1} 
                  corretor={corretor}
                  isDaily={false}
                />
              ))}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="mes" className="space-y-6">
          {rankingMensal && rankingMensal.length > 0 && (
            <Podium ranking={rankingMensal} />
          )}
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Ranking Completo - Mês
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {rankingMensal?.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  Nenhuma atividade registrada este mês ainda.
                </p>
              )}
              {rankingMensal?.map((corretor, index) => (
                <RankingRow 
                  key={corretor.corretorId} 
                  position={index + 1} 
                  corretor={corretor}
                  isDaily={false}
                />
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Rodapé com última atualização */}
      <div className="mt-8 text-center text-sm text-muted-foreground">
        <p>Atualização automática a cada 30 segundos</p>
        <p className="flex items-center justify-center gap-2 mt-1">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
          Sistema online
        </p>
      </div>
    </div>
  );
  
  // Se estiver em fullscreen, renderiza sem o layout
  if (isFullscreen) {
    return content;
  }
  
  return (
    <DashboardLayout>
      {content}
    </DashboardLayout>
  );
}

import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Trophy, Medal, Maximize, RefreshCw, Users,
  Award, Star, Zap, Flag, Timer, TrendingUp
} from "lucide-react";
import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";

// Sistema de pontuação
const PONTUACAO = {
  CLIENTE_CADASTRADO: 5,
  ALTERACAO_STATUS: 2,
  AGENDAMENTO: 15,
  VISITA: 25,
  DOCUMENTACAO: 35,
  VENDA: 80,
};

// Formatar valor em reais
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value / 100);
}

// Cores para os corredores
const CORES_CORREDORES = [
  'from-red-500 to-red-600',
  'from-blue-500 to-blue-600',
  'from-green-500 to-green-600',
  'from-purple-500 to-purple-600',
  'from-orange-500 to-orange-600',
  'from-pink-500 to-pink-600',
  'from-cyan-500 to-cyan-600',
  'from-yellow-500 to-yellow-600',
];

// Componente do pódio estilo corrida
function RacePodium({ ranking }: { ranking: any[] }) {
  if (ranking.length === 0) return null;
  
  const top3 = ranking.slice(0, 3);
  const [segundo, primeiro, terceiro] = [top3[1], top3[0], top3[2]];
  
  return (
    <div className="relative mb-8">
      {/* Título do pódio */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 bg-gradient-to-r from-yellow-400 to-yellow-600 text-white px-6 py-2 rounded-full shadow-lg">
          <Trophy className="w-6 h-6" />
          <span className="text-xl font-bold">PÓDIO DOS CAMPEÕES</span>
          <Trophy className="w-6 h-6" />
        </div>
      </div>
      
      <div className="flex items-end justify-center gap-6">
        {/* 2º Lugar */}
        {segundo && (
          <div className="flex flex-col items-center animate-bounce-slow">
            <div className="relative mb-2">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-gray-300 to-gray-500 flex items-center justify-center text-3xl font-bold text-white shadow-xl border-4 border-gray-200">
                {segundo.corretorNome?.charAt(0) || "?"}
              </div>
              <div className="absolute -top-2 -right-2 w-10 h-10 rounded-full bg-gray-400 flex items-center justify-center shadow-lg">
                <Medal className="w-6 h-6 text-white" />
              </div>
            </div>
            <div className="text-center mb-2">
              <p className="font-bold text-lg">{segundo.corretorNome?.split(' ')[0]}</p>
              <div className="flex items-center justify-center gap-1">
                <Zap className="w-4 h-4 text-yellow-500" />
                <span className="text-2xl font-black text-gray-600">{segundo.pontuacaoTotal || segundo.totalPontos || 0}</span>
              </div>
              <p className="text-xs text-muted-foreground">pontos</p>
            </div>
            <div className="w-28 h-36 bg-gradient-to-t from-gray-500 to-gray-400 rounded-t-xl flex flex-col items-center justify-center shadow-xl">
              <span className="text-5xl font-black text-white">2</span>
              <span className="text-white text-sm font-bold">PRATA</span>
            </div>
          </div>
        )}
        
        {/* 1º Lugar */}
        {primeiro && (
          <div className="flex flex-col items-center animate-pulse-slow z-10">
            <div className="relative mb-2">
              {/* Coroa */}
              <div className="absolute -top-8 left-1/2 -translate-x-1/2">
                <svg className="w-12 h-12 text-yellow-500 drop-shadow-lg" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5z"/>
                </svg>
              </div>
              <div className="w-32 h-32 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center text-4xl font-bold text-white shadow-2xl border-4 border-yellow-300 ring-4 ring-yellow-200/50">
                {primeiro.corretorNome?.charAt(0) || "?"}
              </div>
              <div className="absolute -top-2 -right-2 w-12 h-12 rounded-full bg-yellow-500 flex items-center justify-center shadow-lg animate-spin-slow">
                <Trophy className="w-7 h-7 text-white" />
              </div>
            </div>
            <div className="text-center mb-2">
              <p className="font-black text-xl">{primeiro.corretorNome?.split(' ')[0]}</p>
              <div className="flex items-center justify-center gap-1">
                <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                <span className="text-4xl font-black text-yellow-600">{primeiro.pontuacaoTotal || primeiro.totalPontos || 0}</span>
                <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
              </div>
              <p className="text-sm text-muted-foreground font-semibold">pontos</p>
            </div>
            <div className="w-36 h-48 bg-gradient-to-t from-yellow-600 to-yellow-400 rounded-t-xl flex flex-col items-center justify-center shadow-2xl">
              <span className="text-6xl font-black text-white">1</span>
              <span className="text-white text-lg font-bold">OURO</span>
            </div>
          </div>
        )}
        
        {/* 3º Lugar */}
        {terceiro && (
          <div className="flex flex-col items-center animate-bounce-slow">
            <div className="relative mb-2">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-600 to-amber-800 flex items-center justify-center text-2xl font-bold text-white shadow-xl border-4 border-amber-400">
                {terceiro.corretorNome?.charAt(0) || "?"}
              </div>
              <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-amber-700 flex items-center justify-center shadow-lg">
                <Award className="w-5 h-5 text-white" />
              </div>
            </div>
            <div className="text-center mb-2">
              <p className="font-bold">{terceiro.corretorNome?.split(' ')[0]}</p>
              <div className="flex items-center justify-center gap-1">
                <Zap className="w-4 h-4 text-yellow-500" />
                <span className="text-xl font-black text-amber-700">{terceiro.pontuacaoTotal || terceiro.totalPontos || 0}</span>
              </div>
              <p className="text-xs text-muted-foreground">pontos</p>
            </div>
            <div className="w-24 h-28 bg-gradient-to-t from-amber-800 to-amber-600 rounded-t-xl flex flex-col items-center justify-center shadow-xl">
              <span className="text-4xl font-black text-white">3</span>
              <span className="text-white text-xs font-bold">BRONZE</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Componente da pista de corrida
function RaceTrack({ ranking }: { ranking: any[] }) {
  if (ranking.length === 0) return null;
  
  const maxPontos = Math.max(...ranking.map(r => r.pontuacaoTotal || r.totalPontos || 1));
  
  return (
    <div className="bg-gradient-to-b from-green-900 to-green-800 rounded-2xl p-6 shadow-xl">
      {/* Cabeçalho da pista */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-white">
          <Flag className="w-6 h-6 text-red-500" />
          <span className="font-bold text-lg">PISTA DE CORRIDA</span>
        </div>
        <div className="flex items-center gap-2 text-white/80">
          <Timer className="w-5 h-5" />
          <span className="text-sm">Atualização em tempo real</span>
        </div>
      </div>
      
      {/* Linhas da pista */}
      <div className="space-y-3">
        {ranking.map((corretor, index) => {
          const pontos = corretor.pontuacaoTotal || corretor.totalPontos || 0;
          const progresso = maxPontos > 0 ? (pontos / maxPontos) * 100 : 0;
          const cor = CORES_CORREDORES[index % CORES_CORREDORES.length];
          
          return (
            <div key={corretor.corretorId || index} className="relative">
              {/* Linha da pista */}
              <div className="h-16 bg-gray-700/50 rounded-lg relative overflow-hidden border-2 border-dashed border-white/20">
                {/* Marcações da pista */}
                <div className="absolute inset-0 flex">
                  {[...Array(10)].map((_, i) => (
                    <div key={i} className="flex-1 border-r border-white/10" />
                  ))}
                </div>
                
                {/* Barra de progresso (posição do corredor) */}
                <div 
                  className={`absolute left-0 top-0 h-full bg-gradient-to-r ${cor} transition-all duration-1000 ease-out rounded-r-lg`}
                  style={{ width: `${Math.max(progresso, 5)}%` }}
                >
                  {/* Carro/Avatar do corredor */}
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 flex items-center">
                    <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${cor} flex items-center justify-center text-white font-bold text-lg shadow-lg border-2 border-white`}>
                      {corretor.corretorNome?.charAt(0) || "?"}
                    </div>
                  </div>
                </div>
                
                {/* Posição e nome */}
                <div className="absolute left-2 top-1/2 -translate-y-1/2 flex items-center gap-2 z-10">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                    index === 0 ? 'bg-yellow-500 text-white' :
                    index === 1 ? 'bg-gray-400 text-white' :
                    index === 2 ? 'bg-amber-700 text-white' :
                    'bg-white/20 text-white'
                  }`}>
                    {index + 1}º
                  </div>
                  <span className="text-white font-semibold text-sm drop-shadow-lg">
                    {corretor.corretorNome?.split(' ')[0]}
                  </span>
                </div>
                
                {/* Pontuação */}
                <div className="absolute right-2 top-1/2 -translate-y-1/2 z-10">
                  <div className="bg-black/50 px-3 py-1 rounded-full">
                    <span className="text-white font-bold">{pontos} pts</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Linha de chegada */}
      <div className="mt-4 flex justify-end">
        <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-lg">
          <Flag className="w-5 h-5 text-white" />
          <span className="text-white font-semibold">LINHA DE CHEGADA</span>
        </div>
      </div>
    </div>
  );
}

// Componente de legenda de pontuação
function PontuacaoLegenda() {
  return (
    <div className="bg-card border rounded-xl p-4 shadow-lg">
      <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
        <Zap className="w-5 h-5 text-yellow-500" />
        Sistema de Pontuação
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-950 p-2 rounded-lg">
          <Badge variant="outline" className="bg-blue-500 text-white border-0">+{PONTUACAO.CLIENTE_CADASTRADO}</Badge>
          <span className="text-sm">Cliente cadastrado</span>
        </div>
        <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-900 p-2 rounded-lg">
          <Badge variant="outline" className="bg-gray-500 text-white border-0">+{PONTUACAO.ALTERACAO_STATUS}</Badge>
          <span className="text-sm">Alteração de status</span>
        </div>
        <div className="flex items-center gap-2 bg-purple-50 dark:bg-purple-950 p-2 rounded-lg">
          <Badge variant="outline" className="bg-purple-500 text-white border-0">+{PONTUACAO.AGENDAMENTO}</Badge>
          <span className="text-sm">Agendamento</span>
        </div>
        <div className="flex items-center gap-2 bg-orange-50 dark:bg-orange-950 p-2 rounded-lg">
          <Badge variant="outline" className="bg-orange-500 text-white border-0">+{PONTUACAO.VISITA}</Badge>
          <span className="text-sm">Visita realizada</span>
        </div>
        <div className="flex items-center gap-2 bg-cyan-50 dark:bg-cyan-950 p-2 rounded-lg">
          <Badge variant="outline" className="bg-cyan-500 text-white border-0">+{PONTUACAO.DOCUMENTACAO}</Badge>
          <span className="text-sm">Documentação</span>
        </div>
        <div className="flex items-center gap-2 bg-green-50 dark:bg-green-950 p-2 rounded-lg">
          <Badge variant="outline" className="bg-green-500 text-white border-0">+{PONTUACAO.VENDA}</Badge>
          <span className="text-sm">Venda fechada</span>
        </div>
      </div>
    </div>
  );
}

// Componente de estatísticas do dia
function EstatisticasDia({ ranking }: { ranking: any[] }) {
  const totais = ranking?.reduce((acc, curr) => ({
    clientes: acc.clientes + (curr.clientesCadastrados || 0),
    alteracoes: acc.alteracoes + (curr.alteracoesStatus || 0),
    agendamentos: acc.agendamentos + (curr.agendamentosConfirmados || 0),
    visitas: acc.visitas + (curr.visitasRealizadas || 0),
    documentacoes: acc.documentacoes + (curr.documentacoesRecolhidas || 0),
    contratos: acc.contratos + (curr.contratosFechados || 0),
    pontos: acc.pontos + (curr.pontuacaoTotal || 0),
    vgv: acc.vgv + (curr.vgvDia || 0),
  }), { clientes: 0, alteracoes: 0, agendamentos: 0, visitas: 0, documentacoes: 0, contratos: 0, pontos: 0, vgv: 0 });
  
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white shadow-lg">
        <div className="flex items-center gap-2 mb-2">
          <Users className="w-5 h-5" />
          <span className="text-sm font-medium">Clientes Cadastrados</span>
        </div>
        <p className="text-3xl font-black">{totais?.clientes || 0}</p>
        <p className="text-xs opacity-80">+{(totais?.clientes || 0) * PONTUACAO.CLIENTE_CADASTRADO} pontos</p>
      </div>
      
      <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 text-white shadow-lg">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="w-5 h-5" />
          <span className="text-sm font-medium">Agendamentos</span>
        </div>
        <p className="text-3xl font-black">{totais?.agendamentos || 0}</p>
        <p className="text-xs opacity-80">+{(totais?.agendamentos || 0) * PONTUACAO.AGENDAMENTO} pontos</p>
      </div>
      
      <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-4 text-white shadow-lg">
        <div className="flex items-center gap-2 mb-2">
          <Flag className="w-5 h-5" />
          <span className="text-sm font-medium">Visitas</span>
        </div>
        <p className="text-3xl font-black">{totais?.visitas || 0}</p>
        <p className="text-xs opacity-80">+{(totais?.visitas || 0) * PONTUACAO.VISITA} pontos</p>
      </div>
      
      <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-4 text-white shadow-lg">
        <div className="flex items-center gap-2 mb-2">
          <Trophy className="w-5 h-5" />
          <span className="text-sm font-medium">Vendas</span>
        </div>
        <p className="text-3xl font-black">{totais?.contratos || 0}</p>
        <p className="text-xs opacity-80">{formatCurrency(totais?.vgv || 0)} VGV</p>
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
    refetchInterval: 30000,
  });
  
  const { data: rankingSemanal, refetch: refetchSemanal } = trpc.ranking.semanal.useQuery(undefined, {
    refetchInterval: 60000,
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
  
  const content = (
    <div className={`min-h-screen ${isFullscreen ? 'bg-gradient-to-br from-slate-900 to-slate-800 p-8' : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-black flex items-center gap-3">
            <Trophy className="w-10 h-10 text-yellow-500" />
            <span className="bg-gradient-to-r from-yellow-500 to-orange-500 bg-clip-text text-transparent">
              RANKING DE PRODUTIVIDADE
            </span>
          </h1>
          <p className="text-muted-foreground mt-1">
            Corrida pela excelência - Quem será o campeão?
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={refetchAll}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Atualizar
          </Button>
          <Button variant="default" size="sm" onClick={toggleFullscreen}>
            <Maximize className="w-4 h-4 mr-2" />
            {isFullscreen ? 'Sair' : 'Tela Cheia'}
          </Button>
        </div>
      </div>
      
      {/* Tabs de período */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="dia" className="font-semibold">
            🏁 Hoje
          </TabsTrigger>
          <TabsTrigger value="semana" className="font-semibold">
            📅 Semana
          </TabsTrigger>
          <TabsTrigger value="mes" className="font-semibold">
            🏆 Mês
          </TabsTrigger>
        </TabsList>
      </Tabs>
      
      {/* Estatísticas do dia */}
      {activeTab === "dia" && rankingDia && (
        <div className="mb-6">
          <EstatisticasDia ranking={rankingDia} />
        </div>
      )}
      
      {/* Pódio */}
      {currentRanking && currentRanking.length > 0 && (
        <RacePodium ranking={currentRanking} />
      )}
      
      {/* Pista de corrida */}
      {currentRanking && currentRanking.length > 0 && (
        <div className="mb-6">
          <RaceTrack ranking={currentRanking} />
        </div>
      )}
      
      {/* Legenda de pontuação */}
      <div className="mt-6">
        <PontuacaoLegenda />
      </div>
      
      {/* Mensagem se não houver dados */}
      {(!currentRanking || currentRanking.length === 0) && (
        <div className="text-center py-12">
          <Trophy className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-xl font-semibold mb-2">Nenhuma atividade registrada</h3>
          <p className="text-muted-foreground">
            As atividades dos corretores aparecerão aqui conforme forem realizadas.
          </p>
        </div>
      )}
    </div>
  );
  
  // Se estiver em fullscreen, renderizar sem o layout
  if (isFullscreen) {
    return content;
  }
  
  return (
    <DashboardLayout>
      {content}
    </DashboardLayout>
  );
}

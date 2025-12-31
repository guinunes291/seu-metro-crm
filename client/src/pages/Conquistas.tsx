import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useCelebration } from "@/components/CelebrationEffect";
import { CONQUISTAS, CATEGORIAS, getNivelAtual, type Conquista } from "../../../shared/conquistas";
import { 
  Trophy, Target, Star, Sparkles, Search, Lock, ChevronDown, ChevronRight,
  Phone, MessageCircle, Calendar, Eye, FileText, DollarSign, Flag, Zap, Award
} from "lucide-react";
import ConquistaShareCard from "@/components/ConquistaShareCard";

// Ícones para cada categoria
const CATEGORIA_ICONS: Record<string, React.ReactNode> = {
  "Primeiros Passos": <Flag className="h-5 w-5" />,
  "Mestre das Ligações": <Phone className="h-5 w-5" />,
  "Mestre do WhatsApp": <MessageCircle className="h-5 w-5" />,
  "Agendador Profissional": <Calendar className="h-5 w-5" />,
  "Visitador Expert": <Eye className="h-5 w-5" />,
  "Documentador": <FileText className="h-5 w-5" />,
  "Vendedor Campeão": <DollarSign className="h-5 w-5" />,
  "Metas e Objetivos": <Target className="h-5 w-5" />,
  "Produtividade": <Zap className="h-5 w-5" />,
  "Especiais e Raras": <Award className="h-5 w-5" />,
};

// Cores para cada categoria
const CATEGORIA_COLORS: Record<string, { bg: string; border: string; text: string; gradient: string }> = {
  "Primeiros Passos": { bg: "bg-emerald-500/10", border: "border-emerald-500/30", text: "text-emerald-400", gradient: "from-emerald-500/20 to-emerald-600/20" },
  "Mestre das Ligações": { bg: "bg-blue-500/10", border: "border-blue-500/30", text: "text-blue-400", gradient: "from-blue-500/20 to-blue-600/20" },
  "Mestre do WhatsApp": { bg: "bg-green-500/10", border: "border-green-500/30", text: "text-green-400", gradient: "from-green-500/20 to-green-600/20" },
  "Agendador Profissional": { bg: "bg-purple-500/10", border: "border-purple-500/30", text: "text-purple-400", gradient: "from-purple-500/20 to-purple-600/20" },
  "Visitador Expert": { bg: "bg-cyan-500/10", border: "border-cyan-500/30", text: "text-cyan-400", gradient: "from-cyan-500/20 to-cyan-600/20" },
  "Documentador": { bg: "bg-orange-500/10", border: "border-orange-500/30", text: "text-orange-400", gradient: "from-orange-500/20 to-orange-600/20" },
  "Vendedor Campeão": { bg: "bg-amber-500/10", border: "border-amber-500/30", text: "text-amber-400", gradient: "from-amber-500/20 to-amber-600/20" },
  "Metas e Objetivos": { bg: "bg-pink-500/10", border: "border-pink-500/30", text: "text-pink-400", gradient: "from-pink-500/20 to-pink-600/20" },
  "Produtividade": { bg: "bg-indigo-500/10", border: "border-indigo-500/30", text: "text-indigo-400", gradient: "from-indigo-500/20 to-indigo-600/20" },
  "Especiais e Raras": { bg: "bg-rose-500/10", border: "border-rose-500/30", text: "text-rose-400", gradient: "from-rose-500/20 to-rose-600/20" },
};

export default function Conquistas() {
  const { user } = useAuth();
  const { celebrate } = useCelebration();
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [showUnlocked, setShowUnlocked] = useState<boolean | null>(null);
  
  // Queries - Buscar conquistas do usuário logado
  const { data: conquistasUsuario, refetch: refetchConquistas } = trpc.conquistas.minhas.useQuery();
  const { data: estatisticas } = trpc.ranking.minhaPerformance.useQuery();
  
  // Mutations
  const verificarConquistas = trpc.conquistas.verificar.useMutation({
    onSuccess: (data) => {
      if (data.novasConquistas && data.novasConquistas.length > 0) {
        celebrate();
        toast.success(`🎉 Parabéns! Você desbloqueou ${data.novasConquistas.length} nova(s) conquista(s)!`);
        refetchConquistas();
      } else {
        toast.info("Nenhuma nova conquista desbloqueada no momento");
      }
    }
  });

  // Calcular progresso das conquistas
  // O backend retorna array direto com tipoConquistaId que corresponde ao id da conquista
  const conquistasDesbloqueadas = conquistasUsuario || [];
  const idsDesbloqueadas = new Set(conquistasDesbloqueadas.map((c: any) => c.tipoConquistaId));
  
  // Calcular pontos totais
  const pontosTotal = conquistasDesbloqueadas.reduce((acc: number, c: any) => {
    const conquista = CONQUISTAS.find(cq => cq.id === c.tipoConquistaId);
    return acc + (conquista?.pontos || 0);
  }, 0);
  
  const nivelInfo = getNivelAtual(pontosTotal);

  // Filtrar conquistas
  const conquistasFiltradas = CONQUISTAS.filter(c => {
    const matchSearch = c.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       c.descricao.toLowerCase().includes(searchTerm.toLowerCase());
    const isUnlocked = idsDesbloqueadas.has(c.id);
    const matchStatus = showUnlocked === null || showUnlocked === isUnlocked;
    return matchSearch && matchStatus;
  });

  // Agrupar por categoria
  const conquistasPorCategoria = CATEGORIAS.map(cat => ({
    categoria: cat,
    conquistas: conquistasFiltradas.filter(c => c.categoria === cat),
    total: CONQUISTAS.filter(c => c.categoria === cat).length,
    desbloqueadas: CONQUISTAS.filter(c => c.categoria === cat && idsDesbloqueadas.has(c.id)).length
  }));

  // Toggle categoria expandida
  const toggleCategoria = (categoria: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoria)) {
      newExpanded.delete(categoria);
    } else {
      newExpanded.add(categoria);
    }
    setExpandedCategories(newExpanded);
  };

  // Expandir todas
  const expandirTodas = () => {
    setExpandedCategories(new Set(CATEGORIAS));
  };

  // Recolher todas
  const recolherTodas = () => {
    setExpandedCategories(new Set());
  };

  // Calcular progresso de uma conquista específica
  const getProgressoConquista = (conquista: Conquista): number => {
    if (idsDesbloqueadas.has(conquista.id)) return 100;
    
    if (!estatisticas) return 0;
    
    let atual = 0;
    switch (conquista.metaTipo) {
      case 'ligacoes':
        atual = estatisticas.ligacoes || 0;
        break;
      case 'whatsapp':
        atual = estatisticas.whatsapp || 0;
        break;
      case 'agendamentos':
        atual = estatisticas.agendamentos || 0;
        break;
      case 'visitas':
        atual = estatisticas.visitas || 0;
        break;
      case 'documentacoes':
        atual = estatisticas.documentacoes || 0;
        break;
      case 'vendas':
        atual = estatisticas.vendas || 0;
        break;
      case 'vgv':
        atual = estatisticas.vgvTotal || 0;
        break;
      default:
        return 0;
    }
    
    return Math.min((atual / conquista.metaValor) * 100, 99);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <Trophy className="h-8 w-8 text-amber-500" />
              Conquistas
            </h1>
            <p className="text-slate-400 mt-1">
              Desbloqueie conquistas e ganhe pontos para subir no ranking
            </p>
          </div>
          
          {/* Stats Rápidos */}
          <div className="flex items-center gap-4">
            <div className="text-center px-4 py-2 bg-slate-800 rounded-lg border border-slate-700">
              <div className="text-2xl font-bold text-amber-500">{conquistasDesbloqueadas.length}</div>
              <div className="text-xs text-slate-400">de 250</div>
            </div>
            <div className="text-center px-4 py-2 bg-slate-800 rounded-lg border border-slate-700">
              <div className="text-2xl font-bold text-cyan-500">{pontosTotal.toLocaleString()}</div>
              <div className="text-xs text-slate-400">pontos</div>
            </div>
            <div className="text-center px-4 py-2 bg-slate-800 rounded-lg border border-slate-700">
              <div className="text-2xl font-bold text-purple-500">Nv. {nivelInfo.nivel}</div>
              <div className="text-xs text-slate-400">{nivelInfo.titulo}</div>
            </div>
          </div>
        </div>

        {/* Barra de Progresso Geral */}
        <Card className="bg-gradient-to-r from-slate-900 to-slate-800 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-400">Progresso Geral</span>
              <span className="text-sm text-amber-500 font-medium">
                {Math.round((conquistasDesbloqueadas.length / 250) * 100)}% completo
              </span>
            </div>
            <Progress 
              value={(conquistasDesbloqueadas.length / 250) * 100} 
              className="h-3 bg-slate-700"
            />
          </CardContent>
        </Card>

        {/* Filtros */}
        <Card className="bg-slate-900 border-slate-700">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Buscar conquistas..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-slate-800 border-slate-700 text-white"
                />
              </div>
              <select
                value={showUnlocked === null ? "todas" : showUnlocked ? "desbloqueadas" : "bloqueadas"}
                onChange={(e) => {
                  if (e.target.value === "todas") setShowUnlocked(null);
                  else if (e.target.value === "desbloqueadas") setShowUnlocked(true);
                  else setShowUnlocked(false);
                }}
                className="bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-white"
              >
                <option value="todas">Todas</option>
                <option value="desbloqueadas">Desbloqueadas</option>
                <option value="bloqueadas">Bloqueadas</option>
              </select>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={expandirTodas}
                  className="border-slate-600 text-slate-300 hover:bg-slate-700"
                >
                  Expandir Todas
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={recolherTodas}
                  className="border-slate-600 text-slate-300 hover:bg-slate-700"
                >
                  Recolher Todas
                </Button>
              </div>
              <Button
                onClick={() => verificarConquistas.mutate()}
                disabled={verificarConquistas.isPending}
                className="bg-amber-500 hover:bg-amber-600 text-white"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Verificar Conquistas
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Lista de Categorias (Grupos Expansíveis) */}
        <div className="space-y-3">
          {conquistasPorCategoria.map(grupo => {
            const isExpanded = expandedCategories.has(grupo.categoria);
            const colors = CATEGORIA_COLORS[grupo.categoria] || CATEGORIA_COLORS["Primeiros Passos"];
            const icon = CATEGORIA_ICONS[grupo.categoria] || <Trophy className="h-5 w-5" />;
            const progressPercent = (grupo.desbloqueadas / grupo.total) * 100;
            
            return (
              <Card 
                key={grupo.categoria} 
                className={`bg-slate-900 border-slate-700 overflow-hidden transition-all duration-300 ${
                  isExpanded ? "shadow-lg" : ""
                }`}
              >
                {/* Header do Grupo (Clicável) */}
                <button
                  onClick={() => toggleCategoria(grupo.categoria)}
                  className={`w-full p-4 flex items-center justify-between hover:bg-slate-800/50 transition-colors ${
                    isExpanded ? `bg-gradient-to-r ${colors.gradient}` : ""
                  }`}
                >
                  <div className="flex items-center gap-4">
                    {/* Ícone de Expandir/Recolher */}
                    <div className={`transition-transform duration-300 ${isExpanded ? "rotate-0" : "-rotate-90"}`}>
                      <ChevronDown className="h-5 w-5 text-slate-400" />
                    </div>
                    
                    {/* Ícone da Categoria */}
                    <div className={`p-2 rounded-lg ${colors.bg} ${colors.border} border`}>
                      <span className={colors.text}>{icon}</span>
                    </div>
                    
                    {/* Nome e Progresso */}
                    <div className="text-left">
                      <h3 className="font-semibold text-white">{grupo.categoria}</h3>
                      <p className="text-sm text-slate-400">
                        {grupo.desbloqueadas} de {grupo.total} conquistas
                      </p>
                    </div>
                  </div>
                  
                  {/* Badge e Barra de Progresso */}
                  <div className="flex items-center gap-4">
                    <div className="hidden md:block w-32">
                      <Progress 
                        value={progressPercent} 
                        className="h-2 bg-slate-700"
                      />
                    </div>
                    <Badge 
                      variant="outline" 
                      className={`${colors.border} ${colors.text}`}
                    >
                      {Math.round(progressPercent)}%
                    </Badge>
                  </div>
                </button>

                {/* Conteúdo Expandido */}
                <div className={`overflow-hidden transition-all duration-300 ${
                  isExpanded ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
                }`}>
                  <CardContent className="p-4 pt-0 border-t border-slate-700/50">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 pt-4">
                      {grupo.conquistas.map(conquista => {
                        const isUnlocked = idsDesbloqueadas.has(conquista.id);
                        const progresso = getProgressoConquista(conquista);
                        
                        return (
                          <div
                            key={conquista.id}
                            className={`
                              relative p-4 rounded-lg border transition-all duration-300
                              transform hover:scale-105 hover:shadow-xl hover:z-10
                              cursor-pointer group
                              ${isUnlocked
                                ? `bg-gradient-to-br ${colors.gradient} ${colors.border} shadow-lg`
                                : "bg-slate-800/50 border-slate-700 opacity-60 hover:opacity-100"
                              }
                            `}
                          >
                            {/* Efeito de brilho no hover */}
                            <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                            
                            {/* Ícone e Nome */}
                            <div className="flex items-start gap-3 relative">
                              <div className={`text-3xl transition-transform duration-300 group-hover:scale-110 ${isUnlocked ? "" : "grayscale"}`}>
                                {conquista.icone}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className={`font-semibold text-sm leading-tight ${isUnlocked ? "text-white" : "text-slate-400"}`}>
                                  {conquista.nome}
                                </h4>
                                <p className="text-xs text-slate-500 mt-1 leading-relaxed line-clamp-2">
                                  {conquista.descricao}
                                </p>
                              </div>
                              {!isUnlocked && (
                                <Lock className="h-4 w-4 text-slate-500 flex-shrink-0 transition-transform duration-300 group-hover:rotate-12" />
                              )}
                            </div>

                            {/* Barra de Progresso */}
                            <div className="mt-3 relative">
                              <div className="flex justify-between text-xs mb-1">
                                <span className={isUnlocked ? colors.text : "text-slate-500"}>
                                  {conquista.meta}
                                </span>
                                <span className={isUnlocked ? "text-green-400" : "text-slate-500"}>
                                  {isUnlocked ? "✓ Completo" : `${Math.round(progresso)}%`}
                                </span>
                              </div>
                              <Progress 
                                value={progresso} 
                                className={`h-1.5 ${isUnlocked ? "bg-slate-700/50" : "bg-slate-700"}`}
                              />
                            </div>

                            {/* Pontos e Compartilhamento */}
                            <div className="mt-2 flex items-center justify-between relative">
                              <Badge 
                                variant="outline" 
                                className={`text-xs transition-all duration-300 group-hover:scale-105 ${
                                  isUnlocked ? `${colors.border} ${colors.text}` : "border-slate-600 text-slate-500"
                                }`}
                              >
                                +{conquista.pontos} pts
                              </Badge>
                              <div className="flex items-center gap-1">
                                {isUnlocked && (
                                  <>
                                    <ConquistaShareCard 
                                      conquista={conquista} 
                                      userName={user?.name || "Corretor"}
                                      nivel={nivelInfo.nivel}
                                      titulo={nivelInfo.titulo}
                                    />
                                    <Sparkles className="h-4 w-4 text-amber-400 animate-pulse" />
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    
                    {grupo.conquistas.length === 0 && (
                      <div className="text-center py-8 text-slate-500">
                        <Trophy className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>Nenhuma conquista encontrada com os filtros atuais</p>
                      </div>
                    )}
                  </CardContent>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Mensagem quando não há conquistas */}
        {conquistasFiltradas.length === 0 && (
          <Card className="bg-slate-900 border-slate-700">
            <CardContent className="p-8 text-center">
              <Trophy className="h-12 w-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">Nenhuma conquista encontrada com os filtros selecionados.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}

import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useCelebration } from "@/components/CelebrationEffect";
import { CONQUISTAS, CATEGORIAS, getNivelAtual, type Conquista } from "../../../shared/conquistas";
import { 
  Camera, Trophy, Target, Flame, Star, Crown, Medal, Award, 
  Gem, Rocket, Flag, Sparkles, Upload, User, Calendar,
  TrendingUp, Phone, Mail, Search, Filter, ChevronRight, ChevronDown, Lock, Share2
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import ConquistaShareCard from "@/components/ConquistaShareCard";

export default function MeuPerfil() {
  const { user } = useAuth();
  const { celebrate } = useCelebration();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>("todas");
  const [showUnlocked, setShowUnlocked] = useState<boolean | null>(null);
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set(["Primeiros Passos"]));
  
  const toggleGroup = (categoria: string) => {
    setOpenGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoria)) {
        newSet.delete(categoria);
      } else {
        newSet.add(categoria);
      }
      return newSet;
    });
  };
  
  const expandAll = () => {
    setOpenGroups(new Set(CATEGORIAS));
  };
  
  const collapseAll = () => {
    setOpenGroups(new Set());
  };
  
  // Queries
  const { data: conquistasUsuario, refetch: refetchConquistas } = trpc.conquistas.minhasConquistas.useQuery();
  const { data: estatisticas } = trpc.ranking.minhaPerformance.useQuery();
  
  // Mutations
  const uploadFoto = trpc.conquistas.uploadFoto.useMutation({
    onSuccess: () => {
      toast.success("Foto atualizada com sucesso!");
    },
    onError: () => {
      toast.error("Erro ao atualizar foto");
    }
  });

  const verificarConquistas = trpc.conquistas.verificarConquistas.useMutation({
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
  const conquistasDesbloqueadas = conquistasUsuario?.conquistas || [];
  const idsDesbloqueadas = new Set(conquistasDesbloqueadas.map((c: any) => c.conquistaId));
  
  // Calcular pontos totais
  const pontosTotal = conquistasDesbloqueadas.reduce((acc: number, c: any) => {
    const conquista = CONQUISTAS.find(cq => cq.id === c.conquistaId);
    return acc + (conquista?.pontos || 0);
  }, 0);
  
  const nivelInfo = getNivelAtual(pontosTotal);

  // Filtrar conquistas
  const conquistasFiltradas = CONQUISTAS.filter(c => {
    const matchSearch = c.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       c.descricao.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCategoria = categoriaFiltro === "todas" || c.categoria === categoriaFiltro;
    const isUnlocked = idsDesbloqueadas.has(c.id);
    const matchStatus = showUnlocked === null || showUnlocked === isUnlocked;
    return matchSearch && matchCategoria && matchStatus;
  });

  // Agrupar por categoria
  const conquistasPorCategoria = CATEGORIAS.map(cat => ({
    categoria: cat,
    conquistas: conquistasFiltradas.filter(c => c.categoria === cat),
    total: CONQUISTAS.filter(c => c.categoria === cat).length,
    desbloqueadas: CONQUISTAS.filter(c => c.categoria === cat && idsDesbloqueadas.has(c.id)).length
  })).filter(g => g.conquistas.length > 0);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Máximo 5MB.");
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/upload/foto", {
        method: "POST",
        body: formData,
      });
      
      if (response.ok) {
        const data = await response.json();
        await uploadFoto.mutateAsync({ fotoUrl: data.url });
      } else {
        toast.error("Erro ao fazer upload da foto");
      }
    } catch (error) {
      toast.error("Erro ao fazer upload da foto");
    } finally {
      setUploading(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Calcular progresso de uma conquista específica
  const getProgressoConquista = (conquista: Conquista): number => {
    if (idsDesbloqueadas.has(conquista.id)) return 100;
    
    // Calcular progresso baseado nas estatísticas
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
        {/* Header do Perfil */}
        <Card className="bg-gradient-to-r from-slate-900 to-slate-800 border-slate-700">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row items-center gap-6">
              {/* Avatar com Upload */}
              <div className="relative group">
                <Avatar className="h-32 w-32 border-4 border-amber-500 shadow-lg shadow-amber-500/20">
                  <AvatarImage src={user?.fotoUrl || ""} />
                  <AvatarFallback className="text-3xl bg-gradient-to-br from-amber-500 to-orange-600 text-white">
                    {user?.name ? getInitials(user.name) : "?"}
                  </AvatarFallback>
                </Avatar>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  disabled={uploading}
                >
                  <Camera className="h-8 w-8 text-white" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              {/* Info do Usuário */}
              <div className="flex-1 text-center md:text-left">
                <h1 className="text-2xl font-bold text-white">{user?.name || "Corretor"}</h1>
                <p className="text-slate-400 flex items-center justify-center md:justify-start gap-2 mt-1">
                  <Mail className="h-4 w-4" />
                  {user?.email}
                </p>
                <div className="flex items-center justify-center md:justify-start gap-2 mt-2">
                  <Badge variant="outline" className="border-amber-500 text-amber-500">
                    {user?.role === "admin" ? "Gestor" : "Corretor"}
                  </Badge>
                  <Badge variant="outline" className="border-cyan-500 text-cyan-500">
                    Nível {nivelInfo.nivel} - {nivelInfo.titulo}
                  </Badge>
                </div>
              </div>

              {/* Stats Rápidos */}
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <Trophy className="h-6 w-6 text-amber-500 mx-auto mb-1" />
                  <div className="text-2xl font-bold text-white">{conquistasDesbloqueadas.length}</div>
                  <div className="text-xs text-slate-400">Conquistas</div>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <Star className="h-6 w-6 text-cyan-500 mx-auto mb-1" />
                  <div className="text-2xl font-bold text-white">{pontosTotal.toLocaleString()}</div>
                  <div className="text-xs text-slate-400">Pontos</div>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <Target className="h-6 w-6 text-green-500 mx-auto mb-1" />
                  <div className="text-2xl font-bold text-white">{Math.round((conquistasDesbloqueadas.length / 250) * 100)}%</div>
                  <div className="text-xs text-slate-400">Completo</div>
                </div>
              </div>
            </div>

            {/* Barra de Progresso do Nível */}
            <div className="mt-6">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-slate-400">Progresso para Nível {nivelInfo.nivel + 1}</span>
                <span className="text-amber-500">{pontosTotal.toLocaleString()} / {nivelInfo.pontosProximo.toLocaleString()} pts</span>
              </div>
              <Progress value={nivelInfo.progresso} className="h-3 bg-slate-700" />
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="conquistas" className="space-y-4">
          <TabsList className="bg-slate-800 border border-slate-700">
            <TabsTrigger value="conquistas" className="data-[state=active]:bg-amber-500 data-[state=active]:text-white">
              <Trophy className="h-4 w-4 mr-2" />
              Conquistas ({conquistasDesbloqueadas.length}/250)
            </TabsTrigger>
            <TabsTrigger value="estatisticas" className="data-[state=active]:bg-cyan-500 data-[state=active]:text-white">
              <TrendingUp className="h-4 w-4 mr-2" />
              Estatísticas
            </TabsTrigger>
          </TabsList>

          {/* Tab Conquistas */}
          <TabsContent value="conquistas" className="space-y-4">
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
                    value={categoriaFiltro}
                    onChange={(e) => setCategoriaFiltro(e.target.value)}
                    className="bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-white"
                  >
                    <option value="todas">Todas as Categorias</option>
                    {CATEGORIAS.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
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
                      onClick={expandAll}
                      variant="outline"
                      className="border-slate-600 text-slate-300 hover:bg-slate-700"
                    >
                      Expandir Todas
                    </Button>
                    <Button
                      onClick={collapseAll}
                      variant="outline"
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

            {/* Lista de Conquistas por Categoria - Grupos Expansíveis */}
            {conquistasPorCategoria.map(grupo => (
              <Collapsible
                key={grupo.categoria}
                open={openGroups.has(grupo.categoria)}
                onOpenChange={() => toggleGroup(grupo.categoria)}
              >
                <Card className="bg-slate-900 border-slate-700 overflow-hidden">
                  <CollapsibleTrigger asChild>
                    <CardHeader className="pb-2 cursor-pointer hover:bg-slate-800/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg transition-transform duration-300 ${
                            openGroups.has(grupo.categoria) ? "bg-amber-500/20" : "bg-slate-800"
                          }`}>
                            <ChevronDown className={`h-5 w-5 text-amber-400 transition-transform duration-300 ${
                              openGroups.has(grupo.categoria) ? "rotate-0" : "-rotate-90"
                            }`} />
                          </div>
                          <CardTitle className="text-lg text-white flex items-center gap-2">
                            <span>{grupo.categoria}</span>
                            <Badge variant="outline" className={`border-slate-600 ${
                              grupo.desbloqueadas === grupo.total ? "border-green-500 text-green-400" : "text-slate-400"
                            }`}>
                              {grupo.desbloqueadas}/{grupo.total}
                            </Badge>
                          </CardTitle>
                        </div>
                        <div className="flex items-center gap-4">
                          <Progress 
                            value={(grupo.desbloqueadas / grupo.total) * 100} 
                            className="w-32 h-2 bg-slate-700"
                          />
                          <span className="text-sm text-slate-400 min-w-[3rem] text-right">
                            {Math.round((grupo.desbloqueadas / grupo.total) * 100)}%
                          </span>
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="animate-in slide-in-from-top-2 duration-300">
                    <CardContent className="pt-0">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                        {grupo.conquistas.map(conquista => {
                          const isUnlocked = idsDesbloqueadas.has(conquista.id);
                          const progresso = getProgressoConquista(conquista);
                          
                          return (
                            <div
                              key={conquista.id}
                              className={`relative p-4 rounded-lg border cursor-pointer
                                transition-all duration-300 ease-out
                                hover:scale-[1.02] hover:-translate-y-1 hover:shadow-xl
                                ${
                                isUnlocked
                                  ? "bg-gradient-to-br from-amber-500/20 to-orange-500/20 border-amber-500/50 shadow-lg shadow-amber-500/10 hover:shadow-amber-500/20"
                                  : "bg-slate-800/50 border-slate-700 opacity-60 hover:opacity-100 hover:border-slate-500"
                              }`}
                            >
                              {/* Ícone e Nome */}
                              <div className="flex items-start gap-3">
                                <div className={`text-3xl transition-transform duration-300 hover:scale-110 ${isUnlocked ? "" : "grayscale"}`}>
                                  {conquista.icone}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h4 className={`font-semibold text-sm leading-tight ${isUnlocked ? "text-white" : "text-slate-400"}`}>
                                    {conquista.nome}
                                  </h4>
                                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                                    {conquista.descricao}
                                  </p>
                                </div>
                                {!isUnlocked && (
                                  <Lock className="h-4 w-4 text-slate-500 flex-shrink-0" />
                                )}
                              </div>

                              {/* Barra de Progresso */}
                              <div className="mt-3">
                                <div className="flex justify-between text-xs mb-1">
                                  <span className={isUnlocked ? "text-amber-400" : "text-slate-500"}>
                                    {conquista.meta}
                                  </span>
                                  <span className={isUnlocked ? "text-green-400" : "text-slate-500"}>
                                    {isUnlocked ? "✓ Completo" : `${Math.round(progresso)}%`}
                                  </span>
                                </div>
                                <Progress 
                                  value={progresso} 
                                  className={`h-1.5 ${isUnlocked ? "bg-amber-900" : "bg-slate-700"}`}
                                />
                              </div>

                              {/* Pontos e Compartilhamento */}
                              <div className="mt-2 flex items-center justify-between">
                                <Badge 
                                  variant="outline" 
                                  className={`text-xs ${isUnlocked ? "border-amber-500 text-amber-400" : "border-slate-600 text-slate-500"}`}
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
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            ))}

            {conquistasFiltradas.length === 0 && (
              <Card className="bg-slate-900 border-slate-700">
                <CardContent className="p-8 text-center">
                  <Trophy className="h-12 w-12 text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-400">Nenhuma conquista encontrada com os filtros selecionados.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Tab Estatísticas */}
          <TabsContent value="estatisticas">
            <Card className="bg-slate-900 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Suas Estatísticas</CardTitle>
                <CardDescription>Resumo da sua performance no sistema</CardDescription>
              </CardHeader>
              <CardContent>
                {estatisticas ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-slate-800 rounded-lg p-4 text-center">
                      <Phone className="h-8 w-8 text-blue-400 mx-auto mb-2" />
                      <div className="text-2xl font-bold text-white">{estatisticas.ligacoes || 0}</div>
                      <div className="text-sm text-slate-400">Ligações</div>
                    </div>
                    <div className="bg-slate-800 rounded-lg p-4 text-center">
                      <Mail className="h-8 w-8 text-green-400 mx-auto mb-2" />
                      <div className="text-2xl font-bold text-white">{estatisticas.whatsapp || 0}</div>
                      <div className="text-sm text-slate-400">WhatsApp</div>
                    </div>
                    <div className="bg-slate-800 rounded-lg p-4 text-center">
                      <Calendar className="h-8 w-8 text-purple-400 mx-auto mb-2" />
                      <div className="text-2xl font-bold text-white">{estatisticas.agendamentos || 0}</div>
                      <div className="text-sm text-slate-400">Agendamentos</div>
                    </div>
                    <div className="bg-slate-800 rounded-lg p-4 text-center">
                      <Target className="h-8 w-8 text-orange-400 mx-auto mb-2" />
                      <div className="text-2xl font-bold text-white">{estatisticas.visitas || 0}</div>
                      <div className="text-sm text-slate-400">Visitas</div>
                    </div>
                    <div className="bg-slate-800 rounded-lg p-4 text-center">
                      <Flag className="h-8 w-8 text-cyan-400 mx-auto mb-2" />
                      <div className="text-2xl font-bold text-white">{estatisticas.documentacoes || 0}</div>
                      <div className="text-sm text-slate-400">Documentações</div>
                    </div>
                    <div className="bg-slate-800 rounded-lg p-4 text-center">
                      <Trophy className="h-8 w-8 text-amber-400 mx-auto mb-2" />
                      <div className="text-2xl font-bold text-white">{estatisticas.vendas || 0}</div>
                      <div className="text-sm text-slate-400">Vendas</div>
                    </div>
                    <div className="bg-slate-800 rounded-lg p-4 text-center col-span-2">
                      <Crown className="h-8 w-8 text-yellow-400 mx-auto mb-2" />
                      <div className="text-2xl font-bold text-white">
                        R$ {((estatisticas.vgvTotal || 0) / 100).toLocaleString('pt-BR')}
                      </div>
                      <div className="text-sm text-slate-400">VGV Total</div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-slate-400">Carregando estatísticas...</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

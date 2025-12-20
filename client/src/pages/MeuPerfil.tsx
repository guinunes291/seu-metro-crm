import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { 
  Camera, Trophy, Target, Flame, Star, Crown, Medal, Award, 
  Gem, Diamond, Rocket, Flag, Sparkles, Upload, User, Calendar,
  TrendingUp, Phone, Mail
} from "lucide-react";

// Mapeamento de ícones
const iconeMap: Record<string, any> = {
  trophy: Trophy,
  crown: Crown,
  medal: Medal,
  award: Award,
  target: Target,
  flag: Flag,
  rocket: Rocket,
  flame: Flame,
  star: Star,
  sparkles: Sparkles,
  gem: Gem,
  diamond: Diamond,
};

// Mapeamento de cores
const corMap: Record<string, string> = {
  gold: "bg-yellow-500 text-yellow-950",
  silver: "bg-gray-400 text-gray-950",
  bronze: "bg-amber-700 text-amber-50",
  blue: "bg-blue-500 text-blue-50",
  green: "bg-green-500 text-green-50",
  purple: "bg-purple-500 text-purple-50",
  orange: "bg-orange-500 text-orange-50",
  red: "bg-red-500 text-red-50",
};

export default function MeuPerfil() {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();

  // Buscar dados do perfil
  const { data: fotoUrl, isLoading: loadingFoto } = trpc.perfil.foto.useQuery();
  const { data: resumoConquistas, isLoading: loadingConquistas } = trpc.conquistas.resumo.useQuery();
  const { data: todasConquistas } = trpc.conquistas.minhas.useQuery();

  // Mutation para atualizar foto
  const atualizarFotoMutation = trpc.perfil.atualizarFoto.useMutation({
    onSuccess: () => {
      toast.success("Foto de perfil atualizada!");
      utils.perfil.foto.invalidate();
      utils.auth.me.invalidate();
    },
    onError: (error) => {
      toast.error("Erro ao atualizar foto: " + error.message);
    },
  });

  // Inicializar tipos de conquistas
  const inicializarTiposMutation = trpc.conquistas.inicializarTipos.useMutation({
    onSuccess: () => {
      toast.success("Tipos de conquistas inicializados!");
      utils.conquistas.tipos.invalidate();
    },
  });

  // Handler de upload de foto
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar tipo de arquivo
    if (!file.type.startsWith("image/")) {
      toast.error("Por favor, selecione uma imagem");
      return;
    }

    // Validar tamanho (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 5MB");
      return;
    }

    setUploading(true);
    try {
      // Converter para base64 e fazer upload via API
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        
        // Fazer upload para o storage
        const response = await fetch("/api/upload-foto", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            file: base64,
            filename: file.name,
            contentType: file.type,
          }),
        });

        if (!response.ok) {
          throw new Error("Erro no upload");
        }

        const { url } = await response.json();
        await atualizarFotoMutation.mutateAsync({ fotoUrl: url });
      };
      reader.readAsDataURL(file);
    } catch (error) {
      toast.error("Erro ao fazer upload da foto");
    } finally {
      setUploading(false);
    }
  };

  const getInitials = (name?: string | null) => {
    if (!name) return "U";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("pt-BR");
  };

  return (
    <DashboardLayout>
      <div className="container py-6 space-y-6">
        {/* Header do Perfil */}
        <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
          {/* Avatar com upload */}
          <div className="relative group">
            <Avatar className="h-32 w-32 border-4 border-primary/20">
              <AvatarImage src={fotoUrl || user?.fotoUrl || undefined} />
              <AvatarFallback className="text-3xl bg-primary/10">
                {getInitials(user?.name)}
              </AvatarFallback>
            </Avatar>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            >
              {uploading ? (
                <div className="animate-spin h-8 w-8 border-2 border-white border-t-transparent rounded-full" />
              ) : (
                <Camera className="h-8 w-8 text-white" />
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {/* Informações básicas */}
          <div className="flex-1">
            <h1 className="text-3xl font-bold">{user?.name || "Usuário"}</h1>
            <div className="flex flex-wrap gap-4 mt-2 text-muted-foreground">
              {user?.email && (
                <span className="flex items-center gap-1">
                  <Mail className="h-4 w-4" />
                  {user.email}
                </span>
              )}
              {user?.telefone && (
                <span className="flex items-center gap-1">
                  <Phone className="h-4 w-4" />
                  {user.telefone}
                </span>
              )}
            </div>
            <div className="flex gap-2 mt-3">
              <Badge variant="outline" className="capitalize">
                {user?.role || "corretor"}
              </Badge>
              {user?.status && (
                <Badge variant={user.status === "presente" ? "default" : "secondary"}>
                  {user.status === "presente" ? "🟢 Presente" : "⚪ Ausente"}
                </Badge>
              )}
            </div>
          </div>

          {/* Resumo de conquistas */}
          {resumoConquistas && (
            <Card className="w-full md:w-auto">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-full bg-yellow-500/10">
                    <Trophy className="h-8 w-8 text-yellow-500" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold">{resumoConquistas.total}</p>
                    <p className="text-sm text-muted-foreground">Conquistas</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Tabs de conteúdo */}
        <Tabs defaultValue="conquistas" className="w-full">
          <TabsList>
            <TabsTrigger value="conquistas" className="gap-2">
              <Trophy className="h-4 w-4" />
              Conquistas
            </TabsTrigger>
            <TabsTrigger value="estatisticas" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              Estatísticas
            </TabsTrigger>
          </TabsList>

          {/* Aba de Conquistas */}
          <TabsContent value="conquistas" className="space-y-6">
            {/* Conquista em destaque */}
            {resumoConquistas?.destaque && (
              <Card className="border-yellow-500/50 bg-gradient-to-r from-yellow-500/5 to-transparent">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Star className="h-5 w-5 text-yellow-500" />
                    Conquista em Destaque
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    {(() => {
                      const IconComponent = iconeMap[resumoConquistas.destaque.tipo.icone] || Trophy;
                      const corClasses = corMap[resumoConquistas.destaque.tipo.cor] || "bg-gray-500";
                      return (
                        <div className={`p-4 rounded-full ${corClasses}`}>
                          <IconComponent className="h-10 w-10" />
                        </div>
                      );
                    })()}
                    <div>
                      <h3 className="text-xl font-bold">{resumoConquistas.destaque.tipo.nome}</h3>
                      <p className="text-muted-foreground">{resumoConquistas.destaque.tipo.descricao}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Conquistada em {formatDate(resumoConquistas.destaque.createdAt)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Grid de conquistas por categoria */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {Object.entries(resumoConquistas?.porCategoria || {}).map(([categoria, quantidade]) => (
                <Card key={categoria}>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${
                      categoria === "vendas" ? "bg-yellow-500/10 text-yellow-500" :
                      categoria === "produtividade" ? "bg-green-500/10 text-green-500" :
                      categoria === "streak" ? "bg-orange-500/10 text-orange-500" :
                      "bg-purple-500/10 text-purple-500"
                    }`}>
                      {categoria === "vendas" ? <Trophy className="h-5 w-5" /> :
                       categoria === "produtividade" ? <Target className="h-5 w-5" /> :
                       categoria === "streak" ? <Flame className="h-5 w-5" /> :
                       <Star className="h-5 w-5" />}
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{quantidade}</p>
                      <p className="text-xs text-muted-foreground capitalize">{categoria}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Lista de todas as conquistas */}
            <Card>
              <CardHeader>
                <CardTitle>Todas as Conquistas</CardTitle>
                <CardDescription>Histórico completo de medalhas e conquistas</CardDescription>
              </CardHeader>
              <CardContent>
                {todasConquistas && todasConquistas.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {todasConquistas.map((conquista) => {
                      const IconComponent = iconeMap[conquista.tipo.icone] || Trophy;
                      const corClasses = corMap[conquista.tipo.cor] || "bg-gray-500";
                      return (
                        <div
                          key={conquista.id}
                          className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                        >
                          <div className={`p-2 rounded-full ${corClasses}`}>
                            <IconComponent className="h-5 w-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{conquista.tipo.nome}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatDate(conquista.createdAt)}
                            </p>
                          </div>
                          {conquista.posicao && (
                            <Badge variant="outline">{conquista.posicao}º</Badge>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Trophy className="h-12 w-12 mx-auto mb-4 opacity-20" />
                    <p>Nenhuma conquista ainda</p>
                    <p className="text-sm">Continue trabalhando para ganhar suas primeiras medalhas!</p>
                    
                    {/* Botão para inicializar tipos (apenas para gestores) */}
                    {user?.role === "gestor" || user?.role === "admin" ? (
                      <Button
                        variant="outline"
                        className="mt-4"
                        onClick={() => inicializarTiposMutation.mutate()}
                        disabled={inicializarTiposMutation.isPending}
                      >
                        Inicializar Sistema de Conquistas
                      </Button>
                    ) : null}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Aba de Estatísticas */}
          <TabsContent value="estatisticas">
            <Card>
              <CardHeader>
                <CardTitle>Estatísticas de Performance</CardTitle>
                <CardDescription>Seus números e métricas de desempenho</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Acesse a página "Minha Performance" para ver suas estatísticas detalhadas.
                </p>
                <Button variant="outline" className="mt-4" onClick={() => window.location.href = "/minha-performance"}>
                  Ver Minha Performance
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

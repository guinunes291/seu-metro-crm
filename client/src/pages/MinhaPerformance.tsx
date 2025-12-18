import DashboardLayout from "@/components/DashboardLayout";
import { useState, useMemo, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  TrendingUp, 
  Clock, 
  Target, 
  Award, 
  Trophy,
  Users,
  BarChart3,
  CheckCircle2,
  XCircle,
  Crown,
  Medal,
  Star,
  Camera,
  Upload,
  Sparkles,
  Flame,
  Zap
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";

// Componente do Pódio
function Podium({ ranking, meuId }: { ranking: any[]; meuId: number }) {
  const top3 = ranking.slice(0, 3);
  
  // Reordenar para exibição do pódio: 2º, 1º, 3º
  const podiumOrder = [
    top3[1], // 2º lugar (esquerda)
    top3[0], // 1º lugar (centro)
    top3[2], // 3º lugar (direita)
  ].filter(Boolean);

  const getInitials = (nome: string) => {
    return nome
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getPodiumStyle = (posicao: number) => {
    switch (posicao) {
      case 1:
        return {
          height: 'h-40',
          bgGradient: 'bg-gradient-to-b from-yellow-400 via-yellow-500 to-yellow-600',
          borderColor: 'border-yellow-300',
          shadowColor: 'shadow-yellow-500/50',
          crownColor: 'text-yellow-400',
          avatarSize: 'w-28 h-28',
          avatarBorder: 'ring-4 ring-yellow-400 ring-offset-2',
          textSize: 'text-xl',
          medalEmoji: '🥇',
          glowClass: 'animate-pulse',
        };
      case 2:
        return {
          height: 'h-32',
          bgGradient: 'bg-gradient-to-b from-gray-300 via-gray-400 to-gray-500',
          borderColor: 'border-gray-300',
          shadowColor: 'shadow-gray-400/50',
          crownColor: 'text-gray-400',
          avatarSize: 'w-24 h-24',
          avatarBorder: 'ring-4 ring-gray-300 ring-offset-2',
          textSize: 'text-lg',
          medalEmoji: '🥈',
          glowClass: '',
        };
      case 3:
        return {
          height: 'h-24',
          bgGradient: 'bg-gradient-to-b from-amber-500 via-amber-600 to-amber-700',
          borderColor: 'border-amber-400',
          shadowColor: 'shadow-amber-500/50',
          crownColor: 'text-amber-500',
          avatarSize: 'w-20 h-20',
          avatarBorder: 'ring-4 ring-amber-400 ring-offset-2',
          textSize: 'text-base',
          medalEmoji: '🥉',
          glowClass: '',
        };
      default:
        return {
          height: 'h-20',
          bgGradient: 'bg-gradient-to-b from-slate-400 to-slate-500',
          borderColor: 'border-slate-300',
          shadowColor: 'shadow-slate-400/50',
          crownColor: 'text-slate-400',
          avatarSize: 'w-16 h-16',
          avatarBorder: 'ring-2 ring-slate-300',
          textSize: 'text-sm',
          medalEmoji: '',
          glowClass: '',
        };
    }
  };

  if (podiumOrder.length === 0) {
    return (
      <div className="text-center py-12">
        <Trophy className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Nenhum corretor no ranking ainda</p>
      </div>
    );
  }

  return (
    <div className="relative py-8">
      {/* Efeito de brilho no fundo */}
      <div className="absolute inset-0 bg-gradient-to-t from-transparent via-yellow-500/5 to-transparent rounded-3xl" />
      
      {/* Título do Pódio */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-yellow-500/20 via-yellow-400/20 to-yellow-500/20 border border-yellow-500/30">
          <Crown className="h-5 w-5 text-yellow-500" />
          <span className="font-bold text-yellow-600 dark:text-yellow-400">TOP PERFORMERS</span>
          <Crown className="h-5 w-5 text-yellow-500" />
        </div>
      </div>

      {/* Pódio */}
      <div className="flex items-end justify-center gap-4 md:gap-8 px-4">
        {podiumOrder.map((corretor, index) => {
          if (!corretor) return null;
          
          const posicaoReal = index === 0 ? 2 : index === 1 ? 1 : 3;
          const style = getPodiumStyle(posicaoReal);
          const isMe = corretor.corretor.id === meuId;

          return (
            <div 
              key={corretor.corretor.id} 
              className={`flex flex-col items-center transition-all duration-500 ${
                posicaoReal === 1 ? 'order-2 scale-110 z-10' : posicaoReal === 2 ? 'order-1' : 'order-3'
              }`}
            >
              {/* Avatar e Coroa */}
              <div className="relative mb-4">
                {/* Coroa para o 1º lugar */}
                {posicaoReal === 1 && (
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 animate-bounce">
                    <Crown className="h-10 w-10 text-yellow-400 drop-shadow-lg" fill="currentColor" />
                  </div>
                )}
                
                {/* Efeito de brilho */}
                {posicaoReal === 1 && (
                  <div className="absolute inset-0 rounded-full bg-yellow-400/30 blur-xl animate-pulse" />
                )}
                
                {/* Avatar */}
                <Avatar className={`${style.avatarSize} ${style.avatarBorder} ${style.glowClass} relative shadow-2xl ${style.shadowColor}`}>
                  <AvatarImage 
                    src={corretor.corretor.fotoUrl || undefined} 
                    alt={corretor.corretor.nome}
                    className="object-cover"
                  />
                  <AvatarFallback className={`text-2xl font-bold ${
                    posicaoReal === 1 ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-white' :
                    posicaoReal === 2 ? 'bg-gradient-to-br from-gray-300 to-gray-500 text-white' :
                    'bg-gradient-to-br from-amber-500 to-amber-700 text-white'
                  }`}>
                    {getInitials(corretor.corretor.nome)}
                  </AvatarFallback>
                </Avatar>

                {/* Badge de "Você" */}
                {isMe && (
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground text-xs px-2 py-0.5 shadow-lg">
                      Você
                    </Badge>
                  </div>
                )}
              </div>

              {/* Nome e Métricas */}
              <div className="text-center mb-3">
                <p className={`font-bold ${style.textSize} ${isMe ? 'text-primary' : ''} truncate max-w-[120px]`}>
                  {corretor.corretor.nome.split(' ')[0]}
                </p>
                <div className="flex items-center justify-center gap-1 mt-1">
                  <Flame className="h-4 w-4 text-orange-500" />
                  <span className="text-sm font-semibold text-orange-500">{corretor.pontuacao} pts</span>
                </div>
              </div>

              {/* Pedestal */}
              <div className={`
                ${style.height} w-24 md:w-32 
                ${style.bgGradient} 
                rounded-t-xl 
                shadow-xl ${style.shadowColor}
                flex flex-col items-center justify-start pt-4
                border-t-4 ${style.borderColor}
                relative overflow-hidden
              `}>
                {/* Número da posição */}
                <span className="text-4xl md:text-5xl font-black text-white/90 drop-shadow-lg">
                  {style.medalEmoji || posicaoReal}
                </span>
                
                {/* Métricas resumidas */}
                <div className="text-white/80 text-xs mt-2 text-center">
                  <p>{corretor.metricas.contratos} vendas</p>
                </div>

                {/* Efeito de brilho no pedestal */}
                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -skew-x-12 animate-shimmer" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Base do Pódio */}
      <div className="flex justify-center mt-0">
        <div className="h-4 w-[calc(100%-2rem)] max-w-md bg-gradient-to-b from-slate-600 to-slate-800 rounded-b-lg shadow-xl" />
      </div>
    </div>
  );
}

// Componente de Upload de Foto
function FotoUpload({ corretorId, fotoAtual, onSuccess }: { corretorId: number; fotoAtual?: string; onSuccess: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const updateFoto = trpc.foto.updateMinha.useMutation();

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione uma imagem');
      return;
    }

    // Validar tamanho (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 5MB');
      return;
    }

    setUploading(true);
    try {
      // Converter para base64 e fazer upload
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64 = reader.result as string;
          const buffer = Buffer.from(base64.split(',')[1], 'base64');
          const fileName = `corretores/${corretorId}/foto-${Date.now()}.${file.name.split('.').pop()}`;
          
          // Upload para S3 via API
          const response = await fetch('/api/upload-foto', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileName,
              fileData: base64,
              contentType: file.type,
            }),
          });

          if (!response.ok) {
            throw new Error('Erro no upload');
          }

          const { url } = await response.json();
          
          // Atualizar no banco
          await updateFoto.mutateAsync({ fotoUrl: url });
          toast.success('Foto atualizada com sucesso!');
          onSuccess();
        } catch (error) {
          console.error('Erro no upload:', error);
          toast.error('Erro ao fazer upload da foto');
        } finally {
          setUploading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao processar imagem');
      setUploading(false);
    }
  };

  return (
    <div className="relative group">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleUpload}
        className="hidden"
      />
      <Button
        variant="outline"
        size="sm"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="gap-2"
      >
        {uploading ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
            Enviando...
          </>
        ) : (
          <>
            <Camera className="h-4 w-4" />
            {fotoAtual ? 'Trocar Foto' : 'Adicionar Foto'}
          </>
        )}
      </Button>
    </div>
  );
}

function MinhaPerformance() {
  const { user, refresh: refetchUser } = useAuth();
  const [mes, setMes] = useState<number>(new Date().getMonth() + 1);
  const [ano, setAno] = useState<number>(new Date().getFullYear());
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const utils = trpc.useUtils();
  
  // Buscar ranking completo
  const { data: ranking, isLoading: loadingRanking, refetch: refetchRanking } = trpc.ranking.getCompleto.useQuery({ mes, ano });
  
  // Buscar minha performance
  const { data: minhaPerformance, isLoading: loadingPerformance } = trpc.ranking.minhaPerformance.useQuery({ mes, ano });
  
  // Mutation para upload de foto
  const uploadFoto = trpc.foto.upload.useMutation({
    onSuccess: () => {
      toast.success('Foto atualizada com sucesso!');
      refetchRanking();
      refetchUser?.();
    },
    onError: (error) => {
      toast.error(error.message || 'Erro ao fazer upload da foto');
    },
  });
  
  // Handler de upload de arquivo
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validar tipo
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Tipo de arquivo não permitido. Use JPEG, PNG, GIF ou WebP.');
      return;
    }
    
    // Validar tamanho (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Arquivo muito grande. Máximo permitido: 5MB.');
      return;
    }
    
    setUploading(true);
    
    try {
      // Converter para base64
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64 = reader.result as string;
          await uploadFoto.mutateAsync({
            fileData: base64,
            fileName: file.name,
            contentType: file.type,
          });
        } catch (error) {
          console.error('Erro no upload:', error);
        } finally {
          setUploading(false);
          // Limpar input
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        }
      };
      reader.onerror = () => {
        toast.error('Erro ao ler o arquivo');
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      toast.error('Erro ao processar o arquivo');
      setUploading(false);
    }
  };

  const meses = [
    { value: 1, label: 'Janeiro' },
    { value: 2, label: 'Fevereiro' },
    { value: 3, label: 'Março' },
    { value: 4, label: 'Abril' },
    { value: 5, label: 'Maio' },
    { value: 6, label: 'Junho' },
    { value: 7, label: 'Julho' },
    { value: 8, label: 'Agosto' },
    { value: 9, label: 'Setembro' },
    { value: 10, label: 'Outubro' },
    { value: 11, label: 'Novembro' },
    { value: 12, label: 'Dezembro' },
  ];

  const anos = [2024, 2025, 2026];

  if (loadingRanking || loadingPerformance) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="relative">
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary/30 border-t-primary mx-auto"></div>
              <Trophy className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-6 w-6 text-primary" />
            </div>
            <p className="mt-4 text-muted-foreground">Carregando sua performance...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Encontrar minha posição no ranking
  const minhaPosicao = ranking?.find(r => r.corretor.id === user?.id)?.posicao || 0;
  const meusDados = ranking?.find(r => r.corretor.id === user?.id);

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header com gradiente */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 p-8 text-white">
          <div className="absolute inset-0 bg-black/20" />
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2 blur-3xl" />
          
          <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-center gap-6">
              {/* Avatar do usuário com botão de upload */}
              <div className="relative group">
                <Avatar className="w-24 h-24 ring-4 ring-white/30 ring-offset-2 ring-offset-transparent shadow-2xl">
                  <AvatarImage 
                    src={meusDados?.corretor.fotoUrl || user?.fotoUrl || undefined} 
                    alt={user?.name || 'Usuário'}
                    className="object-cover"
                  />
                  <AvatarFallback className="text-2xl font-bold bg-white/20 text-white">
                    {user?.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || 'U'}
                  </AvatarFallback>
                </Avatar>
                {minhaPosicao <= 3 && minhaPosicao > 0 && (
                  <div className="absolute -top-2 -right-2 text-3xl">
                    {minhaPosicao === 1 ? '🥇' : minhaPosicao === 2 ? '🥈' : '🥉'}
                  </div>
                )}
                {/* Botão de upload de foto */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="absolute bottom-0 right-0 p-2 bg-white rounded-full shadow-lg hover:bg-gray-100 transition-all opacity-0 group-hover:opacity-100 disabled:opacity-50"
                  title="Alterar foto de perfil"
                >
                  {uploading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-primary" />
                  ) : (
                    <Camera className="h-4 w-4 text-gray-700" />
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
              
              <div>
                <h1 className="text-3xl md:text-4xl font-bold mb-2">
                  Olá, {user?.name?.split(' ')[0] || 'Corretor'}! 👋
                </h1>
                <p className="text-white/80 text-lg">
                  Acompanhe sua performance e conquiste o topo do ranking!
                </p>
                {minhaPosicao > 0 && (
                  <div className="flex items-center gap-2 mt-3">
                    <Badge className="bg-white/20 text-white border-white/30 text-sm px-3 py-1">
                      <Trophy className="h-4 w-4 mr-1" />
                      {minhaPosicao}º no Ranking
                    </Badge>
                    <Badge className="bg-white/20 text-white border-white/30 text-sm px-3 py-1">
                      <Flame className="h-4 w-4 mr-1" />
                      {meusDados?.pontuacao || 0} pontos
                    </Badge>
                  </div>
                )}
              </div>
            </div>
            
            {/* Seletores de período */}
            <div className="flex items-center gap-3 bg-white/10 rounded-xl p-3 backdrop-blur-sm">
              <Select value={mes.toString()} onValueChange={(v) => setMes(parseInt(v))}>
                <SelectTrigger className="w-[140px] bg-white/20 border-white/30 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {meses.map((m) => (
                    <SelectItem key={m.value} value={m.value.toString()}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={ano.toString()} onValueChange={(v) => setAno(parseInt(v))}>
                <SelectTrigger className="w-[100px] bg-white/20 border-white/30 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {anos.map((a) => (
                    <SelectItem key={a} value={a.toString()}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Pódio */}
        <Card className="p-6 bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-800 border-2 border-yellow-500/20 shadow-xl">
          <Podium ranking={ranking || []} meuId={user?.id || 0} />
        </Card>

        {/* Minhas Métricas */}
        {minhaPerformance && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <Card className="p-6 bg-gradient-to-br from-blue-500 to-blue-600 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-100">Total de Leads</p>
                  <p className="text-4xl font-bold mt-2">{minhaPerformance.metricas.totalLeads}</p>
                </div>
                <Users className="h-10 w-10 text-blue-200" />
              </div>
            </Card>

            <Card className="p-6 bg-gradient-to-br from-purple-500 to-purple-600 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-100">Agendamentos</p>
                  <p className="text-4xl font-bold mt-2">{minhaPerformance.metricas.agendamentos}</p>
                </div>
                <Clock className="h-10 w-10 text-purple-200" />
              </div>
            </Card>

            <Card className="p-6 bg-gradient-to-br from-cyan-500 to-cyan-600 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-cyan-100">Visitas</p>
                  <p className="text-4xl font-bold mt-2">{minhaPerformance.metricas.visitas}</p>
                </div>
                <Target className="h-10 w-10 text-cyan-200" />
              </div>
            </Card>

            <Card className="p-6 bg-gradient-to-br from-green-500 to-green-600 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-100">Contratos</p>
                  <p className="text-4xl font-bold mt-2">{minhaPerformance.metricas.contratos}</p>
                </div>
                <CheckCircle2 className="h-10 w-10 text-green-200" />
              </div>
            </Card>

            <Card className="p-6 bg-gradient-to-br from-amber-500 to-orange-600 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-amber-100">VGV</p>
                  <p className="text-2xl font-bold mt-2">
                    {new Intl.NumberFormat('pt-BR', { 
                      style: 'currency', 
                      currency: 'BRL',
                      notation: 'compact',
                      maximumFractionDigits: 1
                    }).format(minhaPerformance.metricas.vgv / 100)}
                  </p>
                </div>
                <TrendingUp className="h-10 w-10 text-amber-200" />
              </div>
            </Card>
          </div>
        )}

        {/* Progresso das Metas */}
        {minhaPerformance?.meta && minhaPerformance?.progresso && (
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <Target className="h-6 w-6 text-primary" />
              <h2 className="text-xl font-bold">Progresso das Metas</h2>
            </div>
            
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
              {[
                { label: 'Leads', atual: minhaPerformance.metricas.totalLeads, meta: minhaPerformance.meta.leads, progresso: minhaPerformance.progresso.leads, color: 'bg-blue-500' },
                { label: 'Agendamentos', atual: minhaPerformance.metricas.agendamentos, meta: minhaPerformance.meta.agendamentos, progresso: minhaPerformance.progresso.agendamentos, color: 'bg-purple-500' },
                { label: 'Visitas', atual: minhaPerformance.metricas.visitas, meta: minhaPerformance.meta.visitas, progresso: minhaPerformance.progresso.visitas, color: 'bg-cyan-500' },
                { label: 'Contratos', atual: minhaPerformance.metricas.contratos, meta: minhaPerformance.meta.contratos, progresso: minhaPerformance.progresso.contratos, color: 'bg-green-500' },
                { label: 'VGV', atual: minhaPerformance.metricas.vgv, meta: minhaPerformance.meta.vgv, progresso: minhaPerformance.progresso.vgv, color: 'bg-amber-500', isVGV: true },
              ].map((item) => (
                <div key={item.label} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{item.label}</span>
                    <span className="text-muted-foreground">
                      {item.isVGV 
                        ? `${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(item.atual / 100)} / ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(item.meta / 100)}`
                        : `${item.atual} / ${item.meta}`
                      }
                    </span>
                  </div>
                  <div className="relative">
                    <Progress value={Math.min(item.progresso, 100)} className="h-3" />
                    {item.progresso >= 100 && (
                      <Sparkles className="absolute -right-1 -top-1 h-5 w-5 text-yellow-500 animate-pulse" />
                    )}
                  </div>
                  <div className="flex justify-between items-center">
                    <span className={`text-xs font-semibold ${item.progresso >= 100 ? 'text-green-600' : item.progresso >= 75 ? 'text-yellow-600' : 'text-muted-foreground'}`}>
                      {item.progresso}%
                    </span>
                    {item.progresso >= 100 && (
                      <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                        Meta Atingida! 🎉
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Ranking Completo */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-6">
            <Trophy className="h-6 w-6 text-yellow-500" />
            <h2 className="text-xl font-bold">Ranking Completo</h2>
          </div>
          
          <div className="space-y-3">
            {ranking?.map((corretor) => {
              const isMe = corretor.corretor.id === user?.id;
              const medalha = corretor.posicao === 1 ? '🥇' : corretor.posicao === 2 ? '🥈' : corretor.posicao === 3 ? '🥉' : '';

              return (
                <div
                  key={corretor.corretor.id}
                  className={`flex items-center justify-between p-4 rounded-xl transition-all ${
                    isMe
                      ? 'bg-gradient-to-r from-primary/10 to-primary/5 border-2 border-primary shadow-lg'
                      : 'bg-muted/30 hover:bg-muted/50'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    {/* Posição */}
                    <div className={`flex items-center justify-center w-10 h-10 rounded-full font-bold text-lg ${
                      corretor.posicao <= 3 
                        ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-white shadow-lg' 
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {medalha || corretor.posicao}
                    </div>
                    
                    {/* Avatar */}
                    <Avatar className={`w-12 h-12 ${isMe ? 'ring-2 ring-primary ring-offset-2' : ''}`}>
                      <AvatarImage 
                        src={corretor.corretor.fotoUrl || undefined} 
                        alt={corretor.corretor.nome}
                        className="object-cover"
                      />
                      <AvatarFallback className="bg-muted">
                        {corretor.corretor.nome.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    
                    {/* Nome e Status */}
                    <div>
                      <p className={`font-semibold ${isMe ? 'text-primary' : ''}`}>
                        {corretor.corretor.nome}
                        {isMe && <span className="ml-2 text-xs text-primary">(Você)</span>}
                      </p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>{corretor.metricas.totalLeads} leads</span>
                        <span>•</span>
                        <span>{corretor.metricas.contratos} vendas</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Pontuação */}
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-lg font-bold text-orange-500">
                      <Flame className="h-5 w-5" />
                      {corretor.pontuacao}
                    </div>
                    <p className="text-xs text-muted-foreground">pontos</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* CSS para animação de shimmer */}
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%) skewX(-12deg); }
          100% { transform: translateX(200%) skewX(-12deg); }
        }
        .animate-shimmer {
          animation: shimmer 3s infinite;
        }
      `}</style>
    </DashboardLayout>
  );
}

export default MinhaPerformance;

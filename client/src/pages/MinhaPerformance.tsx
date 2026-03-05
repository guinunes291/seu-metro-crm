import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  TrendingUp,
  Target,
  Trophy,
  Users,
  Clock,
  CheckCircle2,
  Edit3,
  Camera,
  Flame,
  Star,
  Award,
  BarChart3,
  Zap,
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";

// ============================================================================
// HELPERS
// ============================================================================

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value / 100);
}

function getProgressColor(pct: number) {
  if (pct >= 100) return "text-green-600 dark:text-green-400";
  if (pct >= 70) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-500 dark:text-red-400";
}

function getProgressBarColor(pct: number) {
  if (pct >= 100) return "bg-green-500";
  if (pct >= 70) return "bg-yellow-500";
  return "bg-red-500";
}

// ============================================================================
// MODAL DE DEFINIR METAS
// ============================================================================

function ModalDefinirMeta({
  mes,
  ano,
  metaAtual,
  onSaved,
}: {
  mes: number;
  ano: number;
  metaAtual: any;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    metaLeads: metaAtual?.metaLeads?.toString() ?? "",
    metaAgendamentos: metaAtual?.metaAgendamentos?.toString() ?? "",
    metaVisitas: metaAtual?.metaVisitas?.toString() ?? "",
    metaContratos: metaAtual?.metaContratos?.toString() ?? "",
    metaVGV: metaAtual?.metaVGV?.toString() ?? "",
  });

  const definirMeta = trpc.metas.definirMinhaMeta.useMutation({
    onSuccess: () => {
      toast.success("Meta salva com sucesso!");
      setOpen(false);
      onSaved();
    },
    onError: (err) => toast.error(err.message || "Erro ao salvar meta"),
  });

  const handleSave = () => {
    definirMeta.mutate({
      mes,
      ano,
      metaLeads: form.metaLeads ? parseInt(form.metaLeads) : undefined,
      metaAgendamentos: form.metaAgendamentos ? parseInt(form.metaAgendamentos) : undefined,
      metaVisitas: form.metaVisitas ? parseInt(form.metaVisitas) : undefined,
      metaContratos: form.metaContratos ? parseInt(form.metaContratos) : undefined,
      metaVGV: form.metaVGV ? parseInt(form.metaVGV) : undefined,
    });
  };

  const campos = [
    { key: "metaLeads", label: "Meta de Leads", icon: Users, placeholder: "Ex: 30" },
    { key: "metaAgendamentos", label: "Meta de Agendamentos", icon: Clock, placeholder: "Ex: 15" },
    { key: "metaVisitas", label: "Meta de Visitas", icon: CheckCircle2, placeholder: "Ex: 10" },
    { key: "metaContratos", label: "Meta de Contratos", icon: Trophy, placeholder: "Ex: 3" },
    { key: "metaVGV", label: "Meta de VGV (R$)", icon: TrendingUp, placeholder: "Ex: 500000" },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Edit3 className="h-4 w-4" />
          {metaAtual ? "Editar Metas" : "Definir Metas"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Minhas Metas — {new Date(ano, mes - 1).toLocaleString("pt-BR", { month: "long", year: "numeric" })}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {campos.map(({ key, label, icon: Icon, placeholder }) => (
            <div key={key} className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-sm font-medium">
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                {label}
              </Label>
              <Input
                type="number"
                min={0}
                placeholder={placeholder}
                value={(form as any)[key]}
                onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={definirMeta.isPending}>
            {definirMeta.isPending ? "Salvando..." : "Salvar Metas"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// CARD DE PROGRESSO DE UMA META
// ============================================================================

function MetaProgressCard({
  label,
  icon: Icon,
  realizado,
  meta,
  progresso,
  formatFn,
}: {
  label: string;
  icon: any;
  realizado: number;
  meta: number | null;
  progresso: number;
  formatFn?: (v: number) => string;
}) {
  const fmt = formatFn ?? ((v: number) => v.toString());
  const hasMeta = meta !== null && meta > 0;
  const pct = hasMeta ? Math.min(progresso, 100) : 0;

  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Icon className="h-4 w-4 text-primary" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">{label}</span>
          </div>
          {hasMeta && pct >= 100 && (
            <Badge className="bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30 text-xs">
              ✓ Meta atingida!
            </Badge>
          )}
        </div>

        <div className="mb-3">
          <span className="text-3xl font-bold">{fmt(realizado)}</span>
          {hasMeta && (
            <span className="text-sm text-muted-foreground ml-2">
              / {fmt(meta!)}
            </span>
          )}
        </div>

        {hasMeta ? (
          <>
            <Progress value={pct} className="h-2 mb-1" />
            <div className="flex justify-between items-center">
              <span className={`text-xs font-semibold ${getProgressColor(progresso)}`}>
                {progresso}%
              </span>
              <span className="text-xs text-muted-foreground">
                Faltam: {Math.max(0, meta! - realizado) > 0 ? fmt(Math.max(0, meta! - realizado)) : "0"}
              </span>
            </div>
          </>
        ) : (
          <p className="text-xs text-muted-foreground italic">Meta não definida</p>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function MinhaPerformance() {
  const { user, refresh: refetchUser } = useAuth();
  const [mes, setMes] = useState<number>(new Date().getMonth() + 1);
  const [ano, setAno] = useState<number>(new Date().getFullYear());
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();

  // Buscar minha performance (métricas reais)
  const { data: minhaPerformance, isLoading: loadingPerf } = trpc.ranking.minhaPerformance.useQuery(
    { mes, ano },
    { refetchOnWindowFocus: false }
  );

  // Buscar minha meta do mês
  const { data: minhaMeta, refetch: refetchMeta } = trpc.metas.minhaMeta.useQuery(
    { mes, ano },
    { refetchOnWindowFocus: false }
  );

  // Buscar meu progresso em relação à meta
  const { data: meuProgresso, refetch: refetchProgresso } = trpc.metas.meuProgresso.useQuery(
    { mes, ano },
    { enabled: !!minhaMeta, refetchOnWindowFocus: false }
  );

  // Upload de foto
  const uploadFoto = trpc.foto.upload.useMutation({
    onSuccess: () => {
      toast.success("Foto atualizada com sucesso!");
      refetchUser?.();
    },
    onError: (error) => toast.error(error.message || "Erro ao fazer upload da foto"),
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Tipo de arquivo não permitido. Use JPEG, PNG, GIF ou WebP.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Máximo: 5MB.");
      return;
    }
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = reader.result as string;
        await uploadFoto.mutateAsync({ fileData: base64, fileName: file.name, contentType: file.type });
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.onerror = () => { toast.error("Erro ao ler o arquivo"); setUploading(false); };
    reader.readAsDataURL(file);
  };

  const meses = [
    { value: 1, label: "Janeiro" }, { value: 2, label: "Fevereiro" },
    { value: 3, label: "Março" }, { value: 4, label: "Abril" },
    { value: 5, label: "Maio" }, { value: 6, label: "Junho" },
    { value: 7, label: "Julho" }, { value: 8, label: "Agosto" },
    { value: 9, label: "Setembro" }, { value: 10, label: "Outubro" },
    { value: 11, label: "Novembro" }, { value: 12, label: "Dezembro" },
  ];
  const anos = [2024, 2025, 2026];

  const onMetaSaved = () => {
    refetchMeta();
    refetchProgresso();
  };

  // Dados reais da performance
  const metricas = minhaPerformance?.metricas;

  // Progresso geral
  const progressoGeral = meuProgresso?.progressoGeral ?? 0;

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-5xl mx-auto">

        {/* ── HEADER ── */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 p-6 md:p-8 text-white">
          <div className="absolute inset-0 bg-black/20" />
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2 blur-3xl" />

          <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            {/* Avatar + Info */}
            <div className="flex items-center gap-5">
              <div className="relative group">
                <Avatar className="w-20 h-20 ring-4 ring-white/30 ring-offset-2 ring-offset-transparent shadow-2xl">
                  <AvatarImage src={user?.fotoUrl || undefined} alt={user?.name || "Corretor"} className="object-cover" />
                  <AvatarFallback className="text-xl font-bold bg-white/20 text-white">
                    {user?.name?.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) || "C"}
                  </AvatarFallback>
                </Avatar>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="absolute bottom-0 right-0 p-1.5 bg-white rounded-full shadow-lg hover:bg-gray-100 transition-all opacity-0 group-hover:opacity-100 disabled:opacity-50"
                  title="Alterar foto"
                >
                  {uploading ? (
                    <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-gray-300 border-t-primary" />
                  ) : (
                    <Camera className="h-3.5 w-3.5 text-gray-700" />
                  )}
                </button>
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" onChange={handleFileUpload} className="hidden" />
              </div>

              <div>
                <h1 className="text-2xl md:text-3xl font-bold mb-1">
                  Olá, {user?.name?.split(" ")[0] || "Corretor"}! 👋
                </h1>
                <p className="text-white/80">Acompanhe suas metas e evolução mensal</p>
                {progressoGeral > 0 && (
                  <div className="flex items-center gap-2 mt-2">
                    <Badge className="bg-white/20 text-white border-white/30 text-sm px-3 py-1">
                      <Flame className="h-4 w-4 mr-1" />
                      {progressoGeral}% da meta geral
                    </Badge>
                  </div>
                )}
              </div>
            </div>

            {/* Seletor de período + botão de metas */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 bg-white/10 rounded-xl p-2.5 backdrop-blur-sm">
                <Select value={mes.toString()} onValueChange={(v) => setMes(parseInt(v))}>
                  <SelectTrigger className="w-[130px] bg-white/20 border-white/30 text-white text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {meses.map((m) => (
                      <SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={ano.toString()} onValueChange={(v) => setAno(parseInt(v))}>
                  <SelectTrigger className="w-[90px] bg-white/20 border-white/30 text-white text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {anos.map((a) => (
                      <SelectItem key={a} value={a.toString()}>{a}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <ModalDefinirMeta mes={mes} ano={ano} metaAtual={minhaMeta} onSaved={onMetaSaved} />
            </div>
          </div>
        </div>

        {/* ── PROGRESSO GERAL ── */}
        {meuProgresso && (
          <Card className="border-2 border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="h-5 w-5 text-primary" />
                Progresso Geral do Mês
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Progress value={progressoGeral} className="h-4" />
                </div>
                <span className={`text-2xl font-bold ${getProgressColor(progressoGeral)}`}>
                  {progressoGeral}%
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Calculado com base nas 5 metas do funil (cada uma vale até 20%)
              </p>
            </CardContent>
          </Card>
        )}

        {/* ── CARDS DE MÉTRICAS ── */}
        {loadingPerf ? (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[...Array(5)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-5 h-32" />
              </Card>
            ))}
          </div>
        ) : metricas ? (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <MetaProgressCard
              label="Leads"
              icon={Users}
              realizado={metricas.totalLeads ?? 0}
              meta={minhaMeta?.metaLeads ?? null}
              progresso={meuProgresso?.progresso?.leads ?? 0}
            />
            <MetaProgressCard
              label="Agendamentos"
              icon={Clock}
              realizado={metricas.agendamentos ?? 0}
              meta={minhaMeta?.metaAgendamentos ?? null}
              progresso={meuProgresso?.progresso?.agendamentos ?? 0}
            />
            <MetaProgressCard
              label="Visitas"
              icon={CheckCircle2}
              realizado={metricas.visitas ?? 0}
              meta={minhaMeta?.metaVisitas ?? null}
              progresso={meuProgresso?.progresso?.visitas ?? 0}
            />
            <MetaProgressCard
              label="Contratos"
              icon={Trophy}
              realizado={metricas.contratos ?? 0}
              meta={minhaMeta?.metaContratos ?? null}
              progresso={meuProgresso?.progresso?.contratos ?? 0}
            />
            <MetaProgressCard
              label="VGV"
              icon={TrendingUp}
              realizado={metricas.vgv ?? 0}
              meta={minhaMeta?.metaVGV ?? null}
              progresso={meuProgresso?.progresso?.vgv ?? 0}
              formatFn={formatCurrency}
            />
          </div>
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              <Target className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">Nenhuma atividade registrada neste período.</p>
            </CardContent>
          </Card>
        )}

        {/* ── PONTUAÇÃO E CONQUISTAS ── */}
        {metricas && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Pontuação */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Zap className="h-5 w-5 text-yellow-500" />
                  Minha Pontuação
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <div className="text-5xl font-black text-yellow-500">
                    {metricas.pontuacao ?? 0}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <p>pontos acumulados</p>
                    <p className="text-xs mt-1">no período selecionado</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Resumo do funil */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Award className="h-5 w-5 text-purple-500" />
                  Resumo do Funil
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {[
                    { label: "Leads → Agendamentos", a: metricas.totalLeads, b: metricas.agendamentos },
                    { label: "Agendamentos → Visitas", a: metricas.agendamentos, b: metricas.visitas },
                    { label: "Visitas → Contratos", a: metricas.visitas, b: metricas.contratos },
                  ].map(({ label, a, b }) => {
                    const taxa = a > 0 ? Math.round((b / a) * 100) : 0;
                    return (
                      <div key={label} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{label}</span>
                        <Badge variant="outline" className={taxa >= 30 ? "border-green-500 text-green-600" : "border-muted"}>
                          {taxa}%
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── CALL TO ACTION quando não tem meta ── */}
        {!minhaMeta && !loadingPerf && (
          <Card className="border-dashed border-2 border-primary/30 bg-primary/5">
            <CardContent className="p-8 text-center">
              <Star className="h-12 w-12 mx-auto text-primary/50 mb-3" />
              <h3 className="font-semibold text-lg mb-2">Defina suas metas para este mês!</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Estabeleça metas de leads, agendamentos, visitas, contratos e VGV para acompanhar seu progresso.
              </p>
              <ModalDefinirMeta mes={mes} ano={ano} metaAtual={null} onSaved={onMetaSaved} />
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}

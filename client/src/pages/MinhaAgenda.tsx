import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Calendar, Clock, Link2, Plus, Trash2, Copy, ExternalLink, CalendarOff, Loader2, MessageCircle, Search, User, Phone, Mail, Timer, X } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { format, addMinutes } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

const DIAS_SEMANA = [
  { value: 0, label: "Domingo" },
  { value: 1, label: "Segunda-feira" },
  { value: 2, label: "Terça-feira" },
  { value: 3, label: "Quarta-feira" },
  { value: 4, label: "Quinta-feira" },
  { value: 5, label: "Sexta-feira" },
  { value: 6, label: "Sábado" },
];

const HORARIOS = Array.from({ length: 24 }, (_, i) => 
  `${String(i).padStart(2, '0')}:00`
);

export default function MinhaAgenda() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [showAddDisponibilidade, setShowAddDisponibilidade] = useState(false);
  const [showAddBloqueio, setShowAddBloqueio] = useState(false);
  const [showCreateLink, setShowCreateLink] = useState(false);
  
  // Estados para busca de cliente
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLead, setSelectedLead] = useState<{ id: number; nome: string; telefone: string; email?: string | null } | null>(null);
  const [linkExclusivo, setLinkExclusivo] = useState(false);
  const [tipoExpiracao, setTipoExpiracao] = useState<'15min' | '30min' | '1hora' | '24horas' | 'indeterminado'>('indeterminado');
  const [deleteLinkDialogOpen, setDeleteLinkDialogOpen] = useState(false);
  const [linkToDelete, setLinkToDelete] = useState<{ id: number; titulo: string | null } | null>(null);

  // Opções de expiração
  const OPCOES_EXPIRACAO = [
    { value: '15min', label: '15 minutos', minutos: 15 },
    { value: '30min', label: '30 minutos', minutos: 30 },
    { value: '1hora', label: '1 hora', minutos: 60 },
    { value: '24horas', label: '24 horas', minutos: 1440 },
    { value: 'indeterminado', label: 'Indeterminado (sem expiração)', minutos: null },
  ];
  
  const [novaDisponibilidade, setNovaDisponibilidade] = useState({
    diaSemana: 1,
    horaInicio: "09:00",
    horaFim: "18:00",
    intervaloInicio: "12:00",
    intervaloFim: "13:00",
    duracaoSlot: 60
  });

  const [novoBloqueio, setNovoBloqueio] = useState({
    dataInicio: "",
    dataFim: "",
    tipo: "outro" as const,
    motivo: "",
    diaInteiro: true
  });

  const [novoLink, setNovoLink] = useState({
    titulo: "",
    mensagemBoasVindas: "",
    projectId: undefined as number | undefined
  });

  // Queries
  const { data: disponibilidades, isLoading: loadingDisp } = trpc.agenda.getDisponibilidade.useQuery();
  const { data: bloqueios, isLoading: loadingBloq } = trpc.agenda.getBloqueios.useQuery();
  const { data: links, isLoading: loadingLinks } = trpc.linksAgendamento.list.useQuery();
  const { data: projetos } = trpc.projects.list.useQuery();
  
  // Busca de leads
  const { data: leadsEncontrados, isLoading: loadingSearch } = trpc.searchLeads.byIdentifier.useQuery(
    { query: searchTerm },
    { enabled: searchTerm.length >= 3 }
  );

  // Mutations
  const saveDisponibilidade = trpc.agenda.saveDisponibilidade.useMutation({
    onSuccess: () => {
      utils.agenda.getDisponibilidade.invalidate();
      setShowAddDisponibilidade(false);
      toast.success("Disponibilidade salva!");
    }
  });

  const deleteDisponibilidade = trpc.agenda.deleteDisponibilidade.useMutation({
    onSuccess: () => {
      utils.agenda.getDisponibilidade.invalidate();
      toast.success("Disponibilidade removida!");
    }
  });

  const createBloqueio = trpc.agenda.createBloqueio.useMutation({
    onSuccess: () => {
      utils.agenda.getBloqueios.invalidate();
      setShowAddBloqueio(false);
      setNovoBloqueio({ dataInicio: "", dataFim: "", tipo: "outro", motivo: "", diaInteiro: true });
      toast.success("Bloqueio criado!");
    }
  });

  const deleteBloqueio = trpc.agenda.deleteBloqueio.useMutation({
    onSuccess: () => {
      utils.agenda.getBloqueios.invalidate();
      toast.success("Bloqueio removido!");
    }
  });

  const createLink = trpc.linksAgendamento.create.useMutation({
    onSuccess: (data) => {
      utils.linksAgendamento.list.invalidate();
      setShowCreateLink(false);
      setNovoLink({ titulo: "", mensagemBoasVindas: "", projectId: undefined });
      setSelectedLead(null);
      setSearchTerm("");
      setLinkExclusivo(false);
      setTipoExpiracao('indeterminado');
      toast.success("Link criado!");
      
      // Copiar link automaticamente
      if (data?.token) {
        const url = `${window.location.origin}/agendar/${data.token}`;
        navigator.clipboard.writeText(url);
        toast.success("Link copiado para a área de transferência!");
      }
    }
  });

  const deleteLink = trpc.linksAgendamento.delete.useMutation({
    onSuccess: () => {
      utils.linksAgendamento.list.invalidate();
      toast.success("Link excluído!");
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao excluir link");
    }
  });

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/agendar/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiado!");
  };

  const shareWhatsApp = (token: string, titulo?: string | null) => {
    const url = `${window.location.origin}/agendar/${token}`;
    const mensagem = encodeURIComponent(
      `Olá! 👋\n\nAgende sua visita através do link abaixo:\n\n${titulo || 'Agendamento de Visita'}\n${url}\n\nEstou à disposição para qualquer dúvida!`
    );
    window.open(`https://wa.me/?text=${mensagem}`, '_blank');
  };

  const handleCreateLink = () => {
    const linkData: any = {
      ...novoLink
    };
    
    // Configurar expiração baseada na opção selecionada
    const opcaoExpiracao = OPCOES_EXPIRACAO.find(o => o.value === tipoExpiracao);
    if (opcaoExpiracao && opcaoExpiracao.minutos) {
      linkData.validoAte = addMinutes(new Date(), opcaoExpiracao.minutos).toISOString();
    }
    
    // Se for link exclusivo para um cliente, adicionar leadId
    if (linkExclusivo && selectedLead) {
      linkData.leadId = selectedLead.id;
      linkData.maxAgendamentos = 1;
      linkData.titulo = linkData.titulo || `Agendamento para ${selectedLead.nome}`;
      // Se não tiver expiração definida, usar 15 minutos como padrão para links exclusivos
      if (!linkData.validoAte) {
        linkData.validoAte = addMinutes(new Date(), 15).toISOString();
      }
    }
    
    createLink.mutate(linkData);
  };

  // Calcular tempo restante para links com expiração
  const getTempoRestante = (validoAte: Date | string | null) => {
    if (!validoAte) return null;
    const agora = new Date();
    const expiracao = new Date(validoAte);
    const diff = expiracao.getTime() - agora.getTime();
    if (diff <= 0) return "Expirado";
    const minutos = Math.floor(diff / 60000);
    const segundos = Math.floor((diff % 60000) / 1000);
    return `${minutos}:${String(segundos).padStart(2, '0')}`;
  };

  // Atualizar tempo restante a cada segundo
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Minha Agenda</h1>
          <p className="text-slate-400">Configure sua disponibilidade e gerencie links de agendamento</p>
        </div>

        {/* Disponibilidade Semanal */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-white flex items-center gap-2">
                <Calendar className="h-5 w-5 text-amber-500" />
                Disponibilidade Semanal
              </CardTitle>
              <CardDescription className="text-slate-400">
                Defina seus horários de trabalho para cada dia da semana
              </CardDescription>
            </div>
            <Dialog open={showAddDisponibilidade} onOpenChange={setShowAddDisponibilidade}>
              <DialogTrigger asChild>
                <Button className="bg-amber-500 hover:bg-amber-600">
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-slate-800 border-slate-700">
                <DialogHeader>
                  <DialogTitle className="text-white">Adicionar Disponibilidade</DialogTitle>
                  <DialogDescription className="text-slate-400">
                    Configure seu horário de trabalho para um dia da semana
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label className="text-slate-300">Dia da Semana</Label>
                    <Select 
                      value={String(novaDisponibilidade.diaSemana)}
                      onValueChange={(v) => setNovaDisponibilidade({ ...novaDisponibilidade, diaSemana: Number(v) })}
                    >
                      <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-700 border-slate-600">
                        {DIAS_SEMANA.map((dia) => (
                          <SelectItem key={dia.value} value={String(dia.value)} className="text-white">
                            {dia.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-slate-300">Início</Label>
                      <Select 
                        value={novaDisponibilidade.horaInicio}
                        onValueChange={(v) => setNovaDisponibilidade({ ...novaDisponibilidade, horaInicio: v })}
                      >
                        <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-700 border-slate-600 max-h-60">
                          {HORARIOS.map((h) => (
                            <SelectItem key={h} value={h} className="text-white">{h}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-300">Fim</Label>
                      <Select 
                        value={novaDisponibilidade.horaFim}
                        onValueChange={(v) => setNovaDisponibilidade({ ...novaDisponibilidade, horaFim: v })}
                      >
                        <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-700 border-slate-600 max-h-60">
                          {HORARIOS.map((h) => (
                            <SelectItem key={h} value={h} className="text-white">{h}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-slate-300">Intervalo Início</Label>
                      <Select 
                        value={novaDisponibilidade.intervaloInicio}
                        onValueChange={(v) => setNovaDisponibilidade({ ...novaDisponibilidade, intervaloInicio: v })}
                      >
                        <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-700 border-slate-600 max-h-60">
                          {HORARIOS.map((h) => (
                            <SelectItem key={h} value={h} className="text-white">{h}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-300">Intervalo Fim</Label>
                      <Select 
                        value={novaDisponibilidade.intervaloFim}
                        onValueChange={(v) => setNovaDisponibilidade({ ...novaDisponibilidade, intervaloFim: v })}
                      >
                        <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-700 border-slate-600 max-h-60">
                          {HORARIOS.map((h) => (
                            <SelectItem key={h} value={h} className="text-white">{h}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300">Duração do Slot (minutos)</Label>
                    <Select 
                      value={String(novaDisponibilidade.duracaoSlot)}
                      onValueChange={(v) => setNovaDisponibilidade({ ...novaDisponibilidade, duracaoSlot: Number(v) })}
                    >
                      <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-700 border-slate-600">
                        <SelectItem value="30" className="text-white">30 minutos</SelectItem>
                        <SelectItem value="60" className="text-white">1 hora</SelectItem>
                        <SelectItem value="90" className="text-white">1h30</SelectItem>
                        <SelectItem value="120" className="text-white">2 horas</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button 
                    variant="outline" 
                    onClick={() => setShowAddDisponibilidade(false)}
                    className="border-slate-600 text-slate-300"
                  >
                    Cancelar
                  </Button>
                  <Button 
                    onClick={() => saveDisponibilidade.mutate(novaDisponibilidade)}
                    disabled={saveDisponibilidade.isPending}
                    className="bg-amber-500 hover:bg-amber-600"
                  >
                    {saveDisponibilidade.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Salvar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {loadingDisp ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
              </div>
            ) : disponibilidades && disponibilidades.length > 0 ? (
              <div className="space-y-2">
                {disponibilidades.map((disp) => (
                  <div key={disp.id} className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className="w-32 font-medium text-white">
                        {DIAS_SEMANA.find(d => d.value === disp.diaSemana)?.label}
                      </div>
                      <div className="flex items-center gap-2 text-slate-300">
                        <Clock className="h-4 w-4" />
                        {disp.horaInicio} - {disp.horaFim}
                      </div>
                      {disp.intervaloInicio && disp.intervaloFim && (
                        <div className="text-sm text-slate-400">
                          (intervalo: {disp.intervaloInicio} - {disp.intervaloFim})
                        </div>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteDisponibilidade.mutate({ id: disp.id })}
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400">
                <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma disponibilidade configurada</p>
                <p className="text-sm">Adicione seus horários de trabalho para receber agendamentos</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bloqueios de Agenda */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-white flex items-center gap-2">
                <CalendarOff className="h-5 w-5 text-red-500" />
                Bloqueios de Agenda
              </CardTitle>
              <CardDescription className="text-slate-400">
                Defina férias, folgas ou compromissos que bloqueiam agendamentos
              </CardDescription>
            </div>
            <Dialog open={showAddBloqueio} onOpenChange={setShowAddBloqueio}>
              <DialogTrigger asChild>
                <Button variant="outline" className="border-red-500/50 text-red-400 hover:bg-red-500/10">
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Bloqueio
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-slate-800 border-slate-700">
                <DialogHeader>
                  <DialogTitle className="text-white">Adicionar Bloqueio</DialogTitle>
                  <DialogDescription className="text-slate-400">
                    Bloqueie um período na sua agenda
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-slate-300">Data Início</Label>
                      <Input
                        type="date"
                        value={novoBloqueio.dataInicio}
                        onChange={(e) => setNovoBloqueio({ ...novoBloqueio, dataInicio: e.target.value })}
                        className="bg-slate-700 border-slate-600 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-300">Data Fim</Label>
                      <Input
                        type="date"
                        value={novoBloqueio.dataFim}
                        onChange={(e) => setNovoBloqueio({ ...novoBloqueio, dataFim: e.target.value })}
                        className="bg-slate-700 border-slate-600 text-white"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300">Tipo</Label>
                    <Select 
                      value={novoBloqueio.tipo}
                      onValueChange={(v: any) => setNovoBloqueio({ ...novoBloqueio, tipo: v })}
                    >
                      <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-700 border-slate-600">
                        <SelectItem value="ferias" className="text-white">Férias</SelectItem>
                        <SelectItem value="folga" className="text-white">Folga</SelectItem>
                        <SelectItem value="reuniao" className="text-white">Reunião</SelectItem>
                        <SelectItem value="compromisso_pessoal" className="text-white">Compromisso Pessoal</SelectItem>
                        <SelectItem value="treinamento" className="text-white">Treinamento</SelectItem>
                        <SelectItem value="outro" className="text-white">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300">Motivo (opcional)</Label>
                    <Input
                      value={novoBloqueio.motivo}
                      onChange={(e) => setNovoBloqueio({ ...novoBloqueio, motivo: e.target.value })}
                      placeholder="Descreva o motivo..."
                      className="bg-slate-700 border-slate-600 text-white"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={novoBloqueio.diaInteiro}
                      onCheckedChange={(v) => setNovoBloqueio({ ...novoBloqueio, diaInteiro: v })}
                    />
                    <Label className="text-slate-300">Dia inteiro</Label>
                  </div>
                </div>
                <DialogFooter>
                  <Button 
                    variant="outline" 
                    onClick={() => setShowAddBloqueio(false)}
                    className="border-slate-600 text-slate-300"
                  >
                    Cancelar
                  </Button>
                  <Button 
                    onClick={() => createBloqueio.mutate({
                      ...novoBloqueio,
                      dataInicio: new Date(novoBloqueio.dataInicio).toISOString(),
                      dataFim: new Date(novoBloqueio.dataFim).toISOString()
                    })}
                    disabled={createBloqueio.isPending || !novoBloqueio.dataInicio || !novoBloqueio.dataFim}
                    className="bg-amber-500 hover:bg-amber-600"
                  >
                    {createBloqueio.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Criar Bloqueio
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {loadingBloq ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
              </div>
            ) : bloqueios && bloqueios.length > 0 ? (
              <div className="space-y-2">
                {bloqueios.map((bloq) => (
                  <div key={bloq.id} className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className="px-2 py-1 rounded text-xs font-medium bg-red-500/20 text-red-400">
                        {bloq.tipo.replace('_', ' ')}
                      </div>
                      <div className="text-slate-300">
                        {format(new Date(bloq.dataInicio), "dd/MM/yyyy")} - {format(new Date(bloq.dataFim), "dd/MM/yyyy")}
                      </div>
                      {bloq.motivo && (
                        <div className="text-sm text-slate-400">{bloq.motivo}</div>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteBloqueio.mutate({ id: bloq.id })}
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400">
                <CalendarOff className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum bloqueio configurado</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Links de Agendamento */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-white flex items-center gap-2">
                <Link2 className="h-5 w-5 text-green-500" />
                Links de Agendamento
              </CardTitle>
              <CardDescription className="text-slate-400">
                Compartilhe links para clientes agendarem visitas diretamente
              </CardDescription>
            </div>
            <Dialog open={showCreateLink} onOpenChange={(open) => {
              setShowCreateLink(open);
              if (!open) {
                setSelectedLead(null);
                setSearchTerm("");
                setLinkExclusivo(false);
                setTipoExpiracao('indeterminado');
              }
            }}>
              <DialogTrigger asChild>
                <Button className="bg-green-600 hover:bg-green-700">
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Link
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-slate-800 border-slate-700 max-w-lg">
                <DialogHeader>
                  <DialogTitle className="text-white">Criar Link de Agendamento</DialogTitle>
                  <DialogDescription className="text-slate-400">
                    Crie um link para compartilhar com clientes
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  {/* Opção de Link Exclusivo */}
                  <div className="flex items-center gap-3 p-3 bg-slate-700/50 rounded-lg">
                    <Switch
                      checked={linkExclusivo}
                      onCheckedChange={(v) => {
                        setLinkExclusivo(v);
                        if (!v) setSelectedLead(null);
                      }}
                    />
                    <div>
                      <Label className="text-white">Link exclusivo para um cliente</Label>
                      <p className="text-xs text-slate-400">O link expira em 15 minutos e só pode ser usado uma vez</p>
                    </div>
                  </div>

                  {/* Busca de Cliente (se link exclusivo) */}
                  {linkExclusivo && (
                    <div className="space-y-2">
                      <Label className="text-slate-300">Buscar Cliente (opcional)</Label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          placeholder="Buscar por nome, telefone ou email..."
                          className="bg-slate-700 border-slate-600 text-white pl-10 pr-10"
                        />
                        {searchTerm && (
                          <button
                            onClick={() => { setSearchTerm(""); setSelectedLead(null); }}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                            aria-label="Limpar busca"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                      
                      {/* Resultados da busca */}
                      {searchTerm.length >= 3 && (
                        <div className="max-h-48 overflow-y-auto space-y-1">
                          {loadingSearch ? (
                            <div className="flex justify-center py-4">
                              <Loader2 className="h-5 w-5 animate-spin text-amber-500" />
                            </div>
                          ) : leadsEncontrados && leadsEncontrados.length > 0 ? (
                            leadsEncontrados.map((lead) => (
                              <button
                                key={lead.id}
                                onClick={() => {
                                  setSelectedLead(lead);
                                  setSearchTerm("");
                                }}
                                className={`w-full p-3 rounded-lg text-left transition-colors ${
                                  selectedLead?.id === lead.id 
                                    ? 'bg-green-600/20 border border-green-500' 
                                    : 'bg-slate-700/50 hover:bg-slate-700'
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <div className="h-10 w-10 rounded-full bg-slate-600 flex items-center justify-center">
                                    <User className="h-5 w-5 text-slate-300" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium text-white truncate">{lead.nome}</div>
                                    <div className="flex items-center gap-3 text-xs text-slate-400">
                                      <span className="flex items-center gap-1">
                                        <Phone className="h-3 w-3" />
                                        {lead.telefone}
                                      </span>
                                      {lead.email && (
                                        <span className="flex items-center gap-1 truncate">
                                          <Mail className="h-3 w-3" />
                                          {lead.email}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </button>
                            ))
                          ) : (
                            <p className="text-center py-4 text-slate-400 text-sm">
                              Nenhum cliente encontrado
                            </p>
                          )}
                        </div>
                      )}

                      {/* Cliente selecionado */}
                      {selectedLead && (
                        <div className="p-3 bg-green-600/20 border border-green-500 rounded-lg">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-full bg-green-600/30 flex items-center justify-center">
                                <User className="h-5 w-5 text-green-400" />
                              </div>
                              <div>
                                <div className="font-medium text-white">{selectedLead.nome}</div>
                                <div className="text-xs text-slate-400">{selectedLead.telefone}</div>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedLead(null)}
                              className="text-slate-400 hover:text-white"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}

                      {!selectedLead && (
                        <p className="text-xs text-slate-400">
                          Se não selecionar um cliente, o link será genérico e o cliente precisará preencher seus dados
                        </p>
                      )}
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label className="text-slate-300">Título (opcional)</Label>
                    <Input
                      value={novoLink.titulo}
                      onChange={(e) => setNovoLink({ ...novoLink, titulo: e.target.value })}
                      placeholder="Ex: Agende sua visita ao Residencial XYZ"
                      className="bg-slate-700 border-slate-600 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300">Projeto (opcional)</Label>
                    <Select 
                      value={novoLink.projectId ? String(novoLink.projectId) : "none"}
                      onValueChange={(v) => setNovoLink({ ...novoLink, projectId: v === "none" ? undefined : Number(v) })}
                    >
                      <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                        <SelectValue placeholder="Selecione um projeto" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-700 border-slate-600">
                        <SelectItem value="none" className="text-white">Nenhum (genérico)</SelectItem>
                        {projetos?.map((p) => (
                          <SelectItem key={p.id} value={String(p.id)} className="text-white">
                            {p.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300">Mensagem de Boas-vindas (opcional)</Label>
                    <Input
                      value={novoLink.mensagemBoasVindas}
                      onChange={(e) => setNovoLink({ ...novoLink, mensagemBoasVindas: e.target.value })}
                      placeholder="Mensagem que aparecerá na página de agendamento"
                      className="bg-slate-700 border-slate-600 text-white"
                    />
                  </div>

                  {/* Expiração do Link */}
                  <div className="space-y-2">
                    <Label className="text-slate-300 flex items-center gap-2">
                      <Timer className="h-4 w-4" />
                      Expiração do Link
                    </Label>
                    <Select 
                      value={tipoExpiracao}
                      onValueChange={(v: any) => setTipoExpiracao(v)}
                    >
                      <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                        <SelectValue placeholder="Selecione a expiração" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-700 border-slate-600">
                        {OPCOES_EXPIRACAO.map((opcao) => (
                          <SelectItem key={opcao.value} value={opcao.value} className="text-white">
                            {opcao.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-slate-400">
                      {tipoExpiracao === 'indeterminado' 
                        ? 'O link poderá ser usado indefinidamente até ser excluído manualmente'
                        : `O link será automaticamente desativado após ${OPCOES_EXPIRACAO.find(o => o.value === tipoExpiracao)?.label}`
                      }
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button 
                    variant="outline" 
                    onClick={() => setShowCreateLink(false)}
                    className="border-slate-600 text-slate-300"
                  >
                    Cancelar
                  </Button>
                  <Button 
                    onClick={handleCreateLink}
                    disabled={createLink.isPending}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {createLink.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Criar Link
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {loadingLinks ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
              </div>
            ) : links && links.length > 0 ? (
              <div className="space-y-2">
                {links.filter(l => l.ativo).map((link) => {
                  const tempoRestante = getTempoRestante(link.validoAte);
                  const expirado = tempoRestante === "Expirado";
                  
                  return (
                    <div key={link.id} className={`flex items-center justify-between p-3 rounded-lg ${expirado ? 'bg-slate-700/30 opacity-60' : 'bg-slate-700/50'}`}>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white">
                            {link.titulo || "Link de Agendamento"}
                          </span>
                          {link.leadId && (
                            <span className="px-2 py-0.5 text-xs rounded bg-blue-500/20 text-blue-400">
                              Exclusivo
                            </span>
                          )}
                          {tempoRestante && !expirado && (
                            <span className="px-2 py-0.5 text-xs rounded bg-amber-500/20 text-amber-400 flex items-center gap-1">
                              <Timer className="h-3 w-3" />
                              {tempoRestante}
                            </span>
                          )}
                          {expirado && (
                            <span className="px-2 py-0.5 text-xs rounded bg-red-500/20 text-red-400">
                              Expirado
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-slate-400">
                          {link.agendamentosRealizados} agendamentos realizados
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {!expirado && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => shareWhatsApp(link.token, link.titulo)}
                              className="text-green-400 hover:text-green-300 hover:bg-green-500/10"
                              title="Compartilhar via WhatsApp"
                              aria-label="Compartilhar via WhatsApp"
                            >
                              <MessageCircle className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyLink(link.token)}
                              className="text-slate-300 hover:text-white"
                              title="Copiar link"
                              aria-label="Copiar link de agendamento"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => window.open(`/agendar/${link.token}`, '_blank')}
                              className="text-slate-300 hover:text-white"
                              title="Abrir link"
                              aria-label="Abrir link de agendamento"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { setLinkToDelete({ id: link.id, titulo: link.titulo }); setDeleteLinkDialogOpen(true); }}
                          disabled={deleteLink.isPending}
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                          title="Excluir link"
                          aria-label="Excluir link"
                        >
                          {deleteLink.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400">
                <Link2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum link criado</p>
                <p className="text-sm">Crie links para compartilhar com seus clientes</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={deleteLinkDialogOpen} onOpenChange={setDeleteLinkDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir link de agendamento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o link <strong>{linkToDelete?.titulo}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (linkToDelete) {
                  deleteLink.mutate({ id: linkToDelete.id });
                  setDeleteLinkDialogOpen(false);
                  setLinkToDelete(null);
                }
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}

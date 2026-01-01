import { useState } from "react";
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
import { Calendar, Clock, Link2, Plus, Trash2, Copy, ExternalLink, CalendarOff, Loader2 } from "lucide-react";
import { format } from "date-fns";
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
    onSuccess: () => {
      utils.linksAgendamento.list.invalidate();
      setShowCreateLink(false);
      setNovoLink({ titulo: "", mensagemBoasVindas: "", projectId: undefined });
      toast.success("Link criado!");
    }
  });

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/agendar/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiado!");
  };

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
                        <Clock className="h-4 w-4 text-amber-500" />
                        {disp.horaInicio} - {disp.horaFim}
                      </div>
                      {disp.intervaloInicio && disp.intervaloFim && (
                        <div className="text-sm text-slate-400">
                          (Intervalo: {disp.intervaloInicio} - {disp.intervaloFim})
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
                <p className="text-sm">Adicione seus horários de trabalho para habilitar agendamentos</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bloqueios */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-white flex items-center gap-2">
                <CalendarOff className="h-5 w-5 text-red-500" />
                Bloqueios de Agenda
              </CardTitle>
              <CardDescription className="text-slate-400">
                Férias, folgas e compromissos que bloqueiam agendamentos
              </CardDescription>
            </div>
            <Dialog open={showAddBloqueio} onOpenChange={setShowAddBloqueio}>
              <DialogTrigger asChild>
                <Button variant="outline" className="border-slate-600 text-slate-300">
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
            <Dialog open={showCreateLink} onOpenChange={setShowCreateLink}>
              <DialogTrigger asChild>
                <Button className="bg-green-600 hover:bg-green-700">
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Link
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-slate-800 border-slate-700">
                <DialogHeader>
                  <DialogTitle className="text-white">Criar Link de Agendamento</DialogTitle>
                  <DialogDescription className="text-slate-400">
                    Crie um link para compartilhar com clientes
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
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
                    onClick={() => createLink.mutate(novoLink)}
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
                {links.map((link) => (
                  <div key={link.id} className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium text-white">
                        {link.titulo || "Link de Agendamento"}
                      </div>
                      <div className="text-sm text-slate-400">
                        {link.agendamentosRealizados} agendamentos realizados
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyLink(link.token)}
                        className="text-slate-300 hover:text-white"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(`/agendar/${link.token}`, '_blank')}
                        className="text-slate-300 hover:text-white"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
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
    </DashboardLayout>
  );
}

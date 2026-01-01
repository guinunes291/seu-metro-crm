import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, ChevronLeft, ChevronRight, Users, Clock, MapPin, Phone, Loader2 } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export default function CalendarioGestor() {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [filtroCorretor, setFiltroCorretor] = useState<string>("todos");
  
  const mes = currentDate.getMonth() + 1;
  const ano = currentDate.getFullYear();
  
  // Buscar calendário de agendamentos
  const { data: calendario, isLoading } = trpc.agendamentosGestor.getCalendario.useQuery({ mes, ano });
  
  // Buscar estatísticas
  const { data: stats } = trpc.agendamentosGestor.getStats.useQuery({
    dataInicio: startOfMonth(currentDate).toISOString(),
    dataFim: endOfMonth(currentDate).toISOString()
  });
  
  // Buscar lista de corretores
  const { data: corretores } = trpc.corretores.list.useQuery();
  
  // Dias do mês
  const diasDoMes = eachDayOfInterval({
    start: startOfMonth(currentDate),
    end: endOfMonth(currentDate)
  });
  
  // Primeiro dia da semana do mês
  const primeiroDia = startOfMonth(currentDate).getDay();
  
  // Agendamentos do dia selecionado
  const agendamentosDoDia = selectedDay && calendario ? calendario[selectedDay] || [] : [];
  
  // Filtrar por corretor
  const agendamentosFiltrados = filtroCorretor === "todos" 
    ? agendamentosDoDia 
    : agendamentosDoDia.filter(a => a.corretorId === Number(filtroCorretor));
  
  const navegarMes = (direcao: 'anterior' | 'proximo') => {
    setCurrentDate(prev => direcao === 'anterior' ? subMonths(prev, 1) : addMonths(prev, 1));
    setSelectedDay(null);
  };
  
  // Verificar se é gestor
  if (user?.role !== 'gestor' && user?.role !== 'admin') {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <p className="text-slate-400">Acesso restrito a gestores</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Calendário de Agendamentos</h1>
            <p className="text-slate-400">Visão consolidada de todos os agendamentos da equipe</p>
          </div>
          <Select value={filtroCorretor} onValueChange={setFiltroCorretor}>
            <SelectTrigger className="w-48 bg-slate-800 border-slate-700 text-white">
              <SelectValue placeholder="Filtrar por corretor" />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              <SelectItem value="todos" className="text-white">Todos os corretores</SelectItem>
              {corretores?.map(c => (
                <SelectItem key={c.id} value={String(c.id)} className="text-white">
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Estatísticas */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-white">{stats.total}</div>
                <div className="text-sm text-slate-400">Total</div>
              </CardContent>
            </Card>
            <Card className="bg-amber-500/10 border-amber-500/30">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-amber-400">{stats.porStatus.pendente}</div>
                <div className="text-sm text-slate-400">Pendentes</div>
              </CardContent>
            </Card>
            <Card className="bg-blue-500/10 border-blue-500/30">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-blue-400">{stats.porStatus.confirmado}</div>
                <div className="text-sm text-slate-400">Confirmados</div>
              </CardContent>
            </Card>
            <Card className="bg-green-500/10 border-green-500/30">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-green-400">{stats.porStatus.realizado}</div>
                <div className="text-sm text-slate-400">Realizados</div>
              </CardContent>
            </Card>
            <Card className="bg-red-500/10 border-red-500/30">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-red-400">{stats.porStatus.cancelado}</div>
                <div className="text-sm text-slate-400">Cancelados</div>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Calendário */}
          <Card className="lg:col-span-2 bg-slate-800/50 border-slate-700">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-white flex items-center gap-2">
                <Calendar className="h-5 w-5 text-amber-500" />
                {MESES[mes - 1]} {ano}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => navegarMes('anterior')}
                  className="text-slate-400 hover:text-white"
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => navegarMes('proximo')}
                  className="text-slate-400 hover:text-white"
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
                </div>
              ) : (
                <>
                  {/* Cabeçalho dos dias da semana */}
                  <div className="grid grid-cols-7 gap-1 mb-2">
                    {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(dia => (
                      <div key={dia} className="text-center text-sm font-medium text-slate-400 py-2">
                        {dia}
                      </div>
                    ))}
                  </div>
                  
                  {/* Dias do mês */}
                  <div className="grid grid-cols-7 gap-1">
                    {/* Espaços vazios antes do primeiro dia */}
                    {Array.from({ length: primeiroDia }).map((_, i) => (
                      <div key={`empty-${i}`} className="h-20" />
                    ))}
                    
                    {diasDoMes.map(dia => {
                      const diaStr = format(dia, 'yyyy-MM-dd');
                      const agendamentosDia = calendario?.[diaStr] || [];
                      const totalDia = filtroCorretor === "todos" 
                        ? agendamentosDia.length 
                        : agendamentosDia.filter(a => a.corretorId === Number(filtroCorretor)).length;
                      const selecionado = selectedDay === diaStr;
                      
                      return (
                        <button
                          key={diaStr}
                          onClick={() => setSelectedDay(diaStr)}
                          className={`h-20 p-1 rounded-lg text-left transition-colors ${
                            selecionado 
                              ? 'bg-amber-500/20 border-2 border-amber-500' 
                              : isToday(dia)
                                ? 'bg-slate-700/50 border border-slate-600'
                                : 'bg-slate-800/30 hover:bg-slate-700/50'
                          }`}
                        >
                          <div className={`text-sm font-medium ${
                            isToday(dia) ? 'text-amber-400' : 'text-slate-300'
                          }`}>
                            {format(dia, 'd')}
                          </div>
                          {totalDia > 0 && (
                            <div className="mt-1">
                              <div className={`text-xs px-1.5 py-0.5 rounded ${
                                totalDia >= 5 ? 'bg-red-500/20 text-red-400' :
                                totalDia >= 3 ? 'bg-amber-500/20 text-amber-400' :
                                'bg-green-500/20 text-green-400'
                              }`}>
                                {totalDia} {totalDia === 1 ? 'visita' : 'visitas'}
                              </div>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Lista de agendamentos do dia */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Users className="h-5 w-5 text-amber-500" />
                {selectedDay 
                  ? format(new Date(selectedDay), "dd 'de' MMMM", { locale: ptBR })
                  : 'Selecione um dia'
                }
              </CardTitle>
              <CardDescription className="text-slate-400">
                {agendamentosFiltrados.length} agendamento(s)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!selectedDay ? (
                <div className="text-center py-8 text-slate-400">
                  <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Clique em um dia para ver os agendamentos</p>
                </div>
              ) : agendamentosFiltrados.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum agendamento neste dia</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {agendamentosFiltrados.map(ag => (
                    <div key={ag.id} className="p-3 bg-slate-700/50 rounded-lg">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-medium text-white">{ag.leadNome}</div>
                          <div className="flex items-center gap-2 text-sm text-slate-400 mt-1">
                            <Clock className="h-3 w-3" />
                            {ag.horaAgendamento}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-slate-400">
                            <Phone className="h-3 w-3" />
                            {ag.leadTelefone}
                          </div>
                          {ag.projetoNome && (
                            <div className="flex items-center gap-2 text-sm text-slate-400">
                              <MapPin className="h-3 w-3" />
                              {ag.projetoNome}
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <div className={`text-xs px-2 py-1 rounded ${
                            ag.status === 'realizado' ? 'bg-green-500/20 text-green-400' :
                            ag.status === 'cancelado' ? 'bg-red-500/20 text-red-400' :
                            ag.status === 'confirmado' ? 'bg-blue-500/20 text-blue-400' :
                            'bg-amber-500/20 text-amber-400'
                          }`}>
                            {ag.status}
                          </div>
                          <div className="text-xs text-slate-500 mt-1">
                            {ag.corretorNome}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Ranking de corretores */}
        {stats && stats.porCorretor.length > 0 && (
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Agendamentos por Corretor</CardTitle>
              <CardDescription className="text-slate-400">
                Desempenho da equipe em {MESES[mes - 1]}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {stats.porCorretor
                  .sort((a, b) => b.total - a.total)
                  .map((corretor, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                          i === 0 ? 'bg-amber-500 text-white' :
                          i === 1 ? 'bg-slate-400 text-white' :
                          i === 2 ? 'bg-amber-700 text-white' :
                          'bg-slate-600 text-slate-300'
                        }`}>
                          {i + 1}
                        </div>
                        <div>
                          <div className="font-medium text-white">{corretor.nome}</div>
                          <div className="text-xs text-slate-400">
                            {corretor.realizados} realizados
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold text-amber-400">{corretor.total}</div>
                        <div className="text-xs text-slate-400">agendamentos</div>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}

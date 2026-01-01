import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { CalendarDays, Clock, User, Phone, Mail, Building2, CheckCircle2, Loader2 } from "lucide-react";
import { format, addDays, isBefore, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function AgendamentoPublico() {
  const { token } = useParams<{ token: string }>();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedSlot, setSelectedSlot] = useState<string>("");
  const [step, setStep] = useState<"info" | "data" | "horario" | "dados" | "confirmado">("info");
  const [formData, setFormData] = useState({
    nome: "",
    telefone: "",
    email: "",
    observacoes: ""
  });
  
  // Flag para indicar se os dados foram pré-preenchidos (link exclusivo com cliente)
  const [dadosPrePreenchidos, setDadosPrePreenchidos] = useState(false);

  // Buscar dados do link
  const { data: linkData, isLoading: loadingLink, error: linkError } = trpc.linksAgendamento.getByToken.useQuery(
    { token: token || "" },
    { enabled: !!token }
  );

  // Buscar slots disponíveis para a data selecionada
  const { data: slots, isLoading: loadingSlots } = trpc.agenda.getSlotsDisponiveis.useQuery(
    { 
      corretorId: linkData?.corretorId || 0, 
      data: selectedDate?.toISOString() || "" 
    },
    { enabled: !!linkData?.corretorId && !!selectedDate }
  );

  // Mutation para criar agendamento
  const createAgendamento = trpc.linksAgendamento.agendar.useMutation({
    onSuccess: () => {
      setStep("confirmado");
    }
  });

  // Pré-preencher dados do lead quando disponíveis (link exclusivo)
  useEffect(() => {
    if (linkData?.lead && !dadosPrePreenchidos) {
      setFormData({
        nome: linkData.lead.nome || "",
        telefone: linkData.lead.telefone || "",
        email: linkData.lead.email || "",
        observacoes: ""
      });
      setDadosPrePreenchidos(true);
    }
  }, [linkData?.lead, dadosPrePreenchidos]);

  // Datas desabilitadas (passadas)
  const disabledDays = (date: Date) => {
    return isBefore(date, startOfDay(new Date()));
  };

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    setSelectedSlot("");
    if (date) {
      setStep("horario");
    }
  };

  const handleSlotSelect = (slot: string) => {
    setSelectedSlot(slot);
    setStep("dados");
  };

  const handleSubmit = () => {
    if (!selectedDate || !selectedSlot || !formData.nome || !formData.telefone || !formData.email) return;

    // Formatar data como yyyy-MM-dd para evitar problemas de timezone
    const dataFormatada = format(selectedDate, 'yyyy-MM-dd');

    createAgendamento.mutate({
      token: token || "",
      nome: formData.nome,
      telefone: formData.telefone,
      email: formData.email,
      data: dataFormatada,
      hora: selectedSlot,
      observacoes: formData.observacoes || undefined
    });
  };

  if (loadingLink) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    );
  }

  if (linkError || !linkData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-slate-800/50 border-slate-700">
          <CardHeader className="text-center">
            <CardTitle className="text-white">Link Inválido</CardTitle>
            <CardDescription className="text-slate-400">
              Este link de agendamento não existe ou expirou.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (step === "confirmado") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-slate-800/50 border-slate-700">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
            <CardTitle className="text-white text-2xl">Agendamento Confirmado!</CardTitle>
            <CardDescription className="text-slate-400 mt-2">
              Sua visita foi agendada com sucesso.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-slate-700/50 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-3 text-slate-300">
                <CalendarDays className="h-5 w-5 text-amber-500" />
                <span>{selectedDate && format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}</span>
              </div>
              <div className="flex items-center gap-3 text-slate-300">
                <Clock className="h-5 w-5 text-amber-500" />
                <span>{selectedSlot}</span>
              </div>
              {linkData.corretor && (
                <div className="flex items-center gap-3 text-slate-300">
                  <User className="h-5 w-5 text-amber-500" />
                  <span>Corretor: {linkData.corretor.name}</span>
                </div>
              )}
              {linkData.projeto && (
                <div className="flex items-center gap-3 text-slate-300">
                  <Building2 className="h-5 w-5 text-amber-500" />
                  <span>{linkData.projeto.nome}</span>
                </div>
              )}
            </div>
            <p className="text-sm text-slate-400 text-center">
              Você receberá uma confirmação por WhatsApp em breve.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <img 
            src="/logo-seu-metro-quadrado.png" 
            alt="Seu Metro Quadrado" 
            className="h-12 mx-auto mb-4"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
          <h1 className="text-2xl font-bold text-white mb-2">
            {linkData.titulo || "Agende sua Visita"}
          </h1>
          {linkData.mensagemBoasVindas && (
            <p className="text-slate-400">{linkData.mensagemBoasVindas}</p>
          )}
        </div>

        {/* Info do Corretor e Projeto */}
        <Card className="bg-slate-800/50 border-slate-700 mb-6">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              {linkData.corretor?.fotoUrl ? (
                <img 
                  src={linkData.corretor.fotoUrl} 
                  alt={linkData.corretor.name || ""} 
                  className="w-14 h-14 rounded-full object-cover"
                />
              ) : (
                <div className="w-14 h-14 rounded-full bg-amber-500/20 flex items-center justify-center">
                  <User className="h-7 w-7 text-amber-500" />
                </div>
              )}
              <div>
                <p className="text-white font-medium">{linkData.corretor?.name}</p>
                <p className="text-sm text-slate-400">Corretor de Imóveis</p>
                {linkData.projeto && (
                  <p className="text-sm text-amber-500">{linkData.projeto.nome}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Steps */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {["info", "data", "horario", "dados"].map((s, i) => (
            <div key={s} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step === s ? "bg-amber-500 text-white" : 
                ["info", "data", "horario", "dados"].indexOf(step) > i ? "bg-green-500 text-white" : 
                "bg-slate-700 text-slate-400"
              }`}>
                {i + 1}
              </div>
              {i < 3 && <div className={`w-8 h-0.5 ${
                ["info", "data", "horario", "dados"].indexOf(step) > i ? "bg-green-500" : "bg-slate-700"
              }`} />}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <Card className="bg-slate-800/50 border-slate-700">
          {step === "info" && (
            <>
              <CardHeader>
                <CardTitle className="text-white">Bem-vindo!</CardTitle>
                <CardDescription className="text-slate-400">
                  Escolha a melhor data e horário para sua visita.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  onClick={() => setStep("data")} 
                  className="w-full bg-amber-500 hover:bg-amber-600 text-white"
                >
                  Começar Agendamento
                </Button>
              </CardContent>
            </>
          )}

          {step === "data" && (
            <>
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <CalendarDays className="h-5 w-5 text-amber-500" />
                  Escolha a Data
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Selecione o dia da sua visita
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={handleDateSelect}
                  disabled={disabledDays}
                  locale={ptBR}
                  className="rounded-md border border-slate-700 bg-slate-800 text-white mx-auto"
                  classNames={{
                    day_selected: "bg-amber-500 text-white hover:bg-amber-600",
                    day_today: "bg-slate-700 text-white",
                  }}
                />
              </CardContent>
            </>
          )}

          {step === "horario" && (
            <>
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Clock className="h-5 w-5 text-amber-500" />
                  Escolha o Horário
                </CardTitle>
                <CardDescription className="text-slate-400">
                  {selectedDate && format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingSlots ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
                  </div>
                ) : slots && slots.length > 0 ? (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {slots.map((slot) => (
                      <Button
                        key={slot}
                        variant={selectedSlot === slot ? "default" : "outline"}
                        className={selectedSlot === slot 
                          ? "bg-amber-500 hover:bg-amber-600 text-white" 
                          : "border-slate-600 text-slate-300 hover:bg-slate-700"
                        }
                        onClick={() => handleSlotSelect(slot)}
                      >
                        {slot}
                      </Button>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-400">
                    <p>Não há horários disponíveis nesta data.</p>
                    <Button 
                      variant="outline" 
                      className="mt-4 border-slate-600 text-slate-300"
                      onClick={() => setStep("data")}
                    >
                      Escolher outra data
                    </Button>
                  </div>
                )}
                <Button 
                  variant="ghost" 
                  className="w-full mt-4 text-slate-400"
                  onClick={() => setStep("data")}
                >
                  ← Voltar
                </Button>
              </CardContent>
            </>
          )}

          {step === "dados" && (
            <>
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <User className="h-5 w-5 text-amber-500" />
                  Seus Dados
                </CardTitle>
                <CardDescription className="text-slate-400">
                  {dadosPrePreenchidos 
                    ? "Confirme seus dados abaixo. Caso precise atualizar alguma informação, basta editar."
                    : "Preencha seus dados para confirmar o agendamento"
                  }
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-slate-700/50 rounded-lg p-3 flex items-center gap-3 text-sm text-slate-300">
                  <CalendarDays className="h-4 w-4 text-amber-500" />
                  {selectedDate && format(selectedDate, "dd/MM/yyyy", { locale: ptBR })} às {selectedSlot}
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-300">Nome completo *</Label>
                  <Input
                    placeholder="Seu nome"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-300">Telefone com DDD *</Label>
                  <Input
                    placeholder="(11) 99999-9999"
                    value={formData.telefone}
                    onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-300">E-mail *</Label>
                  <Input
                    type="email"
                    placeholder="seu@email.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="bg-slate-700 border-slate-600 text-white"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-300">Observações (opcional)</Label>
                  <Textarea
                    placeholder="Alguma informação adicional..."
                    value={formData.observacoes}
                    onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                    className="bg-slate-700 border-slate-600 text-white"
                    rows={3}
                  />
                </div>

                <div className="flex gap-2 pt-4">
                  <Button 
                    variant="outline" 
                    className="flex-1 border-slate-600 text-slate-300"
                    onClick={() => setStep("horario")}
                  >
                    Voltar
                  </Button>
                  <Button 
                    className="flex-1 bg-amber-500 hover:bg-amber-600 text-white"
                    onClick={handleSubmit}
                    disabled={!formData.nome || !formData.telefone || !formData.email || createAgendamento.isPending}
                  >
                    {createAgendamento.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    Confirmar Agendamento
                  </Button>
                </div>

                {createAgendamento.error && (
                  <p className="text-red-400 text-sm text-center">
                    {createAgendamento.error.message}
                  </p>
                )}
              </CardContent>
            </>
          )}
        </Card>

        {/* Footer */}
        <p className="text-center text-slate-500 text-sm mt-6">
          Seu Metro Quadrado © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}

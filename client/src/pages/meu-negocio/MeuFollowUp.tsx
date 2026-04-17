import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { useToast } from "@/hooks/use-toast";
import {
  Phone, MessageSquare, CheckCircle2, XCircle, Clock,
  ChevronDown, ChevronUp, Copy, User, Calendar, AlertCircle
} from "lucide-react";

// ============================================================================
// ROTEIROS POR STATUS
// ============================================================================

const ROTEIROS: Record<string, { titulo: string; script: string; dica: string }[]> = {
  aguardando_atendimento: [
    {
      titulo: "1ª Abordagem — Primeiro contato",
      script: `Olá, [NOME]! Tudo bem? 😊

Sou [SEU NOME], corretor da Seu Metro Quadrado. Vi que você demonstrou interesse em imóveis na nossa plataforma.

Tenho algumas opções incríveis que podem ser perfeitas para o seu perfil — inclusive com subsídio do Minha Casa Minha Vida que pode chegar a R$ 55 mil!

Posso te contar mais detalhes? Quando seria um bom momento para conversarmos?`,
      dica: "Envie no WhatsApp. Se não responder em 2h, ligue.",
    },
    {
      titulo: "Ligação — Primeiro contato",
      script: `"Olá, [NOME]? Aqui é [SEU NOME] da Seu Metro Quadrado. Você preencheu um formulário demonstrando interesse em imóveis — estou ligando para entender melhor o que você está buscando. Tem 2 minutinhos?"`,
      dica: "Se cair na caixa postal: 'Olá [NOME], sou [SEU NOME] da SMQ. Liguei sobre seu interesse em imóveis. Me chame no WhatsApp!'",
    },
  ],
  em_atendimento: [
    {
      titulo: "Follow-up — Sem resposta (dia seguinte)",
      script: `Oi [NOME], tudo bem? 😊

Ontem tentei te contatar sobre as opções de imóveis que separei para você.

Tenho uma oportunidade que encaixa muito bem no seu perfil — inclusive com entrada facilitada. Posso te mostrar?`,
      dica: "Mude o horário do contato. Se ontem foi de manhã, tente à tarde.",
    },
    {
      titulo: "Follow-up — Reengajamento (3+ dias sem resposta)",
      script: `Oi [NOME]! Sei que você está ocupado(a), mas não queria deixar passar essa oportunidade.

Temos um lançamento com condições especiais de pagamento e subsídio MCMV disponível por tempo limitado.

Vale 5 minutinhos de conversa? Posso encaixar no seu horário! 🏠`,
      dica: "Última tentativa antes de marcar como sem interesse. Use um tom mais direto.",
    },
  ],
  agendado: [
    {
      titulo: "Confirmação de visita — 1 dia antes",
      script: `Olá [NOME]! 😊

Passando para confirmar nossa visita amanhã às [HORÁRIO] no [EMPREENDIMENTO].

Endereço: [ENDEREÇO]

Você confirma? Qualquer dúvida é só me chamar!`,
      dica: "Envie na noite anterior. Se não confirmar, ligue na manhã do dia.",
    },
    {
      titulo: "Lembrete — Dia da visita",
      script: `Bom dia [NOME]! ☀️

Hoje é o dia da nossa visita! Te espero às [HORÁRIO] no [EMPREENDIMENTO].

Qualquer imprevisto me avisa com antecedência, ok? Até logo! 🏠`,
      dica: "Envie 2h antes da visita.",
    },
  ],
  visita_realizada: [
    {
      titulo: "Pós-visita — Feedback imediato",
      script: `Olá [NOME]! Foi muito bom te receber hoje! 😊

O que você achou do [EMPREENDIMENTO]? Ficou com alguma dúvida que posso esclarecer?

Posso já adiantar a simulação de financiamento para você ver como ficaria a parcela?`,
      dica: "Envie até 2h após a visita. O cliente ainda está com o imóvel fresco na memória.",
    },
    {
      titulo: "Pós-visita — Proposta (2 dias depois)",
      script: `Oi [NOME]! Tudo bem?

Fiz a simulação do financiamento para você e os números ficaram bem interessantes!

Posso te enviar a proposta personalizada com todos os detalhes? Leva só 5 minutinhos para você analisar. 📄`,
      dica: "Se o cliente demonstrou interesse, não espere mais de 48h para enviar a proposta.",
    },
  ],
  proposta_enviada: [
    {
      titulo: "Acompanhamento da proposta",
      script: `Olá [NOME]! Você teve a oportunidade de analisar a proposta que enviei?

Fico à disposição para esclarecer qualquer dúvida sobre o financiamento, documentação ou condições de pagamento.

O que achou? 😊`,
      dica: "Aguarde 24h após o envio da proposta antes de fazer o follow-up.",
    },
    {
      titulo: "Urgência — Condições por tempo limitado",
      script: `Oi [NOME]! Passando para te avisar que as condições da proposta que enviei têm prazo de validade.

A taxa de juros e o subsídio disponível podem mudar. Você consegue me dar uma resposta esta semana?

Posso te ajudar com qualquer dúvida que esteja travando a decisão! 🏠`,
      dica: "Use apenas se o cliente ficou sem responder por 3+ dias após receber a proposta.",
    },
  ],
  analise_credito: [
    {
      titulo: "Acompanhamento da análise",
      script: `Olá [NOME]! Tudo bem?

Passando para saber se já tem alguma novidade da análise de crédito. Assim que tiver o retorno, me avisa que te ajudo com os próximos passos!

Qualquer documento adicional que solicitarem, pode me enviar que encaminho para o banco. 😊`,
      dica: "Contate o cliente a cada 2-3 dias durante a análise para manter o engajamento.",
    },
  ],
};

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function MeuFollowUp() {
  const { toast } = useToast();
  const [expandido, setExpandido] = useState<number | null>(null);
  const [registrandoId, setRegistrandoId] = useState<number | null>(null);
  const [observacao, setObservacao] = useState("");
  const [respondeu, setRespondeu] = useState<boolean | null>(null);

  const { data: leads, refetch } = trpc.meuNegocio.getLeadsFollowUp.useQuery();
  const registrarMutation = trpc.meuNegocio.registrarFollowUp.useMutation({
    onSuccess: () => {
      toast({ title: "Follow-up registrado!" });
      setRegistrandoId(null);
      setObservacao("");
      setRespondeu(null);
      refetch();
    },
    onError: (e) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  function copiarScript(script: string) {
    navigator.clipboard.writeText(script);
    toast({ title: "Script copiado!", description: "Cole no WhatsApp ou use como roteiro." });
  }

  function handleRegistrar(leadId: number) {
    if (respondeu === null) {
      toast({ title: "Informe se o cliente respondeu", variant: "destructive" });
      return;
    }
    registrarMutation.mutate({ leadId, respondeu, observacao });
  }

  const hoje = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
          <Phone className="h-6 w-6 text-green-600 dark:text-green-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Follow-up do Dia</h1>
          <p className="text-sm text-muted-foreground capitalize">{hoje}</p>
        </div>
        {leads && (
          <Badge variant="secondary" className="ml-auto">
            {leads.length} leads para contatar
          </Badge>
        )}
      </div>

      {/* Lista de leads */}
      {!leads || leads.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-green-500" />
          <h3 className="font-semibold">Tudo em dia!</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Nenhum lead pendente de follow-up hoje.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {leads.map((lead) => {
            const roteiros = ROTEIROS[lead.status] ?? ROTEIROS["em_atendimento"];
            const isExpanded = expandido === lead.id;
            const isRegistrando = registrandoId === lead.id;

            return (
              <div key={lead.id} className="rounded-lg border overflow-hidden">
                {/* Cabeçalho do lead */}
                <div
                  className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => setExpandido(isExpanded ? null : lead.id)}
                >
                  <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                    <User className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{lead.nome}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                      <Phone className="h-3 w-3" />
                      {lead.telefone}
                      {lead.tentativas > 0 && (
                        <span className="text-orange-500">{lead.tentativas}/5 tentativas</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className="text-xs">
                      {lead.statusLabel}
                    </Badge>
                    {lead.alertaDescarte && (
                      <Badge variant="destructive" className="text-xs">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Descarte hoje
                      </Badge>
                    )}
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </div>

                {/* Conteúdo expandido */}
                {isExpanded && (
                  <div className="border-t p-3 space-y-4 bg-muted/10">
                    {/* Roteiros */}
                    <div>
                      <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                        <MessageSquare className="h-4 w-4" />
                        Roteiros sugeridos
                      </h3>
                      <div className="space-y-2">
                        {roteiros.map((r, i) => (
                          <div key={i} className="rounded-lg border bg-background p-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-semibold text-muted-foreground">{r.titulo}</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => copiarScript(r.script.replace("[NOME]", lead.nome).replace("[SEU NOME]", "seu nome"))}
                              >
                                <Copy className="h-3 w-3 mr-1" />
                                Copiar
                              </Button>
                            </div>
                            <pre className="text-xs whitespace-pre-wrap font-sans text-foreground/80 leading-relaxed">
                              {r.script.replace("[NOME]", lead.nome)}
                            </pre>
                            <div className="mt-2 text-xs text-blue-600 dark:text-blue-400 flex items-start gap-1">
                              <span className="shrink-0">💡</span>
                              {r.dica}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Registro de interação */}
                    {!isRegistrando ? (
                      <Button
                        className="w-full"
                        variant="outline"
                        onClick={() => setRegistrandoId(lead.id)}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Registrar interação
                      </Button>
                    ) : (
                      <div className="space-y-3 rounded-lg border p-3 bg-background">
                        <h3 className="text-sm font-semibold">Registrar interação</h3>
                        <div className="flex gap-2">
                          <Button
                            variant={respondeu === true ? "default" : "outline"}
                            size="sm"
                            className="flex-1"
                            onClick={() => setRespondeu(true)}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                            Respondeu
                          </Button>
                          <Button
                            variant={respondeu === false ? "destructive" : "outline"}
                            size="sm"
                            className="flex-1"
                            onClick={() => setRespondeu(false)}
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            Não respondeu
                          </Button>
                        </div>
                        <Textarea
                          placeholder="Observação (opcional)..."
                          value={observacao}
                          onChange={(e) => setObservacao(e.target.value)}
                          className="text-sm h-20 resize-none"
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="flex-1"
                            onClick={() => handleRegistrar(lead.id)}
                            disabled={registrarMutation.isPending}
                          >
                            {registrarMutation.isPending ? "Salvando..." : "Confirmar"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => { setRegistrandoId(null); setObservacao(""); setRespondeu(null); }}
                          >
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

import { useState } from "react";
import { useLocation } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import {
  LayoutDashboard,
  GitBranch,
  Phone,
  DollarSign,
  Calculator,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Star,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ArrowRight,
  BookOpen,
  Lightbulb,
  Info,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
interface AccordionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function Accordion({ title, children, defaultOpen = false }: AccordionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden mb-3">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <span className="font-semibold text-gray-800">{title}</span>
        {open ? (
          <ChevronUp className="w-4 h-4 text-gray-500 shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-500 shrink-0" />
        )}
      </button>
      {open && <div className="px-5 py-4 bg-white text-sm text-gray-700 leading-relaxed">{children}</div>}
    </div>
  );
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 text-sm text-blue-900">
      <Info className="w-4 h-4 mt-0.5 shrink-0 text-blue-500" />
      <div>{children}</div>
    </div>
  );
}

function GreenBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 bg-green-50 border border-green-200 rounded-lg p-4 mb-4 text-sm text-green-900">
      <CheckCircle className="w-4 h-4 mt-0.5 shrink-0 text-green-500" />
      <div>{children}</div>
    </div>
  );
}

function YellowBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4 text-sm text-yellow-900">
      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-yellow-500" />
      <div>{children}</div>
    </div>
  );
}

function RedBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 bg-red-50 border border-red-200 rounded-lg p-4 mb-4 text-sm text-red-900">
      <XCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-500" />
      <div>{children}</div>
    </div>
  );
}

function GoldTip({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 bg-amber-50 border-2 border-amber-300 rounded-xl p-5 my-5">
      <Star className="w-5 h-5 mt-0.5 shrink-0 text-amber-500 fill-amber-400" />
      <div className="text-sm text-amber-900 leading-relaxed font-medium">{children}</div>
    </div>
  );
}

function ErrorItem({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2 items-start mb-2 text-sm text-gray-700">
      <XCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-400" />
      <span>{children}</span>
    </div>
  );
}

function NavButton({ href, children }: { href: string; children: React.ReactNode }) {
  const [, setLocation] = useLocation();
  return (
    <button
      onClick={() => setLocation(href)}
      className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-800 border border-indigo-200 hover:border-indigo-400 rounded-lg px-3 py-1.5 transition-colors mt-4"
    >
      {children}
      <ArrowRight className="w-3.5 h-3.5" />
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// Blocks
// ─────────────────────────────────────────────────────────────
function Bloco1() {
  return (
    <div>
      <InfoBox>
        <strong>O que é:</strong> Sua central de comando. É a primeira tela que você deve abrir todo dia antes de fazer qualquer coisa. Em menos de 1 minuto ela te diz onde você está, onde precisa chegar e o que precisa fazer agora.
      </InfoBox>

      <Accordion title="O que cada número significa" defaultOpen>
        <p className="mb-3 font-semibold text-gray-800">Parâmetros Pessoais</p>
        <p className="mb-3 text-gray-600">São as taxas de conversão do <em>seu</em> trabalho — não da empresa, não do mercado. São individuais e mudam conforme você melhora.</p>
        <div className="space-y-3">
          {[
            { label: "Taxa lead → agendamento", desc: "De cada 10 leads que chegam, quantos você consegue agendar uma visita? Quanto maior essa taxa, mais eficiente é sua abordagem." },
            { label: "Taxa agendamento → visita", desc: "De cada 10 visitas marcadas, quantas o cliente realmente aparece? Abaixo de 60% significa que você está confirmando mal ou escolhendo leads pouco comprometidos." },
            { label: "Taxa visita → proposta", desc: "De cada 10 visitas realizadas, quantas geram uma proposta? Abaixo de 40% significa que você está levando cliente sem qualificação suficiente ou não está conduzindo bem a visita." },
            { label: "Taxa proposta → venda", desc: "De cada 10 propostas entregues, quantas fecham? Abaixo de 35% significa que você está perdendo na negociação final. É o número que mais impacta seu resultado." },
          ].map((item) => (
            <div key={item.label} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
              <p className="font-semibold text-gray-800 text-sm mb-1">{item.label}</p>
              <p className="text-gray-600 text-sm">{item.desc}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 mb-2 font-semibold text-gray-800">Cálculo Reverso da Meta</p>
        <p className="text-gray-600">O número mais importante do seu Dashboard é o de baixo: <strong>LEADS POR DIA</strong>. Esse número responde: "Quantas pessoas novas eu preciso contatar hoje para bater minha meta no final do mês?" Se você precisa de 4 leads por dia e está prospectando 2, você já sabe que vai ficar 50% abaixo da meta — antes do mês terminar.</p>
        <p className="mt-3 text-gray-600"><strong>Coluna SALDO:</strong> positivo = você está adiantado. Negativo = você está atrás. Se o mês está na metade e o saldo de vendas está em -2, você precisa dobrar o ritmo.</p>
      </Accordion>

      <Accordion title="Como interpretar — semáforo">
        <GreenBox><strong>🟢 Verde (≥95%):</strong> você está no ritmo certo. Mantenha.</GreenBox>
        <YellowBox><strong>🟡 Amarelo (80–94%):</strong> atenção — você está levemente abaixo. Não é crise, mas exige ajuste agora antes de virar crise.</YellowBox>
        <RedBox><strong>🔴 Vermelho (&lt;80%):</strong> você está fora do ritmo. Precisa de ação imediata — não amanhã, hoje.</RedBox>
      </Accordion>

      <Accordion title="O que fazer quando está vermelho">
        <div className="space-y-3 text-sm">
          {[
            { cond: "Leads está vermelho", action: "Seu problema é volume. Aumente a prospecção ativa. Quantas pessoas você contactou hoje? Se for menos que o número do Cálculo Reverso, esse é o problema." },
            { cond: "Agendamentos vermelho com leads no verde", action: "Seu problema é o primeiro contato. Sua abordagem inicial não está gerando interesse. Revise o roteiro de primeiro contato." },
            { cond: "Visitas vermelho com agendamentos no verde", action: "Seu problema é confirmação. O cliente marca e não aparece. Confirme no D-2 e no D-1. Ligue — não mande só mensagem." },
            { cond: "Propostas vermelho com visitas no verde", action: "Você está visitando mas não conduzindo para a proposta. A visita precisa terminar com uma proposta na mão — sempre." },
            { cond: "Vendas vermelho com propostas no verde", action: "Você está perdendo na negociação. Estude as objeções. Acione um closer nas próximas propostas." },
            { cond: "Comissão verde mas outros vermelhos", action: "Você está dependendo de sorte. Seus números vão cair no próximo mês." },
          ].map((item) => (
            <div key={item.cond} className="border-l-4 border-red-300 pl-4 py-1">
              <p className="font-semibold text-gray-800">Se {item.cond}:</p>
              <p className="text-gray-600">{item.action}</p>
            </div>
          ))}
        </div>
      </Accordion>

      <Accordion title="Erros mais comuns">
        <ErrorItem>Não atualizar os parâmetros quando sua performance melhora. Se você melhorou sua taxa de conversão mas não atualizou, o sistema vai te pedir mais leads do que você realmente precisa.</ErrorItem>
        <ErrorItem>Olhar o Dashboard uma vez por semana. Abra todo dia. O Dashboard é o seu espelho — você precisa ver o reflexo diariamente para corrigir a postura.</ErrorItem>
        <ErrorItem>Focar no verde e ignorar o vermelho. Um número vermelho no início do mês vira catástrofe no final. Corrija logo.</ErrorItem>
      </Accordion>

      <GoldTip>
        A maioria dos corretores que não bate meta não tem problema de mercado — tem problema de volume. Calcule seus leads por dia e pergunte a si mesmo honestamente: "Eu estou prospectando esse número todo dia?" A resposta resolve 80% dos problemas de resultado.
      </GoldTip>

      <NavButton href="/meu-negocio/dashboard">Ver meu Dashboard na prática</NavButton>
    </div>
  );
}

function Bloco2() {
  const etapas = [
    { etapa: "Lead Novo", acao: "primeiro contato em menos de 5 minutos" },
    { etapa: "Primeiro Contato", acao: "qualificar renda, FGTS e urgência" },
    { etapa: "Qualificado", acao: "agendar visita com data e hora confirmadas" },
    { etapa: "Visita Agendada", acao: "confirmar no D-2 e D-1" },
    { etapa: "Visita Realizada", acao: "follow-up em até 24h com proposta" },
    { etapa: "Proposta Enviada", acao: "ligar em 48h para tirar dúvidas" },
    { etapa: "Em Negociação", acao: "acionar closer se necessário" },
    { etapa: "Documentação", acao: "acompanhar cada documento até o fim" },
    { etapa: "Venda Fechada", acao: "pedir indicação no pós-venda" },
  ];

  return (
    <div>
      <InfoBox>
        <strong>O que é:</strong> É a sua carteira de clientes vivos. Todo lead que você está trabalhando deve estar aqui. Se não está no Pipeline, não existe — e você vai esquecer.
      </InfoBox>

      <Accordion title="Temperatura dos leads" defaultOpen>
        <div className="space-y-3">
          <RedBox><strong>🔴 Frio:</strong> lead sem engajamento. Não respondeu, desmarcou visita, sem interesse claro. Precisa de reativação ou descarte.</RedBox>
          <YellowBox><strong>🟡 Morno:</strong> tem interesse mas ainda não está pronto para decidir. Aguarda momento, aprovação do cônjuge, resolver uma situação financeira.</YellowBox>
          <GreenBox><strong>🟢 Quente:</strong> tem interesse claro, está qualificado, o próximo passo está definido e próximo. Prioridade máxima.</GreenBox>
        </div>
      </Accordion>

      <Accordion title="Etapas do funil — ação obrigatória em cada uma">
        <p className="text-sm text-gray-600 mb-4">Cada etapa tem uma ação específica associada. Mover o lead de etapa sem ter executado a ação é mentira para si mesmo.</p>
        <div className="space-y-2">
          {etapas.map((item, i) => (
            <div key={i} className="flex items-start gap-3 text-sm">
              <span className="bg-indigo-100 text-indigo-700 rounded-full w-6 h-6 flex items-center justify-center shrink-0 text-xs font-bold">{i + 1}</span>
              <div>
                <span className="font-semibold text-gray-800">{item.etapa}</span>
                <span className="text-gray-500"> → sua ação: </span>
                <span className="text-gray-700">{item.acao}</span>
              </div>
            </div>
          ))}
        </div>
      </Accordion>

      <Accordion title="Como interpretar um Pipeline saudável">
        <GreenBox>
          <p className="font-semibold mb-2">Pipeline saudável tem:</p>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li>Pelo menos 20 leads ativos trabalhados simultaneamente</li>
            <li>Maioria dos leads com temperatura 🟡 ou 🟢</li>
            <li>Nenhum lead sem "Data do Próximo Passo" preenchida</li>
            <li>Nenhum lead quente sem contato há mais de 2 dias</li>
          </ul>
        </GreenBox>
        <YellowBox>
          <p className="font-semibold mb-2">Sinais de alerta:</p>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li>Pipeline cheio mas sem vendas → leads mal qualificados ou etapas sendo puladas</li>
            <li>Muitos leads em "Proposta Enviada" sem fechar → você está perdendo na negociação</li>
            <li>Pipeline vazio na primeira semana do mês → você vai sofrer na última</li>
            <li>Todos os leads em temperatura fria → sua qualificação está fraca</li>
          </ul>
        </YellowBox>
      </Accordion>

      <Accordion title="Erros mais comuns">
        <ErrorItem>Cadastrar o lead e nunca mais atualizar. Pipeline desatualizado é pior do que Pipeline vazio — você perde tempo em leads mortos.</ErrorItem>
        <ErrorItem>Não colocar a "Data do Próximo Passo". Lead sem próximo passo agendado vai esfriar. Todo lead ativo precisa de uma ação com data.</ErrorItem>
        <ErrorItem>Ter vergonha de marcar como "Perdido". Lead perdido não é fracasso — é informação. Saber o motivo da perda te ajuda a qualificar melhor da próxima vez.</ErrorItem>
      </Accordion>

      <GoldTip>
        Faça uma revisão do Pipeline toda sexta-feira antes de ir embora. Pergunte para cada lead: "Qual é o próximo passo e quando acontece?" Se você não souber responder, o lead está morto — só você ainda não sabe.
      </GoldTip>

      <NavButton href="/meu-negocio/leads">Ver meu Pipeline na prática</NavButton>
    </div>
  );
}

function Bloco3() {
  const cadencia = [
    { dia: "D+0", acao: "Confirmação de recebimento (mesmo dia do primeiro contato)" },
    { dia: "D+2", acao: "Envio de conteúdo de valor (simulação, vídeo do empreendimento)" },
    { dia: "D+5", acao: "Reativação com novo ângulo (história de outro cliente, nova informação)" },
    { dia: "D+10", acao: "Última tentativa ativa antes de mover para 'Frio'" },
    { dia: "D+30", acao: "Reativação de base fria (novo gatilho)" },
  ];

  return (
    <div>
      <InfoBox>
        <strong>O que é:</strong> É a diferença entre o corretor que fecha e o que "quase fechou". 80% das vendas acontecem após o 5º contato. A maioria dos corretores desiste no 2º. O Follow-up é sua agenda de comprometimento.
      </InfoBox>

      <Accordion title="Tipos de ação e quando usar cada um" defaultOpen>
        <div className="space-y-3">
          {[
            { tipo: "Ligação", uso: "Use para leads quentes, pós-visita e negociação. Mais impacto que mensagem — voz cria conexão." },
            { tipo: "WhatsApp", uso: "Use para reativação, envio de material e confirmação. Mais prático — o cliente lê quando pode." },
            { tipo: "Envio de Material", uso: "Simulação MCMV, fotos do empreendimento, vídeo. Não envie material sem contexto — explique o que está enviando e por que aquilo importa para AQUELE cliente." },
            { tipo: "Reativação", uso: "Lead que esfriou. Use um gatilho novo — subsídio que aumentou, vaga que está acabando, história de outro cliente que fechou." },
          ].map((item) => (
            <div key={item.tipo} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
              <p className="font-semibold text-gray-800 text-sm mb-1">{item.tipo}</p>
              <p className="text-gray-600 text-sm">{item.uso}</p>
            </div>
          ))}
        </div>
        <div className="mt-4">
          <p className="font-semibold text-sm text-gray-800 mb-2">Urgência:</p>
          <RedBox>🔴 <strong>Hoje:</strong> não pode esperar. Lead quente, proposta pendente, visita para confirmar.</RedBox>
          <YellowBox>🟡 <strong>Esta semana:</strong> importante mas não urgente. Reativação de morno, envio de material.</YellowBox>
          <GreenBox>🟢 <strong>Próxima semana:</strong> planejamento antecipado. Você está se organizando bem.</GreenBox>
          <p className="text-sm text-red-700 font-medium mt-1">Se você tem mais de 5 ações 🔴 acumuladas, você está atrasado.</p>
        </div>
      </Accordion>

      <Accordion title="Cadência de follow-up recomendada">
        <div className="space-y-3">
          {cadencia.map((item, i) => (
            <div key={i} className="flex items-start gap-3 text-sm">
              <span className="bg-indigo-600 text-white rounded-lg px-2 py-0.5 text-xs font-bold shrink-0">{item.dia}</span>
              <span className="text-gray-700">{item.acao}</span>
            </div>
          ))}
        </div>
      </Accordion>

      <Accordion title="Como usar os Roteiros">
        <p className="text-sm text-gray-700 mb-3">Os roteiros são pontos de partida — não são scripts para copiar e colar sem pensar. Personalize sempre com:</p>
        <ul className="list-disc list-inside text-sm text-gray-700 space-y-1 mb-4">
          <li>O nome do cliente</li>
          <li>Uma referência do que vocês conversaram antes</li>
          <li>Um motivo específico para entrar em contato agora</li>
        </ul>
        <div className="grid grid-cols-2 gap-3">
          <RedBox>Mensagem genérica → cliente ignora.</RedBox>
          <GreenBox>Mensagem personalizada → cliente responde.</GreenBox>
        </div>
      </Accordion>

      <Accordion title="Erros mais comuns">
        <ErrorItem>Fazer follow-up só quando lembra. Follow-up sem data vira follow-up que nunca acontece. Toda ação precisa de data.</ErrorItem>
        <ErrorItem>Mandar a mesma mensagem toda vez. O cliente percebe. Traga algo novo a cada contato.</ErrorItem>
        <ErrorItem>Desistir depois de 2 tentativas sem resposta. Silêncio não é não. É timing errado. Espere, mude o canal, mude o ângulo.</ErrorItem>
        <ErrorItem>Marcar como realizado sem registrar o resultado. "Liguei" não é informação. "Liguei, cliente confirmou visita para quinta" é informação.</ErrorItem>
      </Accordion>

      <GoldTip>
        O melhor follow-up não fala de imóvel — fala do sonho do cliente. "Oi [nome], lembrei de você porque vi um casal que saiu do aluguel semana passada depois de 8 anos esperando. Me lembrou da sua situação." Isso abre conversa. "Ainda tem interesse no imóvel?" fecha a conversa.
      </GoldTip>

      <NavButton href="/meu-negocio/followup">Ver meu Follow-up na prática</NavButton>
    </div>
  );
}

function Bloco4() {
  return (
    <div>
      <InfoBox>
        <strong>O que é:</strong> Seu extrato financeiro pessoal. Aqui você entende quanto ganhou, quanto vai receber, quanto cedeu ao closer e se está no ritmo para bater a meta do mês.
      </InfoBox>

      <Accordion title="O que cada número significa" defaultOpen>
        <div className="space-y-2">
          {[
            { label: "Comissão Bruta", desc: "O que você gerou antes de descontar o closer." },
            { label: "Comissão paga ao Closer", desc: "O que você cedeu em troca de ajuda para fechar." },
            { label: "Comissão Líquida", desc: "O que realmente fica no seu bolso." },
            { label: "A Receber", desc: "Vendas fechadas mas ainda não pagas pela construtora." },
            { label: "Já Recebido", desc: "O que efetivamente entrou." },
          ].map((item) => (
            <div key={item.label} className="flex gap-3 text-sm py-2 border-b border-gray-100 last:border-0">
              <span className="font-semibold text-gray-800 w-44 shrink-0">{item.label}:</span>
              <span className="text-gray-600">{item.desc}</span>
            </div>
          ))}
        </div>
      </Accordion>

      <Accordion title="Como interpretar a saúde financeira">
        <GreenBox><strong>🟢 Saudável:</strong> comissão líquida ≥ meta do mês, maioria das vendas com previsão de pagamento confirmada.</GreenBox>
        <YellowBox><strong>🟡 Atenção:</strong> comissão bruta bate a meta mas líquida não — você está cedendo muito ao closer. Avalie se está acionando o closer desnecessariamente ou se precisa desenvolver mais sua habilidade de fechamento.</YellowBox>
        <RedBox><strong>🔴 Crítico:</strong> comissão abaixo de 50% da meta na segunda quinzena do mês. Não tem mais tempo para recuperar pelo volume — precisa focar em fechar as propostas que já estão abertas.</RedBox>
      </Accordion>

      <Accordion title="Quando acionar o Closer — e quando não acionar">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <GreenBox>
            <p className="font-semibold mb-2">✅ Acione o closer quando:</p>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>O cliente chegou na proposta mas está travado em uma objeção específica que você não consegue quebrar</li>
              <li>É uma venda de valor mais alto e o cliente precisa de segurança técnica</li>
              <li>Você já fez 3 tentativas de fechamento e o cliente continua "vou pensar"</li>
            </ul>
          </GreenBox>
          <RedBox>
            <p className="font-semibold mb-2">❌ Não acione o closer quando:</p>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>O cliente ainda está na fase de qualificação — closer não qualifica</li>
              <li>Você ainda não apresentou a proposta formalmente</li>
              <li>O cliente pediu prazo e você não deu ainda</li>
            </ul>
          </RedBox>
        </div>
        <p className="text-sm text-gray-700 mt-3">Cada vez que você aciona o closer sem necessidade, você cede <strong>0,2–0,3% do VGV</strong>. Em um imóvel de R$275k, isso é entre <strong>R$550 e R$825</strong> que saem do seu bolso.</p>
      </Accordion>

      <Accordion title="Erros mais comuns">
        <ErrorItem>Não registrar a venda imediatamente após o fechamento. O registro no sistema é o que aciona o acompanhamento de pagamento. Sem registro, você perde o controle de quando vai receber.</ErrorItem>
        <ErrorItem>Não acompanhar a previsão de pagamento. A construtora paga na data combinada? Nem sempre. Acompanhe. Se a data passou e não entrou, questione imediatamente.</ErrorItem>
        <ErrorItem>Confundir "a receber" com "já recebi". Venda fechada não é dinheiro no bolso. Monitore o status de cada venda.</ErrorItem>
      </Accordion>

      <GoldTip>
        Olhe seus números de closer todo mês. Se mais de 30% das suas vendas precisaram de closer, seu gargalo está no fechamento — não nos leads. Invista tempo nos módulos de fechamento da Academia SMQ antes de pagar para ser ajudado a fechar.
      </GoldTip>

      <NavButton href="/meu-negocio/comissoes">Ver minhas Comissões na prática</NavButton>
    </div>
  );
}

function Bloco5() {
  const faixas = [
    { faixa: "F1", renda: "até R$2.640", desc: "Maior subsídio, menores juros → mais fácil de fechar" },
    { faixa: "F2", renda: "R$2.640–R$4.400", desc: "Bom subsídio, juros ainda acessíveis → público principal da SMQ" },
    { faixa: "F3", renda: "R$4.400–R$8.000", desc: "Subsídio menor, juros mais altos → cliente precisa de FGTS forte" },
    { faixa: "F4", renda: "R$8.000–R$12.000", desc: "Sem subsídio direto → cliente usa FGTS para reduzir parcela" },
  ];

  return (
    <div>
      <InfoBox>
        <strong>O que é:</strong> Uma calculadora de crédito que você usa antes ou durante o atendimento para descobrir se o cliente se encaixa no programa, qual o subsídio que ele pode receber e qual seria a parcela aproximada. Transforma "vou ver se você aprova" em números concretos.
      </InfoBox>

      <Accordion title="Como interpretar cada resultado" defaultOpen>
        <p className="font-semibold text-gray-800 mb-3 text-sm">Faixa MCMV</p>
        <div className="overflow-x-auto mb-4">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="text-left p-2 border border-gray-200 font-semibold">Faixa</th>
                <th className="text-left p-2 border border-gray-200 font-semibold">Renda</th>
                <th className="text-left p-2 border border-gray-200 font-semibold">Perfil</th>
              </tr>
            </thead>
            <tbody>
              {faixas.map((f, i) => (
                <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                  <td className="p-2 border border-gray-200 font-bold text-indigo-700">{f.faixa}</td>
                  <td className="p-2 border border-gray-200 text-gray-700">{f.renda}</td>
                  <td className="p-2 border border-gray-200 text-gray-600">{f.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="space-y-3">
          {[
            { label: "Subsídio estimado", desc: 'Esse é o número que mais encanta o cliente. Traduza assim: "Você tem direito a R$35mil de subsídio. Isso significa que o governo vai entrar com R$35mil na sua compra — você não precisa ter esse dinheiro."' },
            { label: "Comprometimento de renda", desc: "O limite é 30% da renda bruta. Se a parcela comprometer mais que isso, o cliente tem risco alto de reprovação na Caixa. Opções: aumentar prazo, usar mais FGTS, buscar imóvel menor ou compor renda com cônjuge." },
            { label: "FGTS", desc: "É a entrada. Quanto maior o FGTS, menor o valor financiado e menor a parcela. Sempre pergunte o saldo de FGTS — é o primeiro dado que faz diferença." },
          ].map((item) => (
            <div key={item.label} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
              <p className="font-semibold text-gray-800 text-sm mb-1">{item.label}</p>
              <p className="text-gray-600 text-sm">{item.desc}</p>
            </div>
          ))}
        </div>
      </Accordion>

      <Accordion title="Quando usar durante o atendimento">
        <div className="space-y-3">
          {[
            { momento: "Antes da visita", acao: "Faça a pré-análise com os dados que o cliente informou no WhatsApp. Chegue na visita já com os números. O cliente vai perceber que você se preparou — isso gera confiança." },
            { momento: "Durante a visita", acao: "Se o cliente questionar se 'consegue pagar', abra a calculadora na hora e mostre. Transparência fecha mais do que enrolação." },
            { momento: "No follow-up", acao: "Envie a simulação pelo WhatsApp após a visita. Formato: 'Fiz a simulação para você baseada nos dados que me passou. Olha como fica: [dados]. Quer avançar para a análise formal?'" },
          ].map((item) => (
            <div key={item.momento} className="border-l-4 border-indigo-300 pl-4 py-1 mb-3">
              <p className="font-semibold text-gray-800 text-sm">{item.momento}</p>
              <p className="text-gray-600 text-sm">{item.acao}</p>
            </div>
          ))}
        </div>
      </Accordion>

      <Accordion title="O aviso mais importante">
        <YellowBox>
          <p className="font-semibold mb-2">Esta análise é uma ESTIMATIVA COMERCIAL.</p>
          <p>Você pode e deve usar para orientar o cliente e mostrar que o sonho é viável. Mas nunca diga "você está aprovado" — quem aprova é a Caixa. Se você prometer aprovação e a Caixa reprovar, você perde a venda e a confiança do cliente.</p>
          <p className="mt-2 font-medium">Seja honesto: "Esta é uma estimativa. O próximo passo é a análise formal da Caixa — eu te acompanho em todo o processo."</p>
        </YellowBox>
      </Accordion>

      <Accordion title="Erros mais comuns">
        <ErrorItem>Fazer a análise sem perguntar o FGTS. FGTS muda completamente a conta. Sempre pergunte antes.</ErrorItem>
        <ErrorItem>Usar o resultado como promessa. "Você vai pagar R$1.200 de parcela" → errado. "A estimativa é de R$1.200 de parcela" → certo.</ErrorItem>
        <ErrorItem>Não salvar a análise no perfil do lead. Você vai precisar dessa informação de novo. Salve sempre.</ErrorItem>
      </Accordion>

      <GoldTip>
        O cliente F1 e F2 muitas vezes não sabe que tem direito a subsídio. Ele acha que nunca vai conseguir comprar um imóvel. Quando você mostra que o governo vai entrar com R$35mil ou R$55mil na compra dele, a conversa muda completamente. Use esse número logo no primeiro contato — é o maior gatilho de interesse que você tem.
      </GoldTip>

      <NavButton href="/meu-negocio/pre-analise-mcmv">Abrir Pré-Análise MCMV</NavButton>
    </div>
  );
}

function Bloco6() {
  const benchmarks = [
    { indicador: "Lead → Agendamento", iniciante: "20–25%", experiente: "30–40%", top: "45%+" },
    { indicador: "Agendamento → Visita", iniciante: "55–65%", experiente: "70–80%", top: "85%+" },
    { indicador: "Visita → Proposta", iniciante: "30–40%", experiente: "45–55%", top: "60%+" },
    { indicador: "Proposta → Venda", iniciante: "25–35%", experiente: "40–50%", top: "55%+" },
    { indicador: "Ciclo médio (dias)", iniciante: "28–35", experiente: "18–25", top: "12–18" },
  ];

  return (
    <div>
      <InfoBox>
        <strong>O que é:</strong> Seu histórico de performance mês a mês. É onde você vê se está evoluindo ou estagnando — e onde identifica exatamente o que precisa melhorar.
      </InfoBox>

      <Accordion title="Os 4 números que mais importam" defaultOpen>
        <div className="space-y-3">
          {[
            { num: "1", label: "Taxa lead → agendamento", desc: "Mede a qualidade do seu primeiro contato" },
            { num: "2", label: "Taxa proposta → venda", desc: "Mede sua habilidade de fechamento" },
            { num: "3", label: "Ciclo médio de venda", desc: "Mede a eficiência do seu processo" },
            { num: "4", label: "Indicações recebidas", desc: "Mede a satisfação dos seus clientes" },
          ].map((item) => (
            <div key={item.num} className="flex items-start gap-3 text-sm">
              <span className="bg-indigo-600 text-white rounded-full w-6 h-6 flex items-center justify-center shrink-0 text-xs font-bold">{item.num}</span>
              <div>
                <span className="font-semibold text-gray-800">{item.label}</span>
                <span className="text-gray-500"> — {item.desc}</span>
              </div>
            </div>
          ))}
        </div>
        <InfoBox>
          <strong>Olhe primeiro as taxas de conversão — não os volumes.</strong> Volume depende parcialmente de fatores externos. Taxa de conversão depende quase exclusivamente de você.
        </InfoBox>
      </Accordion>

      <Accordion title="Como interpretar cada indicador caindo">
        <div className="space-y-3">
          {[
            { ind: "Taxa lead → agendamento caindo", causa: "Seu primeiro contato está perdendo eficiência. Possíveis causas: leads de menor qualidade chegando, ou sua abordagem inicial precisa de atualização. Revise o roteiro de primeiro contato." },
            { ind: "Taxa agendamento → visita caindo", causa: "Você está marcando mas o cliente não aparece. Melhore a confirmação. Ligue no D-1, não só mande mensagem." },
            { ind: "Taxa visita → proposta caindo", causa: "Você está visitando mas não chegando à proposta. O cliente sai da visita 'vendo mais opções'. Trabalhe melhor o fechamento da visita — a proposta deve ser apresentada ainda no empreendimento." },
            { ind: "Taxa proposta → venda caindo", causa: "Você está perdendo na reta final. Mapeie as objeções que estão travando. As mais comuns: 'preciso falar com meu marido/esposa', 'vou pensar', 'está caro'. Cada uma tem protocolo específico." },
            { ind: "Ciclo médio subindo", causa: "Os leads estão demorando mais para fechar. Verifique sua cadência de follow-up — você pode estar deixando os leads esfriarem entre contatos." },
            { ind: "Indicações zeradas por 2 meses", causa: "Você está fechando mas não pedindo indicação. A indicação não vem sozinha — você precisa pedir. Crie o hábito de pedir no pós-venda de todo cliente que fechou." },
          ].map((item) => (
            <div key={item.ind} className="border-l-4 border-yellow-300 pl-4 py-1 mb-3">
              <p className="font-semibold text-gray-800 text-sm">{item.ind}</p>
              <p className="text-gray-600 text-sm">{item.causa}</p>
            </div>
          ))}
        </div>
      </Accordion>

      <Accordion title="Benchmarks de referência (mercado MCMV SP)">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="text-left p-2 border border-gray-200 font-semibold">Indicador</th>
                <th className="text-center p-2 border border-gray-200 font-semibold text-yellow-700">Iniciante</th>
                <th className="text-center p-2 border border-gray-200 font-semibold text-blue-700">Experiente</th>
                <th className="text-center p-2 border border-gray-200 font-semibold text-green-700">Top Performer</th>
              </tr>
            </thead>
            <tbody>
              {benchmarks.map((b, i) => (
                <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                  <td className="p-2 border border-gray-200 font-medium text-gray-800">{b.indicador}</td>
                  <td className="p-2 border border-gray-200 text-center text-yellow-700 font-medium">{b.iniciante}</td>
                  <td className="p-2 border border-gray-200 text-center text-blue-700 font-medium">{b.experiente}</td>
                  <td className="p-2 border border-gray-200 text-center text-green-700 font-bold">{b.top}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-500 mt-2">Use esses benchmarks como referência — não como pressão. Melhorar 5 pontos percentuais em uma taxa já é resultado significativo.</p>
      </Accordion>

      <Accordion title="Como usar a Evolução para melhorar — 4 passos">
        <div className="space-y-3">
          {[
            { passo: "Passo 1", desc: "Identifique o indicador que mais caiu ou está mais abaixo do esperado. Foque em um por vez." },
            { passo: "Passo 2", desc: "Pergunte 'por que está assim?' — não 'o que eu preciso fazer?' Diagnóstico antes de prescrição." },
            { passo: "Passo 3", desc: "Defina uma ação específica para o próximo mês direcionada a esse indicador. Exemplo: 'Minha taxa visita → proposta está em 30%. Vou apresentar a proposta em todas as visitas deste mês, sem exceção.'" },
            { passo: "Passo 4", desc: "No mês seguinte, verifique se o número melhorou." },
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-3 text-sm">
              <span className="bg-green-600 text-white rounded-lg px-2 py-0.5 text-xs font-bold shrink-0">{item.passo}</span>
              <span className="text-gray-700">{item.desc}</span>
            </div>
          ))}
        </div>
      </Accordion>

      <Accordion title="Erros mais comuns">
        <ErrorItem>Olhar a evolução só quando o resultado está ruim. Acompanhe todo mês — bom ou ruim. Você precisa saber o que causou o bom resultado tanto quanto o que causou o ruim.</ErrorItem>
        <ErrorItem>Comparar-se com outros corretores antes de se comparar consigo mesmo. Sua referência principal é o seu próprio mês anterior. Evoluiu? Você está no caminho certo.</ErrorItem>
        <ErrorItem>Querer melhorar tudo ao mesmo tempo. Foque em um indicador por mês. Melhora focada supera melhora dispersa.</ErrorItem>
      </Accordion>

      <GoldTip>
        O corretor que acompanha os próprios números todo mês evolui 3x mais rápido do que o que só olha a comissão no final do mês. Não porque trabalha mais — mas porque sabe exatamente onde está perdendo e corrige antes de perder muito.
      </GoldTip>

      <NavButton href="/meu-negocio/evolucao">Ver minha Evolução na prática</NavButton>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────
const TABS = [
  { id: "dashboard", label: "Meu Dashboard", icon: LayoutDashboard, component: Bloco1 },
  { id: "pipeline", label: "Meu Pipeline", icon: GitBranch, component: Bloco2 },
  { id: "followup", label: "Follow-up", icon: Phone, component: Bloco3 },
  { id: "comissoes", label: "Comissões", icon: DollarSign, component: Bloco4 },
  { id: "mcmv", label: "Pré-Análise MCMV", icon: Calculator, component: Bloco5 },
  { id: "evolucao", label: "Minha Evolução", icon: TrendingUp, component: Bloco6 },
];

export default function ComoAvaliarMeuNegocio() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const ActiveComponent = TABS.find((t) => t.id === activeTab)?.component ?? Bloco1;
  const activeIndex = TABS.findIndex((t) => t.id === activeTab);

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-start gap-4 mb-6">
          <div className="bg-amber-100 rounded-xl p-3">
            <BookOpen className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Como Avaliar Meu Negócio</h1>
            <p className="text-gray-500 mt-0.5">Guia prático para interpretar seus números e tomar decisões com clareza</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-5">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
            <span>Bloco {activeIndex + 1} de {TABS.length}</span>
            <span>{TABS[activeIndex].label}</span>
          </div>
          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all duration-300"
              style={{ width: `${((activeIndex + 1) / TABS.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Tab navigation */}
        <div className="flex flex-wrap gap-2 mb-6">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.label.split(" ")[0]}</span>
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-5 pb-4 border-b border-gray-100">
            {(() => {
              const tab = TABS.find((t) => t.id === activeTab)!;
              const Icon = tab.icon;
              return (
                <>
                  <div className="bg-indigo-100 rounded-lg p-2">
                    <Icon className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">Bloco {activeIndex + 1} — {tab.label}</h2>
                  </div>
                </>
              );
            })()}
          </div>
          <ActiveComponent />
        </div>

        {/* Navigation buttons */}
        <div className="flex justify-between mt-4">
          <button
            onClick={() => setActiveTab(TABS[Math.max(0, activeIndex - 1)].id)}
            disabled={activeIndex === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            ← Anterior
          </button>
          <button
            onClick={() => setActiveTab(TABS[Math.min(TABS.length - 1, activeIndex + 1)].id)}
            disabled={activeIndex === TABS.length - 1}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Próximo →
          </button>
        </div>

        {/* Mentor tip */}
        <div className="mt-6 flex gap-3 bg-indigo-50 border border-indigo-200 rounded-xl p-4">
          <Lightbulb className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
          <p className="text-sm text-indigo-800">
            <strong>Dica do mentor:</strong> Leia um bloco por semana e aplique o que aprendeu antes de avançar para o próximo. Conhecimento sem prática não muda resultado.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Users, 
  Kanban, 
  TrendingUp, 
  Bell, 
  CheckCircle2, 
  ArrowRight,
  Phone,
  Calendar,
  MessageSquare,
  Target,
  Clock,
  Star,
  Building2,
  Upload,
  Settings,
  Tv,
  BarChart3,
  Zap,
  UserCheck,
  UserX,
  AlertTriangle,
  MessageCircle,
  Eye,
  Edit,
  Smartphone,
  RefreshCw,
  Trash2,
  Shield,
  Award,
  ListTodo,
  CalendarDays,
  Timer,
  XCircle,
  ArrowLeftRight,
  UserPlus,
  AlertCircle
} from "lucide-react";
import { useLocation } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";

export default function BoasVindas() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  const isGestor = user?.role === 'admin' || user?.role === 'gestor';

  // Seções para Corretores com instruções detalhadas
  const corretorSections = [
    {
      icon: UserCheck,
      title: "Presença / Ausência",
      description: "Controle quando você está disponível para receber leads",
      path: null,
      color: "bg-emerald-500",
      steps: [
        "No menu lateral, você verá um botão PRESENTE (verde) ou AUSENTE (vermelho)",
        "Clique no botão para alternar entre os estados",
        "Quando PRESENTE: você recebe novos leads automaticamente pela roleta",
        "Quando AUSENTE: você NÃO recebe novos leads (use quando sair para almoço, reunião, etc)",
        "Seu status também aparece no seu avatar com um indicador colorido"
      ],
      important: "⚠️ IMPORTANTE: Sempre marque AUSENTE quando não puder atender leads imediatamente!"
    },
    {
      icon: Users,
      title: "Meus Leads",
      description: "Gerencie todos os leads atribuídos a você",
      path: "/leads",
      color: "bg-blue-500",
      steps: [
        "Visualize todos os leads que foram distribuídos para você",
        "Clique no TELEFONE (verde) ou botão WHATSAPP para contatar o cliente diretamente",
        "Use os filtros para encontrar leads por status, data ou projeto",
        "Clique em 'Ver Detalhes' para abrir informações completas do lead",
        "Atualize o status do lead conforme o progresso do atendimento",
        "O TIMER mostra há quanto tempo o lead está aguardando (amarelo +5min, vermelho +30min, crítico +2h)"
      ],
      important: "💡 DICA: Leads novos devem ser contatados em até 5 minutos para maior conversão!"
    },
    {
      icon: UserPlus,
      title: "Cadastrar Lead (Captação Própria)",
      description: "Cadastre leads que você mesmo captou",
      path: "/leads",
      color: "bg-teal-500",
      steps: [
        "Na página 'Meus Leads', clique no botão 'Novo Lead'",
        "Preencha nome, telefone, email e projeto de interesse",
        "A origem já vem selecionada como 'Captação Própria'",
        "Leads de captação própria NUNCA são transferidos para outros corretores",
        "Esses leads ficam com você mesmo após 3 tentativas de follow-up sem resposta"
      ],
      important: "🎯 REGRA: Leads de Captação Própria são seus para sempre!"
    },
    {
      icon: Kanban,
      title: "Kanban",
      description: "Visualize seu funil de vendas de forma visual",
      path: "/kanban",
      color: "bg-purple-500",
      steps: [
        "Veja seus leads organizados em colunas por status (Novo, Em Atendimento, Visita Agendada, etc)",
        "Arraste e solte os cards para mover leads entre as etapas",
        "Clique no card para ver detalhes e adicionar observações",
        "Acompanhe visualmente quantos leads estão em cada etapa",
        "O timer de urgência aparece em cada card"
      ]
    },
    {
      icon: CalendarDays,
      title: "Agendamentos",
      description: "Gerencie suas visitas e compromissos",
      path: "/agendamentos",
      color: "bg-orange-500",
      steps: [
        "Crie agendamentos de visitas com seus clientes",
        "Visualize em formato de calendário (mensal ou semanal)",
        "Busque o lead por telefone para vincular ao agendamento",
        "Selecione o projeto, data, hora e adicione observações",
        "Acompanhe o status: pendente, confirmado, realizado ou cancelado"
      ]
    },
    {
      icon: ListTodo,
      title: "Tarefas do Dia (Follow-ups)",
      description: "Acompanhe os follow-ups pendentes",
      path: "/tarefas-do-dia",
      color: "bg-red-500",
      steps: [
        "Veja todos os leads que precisam de follow-up hoje",
        "Cada lead tem um contador de tentativas (1/3 até 3/3)",
        "Ao registrar contato, responda: 'Cliente respondeu? Sim ou Não'",
        "Se SIM: contador reseta e lead sai das tarefas do dia",
        "Se NÃO: contador avança (2/3, 3/3) e você tenta novamente amanhã"
      ],
      important: "⚠️ REGRA: Após 3 tentativas sem resposta, o lead é transferido para outro corretor automaticamente!"
    },
    {
      icon: TrendingUp,
      title: "Minha Performance",
      description: "Acompanhe suas métricas e resultados",
      path: "/minha-performance",
      color: "bg-green-500",
      steps: [
        "Veja seu ranking no pódio mensal comparado aos outros corretores",
        "Acompanhe sua taxa de conversão (leads → vendas)",
        "Veja quantos leads recebeu, agendamentos feitos e contratos fechados",
        "Compare seu desempenho com as metas estabelecidas"
      ]
    },
    {
      icon: Award,
      title: "Conquistas",
      description: "Desbloqueie conquistas e ganhe pontos",
      path: "/conquistas",
      color: "bg-yellow-500",
      steps: [
        "Ganhe conquistas por atingir metas e marcos importantes",
        "Cada conquista vale pontos que contam no ranking",
        "Conquistas são exibidas no seu perfil",
        "Tipos: primeiro lead, primeira venda, metas batidas, etc"
      ]
    },
    {
      icon: Bell,
      title: "Notificações",
      description: "Fique por dentro de novos leads e atualizações",
      path: "/notificacoes",
      color: "bg-pink-500",
      steps: [
        "Receba alertas sonoros quando novos leads forem atribuídos a você",
        "Notificações push aparecem mesmo com a aba em segundo plano",
        "Clique na notificação para abrir os detalhes do lead automaticamente",
        "Mantenha o som ativado (ícone 🔔 no topo) para não perder novos leads"
      ],
      important: "🔔 ATENÇÃO: Mantenha o som ativado para não perder leads!"
    },
    {
      icon: Building2,
      title: "Projetos",
      description: "Conheça os empreendimentos disponíveis",
      path: "/projetos",
      color: "bg-indigo-500",
      steps: [
        "Veja todos os empreendimentos cadastrados no sistema",
        "Consulte informações como localização, valores e tipologias",
        "Use para conhecer os produtos antes de apresentar aos clientes",
        "Cada lead pode estar associado a um projeto específico"
      ]
    }
  ];

  // Seções adicionais para Gestores
  const gestorSections = [
    {
      icon: Users,
      title: "Corretores",
      description: "Gerencie sua equipe de vendas",
      path: "/corretores",
      color: "bg-teal-500",
      steps: [
        "Cadastre novos corretores na equipe",
        "Defina status (ativo/inativo) de cada corretor",
        "Acompanhe a performance individual",
        "Gerencie a capacidade de atendimento"
      ]
    },
    {
      icon: Zap,
      title: "Distribuição de Leads",
      description: "Configure a roleta automática de leads",
      path: "/controle-distribuicao",
      color: "bg-yellow-500",
      steps: [
        "Ative/desative a distribuição automática",
        "Configure o limite de leads por corretor",
        "Defina horários de distribuição",
        "Acompanhe o histórico de distribuições"
      ]
    },
    {
      icon: Target,
      title: "Metas",
      description: "Defina e acompanhe metas da equipe",
      path: "/metas",
      color: "bg-red-500",
      steps: [
        "Defina metas mensais por corretor",
        "Configure metas de leads, visitas e vendas",
        "Acompanhe o progresso em tempo real",
        "Visualize o ranking de performance"
      ]
    },
    {
      icon: Tv,
      title: "Ranking TV",
      description: "Exiba o ranking em tela para motivar a equipe",
      path: "/ranking-tv",
      color: "bg-pink-500",
      steps: [
        "Abra em uma TV ou monitor na sala de vendas",
        "Exibe o ranking do dia em tempo real",
        "Atualiza automaticamente a cada minuto",
        "Gamificação para motivar a equipe"
      ]
    },
    {
      icon: BarChart3,
      title: "Relatórios",
      description: "Analise dados e tome decisões",
      path: "/relatorios",
      color: "bg-cyan-500",
      steps: [
        "Relatórios de performance por período",
        "Análise de conversão por etapa do funil",
        "Comparativo entre corretores",
        "Exportação de dados para Excel"
      ]
    }
  ];

  // Seções de importação para Gestores
  const importSections = [
    {
      icon: Upload,
      title: "Importar Projetos",
      description: "Importe empreendimentos de planilhas",
      path: "/importar-projetos",
      color: "bg-emerald-500"
    },
    {
      icon: Upload,
      title: "Importar Leads",
      description: "Importe leads de CSV ou Google Sheets",
      path: "/importar-csv",
      color: "bg-amber-500"
    },
    {
      icon: Settings,
      title: "Configurações",
      description: "Configure webhooks e integrações",
      path: "/configuracoes",
      color: "bg-slate-500"
    }
  ];

  // Regras do Sistema
  const regrasDoSistema = [
    {
      icon: Timer,
      title: "Timer de Urgência",
      description: "Cada lead mostra há quanto tempo está aguardando atendimento",
      rules: [
        "Amarelo: Lead aguardando há mais de 5 minutos",
        "Vermelho: Lead aguardando há mais de 30 minutos",
        "Crítico (pulsando): Lead aguardando há mais de 2 horas"
      ],
      color: "bg-amber-100 border-amber-300 text-amber-800"
    },
    {
      icon: RefreshCw,
      title: "Sistema de Follow-up (3 Tentativas)",
      description: "Cada lead tem direito a 3 tentativas de contato",
      rules: [
        "Tentativa 1/3 até 3/3 - você tenta contatar o cliente",
        "Se o cliente RESPONDER: contador reseta e você continua o atendimento",
        "Se o cliente NÃO RESPONDER após 3 tentativas: lead é transferido automaticamente",
        "Novo corretor recebe o lead e começa 1/3 novamente"
      ],
      color: "bg-blue-100 border-blue-300 text-blue-800"
    },
    {
      icon: Shield,
      title: "Captação Própria (Não Transfere)",
      description: "Leads cadastrados por você com origem 'Captação Própria'",
      rules: [
        "Leads de captação própria NUNCA são transferidos",
        "Mesmo após 3/3 tentativas, o lead continua com você",
        "Ao cadastrar um lead, selecione 'Captação Própria' como origem",
        "Essa regra protege os leads que você mesmo captou"
      ],
      color: "bg-green-100 border-green-300 text-green-800"
    },
    {
      icon: ArrowLeftRight,
      title: "Transferência Automática",
      description: "Como funciona a transferência de leads entre corretores",
      rules: [
        "Após 3/3 tentativas sem resposta → lead vai para outro corretor",
        "O sistema escolhe um corretor que ainda não tentou esse lead",
        "O novo corretor começa do 1/3 novamente",
        "Leads de 'Captação Própria' são exceção e não são transferidos"
      ],
      color: "bg-purple-100 border-purple-300 text-purple-800"
    },
    {
      icon: Trash2,
      title: "Lixeira (Leads Perdidos)",
      description: "Quando um lead vai para a lixeira",
      rules: [
        "Lead só vai para lixeira quando TODOS os corretores completarem 3/3",
        "Ou seja, todos tentaram 3x e ninguém conseguiu contato",
        "Leads na lixeira podem ser recuperados pelo gestor",
        "Motivo é registrado automaticamente no histórico"
      ],
      color: "bg-red-100 border-red-300 text-red-800"
    },
    {
      icon: Bell,
      title: "Notificações Push",
      description: "Alertas em tempo real para novos leads",
      rules: [
        "Você recebe notificação quando um novo lead é atribuído",
        "Funciona mesmo com a aba do navegador em segundo plano",
        "Permita notificações no navegador para receber alertas",
        "Mantenha o som ativado para não perder leads"
      ],
      color: "bg-orange-100 border-orange-300 text-orange-800"
    }
  ];

  const dicasCorretores = [
    {
      icon: Clock,
      title: "Responda em 5 Minutos",
      description: "Leads respondidos em até 5 minutos têm 21x mais chances de conversão. Velocidade é tudo!"
    },
    {
      icon: Phone,
      title: "Prefira Ligação",
      description: "Sempre que possível, faça uma ligação. É mais pessoal e efetivo que mensagens."
    },
    {
      icon: MessageCircle,
      title: "WhatsApp é Aliado",
      description: "Use o botão WhatsApp no card do lead para contato rápido. Já abre com o número preenchido."
    },
    {
      icon: Calendar,
      title: "Agende Visitas",
      description: "Converta leads em visitas agendadas o mais rápido possível. Visita = proximidade da venda."
    },
    {
      icon: Edit,
      title: "Registre Tudo",
      description: "Adicione observações em cada interação. Isso ajuda você e a equipe a não perder informações."
    },
    {
      icon: UserX,
      title: "Marque Ausência",
      description: "Vai almoçar ou entrar em reunião? Marque AUSENTE para não perder leads que não poderá atender."
    }
  ];

  const sections = isGestor ? [...corretorSections, ...gestorSections] : corretorSections;

  return (
    <DashboardLayout>
      <div className="space-y-8 max-w-5xl mx-auto">
        {/* Header de Boas-Vindas */}
        <div className="text-center space-y-4 py-6">
          <h1 className="text-3xl font-bold tracking-tight">
            Bem-vindo{user?.name ? `, ${user.name.split(' ')[0]}` : ''}! 👋
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {isGestor 
              ? "Este guia vai te ajudar a configurar e gerenciar o CRM da sua equipe."
              : "Este guia completo vai te ajudar a usar o sistema e converter mais leads em vendas."
            }
          </p>
          <Badge variant="secondary" className="text-sm">
            {isGestor ? "Acesso de Gestor" : "Acesso de Corretor"} • Leia com atenção
          </Badge>
        </div>

        {/* Alerta importante para Corretores */}
        {!isGestor && (
          <Alert className="bg-amber-50 border-amber-200">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <AlertTitle className="text-amber-800 font-semibold">Antes de começar!</AlertTitle>
            <AlertDescription className="text-amber-700">
              <ul className="list-disc list-inside space-y-1 mt-2">
                <li>Verifique se você está marcado como <strong>PRESENTE</strong> no menu lateral para receber leads</li>
                <li>Mantenha o <strong>som de notificações ativado</strong> (ícone 🔔 no topo)</li>
                <li>Sempre marque <strong>AUSENTE</strong> quando não puder atender (almoço, reunião, etc)</li>
                <li>Leads de <strong>Captação Própria</strong> nunca são transferidos - são seus!</li>
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Primeiros Passos para Gestores */}
        {isGestor && (
          <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                Primeiros Passos - Configure seu CRM
              </CardTitle>
              <CardDescription>
                Siga estes passos para começar a usar o sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4">
                {importSections.map((section) => (
                  <Button
                    key={section.title}
                    variant="outline"
                    className="h-auto py-4 flex flex-col items-center gap-2 hover:bg-background"
                    onClick={() => setLocation(section.path)}
                  >
                    <div className={`p-2 rounded-lg ${section.color} text-white`}>
                      <section.icon className="h-5 w-5" />
                    </div>
                    <span className="font-medium">{section.title}</span>
                    <span className="text-xs text-muted-foreground text-center">
                      {section.description}
                    </span>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* REGRAS DO SISTEMA - Nova Seção */}
        <div className="space-y-6">
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <AlertCircle className="h-6 w-6 text-red-500" />
            Regras do Sistema - LEIA COM ATENÇÃO
          </h2>
          
          <div className="grid md:grid-cols-2 gap-4">
            {regrasDoSistema.map((regra) => (
              <Card key={regra.title} className={`${regra.color} border`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <regra.icon className="h-5 w-5" />
                    {regra.title}
                  </CardTitle>
                  <CardDescription className="text-current opacity-80">
                    {regra.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1 text-sm">
                    {regra.rules.map((rule, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 opacity-70" />
                        <span>{rule}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <Separator />

        {/* Seções do Tutorial */}
        <div className="space-y-6">
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <CheckCircle2 className="h-6 w-6 text-primary" />
            {isGestor ? "Funcionalidades do Sistema" : "Como usar o sistema"}
          </h2>
          
          <div className="grid gap-6">
            {sections.map((section, index) => (
              <Card key={section.title} className="overflow-hidden">
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-lg ${section.color} text-white`}>
                        <section.icon className="h-6 w-6" />
                      </div>
                      <div>
                        <CardTitle className="text-xl flex items-center gap-2">
                          <span className="text-muted-foreground text-sm font-normal">
                            {index + 1}.
                          </span>
                          {section.title}
                        </CardTitle>
                        <CardDescription className="mt-1">
                          {section.description}
                        </CardDescription>
                      </div>
                    </div>
                    {section.path && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setLocation(section.path!)}
                        className="shrink-0"
                      >
                        Acessar
                        <ArrowRight className="h-4 w-4 ml-1" />
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2">
                    {section.steps.map((step, stepIndex) => (
                      <li key={stepIndex} className="flex items-start gap-3 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>
                  {'important' in section && section.important && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                      {section.important}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Dicas de Sucesso */}
        <div className="space-y-6">
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <Star className="h-6 w-6 text-yellow-500" />
            Dicas para você vender mais
          </h2>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {dicasCorretores.map((dica) => (
              <Card key={dica.title} className="hover:shadow-md transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <dica.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-medium">{dica.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {dica.description}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Fluxo de Atendimento */}
        <Card className="bg-gradient-to-br from-green-500/5 to-green-500/10 border-green-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-green-600" />
              Fluxo de Atendimento Recomendado
            </CardTitle>
            <CardDescription>
              Siga este fluxo para maximizar suas conversões
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
              <Badge variant="outline" className="py-2 px-4">
                1. Novo Lead
              </Badge>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <Badge variant="outline" className="py-2 px-4 bg-red-50 border-red-200 text-red-700">
                2. Contato em 5min ⚡
              </Badge>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <Badge variant="outline" className="py-2 px-4">
                3. Qualificação
              </Badge>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <Badge variant="outline" className="py-2 px-4">
                4. Visita Agendada
              </Badge>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <Badge variant="outline" className="py-2 px-4">
                5. Proposta
              </Badge>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <Badge className="py-2 px-4 bg-green-500">
                6. Venda! 🎉
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Resumo Rápido para Corretores */}
        {!isGestor && (
          <Card className="bg-gradient-to-br from-blue-500/5 to-blue-500/10 border-blue-500/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="h-5 w-5 text-blue-600" />
                Resumo Rápido - O que fazer todo dia
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div className="space-y-2">
                  <h4 className="font-semibold text-green-700">✅ Ao chegar:</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>1. Marque-se como PRESENTE</li>
                    <li>2. Ative o som de notificações</li>
                    <li>3. Verifique leads pendentes</li>
                    <li>4. Veja as Tarefas do Dia (follow-ups)</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold text-red-700">❌ Ao sair/pausar:</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>1. Marque-se como AUSENTE</li>
                    <li>2. Atualize status dos leads em andamento</li>
                    <li>3. Registre observações importantes</li>
                    <li>4. Complete os follow-ups pendentes</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* CTA Final */}
        <Card className="text-center">
          <CardContent className="py-8">
            <h3 className="text-xl font-semibold mb-2">
              Pronto para começar?
            </h3>
            <p className="text-muted-foreground mb-6">
              {isGestor 
                ? "Configure seus projetos e comece a distribuir leads para a equipe!"
                : "Verifique se está PRESENTE e comece a atender seus leads!"
              }
            </p>
            <div className="flex justify-center gap-4 flex-wrap">
              {isGestor ? (
                <>
                  <Button onClick={() => setLocation("/importar-projetos")} size="lg">
                    <Upload className="h-4 w-4 mr-2" />
                    Importar Projetos
                  </Button>
                  <Button onClick={() => setLocation("/dashboard")} variant="outline" size="lg">
                    <BarChart3 className="h-4 w-4 mr-2" />
                    Ver Dashboard
                  </Button>
                </>
              ) : (
                <>
                  <Button onClick={() => setLocation("/leads")} size="lg">
                    <Users className="h-4 w-4 mr-2" />
                    Ver Meus Leads
                  </Button>
                  <Button onClick={() => setLocation("/tarefas-do-dia")} variant="outline" size="lg">
                    <ListTodo className="h-4 w-4 mr-2" />
                    Tarefas do Dia
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

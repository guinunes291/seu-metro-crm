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
  Star
} from "lucide-react";
import { useLocation } from "wouter";

export default function BoasVindas() {
  const [, setLocation] = useLocation();

  const tutorialSections = [
    {
      icon: Users,
      title: "Meus Leads",
      description: "Gerencie todos os leads atribuídos a você",
      path: "/leads",
      color: "bg-blue-500",
      steps: [
        "Visualize todos os leads que foram distribuídos para você",
        "Clique em um lead para ver detalhes completos (nome, telefone, email, campanha)",
        "Atualize o status do lead conforme o progresso do atendimento",
        "Use os filtros para encontrar leads específicos por status ou data"
      ]
    },
    {
      icon: Kanban,
      title: "Kanban",
      description: "Visualize seu funil de vendas de forma visual",
      path: "/kanban",
      color: "bg-purple-500",
      steps: [
        "Arraste e solte os cards para mover leads entre as etapas",
        "As colunas representam cada fase do funil de vendas",
        "Clique no card para ver detalhes e adicionar observações",
        "Acompanhe visualmente quantos leads estão em cada etapa"
      ]
    },
    {
      icon: TrendingUp,
      title: "Minha Performance",
      description: "Acompanhe suas métricas e resultados",
      path: "/minha-performance",
      color: "bg-green-500",
      steps: [
        "Veja quantos leads você recebeu no período",
        "Acompanhe sua taxa de conversão",
        "Compare seu desempenho com as metas estabelecidas",
        "Identifique oportunidades de melhoria"
      ]
    },
    {
      icon: Bell,
      title: "Notificações",
      description: "Fique por dentro de novos leads e atualizações",
      path: "/notificacoes",
      color: "bg-orange-500",
      steps: [
        "Receba alertas quando novos leads forem atribuídos a você",
        "Veja notificações de leads que precisam de atenção",
        "Marque notificações como lidas após visualizar",
        "Mantenha o som ativado para não perder novos leads"
      ]
    }
  ];

  const dicas = [
    {
      icon: Clock,
      title: "Responda Rápido",
      description: "Leads respondidos em até 5 minutos têm 21x mais chances de conversão"
    },
    {
      icon: Phone,
      title: "Prefira Ligação",
      description: "Sempre que possível, faça uma ligação. É mais pessoal e efetivo"
    },
    {
      icon: Calendar,
      title: "Agende Visitas",
      description: "Converta leads em visitas agendadas o mais rápido possível"
    },
    {
      icon: MessageSquare,
      title: "Registre Tudo",
      description: "Adicione observações em cada interação para não perder informações"
    },
    {
      icon: Target,
      title: "Foque nas Metas",
      description: "Acompanhe suas metas diariamente e ajuste sua estratégia"
    },
    {
      icon: Star,
      title: "Qualifique Bem",
      description: "Entenda as necessidades do cliente antes de apresentar imóveis"
    }
  ];

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Header de Boas-Vindas */}
      <div className="text-center space-y-4 py-8">
        <div className="flex justify-center mb-4">
          <img 
            src="/logo-seu-metro-quadrado.png" 
            alt="Seu Metro Quadrado" 
            className="h-20 object-contain"
          />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">
          Bem-vindo ao CRM Seu Metro Quadrado!
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Este guia vai te ajudar a aproveitar ao máximo o sistema e converter mais leads em vendas.
        </p>
        <Badge variant="secondary" className="text-sm">
          Tempo de leitura: 3 minutos
        </Badge>
      </div>

      {/* Seções do Tutorial */}
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold flex items-center gap-2">
          <CheckCircle2 className="h-6 w-6 text-primary" />
          Como usar o sistema
        </h2>
        
        <div className="grid gap-6">
          {tutorialSections.map((section, index) => (
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
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setLocation(section.path)}
                    className="shrink-0"
                  >
                    Acessar
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {section.steps.map((step, stepIndex) => (
                    <li key={stepIndex} className="flex items-start gap-3 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                      <span>{step}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Dicas de Sucesso */}
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold flex items-center gap-2">
          <Star className="h-6 w-6 text-yellow-500" />
          Dicas para vender mais
        </h2>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {dicas.map((dica) => (
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
      <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Fluxo de Atendimento Recomendado
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
            <Badge variant="outline" className="py-2 px-4">
              1. Novo Lead
            </Badge>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <Badge variant="outline" className="py-2 px-4">
              2. Contato em 5min
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
              6. Venda!
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* CTA Final */}
      <Card className="text-center">
        <CardContent className="py-8">
          <h3 className="text-xl font-semibold mb-2">
            Pronto para começar?
          </h3>
          <p className="text-muted-foreground mb-6">
            Acesse seus leads e comece a converter agora mesmo!
          </p>
          <div className="flex justify-center gap-4 flex-wrap">
            <Button onClick={() => setLocation("/leads")} size="lg">
              <Users className="h-4 w-4 mr-2" />
              Ver Meus Leads
            </Button>
            <Button onClick={() => setLocation("/kanban")} variant="outline" size="lg">
              <Kanban className="h-4 w-4 mr-2" />
              Abrir Kanban
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users, Target, TrendingUp, Phone, Mail } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";

export default function MinhaEquipe() {
  const { user } = useAuth();
  const { data: equipes, isLoading } = trpc.equipes.list.useQuery();
  
  const minhaEquipe = equipes?.[0]; // Gestor vê apenas sua equipe
  
  const { data: corretores } = trpc.equipes.getCorretores.useQuery(
    { equipeId: minhaEquipe?.id! },
    { enabled: !!minhaEquipe }
  );

  if (isLoading) {
    return <div className="container py-6">Carregando...</div>;
  }

  if (!minhaEquipe) {
    return (
      <div className="container py-6">
        <Card>
          <CardHeader>
            <CardTitle>Sem Equipe Atribuída</CardTitle>
            <CardDescription>
              Você ainda não foi atribuído a nenhuma equipe. Entre em contato com o administrador.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-6">
      {/* Header da Equipe */}
      <div className="mb-6">
        <div 
          className="h-32 rounded-lg mb-4 flex items-center justify-center"
          style={{ backgroundColor: minhaEquipe.cor }}
        >
          <h1 className="text-4xl font-bold text-white">{minhaEquipe.nome}</h1>
        </div>
        
        {minhaEquipe.descricao && (
          <p className="text-muted-foreground text-center">{minhaEquipe.descricao}</p>
        )}
      </div>

      {/* Cards de Métricas */}
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Membros da Equipe</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{corretores?.length || 0}</div>
            <p className="text-xs text-muted-foreground">corretores ativos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Meta Mensal</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{minhaEquipe.metaMensal}</div>
            <p className="text-xs text-muted-foreground">vendas por mês</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Performance</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">-</div>
            <p className="text-xs text-muted-foreground">em breve</p>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Corretores */}
      <Card>
        <CardHeader>
          <CardTitle>Corretores da Equipe</CardTitle>
          <CardDescription>
            Membros ativos da {minhaEquipe.nome}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {corretores && corretores.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {corretores.map(corretor => (
                <Card key={corretor.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${corretor.name}`} />
                        <AvatarFallback>
                          {corretor.name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{corretor.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge 
                            variant={corretor.status === 'presente' ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {corretor.status === 'presente' ? 'Presente' : 'Ausente'}
                          </Badge>
                          <Badge 
                            variant={corretor.situacao === 'ativo' ? 'default' : 'destructive'}
                            className="text-xs"
                          >
                            {corretor.situacao === 'ativo' ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-4 space-y-2 text-sm">
                      {corretor.email && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Mail className="h-4 w-4" />
                          <span className="truncate">{corretor.email}</span>
                        </div>
                      )}
                      {corretor.telefone && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Phone className="h-4 w-4" />
                          <span>{corretor.telefone}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              Nenhum corretor nesta equipe ainda
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

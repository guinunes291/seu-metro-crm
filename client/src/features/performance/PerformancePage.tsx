import { useAuth } from "@/_core/hooks/useAuth";
import MinhaPerformance from "@/pages/MinhaPerformance";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, Trophy, BarChart3 } from "lucide-react";
import { useLocation } from "wouter";

function PerformanceGestor() {
  const [, setLocation] = useLocation();
  return (
    <DashboardLayout>
      <div className="p-4 lg:p-6 space-y-5 max-w-2xl">
        <div>
          <h1 className="text-xl font-bold">Performance da Equipe</h1>
          <p className="text-sm text-muted-foreground">Acompanhe o desempenho do seu time</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setLocation("/ranking-tv")}>
            <CardContent className="p-5 flex flex-col items-center gap-3 text-center">
              <Trophy className="h-8 w-8 text-amber-500" />
              <div>
                <p className="font-semibold">Corrida dos Campeões</p>
                <p className="text-xs text-muted-foreground">Ranking TV em tempo real</p>
              </div>
              <Button size="sm" variant="outline" className="w-full">Abrir</Button>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setLocation("/meu-painel")}>
            <CardContent className="p-5 flex flex-col items-center gap-3 text-center">
              <TrendingUp className="h-8 w-8 text-blue-500" />
              <div>
                <p className="font-semibold">Meu Painel</p>
                <p className="text-xs text-muted-foreground">Suas métricas pessoais</p>
              </div>
              <Button size="sm" variant="outline" className="w-full">Abrir</Button>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setLocation("/relatorios")}>
            <CardContent className="p-5 flex flex-col items-center gap-3 text-center">
              <BarChart3 className="h-8 w-8 text-purple-500" />
              <div>
                <p className="font-semibold">Relatórios</p>
                <p className="text-xs text-muted-foreground">Análise detalhada do time</p>
              </div>
              <Button size="sm" variant="outline" className="w-full">Abrir</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default function PerformancePage() {
  const { user } = useAuth();
  if (user?.role === "corretor") return <MinhaPerformance />;
  return <PerformanceGestor />;
}

import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

export default function Configuracoes() {
  const { user } = useAuth();
  const updateStatusMutation = trpc.corretores.updateStatus.useMutation();
  const utils = trpc.useUtils();

  const isCorretor = user?.role === "corretor";
  const isPresente = user?.status === "presente";

  const handleToggleStatus = async () => {
    if (!isCorretor) return;

    try {
      const newStatus = isPresente ? "ausente" : "presente";
      await updateStatusMutation.mutateAsync({ status: newStatus });
      
      toast.success(`Status alterado para ${newStatus === "presente" ? "Presente" : "Ausente"}`);
      
      // Invalidar cache para atualizar o status
      utils.auth.me.invalidate();
    } catch (error) {
      toast.error("Erro ao alterar status");
    }
  };

  return (
    <DashboardLayout>
      <div className="container py-8 max-w-2xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
          <p className="text-muted-foreground mt-2">
            Gerencie suas preferências e configurações
          </p>
        </div>

        {/* Perfil */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Perfil</CardTitle>
            <CardDescription>Informações da sua conta</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-sm text-muted-foreground">Nome</Label>
              <p className="text-base font-medium">{user?.name || "Não informado"}</p>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">E-mail</Label>
              <p className="text-base font-medium">{user?.email || "Não informado"}</p>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Função</Label>
              <div className="mt-1">
                <Badge>
                  {user?.role === "gestor" ? "Gestor" : user?.role === "admin" ? "Administrador" : "Corretor"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Status de plantão (apenas para corretores) */}
        {isCorretor && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Status de Plantão</CardTitle>
              <CardDescription>
                Controle se você está disponível para receber novos leads
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="status-plantao">Disponível para Receber Leads</Label>
                  <p className="text-sm text-muted-foreground">
                    Quando ativado, você receberá novos leads automaticamente
                  </p>
                </div>
                <Switch
                  id="status-plantao"
                  checked={isPresente}
                  onCheckedChange={handleToggleStatus}
                  disabled={updateStatusMutation.isPending}
                />
              </div>
              <div className="mt-4 p-3 bg-muted rounded-lg">
                <p className="text-sm">
                  Status atual: <strong>{isPresente ? "Presente" : "Ausente"}</strong>
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Sobre */}
        <Card>
          <CardHeader>
            <CardTitle>Sobre o Sistema</CardTitle>
            <CardDescription>Informações do CRM</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm">
              <strong>Sistema:</strong> Seu Metro Quadrado - CRM Imobiliário
            </p>
            <p className="text-sm">
              <strong>Versão:</strong> 1.0.0
            </p>
            <p className="text-sm text-muted-foreground">
              Plataforma completa de gestão de leads e vendas para imobiliárias
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

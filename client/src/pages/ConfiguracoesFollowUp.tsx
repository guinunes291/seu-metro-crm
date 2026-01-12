import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Shield, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export default function ConfiguracoesFollowUp() {
  const { data: config, isLoading, refetch } = trpc.systemConfig.get.useQuery();
  const updateBloqueio = trpc.systemConfig.updateBloqueio.useMutation({
    onSuccess: (data) => {
      refetch();
      toast.success(
        data.bloqueioFollowUpAtivo 
          ? "Sistema de bloqueio ativado! Corretores precisarão completar 60% dos follow-ups." 
          : "Sistema desbloqueado! Corretores podem trabalhar livremente."
      );
    },
    onError: () => {
      toast.error("Erro ao atualizar configuração");
    }
  });

  const handleToggle = (checked: boolean) => {
    updateBloqueio.mutate({ ativo: checked });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const bloqueioAtivo = config?.bloqueioFollowUpAtivo ?? true;

  return (
    <div className="container max-w-4xl py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Configurações de Follow-up</h1>
        <p className="text-muted-foreground mt-2">
          Controle exclusivo do owner para ativar/desativar o sistema de bloqueio gamificado
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            <CardTitle>Sistema de Bloqueio Gamificado</CardTitle>
          </div>
          <CardDescription>
            Quando ativo, corretores precisam completar 60% dos follow-ups do dia para desbloquear outras abas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-0.5">
              <Label htmlFor="bloqueio-toggle" className="text-base font-medium">
                Bloqueio de Follow-ups
              </Label>
              <p className="text-sm text-muted-foreground">
                {bloqueioAtivo 
                  ? "Sistema bloqueado até completar 60% dos follow-ups" 
                  : "Sistema sempre desbloqueado (sem gamificação)"}
              </p>
            </div>
            <Switch
              id="bloqueio-toggle"
              checked={bloqueioAtivo}
              onCheckedChange={handleToggle}
              disabled={updateBloqueio.isPending}
            />
          </div>

          {bloqueioAtivo ? (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                <strong>Sistema de Gamificação Ativo</strong>
                <ul className="mt-2 space-y-1 text-sm">
                  <li>• Corretores precisam completar 60% dos follow-ups do dia</li>
                  <li>• Após atingir a meta, sistema desbloqueia automaticamente</li>
                  <li>• Desbloqueio persiste até o final do dia</li>
                  <li>• Contador reseta à meia-noite</li>
                </ul>
              </AlertDescription>
            </Alert>
          ) : (
            <Alert>
              <AlertDescription>
                <strong>Sistema Desbloqueado</strong>
                <ul className="mt-2 space-y-1 text-sm">
                  <li>• Corretores podem acessar todas as abas livremente</li>
                  <li>• Follow-ups continuam sendo criados normalmente</li>
                  <li>• Sem bloqueio ou gamificação ativa</li>
                  <li>• Ideal para períodos de teste ou treinamento</li>
                </ul>
              </AlertDescription>
            </Alert>
          )}

          <div className="pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              <strong>Nota:</strong> Esta configuração afeta todos os corretores do sistema. 
              Apenas você (owner) pode modificar esta configuração.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Lock, Unlock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export default function ControleBloqueio() {
  const [bloqueioAtivo, setBloqueioAtivo] = useState(false);
  
  // Buscar configuração atual
  const { data: config, isLoading, refetch } = trpc.systemConfig.get.useQuery();
  
  // Mutation para atualizar bloqueio
  const updateBloqueio = trpc.systemConfig.updateBloqueio.useMutation({
    onSuccess: (data) => {
      setBloqueioAtivo(data.bloqueioAtivo);
      toast.success(
        data.bloqueioAtivo ? 'Bloqueio Ativado' : 'Bloqueio Desativado',
        {
          description: data.bloqueioAtivo 
            ? 'Os corretores não poderão registrar follow-ups até você desativar o bloqueio.'
            : 'Os corretores já podem registrar follow-ups normalmente.',
        }
      );
      refetch();
    },
    onError: (error) => {
      toast.error('Erro ao atualizar configuração', {
        description: error.message || 'Erro ao atualizar configuração',
      });
    },
  });

  // Atualizar estado local quando os dados carregarem
  useEffect(() => {
    if (config) {
      setBloqueioAtivo(config.bloqueioAtivo);
    }
  }, [config]);

  const handleToggle = (checked: boolean) => {
    updateBloqueio.mutate({ ativo: checked });
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="container py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Controle de Bloqueio</h1>
          <p className="text-muted-foreground mt-2">
            Gerencie o acesso dos corretores ao sistema de follow-ups
          </p>
        </div>

        {/* Status Atual */}
        <Alert className={bloqueioAtivo ? 'border-red-500 bg-red-50' : 'border-green-500 bg-green-50'}>
          <div className="flex items-center gap-3">
            {bloqueioAtivo ? (
              <>
                <Lock className="h-5 w-5 text-red-600" />
                <AlertDescription className="text-red-900 font-medium">
                  Sistema BLOQUEADO - Corretores não podem registrar follow-ups
                </AlertDescription>
              </>
            ) : (
              <>
                <Unlock className="h-5 w-5 text-green-600" />
                <AlertDescription className="text-green-900 font-medium">
                  Sistema DESBLOQUEADO - Corretores podem registrar follow-ups normalmente
                </AlertDescription>
              </>
            )}
          </div>
        </Alert>

        {/* Card de Controle */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Controle de Acesso</CardTitle>
            <CardDescription>
              Ative ou desative o bloqueio do sistema de follow-ups para todos os corretores
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Toggle Principal */}
            <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
              <div className="space-y-1">
                <Label htmlFor="bloqueio-toggle" className="text-base font-semibold cursor-pointer">
                  Bloquear Sistema de Follow-ups
                </Label>
                <p className="text-sm text-muted-foreground">
                  Quando ativado, os corretores não poderão registrar novos contatos ou follow-ups
                </p>
              </div>
              <Switch
                id="bloqueio-toggle"
                checked={bloqueioAtivo}
                onCheckedChange={handleToggle}
                disabled={updateBloqueio.isPending}
                className="data-[state=checked]:bg-red-600"
              />
            </div>

            {/* Informações Adicionais */}
            <div className="space-y-4 pt-4 border-t">
              <h3 className="font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                Como funciona
              </h3>
              
              <div className="space-y-3 text-sm text-muted-foreground">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <p>
                    <strong>Bloqueio Ativado:</strong> Os corretores verão uma mensagem informando que o sistema está temporariamente bloqueado e não poderão adicionar novos follow-ups.
                  </p>
                </div>
                
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <p>
                    <strong>Bloqueio Desativado:</strong> Os corretores terão acesso completo ao sistema e poderão registrar follow-ups normalmente.
                  </p>
                </div>
                
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <p>
                    <strong>Controle Exclusivo:</strong> Apenas você (gestor) pode ativar ou desativar o bloqueio. Os corretores não têm acesso a esta página.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card de Uso Recomendado */}
        <Card className="mt-6 border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="text-blue-900">Quando usar o bloqueio?</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-blue-800 space-y-2">
            <p>• Durante reuniões de equipe ou treinamentos</p>
            <p>• Quando precisar revisar ou auditar dados antes de permitir novos registros</p>
            <p>• Em situações específicas onde o trabalho dos corretores precisa ser pausado temporariamente</p>
            <p>• Para controlar o horário de trabalho da equipe</p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

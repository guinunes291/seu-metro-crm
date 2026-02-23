import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2, UserCog } from "lucide-react";

/**
 * Modal de bloqueio para onboarding obrigatório
 * 
 * Sistema de camadas:
 * 1ª camada: Perfil incompleto → bloqueia e redireciona para /configurar-perfil
 * 2ª camada: Follow-up pendente → só aparece após completar perfil
 */
export default function ModalOnboardingObrigatorio() {
  const [, setLocation] = useLocation();
  const [aberto, setAberto] = useState(false);
  
  // Query para verificar perfil
  const { data: verificacao } = trpc.onboarding.verificar.useQuery(undefined, {
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!verificacao) return;

    const { completo, user } = verificacao;

    // Admin nunca é bloqueado
    if (user.role === "admin") {
      setAberto(false);
      return;
    }

    // Se perfil está incompleto, bloquear
    if (!completo) {
      setAberto(true);
    } else {
      setAberto(false);
    }
  }, [verificacao]);

  const handleIrParaConfiguracao = () => {
    setAberto(false);
    setLocation("/configuracoes");
  };

  if (!verificacao || !aberto) {
    return null;
  }

  const { camposFaltantes } = verificacao;

  return (
    <Dialog open={aberto} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-[500px]" hideClose>
        <DialogHeader>
          <div className="flex items-center justify-center mb-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <UserCog className="h-8 w-8 text-primary" />
            </div>
          </div>
          <DialogTitle className="text-center text-2xl">
            Complete seu Perfil
          </DialogTitle>
          <DialogDescription className="text-center">
            Para ter acesso completo ao sistema, você precisa completar seu cadastro
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Campos obrigatórios faltantes:</strong>
              <ul className="list-disc list-inside mt-2 space-y-1">
                {camposFaltantes.map((campo) => (
                  <li key={campo}>{campo}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>

          <div className="bg-muted p-4 rounded-lg">
            <h4 className="font-medium mb-2">O que você precisa preencher:</h4>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>✓ Foto de perfil</li>
              <li>✓ Dados pessoais completos</li>
              <li>✓ Informações profissionais</li>
              <li>✓ Endereço completo</li>
            </ul>
          </div>
        </div>

        <div className="flex justify-center">
          <Button onClick={handleIrParaConfiguracao} size="lg" className="w-full">
            Completar Cadastro Agora
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

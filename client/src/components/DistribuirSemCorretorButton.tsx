import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, UserPlus } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export default function DistribuirSemCorretorButton() {
  const [showDialog, setShowDialog] = useState(false);

  const distribuirMutation = trpc.distribution.distribuirLeadsSemCorretor.useMutation({
    onSuccess: (data) => {
      if (data.distribuidos > 0) {
        toast.success(
          `${data.distribuidos} leads distribuídos com sucesso!${
            data.semCorretorDisponivel > 0
              ? ` (${data.semCorretorDisponivel} leads não distribuídos por falta de corretores disponíveis)`
              : ""
          }${data.erros > 0 ? ` (${data.erros} erros)` : ""}`
        );
      } else if (data.semCorretorDisponivel > 0) {
        toast.warning(
          `Nenhum lead distribuído. ${data.semCorretorDisponivel} leads não puderam ser distribuídos por falta de corretores disponíveis.`
        );
      } else {
        toast.info("Não há leads sem corretor para distribuir.");
      }
      setShowDialog(false);
      // Recarregar a página para atualizar os dados
      window.location.reload();
    },
    onError: (error) => {
      toast.error(`Erro ao distribuir leads: ${error.message}`);
      setShowDialog(false);
    },
  });

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowDialog(true)}
        className="gap-2"
      >
        <UserPlus className="h-4 w-4" />
        Distribuir Sem Corretor
      </Button>

      <AlertDialog open={showDialog} onOpenChange={setShowDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Distribuir Leads Sem Corretor</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação irá distribuir automaticamente todos os leads que estão sem corretor
              atribuído para os corretores disponíveis, seguindo as regras da roleta de distribuição.
              <br /><br />
              <strong>Atenção:</strong> Esta operação pode levar alguns minutos dependendo da
              quantidade de leads.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={distribuirMutation.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                distribuirMutation.mutate();
              }}
              disabled={distribuirMutation.isPending}
              className="bg-primary hover:bg-primary/90"
            >
              {distribuirMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Confirmar Distribuição
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

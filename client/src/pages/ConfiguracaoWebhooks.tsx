import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Trash2, ExternalLink, Copy } from "lucide-react";
import { toast } from "sonner";

export default function ConfiguracaoWebhooks() {

  const [selectedWebhook, setSelectedWebhook] = useState<number | null>(null);
  const [showMappingDialog, setShowMappingDialog] = useState(false);
  const [newFormId, setNewFormId] = useState("");
  const [newProjectId, setNewProjectId] = useState("");

  const { data: webhooks, refetch: refetchWebhooks } = trpc.webhook.list.useQuery();
  const { data: projects } = trpc.projects.list.useQuery();

  const updateMappingMutation = trpc.webhook.updateFormIdMapping.useMutation({
    onSuccess: () => {
      toast.success("Mapeamento atualizado", {
        description: "O mapeamento de Form IDs foi salvo com sucesso.",
      });
      refetchWebhooks();
      setShowMappingDialog(false);
      setNewFormId("");
      setNewProjectId("");
    },
    onError: (error) => {
      toast.error("Erro", {
        description: error.message,
      });
    },
  });

  const webhook = webhooks?.find((w) => w.id === selectedWebhook);
  const currentMapping: Record<string, number> = webhook?.formIdMapping
    ? JSON.parse(webhook.formIdMapping)
    : {};

  const handleAddMapping = () => {
    if (!newFormId || !newProjectId || !selectedWebhook) return;

    const updatedMapping = {
      ...currentMapping,
      [newFormId]: parseInt(newProjectId),
    };

    updateMappingMutation.mutate({
      webhookId: selectedWebhook,
      formIdMapping: updatedMapping,
    });
  };

  const handleRemoveMapping = (formId: string) => {
    if (!selectedWebhook) return;

    const updatedMapping = { ...currentMapping };
    delete updatedMapping[formId];

    updateMappingMutation.mutate({
      webhookId: selectedWebhook,
      formIdMapping: updatedMapping,
    });
  };

  const copyWebhookUrl = (token: string) => {
    const url = `${window.location.origin}/api/webhook/facebook/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("URL copiada", {
      description: "A URL do webhook foi copiada para a área de transferência.",
    });
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Configuração de Webhooks</h1>
        <p className="text-muted-foreground mt-2">
          Configure o mapeamento de Form IDs do Facebook para projetos
        </p>
      </div>

      <div className="grid gap-6">
        {webhooks?.map((webhook) => (
          <Card key={webhook.id} className="p-6">
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold">{webhook.nome}</h3>
                  <p className="text-sm text-muted-foreground">
                    Fonte: {webhook.fonte} • {webhook.leadsRecebidos} leads recebidos
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyWebhookUrl(webhook.webhookToken)}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copiar URL
                </Button>
              </div>

              <div className="bg-muted p-3 rounded-md">
                <p className="text-xs font-mono break-all">
                  {window.location.origin}/api/webhook/facebook/{webhook.webhookToken}
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <Label>Mapeamento de Form IDs</Label>
                  <Button
                    size="sm"
                    onClick={() => {
                      setSelectedWebhook(webhook.id);
                      setShowMappingDialog(true);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Mapeamento
                  </Button>
                </div>

                {Object.keys(currentMapping).length === 0 && webhook.id === selectedWebhook ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhum mapeamento configurado
                  </p>
                ) : webhook.formIdMapping && JSON.parse(webhook.formIdMapping) ? (
                  <div className="space-y-2">
                    {Object.entries(JSON.parse(webhook.formIdMapping) as Record<string, number>).map(
                      ([formId, projectId]) => {
                        const project = projects?.find((p) => p.id === projectId);
                        return (
                          <div
                            key={formId}
                            className="flex items-center justify-between p-3 bg-background border rounded-md"
                          >
                            <div>
                              <p className="font-medium">Form ID: {formId}</p>
                              <p className="text-sm text-muted-foreground">
                                → {project?.name || `Projeto #${projectId}`}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedWebhook(webhook.id);
                                handleRemoveMapping(formId);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        );
                      }
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Nenhum mapeamento configurado
                  </p>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={showMappingDialog} onOpenChange={setShowMappingDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Mapeamento</DialogTitle>
            <DialogDescription>
              Configure qual Form ID do Facebook corresponde a qual projeto
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="formId">Form ID do Facebook</Label>
              <Input
                id="formId"
                placeholder="Ex: 123456789012345"
                value={newFormId}
                onChange={(e) => setNewFormId(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Você encontra o Form ID no Facebook Business Manager
              </p>
            </div>

            <div>
              <Label htmlFor="projectId">Projeto Correspondente</Label>
              <Select value={newProjectId} onValueChange={setNewProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um projeto" />
                </SelectTrigger>
                <SelectContent>
                  {projects?.map((project) => (
                    <SelectItem key={project.id} value={project.id.toString()}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMappingDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddMapping} disabled={!newFormId || !newProjectId}>
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

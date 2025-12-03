import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Phone, Mail, Building2, Calendar, Plus, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const statusLabels: Record<string, string> = {
  novo: "Novo",
  aguardando_atendimento: "Aguardando Atendimento",
  em_atendimento: "Em Atendimento",
  agendado: "Agendado",
  visita_realizada: "Visita Realizada",
  analise_credito: "Análise de Crédito",
  contrato_fechado: "Contrato Fechado",
  perdido: "Perdido",
};

export default function Leads() {
  const { data: leads, isLoading, refetch } = trpc.leads.list.useQuery();
  const { data: projects } = trpc.projects.list.useQuery();
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [interactionDialog, setInteractionDialog] = useState(false);
  const updateLeadMutation = trpc.leads.update.useMutation();
  const addInteractionMutation = trpc.leads.addInteraction.useMutation();

  const [interactionForm, setInteractionForm] = useState({
    tipo: "whatsapp" as "ligacao" | "whatsapp" | "email" | "sms" | "visita" | "outro",
    resultado: "contato_realizado" as "contato_realizado" | "nao_atendeu" | "agendamento" | "visita_realizada" | "proposta_enviada" | "recusou" | "outro",
    observacoes: "",
  });

  const handleAddInteraction = async () => {
    if (!selectedLead) return;

    try {
      await addInteractionMutation.mutateAsync({
        leadId: selectedLead.id,
        ...interactionForm,
      });

      toast.success("Interação registrada com sucesso!");
      setInteractionDialog(false);
      setInteractionForm({
        tipo: "whatsapp",
        resultado: "contato_realizado",
        observacoes: "",
      });
      refetch();
    } catch (error) {
      toast.error("Erro ao registrar interação");
    }
  };

  const handleUpdateStatus = async (leadId: number, newStatus: string) => {
    try {
      await updateLeadMutation.mutateAsync({
        id: leadId,
        data: { status: newStatus as any },
      });

      toast.success("Status atualizado com sucesso!");
      refetch();
    } catch (error) {
      toast.error("Erro ao atualizar status");
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "contrato_fechado":
        return "default";
      case "perdido":
        return "destructive";
      case "novo":
      case "aguardando_atendimento":
        return "secondary";
      default:
        return "outline";
    }
  };

  return (
    <DashboardLayout>
      <div className="container py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Meus Leads</h1>
            <p className="text-muted-foreground mt-2">
              Gerencie seus contatos e acompanhe o funil de vendas
            </p>
          </div>
        </div>

        {/* Lista de leads */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Carregando leads...</p>
          </div>
        ) : leads && leads.length > 0 ? (
          <div className="grid gap-4">
            {leads.map((lead) => {
              const project = projects?.find(p => p.id === lead.projectId);
              
              return (
                <Card key={lead.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-xl">{lead.nome}</CardTitle>
                        <CardDescription className="mt-1">
                          {lead.origem && `Origem: ${lead.origem}`}
                        </CardDescription>
                      </div>
                      <Badge variant={getStatusVariant(lead.status)}>
                        {statusLabels[lead.status]}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <span>{lead.telefone}</span>
                        </div>
                        {lead.email && (
                          <div className="flex items-center gap-2 text-sm">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <span>{lead.email}</span>
                          </div>
                        )}
                        {project && (
                          <div className="flex items-center gap-2 text-sm">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            <span>{project.nome}</span>
                          </div>
                        )}
                        {lead.ultimoContato && (
                          <div className="flex items-center gap-2 text-sm">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span>
                              Último contato: {format(new Date(lead.ultimoContato), "dd/MM/yyyy", { locale: ptBR })}
                            </span>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex flex-col gap-2">
                        <Select
                          value={lead.status}
                          onValueChange={(value) => handleUpdateStatus(lead.id, value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(statusLabels).map(([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedLead(lead);
                            setInteractionDialog(true);
                          }}
                        >
                          <MessageSquare className="h-4 w-4 mr-2" />
                          Registrar Interação
                        </Button>
                      </div>
                    </div>
                    
                    {lead.observacoes && (
                      <div className="mt-4 pt-4 border-t">
                        <p className="text-sm text-muted-foreground">
                          <strong>Observações:</strong> {lead.observacoes}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <Phone className="h-20 w-20 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold mb-2">Nenhum lead encontrado</h3>
            <p className="text-muted-foreground">
              Aguarde a distribuição de novos leads pelo gestor
            </p>
          </div>
        )}

        {/* Dialog de interação */}
        <Dialog open={interactionDialog} onOpenChange={setInteractionDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar Interação</DialogTitle>
              <DialogDescription>
                Adicione um registro de contato com o lead {selectedLead?.nome}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="tipo">Tipo de Contato</Label>
                <Select
                  value={interactionForm.tipo}
                  onValueChange={(value: any) => setInteractionForm({ ...interactionForm, tipo: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="ligacao">Ligação</SelectItem>
                    <SelectItem value="email">E-mail</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                    <SelectItem value="visita">Visita</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="resultado">Resultado</Label>
                <Select
                  value={interactionForm.resultado}
                  onValueChange={(value: any) => setInteractionForm({ ...interactionForm, resultado: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contato_realizado">Contato Realizado</SelectItem>
                    <SelectItem value="nao_atendeu">Não Atendeu</SelectItem>
                    <SelectItem value="agendamento">Agendamento</SelectItem>
                    <SelectItem value="visita_realizada">Visita Realizada</SelectItem>
                    <SelectItem value="proposta_enviada">Proposta Enviada</SelectItem>
                    <SelectItem value="recusou">Recusou</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="observacoes">Observações</Label>
                <Textarea
                  id="observacoes"
                  value={interactionForm.observacoes}
                  onChange={(e) => setInteractionForm({ ...interactionForm, observacoes: e.target.value })}
                  rows={4}
                  placeholder="Descreva o que foi conversado..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setInteractionDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleAddInteraction} disabled={addInteractionMutation.isPending}>
                {addInteractionMutation.isPending ? "Salvando..." : "Salvar Interação"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

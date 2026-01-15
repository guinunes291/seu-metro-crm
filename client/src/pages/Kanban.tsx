import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Phone, Mail, GripVertical, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import LeadTimer from "@/components/LeadTimer";
import { TimerLead } from "@/components/TimerLead";

// Definição das colunas do Kanban baseadas nos status do lead
const KANBAN_COLUMNS = [
  { id: "novo", title: "Novos", color: "bg-blue-500" },
  { id: "aguardando_atendimento", title: "Aguardando", color: "bg-slate-500" },
  { id: "em_atendimento", title: "Em Atendimento", color: "bg-yellow-500" },
  { id: "agendado", title: "Agendado", color: "bg-cyan-500" },
  { id: "visita_realizada", title: "Visita Realizada", color: "bg-orange-500" },
  { id: "analise_credito", title: "Análise de Crédito", color: "bg-purple-500" },
  { id: "contrato_fechado", title: "Contrato Fechado", color: "bg-green-500" },
  { id: "perdido", title: "Perdidos", color: "bg-red-500" },
];

type Lead = {
  id: number;
  nome: string;
  telefone: string;
  email: string | null;
  status: string;
  origem: string | null;
  createdAt: Date;
  corretorId: number | null;
};

export default function Kanban() {
  const { user } = useAuth();
  
  // Buscar leads - corretor vê apenas seus leads, gestor vê todos
  // Kanban precisa de TODOS os leads sem paginação
  const { data, isLoading, refetch } = trpc.leads.list.useQuery({ limit: 9999 });
  const leads = data?.leads || [];
  
  // Mutation para atualizar status do lead
  const updateLead = trpc.leads.update.useMutation({
    onSuccess: () => {
      refetch(); // Recarrega todos os leads após atualização
    },
  });

  // Estado para drag and drop
  const [draggedLead, setDraggedLead] = useState<Lead | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  // Agrupar leads por status
  const leadsByStatus = KANBAN_COLUMNS.reduce((acc, column) => {
    acc[column.id] = leads.filter((lead: Lead) => lead.status === column.id);
    return acc;
  }, {} as Record<string, Lead[]>);

  // Handlers de drag and drop
  const handleDragStart = (e: React.DragEvent, lead: Lead) => {
    setDraggedLead(lead);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", lead.id.toString());
  };

  const handleDragEnd = () => {
    setDraggedLead(null);
    setDragOverColumn(null);
  };

  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverColumn(columnId);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    setDragOverColumn(null);

    if (draggedLead && draggedLead.status !== newStatus) {
      // Atualiza o status no banco de dados
      updateLead.mutate({
        id: draggedLead.id,
        data: {
          status: newStatus as "novo" | "aguardando_atendimento" | "em_atendimento" | "agendado" | "visita_realizada" | "analise_credito" | "contrato_fechado" | "perdido",
        }
      });
    }
    setDraggedLead(null);
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Kanban de Leads</h1>
          <p className="text-muted-foreground mt-1">
            Arraste os leads entre as colunas para atualizar o status
          </p>
        </div>

        {/* Kanban Board */}
        <div className="flex gap-4 overflow-x-auto pb-4">
          {KANBAN_COLUMNS.map((column) => (
            <div
              key={column.id}
              className={`flex-shrink-0 w-80 rounded-lg border bg-muted/30 transition-colors ${
                dragOverColumn === column.id ? "ring-2 ring-primary bg-primary/5" : ""
              }`}
              onDragOver={(e) => handleDragOver(e, column.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, column.id)}
            >
              {/* Column Header */}
              <div className="p-3 border-b flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${column.color}`} />
                  <h3 className="font-semibold">{column.title}</h3>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {leadsByStatus[column.id]?.length || 0}
                </Badge>
              </div>

              {/* Column Content */}
              <div className="p-2 space-y-2 min-h-[400px] max-h-[calc(100vh-300px)] overflow-y-auto">
                {leadsByStatus[column.id]?.map((lead: Lead) => (
                  <Card
                    key={lead.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, lead)}
                    onDragEnd={handleDragEnd}
                    className={`cursor-grab active:cursor-grabbing transition-all hover:shadow-md ${
                      draggedLead?.id === lead.id ? "opacity-50 scale-95" : ""
                    }`}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start gap-2">
                        <GripVertical className="h-4 w-4 text-muted-foreground mt-1 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{lead.nome}</p>
                          
                          {lead.telefone && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                              <Phone className="h-3 w-3" />
                              <span className="truncate">{lead.telefone}</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 w-5 p-0 ml-1 bg-green-50 hover:bg-green-100 text-green-700"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const phone = lead.telefone.replace(/\D/g, '');
                                  const formattedPhone = phone.startsWith('55') ? phone : `55${phone}`;
                                  window.open(`https://wa.me/${formattedPhone}`, '_blank');
                                }}
                              >
                                <MessageCircle className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                          
                          {lead.email && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                              <Mail className="h-3 w-3" />
                              <span className="truncate">{lead.email}</span>
                            </div>
                          )}
                          
                          {(user?.role === 'gestor' || user?.role === 'admin') && lead.corretorNome && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                              <span className="font-medium">Corretor:</span>
                              <span className="truncate">{lead.corretorNome}</span>
                            </div>
                          )}
                          
                          {lead.faixaRenda && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                              <span className="font-medium">Renda:</span>
                              <span className="truncate">{lead.faixaRenda}</span>
                            </div>
                          )}

                          <div className="flex items-center justify-between mt-2">
                            {lead.origem && (
                              <Badge variant="outline" className="text-xs">
                                {lead.origem}
                              </Badge>
                            )}
                            <div className="flex flex-col gap-1 items-end">
                              <LeadTimer createdAt={lead.createdAt} status={lead.status} compact showIcon />
                              {lead.origem?.includes('webhook') && (
                                <TimerLead 
                                  timestampRecebimento={lead.timestampRecebimento} 
                                  timerAtivo={lead.timerAtivo ?? false} 
                                />
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {/* Empty state */}
                {(!leadsByStatus[column.id] || leadsByStatus[column.id].length === 0) && (
                  <div className="flex items-center justify-center h-24 text-muted-foreground text-sm border-2 border-dashed rounded-lg">
                    Nenhum lead
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Loading indicator for status update */}
        {updateLead.isPending && (
          <div className="fixed bottom-4 right-4 bg-primary text-primary-foreground px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Atualizando status...</span>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

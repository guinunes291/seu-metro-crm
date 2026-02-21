import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Trash2, Phone, Mail, Calendar, User, Building, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

export default function Lixeira() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [page, setPage] = useState(1);
  const limit = 20;
  
  const { data, isLoading, refetch } = trpc.leads.getLixeira.useQuery({ page, limit });
  const { data: countData } = trpc.leads.countLixeira.useQuery();
  const { data: exportData } = trpc.leads.exportCSV.useQuery({ naLixeira: true });
  
  const totalPages = data ? Math.ceil(data.total / limit) : 1;
  
  const handleExportCSV = () => {
    if (!exportData || exportData.length === 0) {
      toast.error("Nenhum lead para exportar");
      return;
    }
    
    // Criar CSV
    const headers = [
      "ID", "Nome", "Email", "Telefone", "Origem", "Status", 
      "Motivo Perdido", "Corretor Anterior", "Projeto", 
      "Data Criação", "Data Movido para Lixeira"
    ];
    
    const rows = exportData.map(lead => [
      lead.id,
      lead.nome || "",
      lead.email || "",
      lead.telefone || "",
      lead.origem || "",
      lead.status || "",
      lead.motivoPerdido || "",
      lead.corretorNome || "",
      lead.projectNome || "",
      lead.createdAt ? format(new Date(lead.createdAt), "dd/MM/yyyy HH:mm") : "",
      lead.dataMovidoLixeira ? format(new Date(lead.dataMovidoLixeira), "dd/MM/yyyy HH:mm") : "",
    ]);
    
    const csvContent = [
      headers.join(";"),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(";"))
    ].join("\n");
    
    // Download
    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `leads_lixeira_${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    
    toast.success("CSV exportado com sucesso!");
  };
  
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Trash2 className="h-6 w-6 text-red-500" />
              Lixeira de Leads
            </h1>
            <p className="text-muted-foreground">
              Leads marcados como perdidos ficam aqui. Eles não são redistribuídos nem apagados.
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <Badge variant="secondary" className="text-lg px-4 py-2">
              {countData || 0} leads na lixeira
            </Badge>
            
            {isAdmin && (
              <Button 
                onClick={handleExportCSV}
                variant="outline"
                className="gap-2"
                disabled={!exportData || exportData.length === 0}
              >
                <Download className="h-4 w-4" />
                Exportar CSV
              </Button>
            )}
          </div>
        </div>
        
        {/* Lista de Leads */}
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : !data?.leads || data.leads.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Trash2 className="h-16 w-16 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-medium text-muted-foreground">Lixeira vazia</h3>
              <p className="text-sm text-muted-foreground">
                Nenhum lead foi marcado como perdido ainda.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-4">
              {data.leads.map((lead) => (
                <Card key={lead.id} className="border-l-4 border-l-red-500">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-lg">{lead.nome}</h3>
                          <Badge variant="destructive">Perdido</Badge>
                        </div>
                        
                        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                          {lead.telefone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-4 w-4" />
                              {lead.telefone}
                            </span>
                          )}
                          {lead.email && (
                            <span className="flex items-center gap-1">
                              <Mail className="h-4 w-4" />
                              {lead.email}
                            </span>
                          )}
                          {lead.corretorAnteriorNome && (
                            <span className="flex items-center gap-1">
                              <User className="h-4 w-4" />
                              Ex-corretor: {lead.corretorAnteriorNome}
                            </span>
                          )}
                          {lead.projectNome && (
                            <span className="flex items-center gap-1">
                              <Building className="h-4 w-4" />
                              {lead.projectNome}
                            </span>
                          )}
                        </div>
                        
                        {lead.motivoPerdido && (
                          <div className="bg-red-50 dark:bg-red-950/20 p-2 rounded text-sm">
                            <span className="font-medium text-red-600 dark:text-red-400">Motivo: </span>
                            {lead.motivoPerdido}
                          </div>
                        )}
                      </div>
                      
                      <div className="text-right text-sm text-muted-foreground">
                        {lead.dataMovidoLixeira && (
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {format(new Date(lead.dataMovidoLixeira), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </div>
                        )}
                        <div className="text-xs mt-1">
                          Criado em: {format(new Date(lead.createdAt), "dd/MM/yyyy", { locale: ptBR })}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            
            {/* Paginação */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Anterior
                </Button>
                
                <span className="text-sm text-muted-foreground">
                  Página {page} de {totalPages}
                </span>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Próxima
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

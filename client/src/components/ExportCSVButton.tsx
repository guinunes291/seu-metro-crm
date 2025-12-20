import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { format } from "date-fns";

interface ExportCSVButtonProps {
  status?: string;
  corretorId?: number;
  projectId?: number;
  naLixeira?: boolean;
  label?: string;
  variant?: "default" | "outline" | "ghost" | "link" | "destructive" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

export function ExportCSVButton({
  status,
  corretorId,
  projectId,
  naLixeira,
  label = "Exportar CSV",
  variant = "outline",
  size = "sm",
  className = "",
}: ExportCSVButtonProps) {
  const { data: exportData, isLoading, refetch } = trpc.leads.exportCSV.useQuery(
    { status, corretorId, projectId, naLixeira },
    { enabled: false } // Não buscar automaticamente
  );
  
  const handleExport = async () => {
    try {
      const result = await refetch();
      const data = result.data;
      
      if (!data || data.length === 0) {
        toast.error("Nenhum lead para exportar");
        return;
      }
      
      // Criar CSV
      const headers = [
        "ID", "Nome", "Email", "Telefone", "Origem", "Status", 
        "Observações", "Motivo Perdido", "Campanha", "Faixa de Renda",
        "Prefere Contato Por", "Corretor", "Projeto", 
        "Data Criação", "Última Atualização", "Data Distribuição", "Último Contato"
      ];
      
      const rows = data.map(lead => [
        lead.id,
        lead.nome || "",
        lead.email || "",
        lead.telefone || "",
        lead.origem || "",
        lead.status || "",
        lead.observacoes || "",
        lead.motivoPerdido || "",
        lead.campanha || "",
        lead.faixaRenda || "",
        lead.prefereContatoPor || "",
        lead.corretorNome || "",
        lead.projectNome || "",
        lead.createdAt ? format(new Date(lead.createdAt), "dd/MM/yyyy HH:mm") : "",
        lead.updatedAt ? format(new Date(lead.updatedAt), "dd/MM/yyyy HH:mm") : "",
        lead.dataDistribuicao ? format(new Date(lead.dataDistribuicao), "dd/MM/yyyy HH:mm") : "",
        lead.ultimoContato ? format(new Date(lead.ultimoContato), "dd/MM/yyyy HH:mm") : "",
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
      
      // Nome do arquivo baseado nos filtros
      let fileName = "leads";
      if (status) fileName += `_${status}`;
      if (naLixeira) fileName += "_lixeira";
      fileName += `_${format(new Date(), "yyyy-MM-dd")}`;
      
      link.download = `${fileName}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      
      toast.success(`${data.length} leads exportados com sucesso!`);
    } catch (error) {
      toast.error("Erro ao exportar leads");
      console.error(error);
    }
  };
  
  return (
    <Button
      onClick={handleExport}
      variant={variant}
      size={size}
      className={`gap-1 ${className}`}
      disabled={isLoading}
    >
      <Download className="h-3 w-3" />
      {size !== "icon" && (isLoading ? "Exportando..." : label)}
    </Button>
  );
}

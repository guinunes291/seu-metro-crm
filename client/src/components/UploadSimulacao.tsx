import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, FileText, Loader2, CheckCircle2, AlertCircle, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export interface DadosSimulacao {
  rendaFamiliar: number;
  dataNascimento: string;
  valorImovel: number;
  valorFinanciamento: number;
  prazoMeses: number;
  primeiraPrestacao: number;
  jurosEfetivos: string;
  valorEntrada: number;
  origemPdf: string; // "portal_crm" ou "simulador_caixa"
}

interface UploadSimulacaoProps {
  onDadosExtraidos: (dados: DadosSimulacao) => void;
}

export default function UploadSimulacao({ onDadosExtraidos }: UploadSimulacaoProps) {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "processing" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [dadosExtraidos, setDadosExtraidos] = useState<DadosSimulacao | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const extrairDados = trpc.propostas.extrairDadosPdf.useMutation({
    onSuccess: (data) => {
      setStatus("success");
      setDadosExtraidos(data);
      onDadosExtraidos(data);
      toast.success("Dados extraídos com sucesso!");
    },
    onError: (error) => {
      setStatus("error");
      setErrorMessage(error.message || "Erro ao extrair dados do PDF");
      toast.error("Erro ao extrair dados do PDF");
    }
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo de arquivo
    if (file.type !== "application/pdf") {
      toast.error("Por favor, selecione um arquivo PDF");
      return;
    }

    // Validar tamanho (máx 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("O arquivo deve ter no máximo 10MB");
      return;
    }

    setArquivo(file);
    setStatus("uploading");
    setErrorMessage("");
    setDadosExtraidos(null);

    try {
      // Converter para base64
      const base64 = await fileToBase64(file);
      
      setStatus("processing");
      
      // Enviar para extração
      extrairDados.mutate({ 
        pdfBase64: base64,
        nomeArquivo: file.name 
      });
    } catch (error) {
      setStatus("error");
      setErrorMessage("Erro ao processar o arquivo");
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // Remover o prefixo "data:application/pdf;base64,"
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
    });
  };

  const resetUpload = () => {
    setArquivo(null);
    setStatus("idle");
    setErrorMessage("");
    setDadosExtraidos(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        onChange={handleFileSelect}
        className="hidden"
      />

      {status === "idle" && (
        <Card 
          className="border-2 border-dashed border-slate-600 bg-slate-800/30 hover:border-amber-500/50 hover:bg-slate-800/50 transition-colors cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          <CardContent className="py-8 text-center">
            <Upload className="h-12 w-12 mx-auto text-slate-400 mb-4" />
            <h4 className="text-white font-medium mb-2">Upload do PDF de Simulação</h4>
            <p className="text-slate-400 text-sm mb-4">
              Arraste o PDF aqui ou clique para selecionar
            </p>
            <p className="text-slate-500 text-xs">
              Suporta: Portal CRM (Caixa) e Simulador Habitacional CAIXA
            </p>
          </CardContent>
        </Card>
      )}

      {(status === "uploading" || status === "processing") && (
        <Card className="border-slate-600 bg-slate-800/50">
          <CardContent className="py-8 text-center">
            <Loader2 className="h-12 w-12 mx-auto text-amber-500 animate-spin mb-4" />
            <h4 className="text-white font-medium mb-2">
              {status === "uploading" ? "Enviando arquivo..." : "Extraindo dados do PDF..."}
            </h4>
            <p className="text-slate-400 text-sm">
              {arquivo?.name}
            </p>
          </CardContent>
        </Card>
      )}

      {status === "error" && (
        <Card className="border-red-500/50 bg-red-500/10">
          <CardContent className="py-6">
            <div className="flex items-start gap-4">
              <AlertCircle className="h-6 w-6 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-red-400 font-medium mb-1">Erro ao processar PDF</h4>
                <p className="text-slate-400 text-sm">{errorMessage}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={resetUpload}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="mt-4 w-full border-slate-600 text-slate-300"
            >
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      )}

      {status === "success" && dadosExtraidos && (
        <Card className="border-green-500/50 bg-green-500/10">
          <CardContent className="py-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-6 w-6 text-green-400" />
                <div>
                  <h4 className="text-green-400 font-medium">Dados extraídos com sucesso!</h4>
                  <p className="text-slate-400 text-sm">
                    Origem: {dadosExtraidos.origemPdf === "portal_crm" ? "Portal CRM" : "Simulador CAIXA"}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={resetUpload}
                className="text-slate-400 hover:text-white"
              >
                Alterar PDF
              </Button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              <div className="p-3 bg-slate-800/50 rounded-lg">
                <p className="text-slate-400 text-xs mb-1">Renda Familiar</p>
                <p className="text-white font-medium">{formatCurrency(dadosExtraidos.rendaFamiliar)}</p>
              </div>
              <div className="p-3 bg-slate-800/50 rounded-lg">
                <p className="text-slate-400 text-xs mb-1">Valor do Imóvel</p>
                <p className="text-white font-medium">{formatCurrency(dadosExtraidos.valorImovel)}</p>
              </div>
              <div className="p-3 bg-slate-800/50 rounded-lg">
                <p className="text-slate-400 text-xs mb-1">Financiamento</p>
                <p className="text-green-400 font-medium">{formatCurrency(dadosExtraidos.valorFinanciamento)}</p>
              </div>
              <div className="p-3 bg-slate-800/50 rounded-lg">
                <p className="text-slate-400 text-xs mb-1">Prazo</p>
                <p className="text-white font-medium">{dadosExtraidos.prazoMeses} meses</p>
              </div>
              <div className="p-3 bg-slate-800/50 rounded-lg">
                <p className="text-slate-400 text-xs mb-1">1ª Prestação</p>
                <p className="text-amber-400 font-medium">{formatCurrency(dadosExtraidos.primeiraPrestacao)}</p>
              </div>
              <div className="p-3 bg-slate-800/50 rounded-lg">
                <p className="text-slate-400 text-xs mb-1">Juros Efetivos</p>
                <p className="text-white font-medium">{dadosExtraidos.jurosEfetivos}</p>
              </div>
              <div className="p-3 bg-slate-800/50 rounded-lg">
                <p className="text-slate-400 text-xs mb-1">Entrada</p>
                <p className="text-white font-medium">{formatCurrency(dadosExtraidos.valorEntrada)}</p>
              </div>
              <div className="p-3 bg-slate-800/50 rounded-lg">
                <p className="text-slate-400 text-xs mb-1">Data Nascimento</p>
                <p className="text-white font-medium">{dadosExtraidos.dataNascimento}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

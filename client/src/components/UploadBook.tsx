import { useState, useCallback } from "react";
import { FileText, Loader2, X, Check, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

export interface ImagemExtraida {
  url: string;
  descricao: string;
  tipo: "fachada" | "lazer" | "interior" | "planta" | "outro";
  selecionada: boolean;
}

interface UploadBookProps {
  onImagensExtraidas: (imagens: ImagemExtraida[]) => void;
  imagensSelecionadas?: ImagemExtraida[];
  maxImagens?: number;
}

export default function UploadBook({ 
  onImagensExtraidas, 
  imagensSelecionadas = [],
  maxImagens = 4 
}: UploadBookProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");
  const [imagensExtraidas, setImagensExtraidas] = useState<ImagemExtraida[]>(imagensSelecionadas);
  const [bookUrl, setBookUrl] = useState<string | null>(null);

  const uploadBookMutation = trpc.propostas.uploadBook.useMutation();
  const extrairImagensMutation = trpc.propostas.extrairImagensBook.useMutation();

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }, []);

  const processFile = async (file: File) => {
    // Validar tipo de arquivo
    if (file.type !== "application/pdf") {
      toast.error("Por favor, selecione um arquivo PDF");
      return;
    }

    // Validar tamanho (máximo 50MB)
    if (file.size > 50 * 1024 * 1024) {
      toast.error("O arquivo deve ter no máximo 50MB");
      return;
    }

    setIsProcessing(true);
    setProgress(10);
    setStatusMessage("Lendo arquivo...");

    try {
      // Converter arquivo para base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // Remover prefixo data:application/pdf;base64,
          const base64Data = result.includes('base64,') 
            ? result.split('base64,')[1] 
            : result;
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      setProgress(30);
      setStatusMessage("Enviando PDF...");

      // Upload do PDF via tRPC
      const uploadResult = await uploadBookMutation.mutateAsync({
        fileData: base64,
        fileName: file.name,
        contentType: file.type
      });

      setBookUrl(uploadResult.url);
      setProgress(50);
      setStatusMessage("Extraindo imagens do Book...");

      // Extrair imagens via LLM
      const extractResult = await extrairImagensMutation.mutateAsync({
        pdfUrl: uploadResult.url,
        maxImagens
      });

      setProgress(80);
      setStatusMessage("Analisando imagens...");

      // Marcar as primeiras imagens como selecionadas por padrão
      const imagensComSelecao = extractResult.imagens.map((img: any, idx: number) => ({
        ...img,
        selecionada: idx < maxImagens
      }));

      setImagensExtraidas(imagensComSelecao);
      onImagensExtraidas(imagensComSelecao);

      setProgress(100);
      setStatusMessage("Extração concluída!");
      toast.success(`${imagensComSelecao.length} imagens extraídas do Book!`);

    } catch (error: any) {
      console.error("Erro ao processar Book:", error);
      toast.error(error.message || "Erro ao processar o Book. Tente novamente.");
    } finally {
      setIsProcessing(false);
      setTimeout(() => {
        setProgress(0);
        setStatusMessage("");
      }, 2000);
    }
  };

  const toggleImagemSelecionada = (index: number) => {
    const selecionadasAtual = imagensExtraidas.filter(img => img.selecionada).length;
    const imagem = imagensExtraidas[index];
    
    if (!imagem.selecionada && selecionadasAtual >= maxImagens) {
      toast.warning(`Você pode selecionar no máximo ${maxImagens} imagens`);
      return;
    }

    const novasImagens = imagensExtraidas.map((img, idx) => 
      idx === index ? { ...img, selecionada: !img.selecionada } : img
    );
    
    setImagensExtraidas(novasImagens);
    onImagensExtraidas(novasImagens);
  };

  const selecionadasCount = imagensExtraidas.filter(img => img.selecionada).length;

  return (
    <div className="space-y-4">
      {/* Área de Upload */}
      {imagensExtraidas.length === 0 && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            relative border-2 border-dashed rounded-lg p-8 text-center transition-colors
            ${isDragging 
              ? "border-amber-500 bg-amber-500/10" 
              : "border-slate-600 hover:border-slate-500"
            }
            ${isProcessing ? "pointer-events-none opacity-50" : "cursor-pointer"}
          `}
        >
          <input
            type="file"
            accept=".pdf"
            onChange={handleFileSelect}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            disabled={isProcessing}
          />
          
          {isProcessing ? (
            <div className="space-y-4">
              <Loader2 className="h-12 w-12 mx-auto text-amber-500 animate-spin" />
              <p className="text-slate-300">{statusMessage}</p>
              <Progress value={progress} className="w-full max-w-xs mx-auto" />
            </div>
          ) : (
            <>
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-500/20 flex items-center justify-center">
                <FileText className="h-8 w-8 text-amber-500" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">
                Upload do Book do Projeto
              </h3>
              <p className="text-sm text-slate-400 mb-4">
                Arraste o PDF do Book ou clique para selecionar
              </p>
              <p className="text-xs text-slate-500">
                PDF até 50MB • Serão extraídas automaticamente {maxImagens} imagens de perspectiva
              </p>
            </>
          )}
        </div>
      )}

      {/* URL do Book */}
      {bookUrl && (
        <div className="flex items-center gap-2 p-3 bg-slate-700/50 rounded-lg">
          <FileText className="h-5 w-5 text-amber-500" />
          <span className="text-sm text-slate-300 flex-1 truncate">Book carregado</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.open(bookUrl, '_blank')}
            className="text-amber-500 hover:text-amber-400"
          >
            Ver PDF
          </Button>
        </div>
      )}

      {/* Grid de Imagens Extraídas */}
      {imagensExtraidas.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-white">
              Imagens Extraídas ({selecionadasCount}/{maxImagens} selecionadas)
            </h4>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setImagensExtraidas([]);
                setBookUrl(null);
                onImagensExtraidas([]);
              }}
              className="text-slate-400 hover:text-white border-slate-600"
            >
              <X className="h-4 w-4 mr-1" />
              Limpar
            </Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {imagensExtraidas.map((imagem, index) => (
              <Card 
                key={index}
                className={`
                  relative overflow-hidden cursor-pointer transition-all
                  ${imagem.selecionada 
                    ? "ring-2 ring-amber-500 bg-amber-500/10" 
                    : "bg-slate-700/50 hover:bg-slate-700"
                  }
                `}
                onClick={() => toggleImagemSelecionada(index)}
              >
                <CardContent className="p-0">
                  <div className="aspect-video relative">
                    <img 
                      src={imagem.url} 
                      alt={imagem.descricao}
                      className="w-full h-full object-cover"
                    />
                    
                    {/* Badge de seleção */}
                    <div className={`
                      absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center
                      ${imagem.selecionada 
                        ? "bg-amber-500 text-white" 
                        : "bg-slate-800/80 text-slate-400"
                      }
                    `}>
                      {imagem.selecionada ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <span className="text-xs">{index + 1}</span>
                      )}
                    </div>

                    {/* Badge de tipo */}
                    <div className="absolute bottom-2 left-2">
                      <span className={`
                        text-xs px-2 py-1 rounded-full
                        ${imagem.tipo === "fachada" ? "bg-blue-500/80" :
                          imagem.tipo === "lazer" ? "bg-green-500/80" :
                          imagem.tipo === "interior" ? "bg-purple-500/80" :
                          imagem.tipo === "planta" ? "bg-orange-500/80" :
                          "bg-slate-500/80"
                        } text-white
                      `}>
                        {imagem.tipo}
                      </span>
                    </div>
                  </div>
                  
                  <div className="p-2">
                    <p className="text-xs text-slate-300 line-clamp-2">
                      {imagem.descricao}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {selecionadasCount < maxImagens && (
            <div className="flex items-center gap-2 p-3 bg-amber-500/10 rounded-lg">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              <span className="text-sm text-amber-400">
                Selecione mais {maxImagens - selecionadasCount} imagem(ns) para a proposta
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

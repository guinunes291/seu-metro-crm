import { useState, useCallback } from "react";
import { FileText, Loader2, X, Check, AlertCircle, Image } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

export interface ImagemExtraida {
  url: string;
  descricao?: string;
  tipo: "fachada" | "lazer" | "planta" | "perspectiva" | "area_comum" | "outro";
  selecionada: boolean;
  pagina?: number;
  confianca?: number;
}

interface UploadBookProps {
  onImagensExtraidas: (imagens: ImagemExtraida[]) => void;
  onBookUrl?: (url: string) => void;
  imagensSelecionadas?: ImagemExtraida[];
  maxImagens?: number;
  projetoNome: string;
}

export default function UploadBook({ 
  onImagensExtraidas, 
  onBookUrl,
  imagensSelecionadas = [],
  maxImagens = 4,
  projetoNome
}: UploadBookProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");
  const [imagensExtraidas, setImagensExtraidas] = useState<ImagemExtraida[]>(imagensSelecionadas);
  const [bookUrl, setBookUrl] = useState<string | null>(null);

  // Usar o novo endpoint que processa e extrai imagens automaticamente
  const processarBookMutation = trpc.propostas.processarBook.useMutation();

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
  }, [projetoNome]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }, [projetoNome]);

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

      setProgress(20);
      setStatusMessage("Enviando PDF...");

      // Processar Book e extrair imagens via IA
      const result = await processarBookMutation.mutateAsync({
        fileData: base64,
        fileName: file.name,
        projetoNome: projetoNome || "Empreendimento"
      });

      setBookUrl(result.bookUrl);
      onBookUrl?.(result.bookUrl);

      setProgress(70);
      setStatusMessage("Processando imagens extraídas...");

      if (result.imagens && result.imagens.length > 0) {
        // Converter imagens para o formato do componente
        const imagensComSelecao: ImagemExtraida[] = result.imagens.map((img: any, idx: number) => ({
          url: img.url,
          descricao: img.descricao || `Página ${img.pagina}`,
          tipo: img.tipo,
          selecionada: idx < maxImagens,
          pagina: img.pagina,
          confianca: img.confianca
        }));

        setImagensExtraidas(imagensComSelecao);
        onImagensExtraidas(imagensComSelecao);

        setProgress(100);
        setStatusMessage("Extração concluída!");
        toast.success(`${imagensComSelecao.length} imagens extraídas do Book!`);
      } else {
        // Nenhuma imagem extraída, mas o Book foi salvo
        setProgress(100);
        setStatusMessage("Book salvo!");
        toast.info("Book salvo, mas nenhuma imagem foi identificada automaticamente.");
      }

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

  const getTipoBadgeColor = (tipo: string) => {
    switch (tipo) {
      case "fachada": return "bg-blue-500/80";
      case "lazer": return "bg-green-500/80";
      case "planta": return "bg-orange-500/80";
      case "perspectiva": return "bg-purple-500/80";
      case "area_comum": return "bg-teal-500/80";
      default: return "bg-slate-500/80";
    }
  };

  const getTipoLabel = (tipo: string) => {
    switch (tipo) {
      case "fachada": return "Fachada";
      case "lazer": return "Lazer";
      case "planta": return "Planta";
      case "perspectiva": return "Perspectiva";
      case "area_comum": return "Área Comum";
      default: return "Outro";
    }
  };

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
              <p className="text-xs text-slate-500">
                A IA está analisando as páginas do Book para identificar fachada, lazer, planta...
              </p>
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
              <div className="flex flex-wrap justify-center gap-2 mb-4">
                <span className="text-xs px-2 py-1 rounded-full bg-blue-500/20 text-blue-400">Fachada</span>
                <span className="text-xs px-2 py-1 rounded-full bg-green-500/20 text-green-400">Lazer</span>
                <span className="text-xs px-2 py-1 rounded-full bg-orange-500/20 text-orange-400">Planta</span>
                <span className="text-xs px-2 py-1 rounded-full bg-purple-500/20 text-purple-400">Perspectiva</span>
              </div>
              <p className="text-xs text-slate-500">
                PDF até 50MB • A IA extrairá automaticamente até {maxImagens} imagens relevantes
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
                onBookUrl?.("");
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
                  <div className="aspect-video relative bg-slate-800">
                    {/* Para PDFs, mostrar placeholder com ícone */}
                    {imagem.url.endsWith('.pdf') ? (
                      <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                        <Image className="h-8 w-8 mb-2" />
                        <span className="text-xs">Página {imagem.pagina}</span>
                      </div>
                    ) : (
                      <img 
                        src={imagem.url} 
                        alt={imagem.descricao || `Imagem ${index + 1}`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          // Se falhar ao carregar imagem, mostrar placeholder
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          target.parentElement?.classList.add('flex', 'items-center', 'justify-center');
                        }}
                      />
                    )}
                    
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
                        ${getTipoBadgeColor(imagem.tipo)} text-white
                      `}>
                        {getTipoLabel(imagem.tipo)}
                      </span>
                    </div>

                    {/* Badge de confiança */}
                    {imagem.confianca && (
                      <div className="absolute top-2 left-2">
                        <span className="text-xs px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-300">
                          {imagem.confianca}%
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <div className="p-2">
                    <p className="text-xs text-slate-300 line-clamp-2">
                      {imagem.descricao || `Página ${imagem.pagina}`}
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

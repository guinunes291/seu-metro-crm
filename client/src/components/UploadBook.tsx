import { useState, useCallback } from "react";
import { FileText, Loader2, X, Check, AlertCircle, Image, Upload } from "lucide-react";
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

// Tamanho máximo do chunk para upload (5MB)
const CHUNK_SIZE = 5 * 1024 * 1024;

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

  // Usar endpoints separados para upload e processamento
  const uploadBookMutation = trpc.propostas.uploadBookDireto.useMutation();
  const processarBookMutation = trpc.propostas.processarBookPorUrl.useMutation();

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

  // Função para converter ArrayBuffer para base64 em chunks menores
  const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    return btoa(binary);
  };

  const processFile = async (file: File) => {
    // Validar tipo de arquivo
    if (file.type !== "application/pdf") {
      toast.error("Por favor, selecione um arquivo PDF");
      return;
    }

    // Validar tamanho (máximo 50MB)
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error("O arquivo deve ter no máximo 50MB");
      return;
    }

    setIsProcessing(true);
    setProgress(5);
    setStatusMessage("Preparando upload...");

    try {
      // Para arquivos menores que 5MB, usar upload direto
      if (file.size <= CHUNK_SIZE) {
        await uploadSmallFile(file);
      } else {
        // Para arquivos maiores, usar upload em chunks
        await uploadLargeFile(file);
      }
    } catch (error: any) {
      console.error("Erro ao processar Book:", error);
      toast.error(error.message || "Erro ao processar o Book. Tente novamente.");
      setIsProcessing(false);
      setProgress(0);
      setStatusMessage("");
    }
  };

  // Upload de arquivos pequenos (< 5MB)
  const uploadSmallFile = async (file: File) => {
    setStatusMessage("Enviando arquivo...");
    setProgress(20);

    const arrayBuffer = await file.arrayBuffer();
    const base64 = arrayBufferToBase64(arrayBuffer);

    setProgress(40);
    setStatusMessage("Salvando no servidor...");

    // Upload direto
    const uploadResult = await uploadBookMutation.mutateAsync({
      fileData: base64,
      fileName: file.name,
      fileSize: file.size
    });

    setBookUrl(uploadResult.bookUrl);
    onBookUrl?.(uploadResult.bookUrl);

    setProgress(60);
    setStatusMessage("Extraindo páginas do PDF...");

    // Processar o PDF já salvo no S3
    await processUploadedBook(uploadResult.bookUrl);
  };

  // Upload de arquivos grandes em chunks
  const uploadLargeFile = async (file: File) => {
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const uploadId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    setStatusMessage(`Enviando arquivo (0/${totalChunks} partes)...`);
    
    // Enviar cada chunk
    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      const start = chunkIndex * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);
      
      const arrayBuffer = await chunk.arrayBuffer();
      const base64Chunk = arrayBufferToBase64(arrayBuffer);
      
      // Calcular progresso (0-50% para upload)
      const uploadProgress = Math.round(((chunkIndex + 1) / totalChunks) * 50);
      setProgress(uploadProgress);
      setStatusMessage(`Enviando arquivo (${chunkIndex + 1}/${totalChunks} partes)...`);
      
      // Enviar chunk
      const result = await uploadBookMutation.mutateAsync({
        fileData: base64Chunk,
        fileName: file.name,
        fileSize: file.size,
        chunkIndex,
        totalChunks,
        uploadId
      });
      
      // Se for o último chunk, teremos a URL do arquivo completo
      if (chunkIndex === totalChunks - 1 && result.bookUrl) {
        setBookUrl(result.bookUrl);
        onBookUrl?.(result.bookUrl);
        
        setProgress(60);
        setStatusMessage("Extraindo páginas do PDF...");
        
        // Processar o PDF já salvo no S3
        await processUploadedBook(result.bookUrl);
      }
    }
  };

  // Processar o Book já salvo no S3
  const processUploadedBook = async (bookUrl: string) => {
    try {
      setProgress(70);
      setStatusMessage("Analisando páginas do PDF...");

      const result = await processarBookMutation.mutateAsync({
        bookUrl,
        projetoNome: projetoNome || "Empreendimento"
      });

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
        toast.success(`${imagensComSelecao.length} páginas extraídas do Book!`);
      } else {
        // Nenhuma imagem extraída, mas o Book foi salvo
        setProgress(100);
        setStatusMessage("Book salvo!");
        toast.info("Book salvo. As páginas serão incluídas como referência no PDF.");
      }
    } catch (error: any) {
      console.error("Erro ao processar Book:", error);
      // Mesmo com erro no processamento, o Book foi salvo
      setProgress(100);
      setStatusMessage("Book salvo!");
      toast.warning("Book salvo, mas houve um erro ao extrair as páginas automaticamente.");
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
                {progress < 50 
                  ? "Enviando arquivo para o servidor..." 
                  : "Processando páginas do PDF..."}
              </p>
            </div>
          ) : (
            <>
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-500/20 flex items-center justify-center">
                <Upload className="h-8 w-8 text-amber-500" />
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
                PDF até 50MB • As primeiras {maxImagens} páginas serão extraídas automaticamente
              </p>
            </>
          )}
        </div>
      )}

      {/* URL do Book */}
      {bookUrl && (
        <div className="flex items-center gap-2 p-3 bg-slate-700/50 rounded-lg">
          <FileText className="h-5 w-5 text-amber-500" />
          <span className="text-sm text-slate-300 flex-1 truncate">Book carregado com sucesso</span>
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
              Páginas Extraídas ({selecionadasCount}/{maxImagens} selecionadas)
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
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                      <FileText className="h-8 w-8 mb-2" />
                      <span className="text-xs">Página {imagem.pagina}</span>
                    </div>
                    
                    {/* Badge de tipo */}
                    <div className={`absolute top-2 left-2 px-2 py-0.5 rounded text-xs text-white ${getTipoBadgeColor(imagem.tipo)}`}>
                      {getTipoLabel(imagem.tipo)}
                    </div>
                    
                    {/* Indicador de seleção */}
                    {imagem.selecionada && (
                      <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center">
                        <Check className="h-4 w-4 text-white" />
                      </div>
                    )}
                  </div>
                  
                  <div className="p-2">
                    <p className="text-xs text-slate-400 truncate">
                      {imagem.descricao || `Página ${imagem.pagina}`}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          
          <p className="text-xs text-slate-500 text-center">
            Clique nas páginas para selecionar quais serão incluídas na proposta
          </p>
        </div>
      )}
    </div>
  );
}

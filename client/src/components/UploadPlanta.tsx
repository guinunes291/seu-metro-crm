import { useState, useCallback } from "react";
import { Image, Loader2, X, ZoomIn, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

interface UploadPlantaProps {
  onPlantaUpload: (url: string) => void;
  plantaUrl?: string | null;
  label?: string;
}

export default function UploadPlanta({ 
  onPlantaUpload, 
  plantaUrl = null,
  label = "Planta da Unidade"
}: UploadPlantaProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [currentUrl, setCurrentUrl] = useState<string | null>(plantaUrl);
  const [showPreview, setShowPreview] = useState(false);
  const [rotation, setRotation] = useState(0);

  const uploadPlantaMutation = trpc.propostas.uploadPlanta.useMutation();

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
    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!validTypes.includes(file.type)) {
      toast.error("Por favor, selecione uma imagem (JPEG, PNG, WebP ou GIF)");
      return;
    }

    // Validar tamanho (máximo 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 10MB");
      return;
    }

    setIsUploading(true);

    try {
      // Converter arquivo para base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const base64Data = result.includes('base64,') 
            ? result.split('base64,')[1] 
            : result;
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // Upload via tRPC
      const result = await uploadPlantaMutation.mutateAsync({
        fileData: base64,
        fileName: file.name,
        contentType: file.type
      });

      setCurrentUrl(result.url);
      onPlantaUpload(result.url);
      setRotation(0);
      toast.success("Planta carregada com sucesso!");

    } catch (error: any) {
      console.error("Erro ao fazer upload:", error);
      toast.error(error.message || "Erro ao carregar a planta. Tente novamente.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = () => {
    setCurrentUrl(null);
    onPlantaUpload("");
    setRotation(0);
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  return (
    <div className="space-y-3">
      {label && <label className="text-sm font-medium text-white">{label}</label>}

      {!currentUrl ? (
        // Área de Upload
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            relative border-2 border-dashed rounded-lg p-6 text-center transition-colors
            ${isDragging 
              ? "border-amber-500 bg-amber-500/10" 
              : "border-slate-600 hover:border-slate-500"
            }
            ${isUploading ? "pointer-events-none opacity-50" : "cursor-pointer"}
          `}
        >
          <input
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            disabled={isUploading}
          />
          
          {isUploading ? (
            <div className="space-y-2">
              <Loader2 className="h-10 w-10 mx-auto text-amber-500 animate-spin" />
              <p className="text-sm text-slate-300">Carregando...</p>
            </div>
          ) : (
            <>
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-700 flex items-center justify-center">
                <Image className="h-6 w-6 text-slate-400" />
              </div>
              <p className="text-sm text-slate-300 mb-1">
                Arraste a imagem ou clique para selecionar
              </p>
              <p className="text-xs text-slate-500">
                JPEG, PNG, WebP ou GIF • Máx 10MB
              </p>
            </>
          )}
        </div>
      ) : (
        // Preview da Planta
        <div className="relative rounded-lg overflow-hidden bg-slate-700/50 border border-slate-600">
          <div className="aspect-[4/3] relative">
            <img 
              src={currentUrl} 
              alt="Planta da unidade"
              className="w-full h-full object-contain p-2"
              style={{ transform: `rotate(${rotation}deg)` }}
            />
          </div>
          
          {/* Controles */}
          <div className="absolute top-2 right-2 flex gap-1">
            <Button
              variant="secondary"
              size="icon"
              className="h-8 w-8 bg-slate-800/80 hover:bg-slate-700"
              onClick={handleRotate}
              title="Rotacionar"
            >
              <RotateCw className="h-4 w-4" />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              className="h-8 w-8 bg-slate-800/80 hover:bg-slate-700"
              onClick={() => setShowPreview(true)}
              title="Ampliar"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              className="h-8 w-8 bg-red-500/80 hover:bg-red-500"
              onClick={handleRemove}
              title="Remover"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Modal de Preview Ampliado */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl bg-slate-800 border-slate-600">
          <DialogHeader>
            <DialogTitle className="text-white">{label || "Planta da Unidade"}</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center">
            {currentUrl && (
              <img 
                src={currentUrl} 
                alt="Planta da unidade"
                className="max-h-[70vh] object-contain"
                style={{ transform: `rotate(${rotation}deg)` }}
              />
            )}
          </div>
          <div className="flex justify-center gap-2">
            <Button
              variant="outline"
              onClick={handleRotate}
              className="border-slate-600"
            >
              <RotateCw className="h-4 w-4 mr-2" />
              Rotacionar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

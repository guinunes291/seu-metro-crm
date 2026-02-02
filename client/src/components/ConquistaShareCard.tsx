import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Share2, Download, Instagram, Facebook, Twitter, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { type Conquista } from "../../../shared/conquistas";
import html2canvas from "html2canvas";

interface ConquistaShareCardProps {
  conquista: Conquista;
  userName: string;
  nivel: number;
  titulo: string;
}

export default function ConquistaShareCard({ conquista, userName, nivel, titulo }: ConquistaShareCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  const generateImage = async (): Promise<string | null> => {
    if (!cardRef.current) return null;
    
    setIsGenerating(true);
    try {
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: null,
        scale: 2,
        useCORS: true,
        allowTaint: true,
      });
      return canvas.toDataURL("image/png");
    } catch (error) {
      console.error("Erro ao gerar imagem:", error);
      toast.error("Erro ao gerar imagem");
      return null;
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = async () => {
    const dataUrl = await generateImage();
    if (!dataUrl) return;

    const link = document.createElement("a");
    link.download = `conquista-${conquista.id}-${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
    toast.success("Imagem baixada com sucesso!");
  };

  const handleCopyLink = () => {
    const shareText = `🏆 Acabei de desbloquear a conquista "${conquista.nome}" no CRM Seu Metro Quadrado! 🎉\n\n${conquista.descricao}\n\n📍 @seumetroquadrado.sp`;
    navigator.clipboard.writeText(shareText);
    setCopied(true);
    toast.success("Texto copiado para a área de transferência!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareInstagram = async () => {
    const dataUrl = await generateImage();
    if (!dataUrl) return;

    // Converter data URL para blob
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    const file = new File([blob], `conquista-${conquista.id}.png`, { type: "image/png" });

    if (navigator.share && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: `Conquista: ${conquista.nome}`,
          text: `🏆 Acabei de desbloquear a conquista "${conquista.nome}" no CRM Seu Metro Quadrado! 🎉 @seumetroquadrado.sp`,
        });
        toast.success("Compartilhado com sucesso!");
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          toast.error("Erro ao compartilhar");
        }
      }
    } else {
      // Fallback: baixar a imagem
      handleDownload();
      toast.info("Baixe a imagem e compartilhe manualmente no Instagram");
    }
  };

  const handleShareFacebook = () => {
    const shareText = encodeURIComponent(`🏆 Acabei de desbloquear a conquista "${conquista.nome}" no CRM Seu Metro Quadrado! 🎉 @seumetroquadrado.sp`);
    window.open(`https://www.facebook.com/sharer/sharer.php?quote=${shareText}`, "_blank");
  };

  const handleShareTwitter = () => {
    const shareText = encodeURIComponent(`🏆 Acabei de desbloquear a conquista "${conquista.nome}" no CRM @seumetroquadrado! 🎉\n\n${conquista.descricao}`);
    window.open(`https://twitter.com/intent/tweet?text=${shareText}`, "_blank");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-slate-400 hover:text-amber-400 hover:bg-amber-500/10"
          title="Compartilhar conquista"
        >
          <Share2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-white">Compartilhar Conquista</DialogTitle>
        </DialogHeader>
        
        {/* Card para compartilhamento - Layout Instagramável */}
        <div className="flex justify-center py-4">
          <div
            ref={cardRef}
            className="w-[350px] h-[350px] relative overflow-hidden rounded-2xl"
            style={{
              background: "linear-gradient(135deg, #1a365d 0%, #0f172a 50%, #1e3a5f 100%)",
            }}
          >
            {/* Padrão decorativo de fundo */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-0 right-0 w-40 h-40 bg-amber-500 rounded-full blur-3xl" />
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-cyan-500 rounded-full blur-3xl" />
            </div>

            {/* Conteúdo */}
            <div className="relative h-full flex flex-col items-center justify-between p-6 text-center">
              {/* Logo e Header */}
              <div className="flex items-center gap-2">
                <img 
                  src="https://files.manuscdn.com/user_upload_by_module/session_file/310419663032188321/nYdEnBpdRXDVWsgt.png" 
                  alt="Seu Metro Quadrado" 
                  className="h-8 w-8 object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
                <span className="text-amber-400 font-bold text-sm tracking-wide">
                  SEU METRO QUADRADO
                </span>
              </div>

              {/* Ícone da Conquista */}
              <div className="flex flex-col items-center gap-3">
                <div className="text-6xl animate-pulse">
                  {conquista.icone}
                </div>
                <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                  Conquista Desbloqueada
                </div>
              </div>

              {/* Nome e Descrição */}
              <div className="space-y-2">
                <h3 className="text-white font-bold text-xl leading-tight">
                  {conquista.nome}
                </h3>
                <p className="text-slate-300 text-sm leading-relaxed max-w-[280px]">
                  {conquista.descricao}
                </p>
              </div>

              {/* Pontos */}
              <div className="flex items-center gap-2">
                <div className="bg-amber-500/20 border border-amber-500/50 text-amber-400 px-3 py-1 rounded-full text-sm font-bold">
                  +{conquista.pontos} pts
                </div>
              </div>

              {/* Footer com @ */}
              <div className="flex items-center justify-between w-full">
                <div className="text-slate-400 text-xs">
                  <span className="text-white font-semibold">{userName}</span>
                  <span className="mx-1">•</span>
                  <span>Nível {nivel} - {titulo}</span>
                </div>
                <div className="text-amber-400 text-xs font-bold">
                  @seumetroquadrado.sp
                </div>
              </div>
            </div>

            {/* Borda decorativa */}
            <div className="absolute inset-0 rounded-2xl border-2 border-amber-500/30 pointer-events-none" />
          </div>
        </div>

        {/* Botões de compartilhamento */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            onClick={handleDownload}
            disabled={isGenerating}
            className="bg-slate-800 hover:bg-slate-700 text-white"
          >
            <Download className="h-4 w-4 mr-2" />
            {isGenerating ? "Gerando..." : "Baixar Imagem"}
          </Button>
          <Button
            onClick={handleCopyLink}
            className="bg-slate-800 hover:bg-slate-700 text-white"
          >
            {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
            {copied ? "Copiado!" : "Copiar Texto"}
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Button
            onClick={handleShareInstagram}
            disabled={isGenerating}
            className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
          >
            <Instagram className="h-4 w-4 mr-2" />
            Instagram
          </Button>
          <Button
            onClick={handleShareFacebook}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Facebook className="h-4 w-4 mr-2" />
            Facebook
          </Button>
          <Button
            onClick={handleShareTwitter}
            className="bg-sky-500 hover:bg-sky-600 text-white"
          >
            <Twitter className="h-4 w-4 mr-2" />
            Twitter
          </Button>
        </div>

        <p className="text-center text-slate-400 text-xs">
          Compartilhe suas conquistas e inspire outros corretores! 🚀
        </p>
      </DialogContent>
    </Dialog>
  );
}

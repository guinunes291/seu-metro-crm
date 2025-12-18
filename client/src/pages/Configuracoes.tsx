import { useState, useRef, useCallback } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Camera, Upload, X, ZoomIn, RotateCw, Check, Loader2 } from "lucide-react";
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

// Função para criar crop centralizado
function centerAspectCrop(
  mediaWidth: number,
  mediaHeight: number,
  aspect: number,
) {
  return centerCrop(
    makeAspectCrop(
      {
        unit: '%',
        width: 90,
      },
      aspect,
      mediaWidth,
      mediaHeight,
    ),
    mediaWidth,
    mediaHeight,
  );
}

// Função para gerar a imagem recortada
async function getCroppedImg(
  image: HTMLImageElement,
  crop: PixelCrop,
  scale = 1,
  rotate = 0,
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('No 2d context');
  }

  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  
  // Tamanho final da imagem (quadrada para avatar circular)
  const outputSize = 400;
  canvas.width = outputSize;
  canvas.height = outputSize;

  ctx.imageSmoothingQuality = 'high';

  const cropX = crop.x * scaleX;
  const cropY = crop.y * scaleY;
  const cropWidth = crop.width * scaleX;
  const cropHeight = crop.height * scaleY;

  // Aplicar rotação se necessário
  const rotateRads = rotate * Math.PI / 180;
  const centerX = outputSize / 2;
  const centerY = outputSize / 2;

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(rotateRads);
  ctx.scale(scale, scale);
  ctx.translate(-centerX, -centerY);

  ctx.drawImage(
    image,
    cropX,
    cropY,
    cropWidth,
    cropHeight,
    0,
    0,
    outputSize,
    outputSize,
  );

  ctx.restore();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Canvas is empty'));
        }
      },
      'image/jpeg',
      0.95,
    );
  });
}

export default function Configuracoes() {
  const { user, refresh: refetchUser } = useAuth();
  const updateStatusMutation = trpc.corretores.updateStatus.useMutation();
  const uploadFotoMutation = trpc.foto.upload.useMutation();
  const utils = trpc.useUtils();

  const isCorretor = user?.role === "corretor";
  const isPresente = user?.status === "presente";

  // Estados para o cropper
  const [showCropDialog, setShowCropDialog] = useState(false);
  const [imgSrc, setImgSrc] = useState('');
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [scale, setScale] = useState(1);
  const [rotate, setRotate] = useState(0);
  const [uploading, setUploading] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleToggleStatus = async () => {
    if (!isCorretor) return;

    try {
      const newStatus = isPresente ? "ausente" : "presente";
      await updateStatusMutation.mutateAsync({ status: newStatus });
      
      toast.success(`Status alterado para ${newStatus === "presente" ? "Presente" : "Ausente"}`);
      
      // Invalidar cache para atualizar o status
      utils.auth.me.invalidate();
    } catch (error) {
      toast.error("Erro ao alterar status");
    }
  };

  // Selecionar arquivo
  const onSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      
      // Validar tipo
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        toast.error('Tipo de arquivo não permitido. Use JPEG, PNG, GIF ou WebP.');
        return;
      }
      
      // Validar tamanho (10MB para o original, será comprimido após crop)
      if (file.size > 10 * 1024 * 1024) {
        toast.error('Arquivo muito grande. Máximo permitido: 10MB.');
        return;
      }

      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setImgSrc(reader.result?.toString() || '');
        setShowCropDialog(true);
        setScale(1);
        setRotate(0);
      });
      reader.readAsDataURL(file);
    }
    
    // Limpar input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Quando a imagem carrega
  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    setCrop(centerAspectCrop(width, height, 1)); // Aspect ratio 1:1 para círculo
  }, []);

  // Salvar imagem recortada
  const handleSaveCrop = async () => {
    if (!imgRef.current || !completedCrop) {
      toast.error('Por favor, selecione uma área para recortar');
      return;
    }

    setUploading(true);

    try {
      const croppedBlob = await getCroppedImg(
        imgRef.current,
        completedCrop,
        scale,
        rotate,
      );

      // Converter blob para base64
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64 = reader.result as string;
          
          await uploadFotoMutation.mutateAsync({
            fileData: base64,
            fileName: `foto-perfil-${Date.now()}.jpg`,
            contentType: 'image/jpeg',
          });

          toast.success('Foto de perfil atualizada com sucesso!');
          setShowCropDialog(false);
          setImgSrc('');
          
          // Atualizar dados do usuário
          refetchUser?.();
          utils.ranking.getCompleto.invalidate();
        } catch (error: any) {
          toast.error(error.message || 'Erro ao fazer upload da foto');
        } finally {
          setUploading(false);
        }
      };
      reader.readAsDataURL(croppedBlob);
    } catch (error) {
      toast.error('Erro ao processar a imagem');
      setUploading(false);
    }
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <DashboardLayout>
      <div className="container py-8 max-w-2xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
          <p className="text-muted-foreground mt-2">
            Gerencie suas preferências e configurações
          </p>
        </div>

        {/* Foto de Perfil */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Foto de Perfil</CardTitle>
            <CardDescription>
              Sua foto será exibida no pódio de ranking e em outras áreas do sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row items-center gap-6">
              {/* Avatar atual */}
              <div className="relative group">
                <Avatar className="w-32 h-32 ring-4 ring-primary/20">
                  <AvatarImage 
                    src={user?.fotoUrl || undefined} 
                    alt={user?.name || 'Usuário'}
                    className="object-cover"
                  />
                  <AvatarFallback className="text-3xl font-bold bg-gradient-to-br from-primary/20 to-primary/40">
                    {getInitials(user?.name)}
                  </AvatarFallback>
                </Avatar>
                
                {/* Overlay de hover */}
                <div 
                  className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Camera className="h-8 w-8 text-white" />
                </div>
              </div>

              {/* Informações e botão */}
              <div className="flex-1 text-center sm:text-left">
                <h3 className="font-semibold text-lg mb-2">
                  {user?.fotoUrl ? 'Alterar foto' : 'Adicionar foto'}
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Escolha uma foto quadrada para melhor visualização no pódio. 
                  Formatos aceitos: JPEG, PNG, GIF ou WebP. Tamanho máximo: 10MB.
                </p>
                <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                  <Button 
                    onClick={() => fileInputRef.current?.click()}
                    className="gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    Escolher Foto
                  </Button>
                  {user?.fotoUrl && (
                    <Button 
                      variant="outline"
                      onClick={async () => {
                        try {
                          await uploadFotoMutation.mutateAsync({
                            fileData: '',
                            fileName: 'remove',
                            contentType: 'image/jpeg',
                          });
                          toast.success('Foto removida');
                          refetchUser?.();
                        } catch {
                          // Se der erro ao remover, tentar atualizar com URL vazia
                          toast.info('Foto será removida');
                        }
                      }}
                      className="gap-2 text-destructive hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                      Remover
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Input de arquivo oculto */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              onChange={onSelectFile}
              className="hidden"
            />
          </CardContent>
        </Card>

        {/* Perfil */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Perfil</CardTitle>
            <CardDescription>Informações da sua conta</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-sm text-muted-foreground">Nome</Label>
              <p className="text-base font-medium">{user?.name || "Não informado"}</p>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">E-mail</Label>
              <p className="text-base font-medium">{user?.email || "Não informado"}</p>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Função</Label>
              <div className="mt-1">
                <Badge>
                  {user?.role === "gestor" ? "Gestor" : user?.role === "admin" ? "Administrador" : "Corretor"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Status de plantão (apenas para corretores) */}
        {isCorretor && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Status de Plantão</CardTitle>
              <CardDescription>
                Controle se você está disponível para receber novos leads
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="status-plantao">Disponível para Receber Leads</Label>
                  <p className="text-sm text-muted-foreground">
                    Quando ativado, você receberá novos leads automaticamente
                  </p>
                </div>
                <Switch
                  id="status-plantao"
                  checked={isPresente}
                  onCheckedChange={handleToggleStatus}
                  disabled={updateStatusMutation.isPending}
                />
              </div>
              <div className="mt-4 p-3 bg-muted rounded-lg">
                <p className="text-sm">
                  Status atual: <strong>{isPresente ? "Presente" : "Ausente"}</strong>
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Sobre */}
        <Card>
          <CardHeader>
            <CardTitle>Sobre o Sistema</CardTitle>
            <CardDescription>Informações do CRM</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm">
              <strong>Sistema:</strong> Seu Metro Quadrado - CRM Imobiliário
            </p>
            <p className="text-sm">
              <strong>Versão:</strong> 1.0.0
            </p>
            <p className="text-sm text-muted-foreground">
              Plataforma completa de gestão de leads e vendas para imobiliárias
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Dialog de Crop */}
      <Dialog open={showCropDialog} onOpenChange={setShowCropDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Ajustar Foto de Perfil</DialogTitle>
            <DialogDescription>
              Arraste para posicionar e ajuste o zoom para enquadrar sua foto
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Área de crop */}
            <div className="flex justify-center bg-muted/50 rounded-lg p-4 min-h-[300px]">
              {imgSrc && (
                <ReactCrop
                  crop={crop}
                  onChange={(_, percentCrop) => setCrop(percentCrop)}
                  onComplete={(c) => setCompletedCrop(c)}
                  aspect={1}
                  circularCrop
                  className="max-h-[400px]"
                >
                  <img
                    ref={imgRef}
                    alt="Crop"
                    src={imgSrc}
                    style={{ 
                      transform: `scale(${scale}) rotate(${rotate}deg)`,
                      maxHeight: '400px',
                    }}
                    onLoad={onImageLoad}
                  />
                </ReactCrop>
              )}
            </div>

            {/* Controles */}
            <div className="space-y-4">
              {/* Zoom */}
              <div className="flex items-center gap-4">
                <ZoomIn className="h-4 w-4 text-muted-foreground" />
                <Label className="w-16 text-sm">Zoom</Label>
                <Slider
                  value={[scale]}
                  onValueChange={(value) => setScale(value[0])}
                  min={0.5}
                  max={3}
                  step={0.1}
                  className="flex-1"
                />
                <span className="w-12 text-sm text-muted-foreground text-right">
                  {Math.round(scale * 100)}%
                </span>
              </div>

              {/* Rotação */}
              <div className="flex items-center gap-4">
                <RotateCw className="h-4 w-4 text-muted-foreground" />
                <Label className="w-16 text-sm">Rotação</Label>
                <Slider
                  value={[rotate]}
                  onValueChange={(value) => setRotate(value[0])}
                  min={-180}
                  max={180}
                  step={1}
                  className="flex-1"
                />
                <span className="w-12 text-sm text-muted-foreground text-right">
                  {rotate}°
                </span>
              </div>
            </div>

            {/* Preview circular */}
            {completedCrop && imgRef.current && (
              <div className="flex items-center justify-center gap-4 p-4 bg-muted/30 rounded-lg">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-2">Preview no Pódio</p>
                  <div className="w-20 h-20 rounded-full overflow-hidden ring-4 ring-yellow-400 ring-offset-2 mx-auto bg-muted">
                    {/* O preview real será mostrado após o crop */}
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowCropDialog(false);
                setImgSrc('');
              }}
              disabled={uploading}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveCrop}
              disabled={uploading || !completedCrop}
              className="gap-2"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Salvar Foto
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

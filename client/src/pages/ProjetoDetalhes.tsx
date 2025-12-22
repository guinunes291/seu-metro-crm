import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, MapPin, Building2, Home, Car, ExternalLink, Pencil, Trash2, FileText, Upload, Loader2 } from "lucide-react";
import { MapView } from "@/components/Map";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";

export default function ProjetoDetalhes() {
  const { user } = useAuth();
  const [, params] = useRoute("/projetos/:id");
  const [, setLocation] = useLocation();
  const projectId = params?.id ? parseInt(params.id) : 0;
  
  const { data: projects = [], isLoading, refetch } = trpc.projects.list.useQuery();
  const project = projects.find((p) => p.id === projectId);
  
  const updateProjectMutation = trpc.projects.update.useMutation();
  const deleteProjectMutation = trpc.projects.delete.useMutation();
  
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [uploadingBook, setUploadingBook] = useState(false);
  const uploadBookMutation = trpc.projects.uploadBook.useMutation();
  const [formData, setFormData] = useState({
    nome: "",
    construtora: "",
    endereco: "",
    bairro: "",
    cidade: "São Paulo",
    estado: "SP",
    descricao: "",
    tipo: "mcmv" as "mcmv" | "sfh" | "outro",
    status: "ativo" as "ativo" | "inativo" | "esgotado",
    valorMinimo: "",
    valorMaximo: "",
    metragemMinima: "",
    metragemMaxima: "",
    dormitorios: "",
    vagas: 0,
    zona: undefined as "norte" | "sul" | "leste" | "oeste" | "centro" | undefined,
    enquadramento: undefined as "HIS1" | "HIS2" | "HMP" | "R2V" | undefined,
    developer: "",
  });

  const isGestor = user?.role === "gestor" || user?.role === "admin";

  const handleEdit = () => {
    if (!project) return;
    
    setFormData({
      nome: project.nome,
      construtora: project.construtora || "",
      endereco: project.endereco || "",
      bairro: project.bairro || "",
      cidade: project.cidade || "São Paulo",
      estado: project.estado || "SP",
      descricao: project.descricao || "",
      tipo: project.tipo || "mcmv",
      status: project.status || "ativo",
      valorMinimo: project.valorMinimo ? (project.valorMinimo / 100).toString() : "",
      valorMaximo: project.valorMaximo ? (project.valorMaximo / 100).toString() : "",
      metragemMinima: project.metragemMinima?.toString() || "",
      metragemMaxima: project.metragemMaxima?.toString() || "",
      dormitorios: project.dormitorios || "",
      vagas: project.vagas || 0,
      zona: project.zona || undefined,
      enquadramento: project.enquadramento || undefined,
      developer: project.developer || "",
    });
    setEditDialogOpen(true);
  };

  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      await updateProjectMutation.mutateAsync({
        id: projectId,
        data: {
          ...formData,
          valorMinimo: formData.valorMinimo ? parseInt(formData.valorMinimo) * 100 : undefined,
          valorMaximo: formData.valorMaximo ? parseInt(formData.valorMaximo) * 100 : undefined,
          metragemMinima: formData.metragemMinima ? parseInt(formData.metragemMinima) : undefined,
          metragemMaxima: formData.metragemMaxima ? parseInt(formData.metragemMaxima) : undefined,
        },
      });
      
      toast.success("Projeto atualizado com sucesso!");
      setEditDialogOpen(false);
      refetch();
    } catch (error) {
      toast.error("Erro ao atualizar projeto");
    }
  };

  const handleDelete = async () => {
    try {
      await deleteProjectMutation.mutateAsync({ id: projectId });
      toast.success("Projeto excluído com sucesso!");
      setDeleteDialogOpen(false);
      setLocation("/projetos");
    } catch (error) {
      toast.error("Erro ao excluir projeto");
    }
  };

  const handleMapReady = (map: google.maps.Map) => {
    if (!project?.endereco) return;
    
    const geocoder = new google.maps.Geocoder();
    const fullAddress = `${project.endereco}, ${project.bairro || ''}, ${project.cidade || 'São Paulo'}, ${project.estado || 'SP'}`;
    
    geocoder.geocode({ address: fullAddress }, (results, status) => {
      if (status === "OK" && results && results[0]) {
        const location = results[0].geometry.location;
        map.setCenter(location);
        map.setZoom(16);
        
        new google.maps.Marker({
          position: location,
          map: map,
          title: project.nome,
        });
      }
    });
  };

  const handleUploadBook = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.type !== 'application/pdf') {
      toast.error('Por favor, selecione um arquivo PDF');
      return;
    }
    
    if (file.size > 10 * 1024 * 1024) {
      toast.error('O arquivo deve ter no máximo 10MB');
      return;
    }
    
    setUploadingBook(true);
    
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        
        await uploadBookMutation.mutateAsync({
          projectId,
          fileName: file.name,
          fileData: base64,
        });
        
        toast.success('Book do projeto enviado com sucesso!');
        refetch();
      };
      reader.readAsDataURL(file);
    } catch (error) {
      toast.error('Erro ao enviar o book');
    } finally {
      setUploadingBook(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Building2 className="h-12 w-12 animate-pulse mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Carregando projeto...</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-16 w-16 text-muted-foreground mb-4" />
            <p className="text-lg font-semibold mb-2">Projeto não encontrado</p>
            <Button onClick={() => setLocation("/projetos")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar para Projetos
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const fullAddress = `${project.endereco || ''}, ${project.bairro || ''}, ${project.cidade || 'São Paulo'}, ${project.estado || 'SP'}`;
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`;

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <Button variant="ghost" onClick={() => setLocation("/projetos")} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para Projetos
          </Button>
          
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2">{project.nome}</h1>
              {project.construtora && (
                <p className="text-lg text-muted-foreground">{project.construtora}</p>
              )}
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant={project.status === "ativo" ? "default" : project.status === "esgotado" ? "destructive" : "secondary"} className="text-sm">
                  {project.status}
                </Badge>
                
                {project.zona && (
                  <Badge variant="outline" className="text-sm">
                    Zona {project.zona.charAt(0).toUpperCase() + project.zona.slice(1)}
                  </Badge>
                )}
                
                {project.enquadramento && (
                  <Badge variant="outline" className="text-sm">{project.enquadramento}</Badge>
                )}
              </div>
              
              {isGestor && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleEdit}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Editar
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => setDeleteDialogOpen(true)}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Excluir
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Coluna Principal */}
          <div className="lg:col-span-2 space-y-6">
            {/* Imagem Principal */}
            <Card>
              <div 
                className="h-96 bg-gradient-to-br from-blue-500 to-purple-600 rounded-t-lg"
                style={{
                  backgroundImage: project.imagemPrincipal ? `url(${project.imagemPrincipal})` : undefined,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              />
            </Card>

            {/* Descrição */}
            {project.descricao && (
              <Card>
                <CardHeader>
                  <CardTitle>Sobre o Empreendimento</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground whitespace-pre-wrap">{project.descricao}</p>
                </CardContent>
              </Card>
            )}

            {/* Mapa */}
            {project.endereco && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Localização</CardTitle>
                    <Button variant="outline" size="sm" asChild>
                      <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer">
                        Ver no Google Maps
                        <ExternalLink className="ml-2 h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                  <CardDescription className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>{fullAddress}</span>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-96 rounded-lg overflow-hidden">
                    <MapView onMapReady={handleMapReady} />
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Coluna Lateral - Informações */}
          <div className="space-y-6">
            {/* Valores */}
            {(project.valorMinimo || project.valorMaximo) && (
              <Card>
                <CardHeader>
                  <CardTitle>Valores</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {project.valorMinimo && (
                      <div>
                        <p className="text-sm text-muted-foreground">A partir de</p>
                        <p className="text-2xl font-bold text-primary">
                          R$ {(project.valorMinimo / 100).toLocaleString('pt-BR')}
                        </p>
                      </div>
                    )}
                    {project.valorMaximo && project.valorMinimo !== project.valorMaximo && (
                      <div>
                        <p className="text-sm text-muted-foreground">Até</p>
                        <p className="text-2xl font-bold text-primary">
                          R$ {(project.valorMaximo / 100).toLocaleString('pt-BR')}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Características */}
            <Card>
              <CardHeader>
                <CardTitle>Características</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {project.dormitorios && (
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Home className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Dormitórios</p>
                        <p className="font-semibold">{project.dormitorios}</p>
                      </div>
                    </div>
                  )}
                  
                  {project.vagas !== null && project.vagas !== undefined && (
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Car className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Vagas</p>
                        <p className="font-semibold">
                          {project.vagas === 0 ? "Sem vaga" : `${project.vagas} vaga${project.vagas > 1 ? 's' : ''}`}
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {(project.metragemMinima || project.metragemMaxima) && (
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Metragem</p>
                        <p className="font-semibold">
                          {project.metragemMinima && project.metragemMaxima
                            ? `${project.metragemMinima}m² - ${project.metragemMaxima}m²`
                            : project.metragemMinima
                            ? `A partir de ${project.metragemMinima}m²`
                            : `Até ${project.metragemMaxima}m²`}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Informações Adicionais */}
            <Card>
              <CardHeader>
                <CardTitle>Informações Adicionais</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {project.developer && (
                    <div>
                      <p className="text-sm text-muted-foreground">Incorporadora</p>
                      <p className="font-semibold">{project.developer}</p>
                    </div>
                  )}
                  
                  {project.tipo && (
                    <div>
                      <p className="text-sm text-muted-foreground">Tipo</p>
                      <p className="font-semibold uppercase">{project.tipo}</p>
                    </div>
                  )}
                  
                  {project.bairro && (
                    <div>
                      <p className="text-sm text-muted-foreground">Bairro</p>
                      <p className="font-semibold">{project.bairro}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Book do Projeto */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Book do Projeto
                </CardTitle>
                <CardDescription>
                  Material de apresentação em PDF
                </CardDescription>
              </CardHeader>
              <CardContent>
                {project.bookUrl ? (
                  <div className="space-y-3">
                    <Button asChild className="w-full">
                      <a href={project.bookUrl} target="_blank" rel="noopener noreferrer">
                        <FileText className="h-4 w-4 mr-2" />
                        Visualizar Book
                        <ExternalLink className="h-4 w-4 ml-2" />
                      </a>
                    </Button>
                    
                    <div className="relative">
                      <input
                        type="file"
                        accept=".pdf"
                        onChange={handleUploadBook}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        disabled={uploadingBook}
                      />
                      <Button variant="outline" className="w-full" disabled={uploadingBook}>
                        {uploadingBook ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Enviando...
                          </>
                        ) : (
                          <>
                            <Upload className="h-4 w-4 mr-2" />
                            Atualizar Book
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <FileText className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground mb-3">
                      Nenhum book cadastrado
                    </p>
                    
                    <div className="relative">
                      <input
                        type="file"
                        accept=".pdf"
                        onChange={handleUploadBook}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        disabled={uploadingBook}
                      />
                      <Button variant="outline" className="w-full" disabled={uploadingBook}>
                        {uploadingBook ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Enviando...
                          </>
                        ) : (
                          <>
                            <Upload className="h-4 w-4 mr-2" />
                            Enviar Book (PDF)
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Dialog de Edição */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Projeto</DialogTitle>
            <DialogDescription>
              Atualize as informações do empreendimento
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmitEdit} className="space-y-4">
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="nome">Nome do Projeto *</Label>
                <Input
                  id="nome"
                  required
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="construtora">Construtora</Label>
                  <Input
                    id="construtora"
                    value={formData.construtora}
                    onChange={(e) => setFormData({ ...formData, construtora: e.target.value })}
                  />
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="developer">Incorporadora</Label>
                  <Input
                    id="developer"
                    value={formData.developer}
                    onChange={(e) => setFormData({ ...formData, developer: e.target.value })}
                  />
                </div>
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="endereco">Endereço</Label>
                <Input
                  id="endereco"
                  value={formData.endereco}
                  onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                />
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="bairro">Bairro</Label>
                  <Input
                    id="bairro"
                    value={formData.bairro}
                    onChange={(e) => setFormData({ ...formData, bairro: e.target.value })}
                  />
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="zona">Zona</Label>
                  <select
                    id="zona"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                    value={formData.zona || ""}
                    onChange={(e) => setFormData({ ...formData, zona: e.target.value as any })}
                  >
                    <option value="">Selecione...</option>
                    <option value="norte">Zona Norte</option>
                    <option value="sul">Zona Sul</option>
                    <option value="leste">Zona Leste</option>
                    <option value="oeste">Zona Oeste</option>
                    <option value="centro">Centro</option>
                  </select>
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="enquadramento">Enquadramento</Label>
                  <select
                    id="enquadramento"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                    value={formData.enquadramento || ""}
                    onChange={(e) => setFormData({ ...formData, enquadramento: e.target.value as any })}
                  >
                    <option value="">Selecione...</option>
                    <option value="HIS1">HIS1</option>
                    <option value="HIS2">HIS2</option>
                    <option value="HMP">HMP</option>
                    <option value="R2V">R2V</option>
                  </select>
                </div>
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="descricao">Descrição</Label>
                <textarea
                  id="descricao"
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                  value={formData.descricao}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="valorMinimo">Valor Mínimo (R$)</Label>
                  <Input
                    id="valorMinimo"
                    type="number"
                    value={formData.valorMinimo}
                    onChange={(e) => setFormData({ ...formData, valorMinimo: e.target.value })}
                  />
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="valorMaximo">Valor Máximo (R$)</Label>
                  <Input
                    id="valorMaximo"
                    type="number"
                    value={formData.valorMaximo}
                    onChange={(e) => setFormData({ ...formData, valorMaximo: e.target.value })}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="dormitorios">Dormitórios</Label>
                  <Input
                    id="dormitorios"
                    placeholder="Ex: 1, 2, 3"
                    value={formData.dormitorios}
                    onChange={(e) => setFormData({ ...formData, dormitorios: e.target.value })}
                  />
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="vagas">Vagas</Label>
                  <Input
                    id="vagas"
                    type="number"
                    value={formData.vagas}
                    onChange={(e) => setFormData({ ...formData, vagas: parseInt(e.target.value) || 0 })}
                  />
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="status">Status</Label>
                  <select
                    id="status"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  >
                    <option value="ativo">Ativo</option>
                    <option value="inativo">Inativo</option>
                    <option value="esgotado">Esgotado</option>
                  </select>
                </div>
              </div>
            </div>
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">Salvar Alterações</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog de Confirmação de Exclusão */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir o projeto "{project.nome}"? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Excluir Projeto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

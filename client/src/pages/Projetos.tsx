import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Building2, MapPin, Plus, Search, Filter, Check, X, Lightbulb, FileText, Upload, Clock, CheckCircle, XCircle, Map as MapIcon, List, Pencil, Trash2, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { lazy, Suspense } from "react";
const ProjetosMapView = lazy(() => import("./ProjetosMapView"));
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { useCompare } from "@/contexts/CompareContext";
import CompareBar from "@/components/CompareBar";
import { useLocation } from "wouter";

export default function Projetos() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { data: projects = [], isLoading, refetch } = trpc.projects.list.useQuery();
  const { data: construtorasComProjetos = [] } = trpc.construtoras.listWithProjects.useQuery();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [suggestDialogOpen, setSuggestDialogOpen] = useState(false);
  const createProjectMutation = trpc.projects.create.useMutation();
  const updateProjectMutation = trpc.projects.update.useMutation();
  const deleteProjectMutation = trpc.projects.delete.useMutation();
  const suggestProjectMutation = trpc.projects.suggest.useMutation();

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<any>(null);
  const [editFormData, setEditFormData] = useState<any>({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<any>(null);
  const { data: mySuggestions = [] } = trpc.projects.mySuggestions.useQuery();
  const { addProject, removeProject, isSelected, canAddMore } = useCompare();

  const isGestor = user?.role === "gestor" || user?.role === "admin" || user?.role === "superintendente";

  // Estados dos filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [zonaFilter, setZonaFilter] = useState<string>("todas");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [dormitoriosFilter, setDormitoriosFilter] = useState<string>("todos");
  const [enquadramentoFilter, setEnquadramentoFilter] = useState<string>("todos");
  const [vagasFilter, setVagasFilter] = useState<string>("todos");
  const [construtoraFilter, setConstrutoraFilter] = useState<string>("todas");
  const [tipoFilter, setTipoFilter] = useState<string>("todos");

  const [suggestFormData, setSuggestFormData] = useState({
    nome: "",
    construtora: "",
    endereco: "",
    bairro: "",
    cidade: "São Paulo",
    estado: "SP",
    descricao: "",
    tipo: "mcmv" as "mcmv" | "sfh" | "outro",
    valorMinimo: "",
    valorMaximo: "",
    metragemMinima: "",
    metragemMaxima: "",
    dormitorios: "",
    zona: undefined as "norte" | "sul" | "leste" | "oeste" | "centro" | undefined,
  });

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

  // Filtrar projetos
  const filteredProjects = useMemo(() => {
    return projects.filter((project) => {
      const matchesSearch = !searchTerm || 
        project.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.construtora?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.bairro?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.developer?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesZona = zonaFilter === "todas" || project.zona === zonaFilter;
      const matchesStatus = statusFilter === "todos" || project.status === statusFilter;
      const matchesDormitorios = dormitoriosFilter === "todos" || 
        (project.dormitorios && project.dormitorios.includes(dormitoriosFilter));
      const matchesEnquadramento = enquadramentoFilter === "todos" || project.enquadramento === enquadramentoFilter;
      const matchesVagas = vagasFilter === "todos" || 
        (vagasFilter === "com" && project.vagas && project.vagas > 0) ||
        (vagasFilter === "sem" && (!project.vagas || project.vagas === 0));
      // Filtrar por nome da construtora (vindo do JOIN com tabela construtoras)
      const matchesConstrutora = construtoraFilter === "todas" ||
        project.construtoraName === construtoraFilter ||
        project.construtora === construtoraFilter;
      const matchesTipo = tipoFilter === "todos" || project.tipo === tipoFilter;

      return matchesSearch && matchesZona && matchesStatus && matchesDormitorios && matchesEnquadramento && matchesVagas && matchesConstrutora && matchesTipo;
    });
  }, [projects, searchTerm, zonaFilter, statusFilter, dormitoriosFilter, enquadramentoFilter, vagasFilter, construtoraFilter, tipoFilter]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      await createProjectMutation.mutateAsync({
        ...formData,
        valorMinimo: formData.valorMinimo ? parseInt(formData.valorMinimo) * 100 : undefined,
        valorMaximo: formData.valorMaximo ? parseInt(formData.valorMaximo) * 100 : undefined,
        metragemMinima: formData.metragemMinima ? parseInt(formData.metragemMinima) : undefined,
        metragemMaxima: formData.metragemMaxima ? parseInt(formData.metragemMaxima) : undefined,
      });
      
      toast.success("Projeto criado com sucesso!");
      setDialogOpen(false);
      refetch();
      
      setFormData({
        nome: "",
        construtora: "",
        endereco: "",
        bairro: "",
        cidade: "São Paulo",
        estado: "SP",
        descricao: "",
        tipo: "mcmv",
        status: "ativo",
        valorMinimo: "",
        valorMaximo: "",
        metragemMinima: "",
        metragemMaxima: "",
        dormitorios: "",
        vagas: 0,
        zona: undefined,
        enquadramento: undefined,
        developer: "",
      });
    } catch (error) {
      toast.error("Erro ao criar projeto");
    }
  };

  const handleSuggestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      await suggestProjectMutation.mutateAsync({
        ...suggestFormData,
        valorMinimo: suggestFormData.valorMinimo ? parseInt(suggestFormData.valorMinimo) * 100 : undefined,
        valorMaximo: suggestFormData.valorMaximo ? parseInt(suggestFormData.valorMaximo) * 100 : undefined,
        metragemMinima: suggestFormData.metragemMinima ? parseInt(suggestFormData.metragemMinima) : undefined,
        metragemMaxima: suggestFormData.metragemMaxima ? parseInt(suggestFormData.metragemMaxima) : undefined,
      });
      
      toast.success("Sugestão enviada! O gestor será notificado para aprovar.");
      setSuggestDialogOpen(false);
      
      setSuggestFormData({
        nome: "",
        construtora: "",
        endereco: "",
        bairro: "",
        cidade: "São Paulo",
        estado: "SP",
        descricao: "",
        tipo: "mcmv",
        valorMinimo: "",
        valorMaximo: "",
        metragemMinima: "",
        metragemMaxima: "",
        dormitorios: "",
        zona: undefined,
      });
    } catch (error) {
      toast.error("Erro ao enviar sugestão");
    }
  };

  const openEditDialog = (project: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingProject(project);
    setEditFormData({
      nome: project.nome || "",
      construtora: project.construtora || "",
      developer: project.developer || "",
      endereco: project.endereco || "",
      bairro: project.bairro || "",
      cidade: project.cidade || "São Paulo",
      estado: project.estado || "SP",
      descricao: project.descricao || "",
      tipo: project.tipo || "mcmv",
      status: project.status || "ativo",
      valorMinimo: project.valorMinimo ? String(project.valorMinimo / 100) : "",
      valorMaximo: project.valorMaximo ? String(project.valorMaximo / 100) : "",
      metragemMinima: project.metragemMinima ? String(project.metragemMinima) : "",
      metragemMaxima: project.metragemMaxima ? String(project.metragemMaxima) : "",
      dormitorios: project.dormitorios || "",
      vagas: project.vagas || 0,
      zona: project.zona || "",
      enquadramento: project.enquadramento || "",
    });
    setEditDialogOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProject) return;
    try {
      await updateProjectMutation.mutateAsync({
        id: editingProject.id,
        data: {
          nome: editFormData.nome,
          construtora: editFormData.construtora || undefined,
          developer: editFormData.developer || undefined,
          endereco: editFormData.endereco || undefined,
          bairro: editFormData.bairro || undefined,
          descricao: editFormData.descricao || undefined,
          tipo: editFormData.tipo || undefined,
          status: editFormData.status || undefined,
          valorMinimo: editFormData.valorMinimo ? parseInt(editFormData.valorMinimo) * 100 : undefined,
          valorMaximo: editFormData.valorMaximo ? parseInt(editFormData.valorMaximo) * 100 : undefined,
          metragemMinima: editFormData.metragemMinima ? parseInt(editFormData.metragemMinima) : undefined,
          metragemMaxima: editFormData.metragemMaxima ? parseInt(editFormData.metragemMaxima) : undefined,
          dormitorios: editFormData.dormitorios || undefined,
          vagas: editFormData.vagas || undefined,
          zona: editFormData.zona || undefined,
          enquadramento: editFormData.enquadramento || undefined,
        },
      });
      toast.success("Projeto atualizado com sucesso!");
      setEditDialogOpen(false);
      setEditingProject(null);
      refetch();
    } catch (error) {
      toast.error("Erro ao atualizar projeto");
    }
  };

  const handleDeleteProject = (project: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setProjectToDelete(project);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteProject = async () => {
    if (!projectToDelete) return;
    try {
      await deleteProjectMutation.mutateAsync({ id: projectToDelete.id });
      toast.success("Projeto excluído com sucesso!");
      refetch();
    } catch {
      toast.error("Erro ao excluir projeto");
    } finally {
      setDeleteDialogOpen(false);
      setProjectToDelete(null);
    }
  };

  const handleToggleCompare = (project: any) => {
    if (isSelected(project.id)) {
      removeProject(project.id);
    } else if (canAddMore) {
      addProject(project);
    } else {
      toast.error("Você pode comparar no máximo 3 projetos");
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="container mx-auto p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-40" />
            </div>
            <Skeleton className="h-10 w-36" />
          </div>
          <Skeleton className="h-24 w-full rounded-lg" />
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}>
                <Skeleton className="h-48 w-full rounded-t-lg" />
                <CardContent className="p-4 space-y-3">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <div className="flex gap-2">
                    <Skeleton className="h-6 w-16 rounded-full" />
                    <Skeleton className="h-6 w-20 rounded-full" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Projetos Imobiliários</h1>
            <p className="text-muted-foreground mt-1">
              {filteredProjects.length} {filteredProjects.length === 1 ? "projeto encontrado" : "projetos encontrados"}
            </p>
          </div>
          
          <div className="flex gap-2">
            {/* Botão de sugerir projeto (todos podem) */}
            {!isGestor && (
              <Dialog open={suggestDialogOpen} onOpenChange={setSuggestDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Lightbulb className="mr-2 h-4 w-4" />
                    Sugerir Projeto
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Sugerir Novo Projeto</DialogTitle>
                    <DialogDescription>
                      Preencha as informações do projeto. O gestor será notificado para aprovar.
                    </DialogDescription>
                  </DialogHeader>
                  
                  <form onSubmit={handleSuggestSubmit} className="space-y-4">
                    <div className="grid gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="suggest-nome">Nome do Projeto *</Label>
                        <Input
                          id="suggest-nome"
                          required
                          value={suggestFormData.nome}
                          onChange={(e) => setSuggestFormData({ ...suggestFormData, nome: e.target.value })}
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor="suggest-construtora">Construtora</Label>
                          <Input
                            id="suggest-construtora"
                            value={suggestFormData.construtora}
                            onChange={(e) => setSuggestFormData({ ...suggestFormData, construtora: e.target.value })}
                          />
                        </div>
                        
                        <div className="grid gap-2">
                          <Label htmlFor="suggest-bairro">Bairro</Label>
                          <Input
                            id="suggest-bairro"
                            value={suggestFormData.bairro}
                            onChange={(e) => setSuggestFormData({ ...suggestFormData, bairro: e.target.value })}
                          />
                        </div>
                      </div>
                      
                      <div className="grid gap-2">
                        <Label htmlFor="suggest-endereco">Endereço</Label>
                        <Input
                          id="suggest-endereco"
                          value={suggestFormData.endereco}
                          onChange={(e) => setSuggestFormData({ ...suggestFormData, endereco: e.target.value })}
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label>Zona</Label>
                          <Select
                            value={suggestFormData.zona || ""}
                            onValueChange={(v) => setSuggestFormData({ ...suggestFormData, zona: v as any || undefined })}
                          >
                            <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">Selecione...</SelectItem>
                              <SelectItem value="norte">Zona Norte</SelectItem>
                              <SelectItem value="sul">Zona Sul</SelectItem>
                              <SelectItem value="leste">Zona Leste</SelectItem>
                              <SelectItem value="oeste">Zona Oeste</SelectItem>
                              <SelectItem value="centro">Centro</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="grid gap-2">
                          <Label>Tipo</Label>
                          <Select
                            value={suggestFormData.tipo}
                            onValueChange={(v) => setSuggestFormData({ ...suggestFormData, tipo: v as any })}
                          >
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="mcmv">MCMV</SelectItem>
                              <SelectItem value="sfh">SFH</SelectItem>
                              <SelectItem value="outro">Outro</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      
                      <div className="grid gap-2">
                        <Label htmlFor="suggest-descricao">Descrição</Label>
                        <Textarea
                          id="suggest-descricao"
                          className="min-h-[80px]"
                          value={suggestFormData.descricao}
                          onChange={(e) => setSuggestFormData({ ...suggestFormData, descricao: e.target.value })}
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor="suggest-valorMinimo">Valor Mínimo (R$)</Label>
                          <Input
                            id="suggest-valorMinimo"
                            type="number"
                            value={suggestFormData.valorMinimo}
                            onChange={(e) => setSuggestFormData({ ...suggestFormData, valorMinimo: e.target.value })}
                          />
                        </div>
                        
                        <div className="grid gap-2">
                          <Label htmlFor="suggest-valorMaximo">Valor Máximo (R$)</Label>
                          <Input
                            id="suggest-valorMaximo"
                            type="number"
                            value={suggestFormData.valorMaximo}
                            onChange={(e) => setSuggestFormData({ ...suggestFormData, valorMaximo: e.target.value })}
                          />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor="suggest-dormitorios">Dormitórios</Label>
                          <Input
                            id="suggest-dormitorios"
                            placeholder="Ex: 1, 2, 3"
                            value={suggestFormData.dormitorios}
                            onChange={(e) => setSuggestFormData({ ...suggestFormData, dormitorios: e.target.value })}
                          />
                        </div>
                        
                        <div className="grid gap-2">
                          <Label htmlFor="suggest-metragemMinima">Metragem Mínima (m²)</Label>
                          <Input
                            id="suggest-metragemMinima"
                            type="number"
                            value={suggestFormData.metragemMinima}
                            onChange={(e) => setSuggestFormData({ ...suggestFormData, metragemMinima: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setSuggestDialogOpen(false)}>
                        Cancelar
                      </Button>
                      <Button type="submit" disabled={suggestProjectMutation.isPending} className="gap-2">
                        {suggestProjectMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Enviando...
                          </>
                        ) : "Enviar Sugestão"}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            )}
            
            {/* Botão de criar projeto (apenas gestor) */}
            {isGestor && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Novo Projeto
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Criar Novo Projeto</DialogTitle>
                  <DialogDescription>
                    Preencha as informações do empreendimento imobiliário
                  </DialogDescription>
                </DialogHeader>
                
                <form onSubmit={handleSubmit} className="space-y-4">
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
                        <Label>Zona</Label>
                        <Select
                          value={formData.zona || ""}
                          onValueChange={(v) => setFormData({ ...formData, zona: v as any })}
                        >
                          <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">Selecione...</SelectItem>
                            <SelectItem value="norte">Zona Norte</SelectItem>
                            <SelectItem value="sul">Zona Sul</SelectItem>
                            <SelectItem value="leste">Zona Leste</SelectItem>
                            <SelectItem value="oeste">Zona Oeste</SelectItem>
                            <SelectItem value="centro">Centro</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid gap-2">
                        <Label>Enquadramento</Label>
                        <Select
                          value={formData.enquadramento || ""}
                          onValueChange={(v) => setFormData({ ...formData, enquadramento: v as any })}
                        >
                          <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">Selecione...</SelectItem>
                            <SelectItem value="HIS1">HIS1</SelectItem>
                            <SelectItem value="HIS2">HIS2</SelectItem>
                            <SelectItem value="HMP">HMP</SelectItem>
                            <SelectItem value="R2V">R2V</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="descricao">Descrição</Label>
                      <Textarea
                        id="descricao"
                        className="min-h-[80px]"
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
                        <Label>Status</Label>
                        <Select
                          value={formData.status}
                          onValueChange={(v) => setFormData({ ...formData, status: v as any })}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ativo">Ativo</SelectItem>
                            <SelectItem value="inativo">Inativo</SelectItem>
                            <SelectItem value="esgotado">Esgotado</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={createProjectMutation.isPending} className="gap-2">
                      {createProjectMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Criando...
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4" />
                          Criar Projeto
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
          </div>
        </div>

        {/* Minhas Sugestões (apenas para corretores) */}
        {!isGestor && mySuggestions.length > 0 && (
          <Card className="mb-6 border-amber-200 bg-amber-50">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-amber-800">
                <Clock className="h-5 w-5" />
                Minhas Sugestões de Projetos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {mySuggestions.map((suggestion: any) => (
                  <div key={suggestion.id} className="flex items-center justify-between p-3 bg-white rounded-lg border">
                    <div>
                      <p className="font-medium">{suggestion.nome}</p>
                      <p className="text-sm text-muted-foreground">
                        {suggestion.construtora && `${suggestion.construtora} • `}
                        {suggestion.bairro || "Bairro não informado"}
                      </p>
                    </div>
                    <Badge
                      variant={suggestion.status === "aprovado" ? "default" : suggestion.status === "reprovado" ? "destructive" : "secondary"}
                      className="flex items-center gap-1"
                    >
                      {suggestion.status === "aprovado" && <CheckCircle className="h-3 w-3" />}
                      {suggestion.status === "reprovado" && <XCircle className="h-3 w-3" />}
                      {suggestion.status === "pendente" && <Clock className="h-3 w-3" />}
                      {suggestion.status === "aprovado" ? "Aprovado" : suggestion.status === "reprovado" ? "Reprovado" : "Pendente"}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Abas Lista/Mapa */}
        <Tabs defaultValue="lista" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="lista" className="flex items-center gap-2">
              <List className="h-4 w-4" />
              Lista
            </TabsTrigger>
            <TabsTrigger value="mapa" className="flex items-center gap-2">
              <MapIcon className="h-4 w-4" />
              Mapa
            </TabsTrigger>
          </TabsList>

        {/* Filtros */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, construtora, bairro..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-9"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm("")}
                    className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                    aria-label="Limpar busca"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <Select value={zonaFilter} onValueChange={setZonaFilter}>
                <SelectTrigger><SelectValue placeholder="Todas as Zonas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as Zonas</SelectItem>
                  <SelectItem value="norte">Zona Norte</SelectItem>
                  <SelectItem value="sul">Zona Sul</SelectItem>
                  <SelectItem value="leste">Zona Leste</SelectItem>
                  <SelectItem value="oeste">Zona Oeste</SelectItem>
                  <SelectItem value="centro">Centro</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger><SelectValue placeholder="Todos os Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Status</SelectItem>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                  <SelectItem value="esgotado">Esgotado</SelectItem>
                </SelectContent>
              </Select>

              <Select value={dormitoriosFilter} onValueChange={setDormitoriosFilter}>
                <SelectTrigger><SelectValue placeholder="Todos os Dormitórios" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Dormitórios</SelectItem>
                  <SelectItem value="1">1 Dormitório</SelectItem>
                  <SelectItem value="2">2 Dormitórios</SelectItem>
                  <SelectItem value="3">3 Dormitórios</SelectItem>
                  <SelectItem value="4">4+ Dormitórios</SelectItem>
                </SelectContent>
              </Select>

              <Select value={enquadramentoFilter} onValueChange={setEnquadramentoFilter}>
                <SelectTrigger><SelectValue placeholder="Todos os Enquadramentos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Enquadramentos</SelectItem>
                  <SelectItem value="HIS1">HIS1</SelectItem>
                  <SelectItem value="HIS2">HIS2</SelectItem>
                  <SelectItem value="HMP">HMP</SelectItem>
                  <SelectItem value="R2V">R2V</SelectItem>
                </SelectContent>
              </Select>

              <Select value={vagasFilter} onValueChange={setVagasFilter}>
                <SelectTrigger><SelectValue placeholder="Vagas: Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Vagas: Todos</SelectItem>
                  <SelectItem value="com">Com Vaga</SelectItem>
                  <SelectItem value="sem">Sem Vaga</SelectItem>
                </SelectContent>
              </Select>

              <Select value={construtoraFilter} onValueChange={setConstrutoraFilter}>
                <SelectTrigger><SelectValue placeholder="Todas as Construtoras" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as Construtoras</SelectItem>
                  {construtorasComProjetos.map(construtora => (
                    <SelectItem key={construtora.id} value={construtora.nome}>
                      {construtora.nome} ({construtora.totalProjetos})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={tipoFilter} onValueChange={setTipoFilter}>
                <SelectTrigger><SelectValue placeholder="Todos os Tipos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Tipos</SelectItem>
                  <SelectItem value="mcmv">MCMV</SelectItem>
                  <SelectItem value="sfh">SFH</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(searchTerm || zonaFilter !== "todas" || statusFilter !== "todos" || dormitoriosFilter !== "todos" || enquadramentoFilter !== "todos" || vagasFilter !== "todos" || construtoraFilter !== "todas" || tipoFilter !== "todos") && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{filteredProjects.length} resultado(s)</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setSearchTerm("");
                    setZonaFilter("todas");
                    setStatusFilter("todos");
                    setDormitoriosFilter("todos");
                    setEnquadramentoFilter("todos");
                    setVagasFilter("todos");
                    setConstrutoraFilter("todas");
                    setTipoFilter("todos");
                  }}
                >
                  <X className="h-3 w-3 mr-1" />
                  Limpar filtros
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <TabsContent value="lista">
        {/* Grid de Projetos */}
        {filteredProjects.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Building2 className="h-16 w-16 text-muted-foreground mb-4" />
              <p className="text-lg font-semibold mb-2">Nenhum projeto encontrado</p>
              <p className="text-muted-foreground text-center">
                {searchTerm || zonaFilter !== "todas" || statusFilter !== "todos" || dormitoriosFilter !== "todos" || enquadramentoFilter !== "todos" || vagasFilter !== "todos" || construtoraFilter !== "todas"
                  ? "Tente ajustar os filtros para encontrar projetos"
                  : "Comece criando um novo projeto"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredProjects.map((project) => (
              <Card 
                key={project.id} 
                className="group hover:shadow-lg transition-all duration-300 cursor-pointer relative overflow-hidden"
                onClick={() => setLocation(`/projetos/${project.id}`)}
              >
                <div className="absolute top-2 right-2 z-10 flex gap-1">
                  {isGestor && (
                    <>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={(e) => openEditDialog(project, e)}
                        className="h-8 w-8 p-0 bg-white/90 hover:bg-white"
                        title="Editar projeto"
                        aria-label="Editar projeto"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={(e) => handleDeleteProject(project, e)}
                        className="h-8 w-8 p-0 bg-white/90 hover:bg-red-50 hover:text-red-600"
                        title="Excluir projeto"
                        aria-label="Excluir projeto"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                  <Button
                    size="sm"
                    variant={isSelected(project.id) ? "default" : "secondary"}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleCompare(project);
                    }}
                    className="h-8 w-8 p-0"
                    aria-label={isSelected(project.id) ? "Remover da comparação" : "Adicionar à comparação"}
                    title={isSelected(project.id) ? "Remover da comparação" : "Adicionar à comparação"}
                  >
                    {isSelected(project.id) ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                
                <div 
                  className="h-48 bg-gradient-to-br from-blue-500 to-purple-600 relative"
                  style={{
                    backgroundImage: project.imagemPrincipal ? `url(${project.imagemPrincipal})` : undefined,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }}
                >
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-black/30 transition-colors" />
                  
                  {/* Logo da Construtora */}
                  {project.logoUrl && (
                    <div className="absolute top-3 right-3 bg-white/95 rounded-md p-1.5 shadow-md backdrop-blur-sm">
                      <img 
                        src={project.logoUrl} 
                        alt={project.construtora || 'Logo'}
                        className="h-8 max-w-[80px] object-contain"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    </div>
                  )}
                  
                  <div className="absolute bottom-4 left-4 right-4">
                    <h3 className="text-white font-bold text-xl mb-1">{project.nome}</h3>
                    {project.construtora && (
                      <p className="text-white/90 text-sm">{project.construtora}</p>
                    )}
                  </div>
                </div>
                
                <CardContent className="p-4">
                  <div className="space-y-3">
                    {project.endereco && (
                      <div className="flex items-start gap-2 text-sm">
                        <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <span className="text-muted-foreground line-clamp-2">
                          {project.endereco}
                          {project.bairro && `, ${project.bairro}`}
                        </span>
                      </div>
                    )}
                    
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={project.status === "ativo" ? "default" : project.status === "esgotado" ? "destructive" : "secondary"}>
                        {project.status === "ativo" ? "Ativo" : project.status === "inativo" ? "Inativo" : "Esgotado"}
                      </Badge>

                      {project.tipo && (
                        <Badge variant="outline" className="font-semibold">
                          {project.tipo === "mcmv" ? "MCMV" : project.tipo === "sfh" ? "SFH" : "Outro"}
                        </Badge>
                      )}

                      {project.zona && (
                        <Badge variant="outline">
                          Zona {project.zona.charAt(0).toUpperCase() + project.zona.slice(1)}
                        </Badge>
                      )}

                      {project.enquadramento && (
                        <Badge variant="outline">{project.enquadramento}</Badge>
                      )}

                      {project.dormitorios && (
                        <Badge variant="outline">{project.dormitorios} dorm</Badge>
                      )}

                      {project.vagas && project.vagas > 0 && (
                        <Badge variant="outline">{project.vagas} vaga{project.vagas > 1 ? 's' : ''}</Badge>
                      )}

                      {(project.metragemMinima || project.metragemMaxima) && (
                        <Badge variant="outline">
                          {project.metragemMinima && project.metragemMaxima
                            ? `${project.metragemMinima}–${project.metragemMaxima} m²`
                            : project.metragemMinima
                            ? `≥ ${project.metragemMinima} m²`
                            : `≤ ${project.metragemMaxima} m²`}
                        </Badge>
                      )}
                    </div>
                    
                    {(project.valorMinimo || project.valorMaximo) && (
                      <div className="text-sm">
                        <span className="font-semibold text-primary">
                          {project.valorMinimo && project.valorMaximo
                            ? `R$ ${(project.valorMinimo / 100).toLocaleString('pt-BR')} - R$ ${(project.valorMaximo / 100).toLocaleString('pt-BR')}`
                            : project.valorMinimo
                            ? `A partir de R$ ${(project.valorMinimo / 100).toLocaleString('pt-BR')}`
                            : `Até R$ ${(project.valorMaximo! / 100).toLocaleString('pt-BR')}`}
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        </TabsContent>

        <TabsContent value="mapa">
          <Suspense fallback={<div className="flex items-center justify-center h-[600px] bg-card rounded-lg border"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
            <ProjetosMapView
              filtroConstrutora={construtoraFilter}
              filtroZona={zonaFilter}
              filtroStatus={statusFilter}
              filtroBusca={searchTerm}
            />
          </Suspense>
        </TabsContent>
        </Tabs>
      </div>
      
      <CompareBar />

      {/* Dialog de Edição de Projeto */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Projeto</DialogTitle>
            <DialogDescription>
              Atualize as informações do empreendimento
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-nome">Nome do Projeto *</Label>
                <Input
                  id="edit-nome"
                  required
                  value={editFormData.nome || ""}
                  onChange={(e) => setEditFormData({ ...editFormData, nome: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-construtora">Construtora</Label>
                  <Input
                    id="edit-construtora"
                    value={editFormData.construtora || ""}
                    onChange={(e) => setEditFormData({ ...editFormData, construtora: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-developer">Incorporadora</Label>
                  <Input
                    id="edit-developer"
                    value={editFormData.developer || ""}
                    onChange={(e) => setEditFormData({ ...editFormData, developer: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-endereco">Endereço</Label>
                <Input
                  id="edit-endereco"
                  value={editFormData.endereco || ""}
                  onChange={(e) => setEditFormData({ ...editFormData, endereco: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-bairro">Bairro</Label>
                  <Input
                    id="edit-bairro"
                    value={editFormData.bairro || ""}
                    onChange={(e) => setEditFormData({ ...editFormData, bairro: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Zona</Label>
                  <Select
                    value={editFormData.zona || ""}
                    onValueChange={(v) => setEditFormData({ ...editFormData, zona: v || undefined })}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Selecione...</SelectItem>
                      <SelectItem value="norte">Zona Norte</SelectItem>
                      <SelectItem value="sul">Zona Sul</SelectItem>
                      <SelectItem value="leste">Zona Leste</SelectItem>
                      <SelectItem value="oeste">Zona Oeste</SelectItem>
                      <SelectItem value="centro">Centro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Enquadramento</Label>
                  <Select
                    value={editFormData.enquadramento || ""}
                    onValueChange={(v) => setEditFormData({ ...editFormData, enquadramento: v || undefined })}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Selecione...</SelectItem>
                      <SelectItem value="HIS1">HIS1</SelectItem>
                      <SelectItem value="HIS2">HIS2</SelectItem>
                      <SelectItem value="HMP">HMP</SelectItem>
                      <SelectItem value="R2V">R2V</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-descricao">Descrição</Label>
                <Textarea
                  id="edit-descricao"
                  className="min-h-[80px]"
                  value={editFormData.descricao || ""}
                  onChange={(e) => setEditFormData({ ...editFormData, descricao: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-valorMinimo">Valor Mínimo (R$)</Label>
                  <Input
                    id="edit-valorMinimo"
                    type="number"
                    value={editFormData.valorMinimo || ""}
                    onChange={(e) => setEditFormData({ ...editFormData, valorMinimo: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-valorMaximo">Valor Máximo (R$)</Label>
                  <Input
                    id="edit-valorMaximo"
                    type="number"
                    value={editFormData.valorMaximo || ""}
                    onChange={(e) => setEditFormData({ ...editFormData, valorMaximo: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-dormitorios">Dorm.</Label>
                  <Input
                    id="edit-dormitorios"
                    placeholder="Ex: 1, 2, 3"
                    value={editFormData.dormitorios || ""}
                    onChange={(e) => setEditFormData({ ...editFormData, dormitorios: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-vagas">Vagas</Label>
                  <Input
                    id="edit-vagas"
                    type="number"
                    value={editFormData.vagas || 0}
                    onChange={(e) => setEditFormData({ ...editFormData, vagas: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Status</Label>
                  <Select
                    value={editFormData.status || "ativo"}
                    onValueChange={(v) => setEditFormData({ ...editFormData, status: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ativo">Ativo</SelectItem>
                      <SelectItem value="inativo">Inativo</SelectItem>
                      <SelectItem value="esgotado">Esgotado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={updateProjectMutation.isPending} className="gap-2">
                {updateProjectMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : "Salvar Alterações"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir projeto</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{projectToDelete?.nome}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmDeleteProject}
              disabled={deleteProjectMutation.isPending}
            >
              {deleteProjectMutation.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Excluindo...</>
              ) : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}

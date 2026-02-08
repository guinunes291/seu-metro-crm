import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Building2, MapPin, Plus, Search, Filter, Check, X, Lightbulb, FileText, Upload, Clock, CheckCircle, XCircle, Map as MapIcon, List } from "lucide-react";
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
  const suggestProjectMutation = trpc.projects.suggest.useMutation();
  const { data: mySuggestions = [] } = trpc.projects.mySuggestions.useQuery();
  const { addProject, removeProject, isSelected, canAddMore } = useCompare();

  const isGestor = user?.role === "gestor" || user?.role === "admin";

  // Estados dos filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [zonaFilter, setZonaFilter] = useState<string>("todas");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [dormitoriosFilter, setDormitoriosFilter] = useState<string>("todos");
  const [enquadramentoFilter, setEnquadramentoFilter] = useState<string>("todos");
  const [vagasFilter, setVagasFilter] = useState<string>("todos");
  const [construtoraFilter, setConstrutoraFilter] = useState<string>("todas");

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

      return matchesSearch && matchesZona && matchesStatus && matchesDormitorios && matchesEnquadramento && matchesVagas && matchesConstrutora;
    });
  }, [projects, searchTerm, zonaFilter, statusFilter, dormitoriosFilter, enquadramentoFilter, vagasFilter, construtoraFilter]);

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
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Building2 className="h-12 w-12 animate-pulse mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Carregando projetos...</p>
        </div>
      </div>
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
                          <Label htmlFor="suggest-zona">Zona</Label>
                          <select
                            id="suggest-zona"
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            value={suggestFormData.zona || ""}
                            onChange={(e) => setSuggestFormData({ ...suggestFormData, zona: e.target.value as any || undefined })}
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
                          <Label htmlFor="suggest-tipo">Tipo</Label>
                          <select
                            id="suggest-tipo"
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            value={suggestFormData.tipo}
                            onChange={(e) => setSuggestFormData({ ...suggestFormData, tipo: e.target.value as any })}
                          >
                            <option value="mcmv">MCMV</option>
                            <option value="sfh">SFH</option>
                            <option value="outro">Outro</option>
                          </select>
                        </div>
                      </div>
                      
                      <div className="grid gap-2">
                        <Label htmlFor="suggest-descricao">Descrição</Label>
                        <textarea
                          id="suggest-descricao"
                          className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
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
                      <Button type="submit" disabled={suggestProjectMutation.isPending}>
                        {suggestProjectMutation.isPending ? "Enviando..." : "Enviar Sugestão"}
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
                  
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit">Criar Projeto</Button>
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
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, construtora, bairro..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                value={zonaFilter}
                onChange={(e) => setZonaFilter(e.target.value)}
              >
                <option value="todas">Todas as Zonas</option>
                <option value="norte">Zona Norte</option>
                <option value="sul">Zona Sul</option>
                <option value="leste">Zona Leste</option>
                <option value="oeste">Zona Oeste</option>
                <option value="centro">Centro</option>
              </select>
              
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="todos">Todos os Status</option>
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
                <option value="esgotado">Esgotado</option>
              </select>
              
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                value={dormitoriosFilter}
                onChange={(e) => setDormitoriosFilter(e.target.value)}
              >
                <option value="todos">Todos os Dormitórios</option>
                <option value="1">1 Dormitório</option>
                <option value="2">2 Dormitórios</option>
                <option value="3">3 Dormitórios</option>
                <option value="4">4+ Dormitórios</option>
              </select>
              
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                value={enquadramentoFilter}
                onChange={(e) => setEnquadramentoFilter(e.target.value)}
              >
                <option value="todos">Todos os Enquadramentos</option>
                <option value="HIS1">HIS1</option>
                <option value="HIS2">HIS2</option>
                <option value="HMP">HMP</option>
                <option value="R2V">R2V</option>
              </select>
              
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                value={vagasFilter}
                onChange={(e) => setVagasFilter(e.target.value)}
              >
                <option value="todos">Vagas: Todos</option>
                <option value="com">Com Vaga</option>
                <option value="sem">Sem Vaga</option>
              </select>
              
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                value={construtoraFilter}
                onChange={(e) => setConstrutoraFilter(e.target.value)}
              >
                <option value="todas">Todas as Construtoras</option>
                {construtorasComProjetos.map(construtora => (
                  <option key={construtora.id} value={construtora.nome}>
                    {construtora.nome} ({construtora.totalProjetos})
                  </option>
                ))}
              </select>
            </div>
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
                <div className="absolute top-2 right-2 z-10">
                  <Button
                    size="sm"
                    variant={isSelected(project.id) ? "default" : "secondary"}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleCompare(project);
                    }}
                    className="h-8 w-8 p-0"
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
                        {project.status}
                      </Badge>
                      
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
          <Suspense fallback={<div className="flex items-center justify-center h-[600px] bg-card rounded-lg border"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>}>
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
    </DashboardLayout>
  );
}

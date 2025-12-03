import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Building2, MapPin, Home, Car, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

export default function Projetos() {
  const { user } = useAuth();
  const { data: projects, isLoading, refetch } = trpc.projects.list.useQuery();
  const [dialogOpen, setDialogOpen] = useState(false);
  const createProjectMutation = trpc.projects.create.useMutation();

  const isGestor = user?.role === "gestor" || user?.role === "admin";

  const [formData, setFormData] = useState({
    nome: "",
    construtora: "",
    endereco: "",
    bairro: "",
    cidade: "São Paulo",
    estado: "SP",
    zona: "",
    descricao: "",
    tipo: "mcmv" as "mcmv" | "sfh" | "outro",
    status: "ativo" as "ativo" | "inativo" | "esgotado",
    valorMinimo: "",
    valorMaximo: "",
    metragemMinima: "",
    metragemMaxima: "",
    dormitorios: "",
    vagas: false,
  });

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
      
      // Reset form
      setFormData({
        nome: "",
        construtora: "",
        endereco: "",
        bairro: "",
        cidade: "São Paulo",
        estado: "SP",
        zona: "",
        descricao: "",
        tipo: "mcmv",
        status: "ativo",
        valorMinimo: "",
        valorMaximo: "",
        metragemMinima: "",
        metragemMaxima: "",
        dormitorios: "",
        vagas: false,
      });
    } catch (error) {
      toast.error("Erro ao criar projeto");
    }
  };

  const formatCurrency = (cents: number | null | undefined) => {
    if (!cents) return "N/A";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(cents / 100);
  };

  return (
    <DashboardLayout>
      <div className="container py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Projetos</h1>
            <p className="text-muted-foreground mt-2">
              Catálogo de empreendimentos disponíveis
            </p>
          </div>
          
          {isGestor && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Projeto
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Criar Novo Projeto</DialogTitle>
                  <DialogDescription>
                    Adicione um novo empreendimento ao catálogo
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="nome">Nome do Projeto *</Label>
                      <Input
                        id="nome"
                        value={formData.nome}
                        onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                        required
                      />
                    </div>
                    
                    <div className="grid gap-2">
                      <Label htmlFor="construtora">Construtora</Label>
                      <Input
                        id="construtora"
                        value={formData.construtora}
                        onChange={(e) => setFormData({ ...formData, construtora: e.target.value })}
                      />
                    </div>
                    
                    <div className="grid gap-2">
                      <Label htmlFor="endereco">Endereço</Label>
                      <Input
                        id="endereco"
                        value={formData.endereco}
                        onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
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
                        <Input
                          id="zona"
                          placeholder="Ex: Zona Norte"
                          value={formData.zona}
                          onChange={(e) => setFormData({ ...formData, zona: e.target.value })}
                        />
                      </div>
                    </div>
                    
                    <div className="grid gap-2">
                      <Label htmlFor="descricao">Descrição</Label>
                      <Textarea
                        id="descricao"
                        value={formData.descricao}
                        onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                        rows={3}
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="tipo">Tipo</Label>
                        <Select
                          value={formData.tipo}
                          onValueChange={(value: "mcmv" | "sfh" | "outro") => setFormData({ ...formData, tipo: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="mcmv">MCMV</SelectItem>
                            <SelectItem value="sfh">SFH</SelectItem>
                            <SelectItem value="outro">Outro</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="grid gap-2">
                        <Label htmlFor="status">Status</Label>
                        <Select
                          value={formData.status}
                          onValueChange={(value: "ativo" | "inativo" | "esgotado") => setFormData({ ...formData, status: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ativo">Ativo</SelectItem>
                            <SelectItem value="inativo">Inativo</SelectItem>
                            <SelectItem value="esgotado">Esgotado</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
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
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="metragemMinima">Metragem Mínima (m²)</Label>
                        <Input
                          id="metragemMinima"
                          type="number"
                          value={formData.metragemMinima}
                          onChange={(e) => setFormData({ ...formData, metragemMinima: e.target.value })}
                        />
                      </div>
                      
                      <div className="grid gap-2">
                        <Label htmlFor="metragemMaxima">Metragem Máxima (m²)</Label>
                        <Input
                          id="metragemMaxima"
                          type="number"
                          value={formData.metragemMaxima}
                          onChange={(e) => setFormData({ ...formData, metragemMaxima: e.target.value })}
                        />
                      </div>
                    </div>
                    
                    <div className="grid gap-2">
                      <Label htmlFor="dormitorios">Dormitórios</Label>
                      <Input
                        id="dormitorios"
                        placeholder="Ex: 1, 2, 3"
                        value={formData.dormitorios}
                        onChange={(e) => setFormData({ ...formData, dormitorios: e.target.value })}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={createProjectMutation.isPending}>
                      {createProjectMutation.isPending ? "Criando..." : "Criar Projeto"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Grid de projetos em formato "estante" */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Carregando projetos...</p>
          </div>
        ) : projects && projects.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <Card key={project.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                <div className="h-48 bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                  <Building2 className="h-20 w-20 text-primary/20" />
                </div>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-xl">{project.nome}</CardTitle>
                    <Badge variant={
                      project.status === "ativo" ? "default" :
                      project.status === "esgotado" ? "destructive" : "secondary"
                    }>
                      {project.status}
                    </Badge>
                  </div>
                  {project.construtora && (
                    <CardDescription>{project.construtora}</CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    {project.endereco && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        <span>{project.bairro}, {project.cidade}</span>
                      </div>
                    )}
                    
                    {(project.metragemMinima || project.metragemMaxima) && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Home className="h-4 w-4" />
                        <span>
                          {project.metragemMinima && project.metragemMaxima
                            ? `${project.metragemMinima}m² - ${project.metragemMaxima}m²`
                            : project.metragemMinima
                            ? `A partir de ${project.metragemMinima}m²`
                            : `Até ${project.metragemMaxima}m²`}
                        </span>
                      </div>
                    )}
                    
                    {project.vagas && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Car className="h-4 w-4" />
                        <span>Com vaga de garagem</span>
                      </div>
                    )}
                    
                    {(project.valorMinimo || project.valorMaximo) && (
                      <div className="mt-4 pt-4 border-t">
                        <p className="font-semibold text-lg">
                          {project.valorMinimo && project.valorMaximo
                            ? `${formatCurrency(project.valorMinimo)} - ${formatCurrency(project.valorMaximo)}`
                            : project.valorMinimo
                            ? `A partir de ${formatCurrency(project.valorMinimo)}`
                            : `Até ${formatCurrency(project.valorMaximo)}`}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
                <CardFooter>
                  <Button variant="outline" className="w-full">
                    Ver Detalhes
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Building2 className="h-20 w-20 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold mb-2">Nenhum projeto cadastrado</h3>
            <p className="text-muted-foreground mb-6">
              {isGestor 
                ? "Comece adicionando o primeiro empreendimento ao catálogo"
                : "Aguarde o gestor cadastrar os projetos"}
            </p>
            {isGestor && (
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Primeiro Projeto
              </Button>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

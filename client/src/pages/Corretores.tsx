import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { UserPlus, Edit, Trash2, UserCheck, UserX, Mail, Phone, Search, MapPin, Calendar, FileText, Eye } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface CorretorFormData {
  name: string;
  email: string;
  telefone: string;
  status: "presente" | "ausente";
  // Dados pessoais
  cpf: string;
  dataNascimento: string;
  // Dados profissionais
  creci: string;
  dataCredenciamento: string;
  dataDescredenciamento: string;
  situacao: "ativo" | "inativo";
  // Endereço
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
}

const initialFormData: CorretorFormData = {
  name: "",
  email: "",
  telefone: "",
  status: "ausente",
  cpf: "",
  dataNascimento: "",
  creci: "",
  dataCredenciamento: "",
  dataDescredenciamento: "",
  situacao: "ativo",
  logradouro: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  estado: "",
  cep: "",
};

const estadosBrasileiros = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];

export default function Corretores() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [selectedCorretor, setSelectedCorretor] = useState<any>(null);
  const [formData, setFormData] = useState<CorretorFormData>(initialFormData);
  const [leadsCount, setLeadsCount] = useState(0);

  const { data: corretores = [], isLoading } = trpc.corretores.list.useQuery();
  const utils = trpc.useUtils();

  const createMutation = trpc.corretores.create.useMutation({
    onSuccess: () => {
      toast.success("Corretor cadastrado com sucesso!");
      utils.corretores.list.invalidate();
      setIsCreateDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error(`Erro ao cadastrar corretor: ${error.message}`);
    },
  });

  const updateMutation = trpc.corretores.update.useMutation({
    onSuccess: () => {
      toast.success("Corretor atualizado com sucesso!");
      utils.corretores.list.invalidate();
      setIsEditDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error(`Erro ao atualizar corretor: ${error.message}`);
    },
  });

  const deleteMutation = trpc.corretores.delete.useMutation({
    onSuccess: (data) => {
      if (data.leadsRedistribuidos > 0) {
        toast.success(`Corretor excluído! ${data.leadsRedistribuidos} lead(s) redistribuído(s) para outros corretores.`);
      } else {
        toast.success("Corretor excluído com sucesso!");
      }
      utils.corretores.list.invalidate();
      utils.leads.list.invalidate();
      setIsDeleteDialogOpen(false);
      setSelectedCorretor(null);
      setLeadsCount(0);
    },
    onError: (error) => {
      toast.error(`Erro ao excluir corretor: ${error.message}`);
    },
  });

  const updateStatusMutation = trpc.corretores.updateStatusGestor.useMutation({
    onSuccess: () => {
      toast.success("Status atualizado com sucesso!");
      utils.corretores.list.invalidate();
    },
    onError: (error) => {
      toast.error(`Erro ao atualizar status: ${error.message}`);
    },
  });

  const resetForm = () => {
    setFormData(initialFormData);
    setSelectedCorretor(null);
  };

  const formatDateForInput = (date: any) => {
    if (!date) return "";
    const d = new Date(date);
    return d.toISOString().split('T')[0];
  };

  const handleCreate = () => {
    if (!formData.name || !formData.email) {
      toast.error("Nome e email são obrigatórios");
      return;
    }
    
    const payload: any = {
      name: formData.name,
      email: formData.email,
      telefone: formData.telefone || undefined,
      status: formData.status,
      situacao: formData.situacao,
      cpf: formData.cpf || undefined,
      creci: formData.creci || undefined,
      logradouro: formData.logradouro || undefined,
      numero: formData.numero || undefined,
      complemento: formData.complemento || undefined,
      bairro: formData.bairro || undefined,
      cidade: formData.cidade || undefined,
      estado: formData.estado || undefined,
      cep: formData.cep || undefined,
    };
    
    if (formData.dataNascimento) {
      payload.dataNascimento = new Date(formData.dataNascimento);
    }
    if (formData.dataCredenciamento) {
      payload.dataCredenciamento = new Date(formData.dataCredenciamento);
    }
    if (formData.dataDescredenciamento) {
      payload.dataDescredenciamento = new Date(formData.dataDescredenciamento);
    }
    
    createMutation.mutate(payload);
  };

  const handleEdit = (corretor: any) => {
    setSelectedCorretor(corretor);
    setFormData({
      name: corretor.name || "",
      email: corretor.email || "",
      telefone: corretor.telefone || "",
      status: corretor.status || "ausente",
      cpf: corretor.cpf || "",
      dataNascimento: formatDateForInput(corretor.dataNascimento),
      creci: corretor.creci || "",
      dataCredenciamento: formatDateForInput(corretor.dataCredenciamento),
      dataDescredenciamento: formatDateForInput(corretor.dataDescredenciamento),
      situacao: corretor.situacao || "ativo",
      logradouro: corretor.logradouro || "",
      numero: corretor.numero || "",
      complemento: corretor.complemento || "",
      bairro: corretor.bairro || "",
      cidade: corretor.cidade || "",
      estado: corretor.estado || "",
      cep: corretor.cep || "",
    });
    setIsEditDialogOpen(true);
  };

  const handleView = (corretor: any) => {
    setSelectedCorretor(corretor);
    setIsViewDialogOpen(true);
  };

  const handleUpdate = () => {
    if (!selectedCorretor) return;
    
    const payload: any = {
      name: formData.name || undefined,
      email: formData.email || undefined,
      telefone: formData.telefone || undefined,
      status: formData.status,
      situacao: formData.situacao,
      cpf: formData.cpf || undefined,
      creci: formData.creci || undefined,
      logradouro: formData.logradouro || undefined,
      numero: formData.numero || undefined,
      complemento: formData.complemento || undefined,
      bairro: formData.bairro || undefined,
      cidade: formData.cidade || undefined,
      estado: formData.estado || undefined,
      cep: formData.cep || undefined,
    };
    
    if (formData.dataNascimento) {
      payload.dataNascimento = new Date(formData.dataNascimento);
    } else {
      payload.dataNascimento = null;
    }
    if (formData.dataCredenciamento) {
      payload.dataCredenciamento = new Date(formData.dataCredenciamento);
    } else {
      payload.dataCredenciamento = null;
    }
    if (formData.dataDescredenciamento) {
      payload.dataDescredenciamento = new Date(formData.dataDescredenciamento);
    } else {
      payload.dataDescredenciamento = null;
    }
    
    updateMutation.mutate({
      id: selectedCorretor.id,
      data: payload,
    });
  };

  const handleDelete = async (corretor: any) => {
    setSelectedCorretor(corretor);
    try {
      const result = await utils.corretores.countLeads.fetch({ corretorId: corretor.id });
      setLeadsCount(result.count);
    } catch (error) {
      setLeadsCount(0);
    }
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = (redistribuirLeads: boolean = false) => {
    if (!selectedCorretor) return;
    deleteMutation.mutate({ id: selectedCorretor.id, redistribuirLeads });
  };

  const toggleStatus = (corretor: any) => {
    const newStatus = corretor.status === "presente" ? "ausente" : "presente";
    updateStatusMutation.mutate({
      id: corretor.id,
      status: newStatus,
    });
  };

  const filteredCorretores = corretores.filter((corretor) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      corretor.name?.toLowerCase().includes(searchLower) ||
      corretor.email?.toLowerCase().includes(searchLower) ||
      corretor.telefone?.toLowerCase().includes(searchLower) ||
      corretor.cpf?.toLowerCase().includes(searchLower) ||
      corretor.creci?.toLowerCase().includes(searchLower)
    );
  });

  const presentesCount = corretores.filter((c) => c.status === "presente").length;
  const ausentesCount = corretores.filter((c) => c.status === "ausente").length;
  const ativosCount = corretores.filter((c) => c.situacao === "ativo").length;
  const inativosCount = corretores.filter((c) => c.situacao === "inativo").length;

  const formatDate = (date: any) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString('pt-BR');
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="container py-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-muted-foreground">Carregando corretores...</div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Componente do formulário reutilizável
  const CorretorForm = ({ isEdit = false }: { isEdit?: boolean }) => (
    <Tabs defaultValue="dados-pessoais" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="dados-pessoais">Dados Pessoais</TabsTrigger>
        <TabsTrigger value="profissional">Profissional</TabsTrigger>
        <TabsTrigger value="endereco">Endereço</TabsTrigger>
      </TabsList>
      
      <TabsContent value="dados-pessoais" className="space-y-4 mt-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 space-y-2">
            <Label htmlFor="name">Nome Completo *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Nome completo do corretor"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="cpf">CPF</Label>
            <Input
              id="cpf"
              value={formData.cpf}
              onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
              placeholder="000.000.000-00"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="dataNascimento">Data de Nascimento</Label>
            <Input
              id="dataNascimento"
              type="date"
              value={formData.dataNascimento}
              onChange={(e) => setFormData({ ...formData, dataNascimento: e.target.value })}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="email@exemplo.com"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="telefone">Telefone</Label>
            <Input
              id="telefone"
              value={formData.telefone}
              onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
              placeholder="(11) 99999-9999"
            />
          </div>
        </div>
      </TabsContent>
      
      <TabsContent value="profissional" className="space-y-4 mt-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="creci">CRECI</Label>
            <Input
              id="creci"
              value={formData.creci}
              onChange={(e) => setFormData({ ...formData, creci: e.target.value })}
              placeholder="Número do CRECI (se houver)"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="situacao">Situação</Label>
            <Select
              value={formData.situacao}
              onValueChange={(value: "ativo" | "inativo") =>
                setFormData({ ...formData, situacao: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="inativo">Inativo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="dataCredenciamento">Data de Credenciamento</Label>
            <Input
              id="dataCredenciamento"
              type="date"
              value={formData.dataCredenciamento}
              onChange={(e) => setFormData({ ...formData, dataCredenciamento: e.target.value })}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="dataDescredenciamento">Data de Descredenciamento</Label>
            <Input
              id="dataDescredenciamento"
              type="date"
              value={formData.dataDescredenciamento}
              onChange={(e) => setFormData({ ...formData, dataDescredenciamento: e.target.value })}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="status">Status de Plantão</Label>
            <Select
              value={formData.status}
              onValueChange={(value: "presente" | "ausente") =>
                setFormData({ ...formData, status: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="presente">Presente</SelectItem>
                <SelectItem value="ausente">Ausente</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </TabsContent>
      
      <TabsContent value="endereco" className="space-y-4 mt-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="cep">CEP</Label>
            <Input
              id="cep"
              value={formData.cep}
              onChange={(e) => setFormData({ ...formData, cep: e.target.value })}
              placeholder="00000-000"
            />
          </div>
          
          <div className="col-span-2 space-y-2">
            <Label htmlFor="logradouro">Logradouro</Label>
            <Input
              id="logradouro"
              value={formData.logradouro}
              onChange={(e) => setFormData({ ...formData, logradouro: e.target.value })}
              placeholder="Rua, Avenida, etc."
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="numero">Número</Label>
            <Input
              id="numero"
              value={formData.numero}
              onChange={(e) => setFormData({ ...formData, numero: e.target.value })}
              placeholder="Número"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="complemento">Complemento</Label>
            <Input
              id="complemento"
              value={formData.complemento}
              onChange={(e) => setFormData({ ...formData, complemento: e.target.value })}
              placeholder="Apto, Bloco, etc."
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="bairro">Bairro</Label>
            <Input
              id="bairro"
              value={formData.bairro}
              onChange={(e) => setFormData({ ...formData, bairro: e.target.value })}
              placeholder="Bairro"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="cidade">Cidade</Label>
            <Input
              id="cidade"
              value={formData.cidade}
              onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
              placeholder="Cidade"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="estado">Estado</Label>
            <Select
              value={formData.estado}
              onValueChange={(value) => setFormData({ ...formData, estado: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {estadosBrasileiros.map((uf) => (
                  <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </TabsContent>
    </Tabs>
  );

  return (
    <DashboardLayout>
      <div className="container py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Gestão de Corretores</h1>
            <p className="text-muted-foreground mt-1">
              Gerencie sua equipe de corretores com ficha completa
            </p>
          </div>
          <Button onClick={() => { resetForm(); setIsCreateDialogOpen(true); }}>
            <UserPlus className="mr-2 h-4 w-4" />
            Novo Corretor
          </Button>
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total de Corretores
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{corretores.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Ativos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">{ativosCount}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Presentes Agora
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">{presentesCount}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Inativos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-400">{inativosCount}</div>
            </CardContent>
          </Card>
        </div>

        {/* Busca */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, email, telefone, CPF ou CRECI..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Lista de Corretores */}
        <div className="grid grid-cols-1 gap-4">
          {filteredCorretores.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">
                  {searchTerm ? "Nenhum corretor encontrado" : "Nenhum corretor cadastrado"}
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredCorretores.map((corretor) => (
              <Card key={corretor.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-lg font-semibold text-primary">
                          {corretor.name?.charAt(0).toUpperCase()}
                        </span>
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-lg">{corretor.name}</h3>
                          <Badge variant={corretor.situacao === "ativo" ? "default" : "secondary"}>
                            {corretor.situacao === "ativo" ? "Ativo" : "Inativo"}
                          </Badge>
                          <Badge variant={corretor.status === "presente" ? "outline" : "secondary"} className={corretor.status === "presente" ? "border-green-500 text-green-600" : ""}>
                            {corretor.status === "presente" ? (
                              <>
                                <UserCheck className="mr-1 h-3 w-3" />
                                Presente
                              </>
                            ) : (
                              <>
                                <UserX className="mr-1 h-3 w-3" />
                                Ausente
                              </>
                            )}
                          </Badge>
                        </div>

                        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                          {corretor.email && (
                            <div className="flex items-center gap-1">
                              <Mail className="h-4 w-4" />
                              {corretor.email}
                            </div>
                          )}
                          {corretor.telefone && (
                            <div className="flex items-center gap-1">
                              <Phone className="h-4 w-4" />
                              {corretor.telefone}
                            </div>
                          )}
                          {corretor.creci && (
                            <div className="flex items-center gap-1">
                              <FileText className="h-4 w-4" />
                              CRECI: {corretor.creci}
                            </div>
                          )}
                          {corretor.dataCredenciamento && (
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              Desde: {formatDate(corretor.dataCredenciamento)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleView(corretor)}
                        title="Ver detalhes"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => toggleStatus(corretor)}
                        title={corretor.status === "presente" ? "Marcar como ausente" : "Marcar como presente"}
                      >
                        {corretor.status === "presente" ? (
                          <UserX className="h-4 w-4" />
                        ) : (
                          <UserCheck className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(corretor)}
                        title="Editar"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(corretor)}
                        title="Excluir"
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Dialog de Criação */}
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Cadastrar Novo Corretor</DialogTitle>
              <DialogDescription>
                Preencha os dados completos do novo corretor
              </DialogDescription>
            </DialogHeader>

            <CorretorForm />

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreate} disabled={createMutation.isPending}>
                {createMutation.isPending ? "Cadastrando..." : "Cadastrar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog de Edição */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Editar Corretor</DialogTitle>
              <DialogDescription>
                Atualize os dados do corretor
              </DialogDescription>
            </DialogHeader>

            <CorretorForm isEdit />

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog de Visualização */}
        <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Ficha do Corretor</DialogTitle>
            </DialogHeader>

            {selectedCorretor && (
              <div className="space-y-6">
                {/* Dados Pessoais */}
                <div>
                  <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                    <UserCheck className="h-5 w-5" />
                    Dados Pessoais
                  </h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Nome:</span>
                      <p className="font-medium">{selectedCorretor.name || "-"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">CPF:</span>
                      <p className="font-medium">{selectedCorretor.cpf || "-"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Data de Nascimento:</span>
                      <p className="font-medium">{formatDate(selectedCorretor.dataNascimento)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Email:</span>
                      <p className="font-medium">{selectedCorretor.email || "-"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Telefone:</span>
                      <p className="font-medium">{selectedCorretor.telefone || "-"}</p>
                    </div>
                  </div>
                </div>

                {/* Dados Profissionais */}
                <div>
                  <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Dados Profissionais
                  </h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">CRECI:</span>
                      <p className="font-medium">{selectedCorretor.creci || "-"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Situação:</span>
                      <p className="font-medium">
                        <Badge variant={selectedCorretor.situacao === "ativo" ? "default" : "secondary"}>
                          {selectedCorretor.situacao === "ativo" ? "Ativo" : "Inativo"}
                        </Badge>
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Data de Credenciamento:</span>
                      <p className="font-medium">{formatDate(selectedCorretor.dataCredenciamento)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Data de Descredenciamento:</span>
                      <p className="font-medium">{formatDate(selectedCorretor.dataDescredenciamento)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Status de Plantão:</span>
                      <p className="font-medium">
                        <Badge variant={selectedCorretor.status === "presente" ? "outline" : "secondary"} className={selectedCorretor.status === "presente" ? "border-green-500 text-green-600" : ""}>
                          {selectedCorretor.status === "presente" ? "Presente" : "Ausente"}
                        </Badge>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Endereço */}
                <div>
                  <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Endereço
                  </h3>
                  <div className="text-sm">
                    {selectedCorretor.logradouro ? (
                      <p className="font-medium">
                        {selectedCorretor.logradouro}, {selectedCorretor.numero}
                        {selectedCorretor.complemento && ` - ${selectedCorretor.complemento}`}
                        <br />
                        {selectedCorretor.bairro && `${selectedCorretor.bairro}, `}
                        {selectedCorretor.cidade && `${selectedCorretor.cidade}`}
                        {selectedCorretor.estado && ` - ${selectedCorretor.estado}`}
                        {selectedCorretor.cep && <><br />CEP: {selectedCorretor.cep}</>}
                      </p>
                    ) : (
                      <p className="text-muted-foreground">Endereço não cadastrado</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>
                Fechar
              </Button>
              <Button onClick={() => { setIsViewDialogOpen(false); handleEdit(selectedCorretor); }}>
                <Edit className="h-4 w-4 mr-2" />
                Editar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog de Confirmação de Exclusão */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={(open) => {
          setIsDeleteDialogOpen(open);
          if (!open) setLeadsCount(0);
        }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div>
                  <p>Tem certeza que deseja excluir o corretor <strong>{selectedCorretor?.name}</strong>?</p>
                  <p className="mt-2">Esta ação não pode ser desfeita.</p>
                  {leadsCount > 0 && (
                    <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-md">
                      <p className="text-amber-800 font-medium">
                        ⚠️ Este corretor possui {leadsCount} lead(s) atribuído(s).
                      </p>
                      <p className="text-amber-700 text-sm mt-1">
                        Ao excluir, os leads serão redistribuídos automaticamente para outros corretores disponíveis.
                      </p>
                    </div>
                  )}
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => confirmDelete(leadsCount > 0)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? "Excluindo..." : leadsCount > 0 ? "Excluir e Redistribuir Leads" : "Excluir"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}

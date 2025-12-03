import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { UserPlus, Edit, Trash2, UserCheck, UserX, Mail, Phone, Search } from "lucide-react";
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
}

export default function Corretores() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedCorretor, setSelectedCorretor] = useState<any>(null);
  const [formData, setFormData] = useState<CorretorFormData>({
    name: "",
    email: "",
    telefone: "",
    status: "ausente",
  });

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
    onSuccess: () => {
      toast.success("Corretor excluído com sucesso!");
      utils.corretores.list.invalidate();
      setIsDeleteDialogOpen(false);
      setSelectedCorretor(null);
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
    setFormData({
      name: "",
      email: "",
      telefone: "",
      status: "ausente",
    });
    setSelectedCorretor(null);
  };

  const handleCreate = () => {
    if (!formData.name || !formData.email) {
      toast.error("Nome e email são obrigatórios");
      return;
    }
    createMutation.mutate(formData);
  };

  const handleEdit = (corretor: any) => {
    setSelectedCorretor(corretor);
    setFormData({
      name: corretor.name || "",
      email: corretor.email || "",
      telefone: corretor.telefone || "",
      status: corretor.status || "ausente",
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdate = () => {
    if (!selectedCorretor) return;
    
    updateMutation.mutate({
      id: selectedCorretor.id,
      data: formData,
    });
  };

  const handleDelete = (corretor: any) => {
    setSelectedCorretor(corretor);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (!selectedCorretor) return;
    deleteMutation.mutate({ id: selectedCorretor.id });
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
      corretor.telefone?.toLowerCase().includes(searchLower)
    );
  });

  const presentesCount = corretores.filter((c) => c.status === "presente").length;
  const ausentesCount = corretores.filter((c) => c.status === "ausente").length;

  if (isLoading) {
    return (
      <div className="container py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Carregando corretores...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Gestão de Corretores</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie sua equipe de corretores e controle o status de plantão
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <UserPlus className="mr-2 h-4 w-4" />
          Novo Corretor
        </Button>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
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
              Presentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{presentesCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Ausentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-400">{ausentesCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Busca */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, email ou telefone..."
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
                        <Badge variant={corretor.status === "presente" ? "default" : "secondary"}>
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

                      <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                        {corretor.email && (
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4" />
                            <span>{corretor.email}</span>
                          </div>
                        )}
                        {corretor.telefone && (
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4" />
                            <span>{corretor.telefone}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleStatus(corretor)}
                    >
                      {corretor.status === "presente" ? "Marcar Ausente" : "Marcar Presente"}
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleEdit(corretor)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleDelete(corretor)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cadastrar Novo Corretor</DialogTitle>
            <DialogDescription>
              Preencha os dados do novo corretor. Email é obrigatório para envio de notificações.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Nome completo do corretor"
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

            <div className="space-y-2">
              <Label htmlFor="status">Status Inicial</Label>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Corretor</DialogTitle>
            <DialogDescription>
              Atualize os dados do corretor
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Nome</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-telefone">Telefone</Label>
              <Input
                id="edit-telefone"
                value={formData.telefone}
                onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-status">Status</Label>
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

      {/* Dialog de Confirmação de Exclusão */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o corretor <strong>{selectedCorretor?.name}</strong>?
              Esta ação não pode ser desfeita.
              {selectedCorretor && (
                <div className="mt-2 text-sm text-muted-foreground">
                  Nota: Não é possível excluir corretores que possuem leads atribuídos.
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

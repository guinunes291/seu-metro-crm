import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Star } from 'lucide-react';

export default function TemplatesComissao() {
  const utils = trpc.useUtils();
  
  // Estados do formulário
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [nome, setNome] = useState('');
  const [projectId, setProjectId] = useState<number | null>(null);
  const [percentualImobiliaria, setPercentualImobiliaria] = useState('3.50');
  const [percentualCorretor, setPercentualCorretor] = useState('1.85');
  const [percentualGerente, setPercentualGerente] = useState('0.50');
  const [percentualSuperintendente, setPercentualSuperintendente] = useState('0.30');
  const [isPadrao, setIsPadrao] = useState(false);

  // Queries
  const { data: templates, isLoading } = trpc.templates.listar.useQuery();
  const { data: projetos } = trpc.templates.listarProjetos.useQuery();

  // Mutations
  const criarMutation = trpc.templates.criar.useMutation({
    onSuccess: () => {
      toast.success('Template criado com sucesso!');
      utils.templates.listar.invalidate();
      fecharDialog();
    },
    onError: (error) => {
      toast.error(`Erro ao criar template: ${error.message}`);
    },
  });

  const atualizarMutation = trpc.templates.atualizar.useMutation({
    onSuccess: () => {
      toast.success('Template atualizado com sucesso!');
      utils.templates.listar.invalidate();
      fecharDialog();
    },
    onError: (error) => {
      toast.error(`Erro ao atualizar template: ${error.message}`);
    },
  });

  const excluirMutation = trpc.templates.excluir.useMutation({
    onSuccess: () => {
      toast.success('Template excluído com sucesso!');
      utils.templates.listar.invalidate();
    },
    onError: (error) => {
      toast.error(`Erro ao excluir template: ${error.message}`);
    },
  });

  const marcarPadraoMutation = trpc.templates.marcarPadrao.useMutation({
    onSuccess: () => {
      toast.success('Template marcado como padrão!');
      utils.templates.listar.invalidate();
    },
    onError: (error) => {
      toast.error(`Erro ao marcar como padrão: ${error.message}`);
    },
  });

  const fecharDialog = () => {
    setDialogOpen(false);
    setEditingId(null);
    setNome('');
    setProjectId(null);
    setPercentualImobiliaria('3.50');
    setPercentualCorretor('1.85');
    setPercentualGerente('0.50');
    setPercentualSuperintendente('0.30');
    setIsPadrao(false);
  };

  const abrirEdicao = (template: any) => {
    setEditingId(template.id);
    setNome(template.nome);
    setProjectId(template.projectId);
    setPercentualImobiliaria(template.percentualImobiliaria);
    setPercentualCorretor(template.percentualCorretor);
    setPercentualGerente(template.percentualGerente);
    setPercentualSuperintendente(template.percentualSuperintendente);
    setIsPadrao(template.isPadrao);
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const data = {
      nome,
      projectId,
      percentualImobiliaria: parseFloat(percentualImobiliaria.replace(',', '.')),
      percentualCorretor: parseFloat(percentualCorretor.replace(',', '.')),
      percentualGerente: parseFloat(percentualGerente.replace(',', '.')),
      percentualSuperintendente: parseFloat(percentualSuperintendente.replace(',', '.')),
      isPadrao,
    };

    if (editingId) {
      atualizarMutation.mutate({ id: editingId, ...data });
    } else {
      criarMutation.mutate(data);
    }
  };

  const handleExcluir = (id: number) => {
    if (confirm('Tem certeza que deseja excluir este template?')) {
      excluirMutation.mutate({ id });
    }
  };

  const handleMarcarPadrao = (id: number) => {
    marcarPadraoMutation.mutate({ id });
  };

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Templates de Comissão</h1>
          <p className="text-muted-foreground mt-1">
            Configure percentuais padrão por projeto/incorporadora
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingId(null)}>
              <Plus className="w-4 h-4 mr-2" />
              Novo Template
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingId ? 'Editar Template' : 'Novo Template'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome do Template *</Label>
                <Input
                  id="nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Incorporadora XYZ, Padrão Alto Padrão"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="projeto">Projeto (Opcional)</Label>
                <Select
                  value={projectId?.toString() || 'nenhum'}
                  onValueChange={(value) => setProjectId(value === 'nenhum' ? null : Number(value))}
                >
                  <SelectTrigger id="projeto">
                    <SelectValue placeholder="Selecione um projeto" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nenhum">Nenhum (Template genérico)</SelectItem>
                    {projetos?.map((projeto) => (
                      <SelectItem key={projeto.id} value={projeto.id.toString()}>
                        {projeto.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Se vinculado a um projeto, será aplicado automaticamente ao selecionar esse projeto
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="percentualImobiliaria">% Imobiliária *</Label>
                  <div className="relative">
                    <Input
                      id="percentualImobiliaria"
                      value={percentualImobiliaria}
                      onChange={(e) => setPercentualImobiliaria(e.target.value.replace(/[^\d,]/g, ''))}
                      placeholder="3,50"
                      className="pr-8"
                      required
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="percentualCorretor">% Corretor *</Label>
                  <div className="relative">
                    <Input
                      id="percentualCorretor"
                      value={percentualCorretor}
                      onChange={(e) => setPercentualCorretor(e.target.value.replace(/[^\d,]/g, ''))}
                      placeholder="1,85"
                      className="pr-8"
                      required
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="percentualGerente">% Gerente *</Label>
                  <div className="relative">
                    <Input
                      id="percentualGerente"
                      value={percentualGerente}
                      onChange={(e) => setPercentualGerente(e.target.value.replace(/[^\d,]/g, ''))}
                      placeholder="0,50"
                      className="pr-8"
                      required
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="percentualSuperintendente">% Superintendente *</Label>
                  <div className="relative">
                    <Input
                      id="percentualSuperintendente"
                      value={percentualSuperintendente}
                      onChange={(e) => setPercentualSuperintendente(e.target.value.replace(/[^\d,]/g, ''))}
                      placeholder="0,30"
                      className="pr-8"
                      required
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isPadrao"
                  checked={isPadrao}
                  onChange={(e) => setIsPadrao(e.target.checked)}
                  className="w-4 h-4"
                />
                <Label htmlFor="isPadrao" className="cursor-pointer">
                  Marcar como template padrão
                </Label>
              </div>
              <p className="text-xs text-muted-foreground">
                O template padrão será usado quando não houver template específico para o projeto
              </p>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={fecharDialog}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={criarMutation.isPending || atualizarMutation.isPending}>
                  {editingId ? 'Atualizar' : 'Criar'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Templates Cadastrados</CardTitle>
          <CardDescription>
            Gerencie os templates de percentuais de comissão
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p>Carregando...</p>
          ) : templates && templates.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Projeto</TableHead>
                  <TableHead className="text-right">Imobiliária</TableHead>
                  <TableHead className="text-right">Corretor</TableHead>
                  <TableHead className="text-right">Gerente</TableHead>
                  <TableHead className="text-right">Superintendente</TableHead>
                  <TableHead className="text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell className="font-medium">
                      {template.nome}
                      {template.isPadrao && (
                        <Badge variant="secondary" className="ml-2">
                          <Star className="w-3 h-3 mr-1" />
                          Padrão
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{template.projetoNome || '-'}</TableCell>
                    <TableCell className="text-right">{template.percentualImobiliaria}%</TableCell>
                    <TableCell className="text-right">{template.percentualCorretor}%</TableCell>
                    <TableCell className="text-right">{template.percentualGerente}%</TableCell>
                    <TableCell className="text-right">{template.percentualSuperintendente}%</TableCell>
                    <TableCell>
                      <div className="flex justify-center gap-2">
                        {!template.isPadrao && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleMarcarPadrao(template.id)}
                            title="Marcar como padrão"
                          >
                            <Star className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => abrirEdicao(template)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleExcluir(template.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              Nenhum template cadastrado. Clique em "Novo Template" para começar.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

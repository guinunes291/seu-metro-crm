import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Target, Users, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

export default function ProjetoFoco() {
  const { user } = useAuth();
  const isGestor = user?.role === "gestor" || user?.role === "admin";
  const utils = trpc.useUtils();
  
  // Estados
  const [projetoSelecionado, setProjetoSelecionado] = useState<number | null>(null);
  const [corretoresSelecionados, setCorretoresSelecionados] = useState<number[]>([]);
  const [observacoes, setObservacoes] = useState("");
  
  // Queries
  const { data: config, isLoading: loadingConfig } = trpc.fila.getProjetoFoco.useQuery();
  const { data: projetos, isLoading: loadingProjetos } = trpc.projects.list.useQuery();
  const { data: corretores, isLoading: loadingCorretores } = trpc.corretor.list.useQuery();
  
  // Mutations
  const setProjetoFoco = trpc.fila.setProjetoFoco.useMutation({
    onSuccess: () => {
      toast.success("Projeto foco configurado com sucesso!");
      utils.fila.getProjetoFoco.invalidate();
    },
    onError: (error) => {
      toast.error(`Erro ao configurar projeto foco: ${error.message}`);
    },
  });
  
  const toggleAtivo = trpc.fila.toggleProjetoFoco.useMutation({
    onSuccess: () => {
      toast.success(config?.ativo ? "Projeto foco desativado" : "Projeto foco ativado");
      utils.fila.getProjetoFoco.invalidate();
    },
    onError: (error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });
  
  // Inicializar estados quando config carregar
  useState(() => {
    if (config) {
      setProjetoSelecionado(config.projetoId);
      setCorretoresSelecionados(config.corretoresIds || []);
      setObservacoes(config.observacoes || "");
    }
  });
  
  const handleToggleCorretor = (corretorId: number) => {
    setCorretoresSelecionados(prev =>
      prev.includes(corretorId)
        ? prev.filter(id => id !== corretorId)
        : [...prev, corretorId]
    );
  };
  
  const handleSalvar = () => {
    if (!projetoSelecionado) {
      toast.error("Selecione um projeto foco");
      return;
    }
    
    if (corretoresSelecionados.length === 0) {
      toast.error("Selecione pelo menos um corretor");
      return;
    }
    
    setProjetoFoco.mutate({
      projetoId: projetoSelecionado,
      corretoresIds: corretoresSelecionados,
      observacoes,
    });
  };
  
  const handleDesativar = () => {
    setProjetoFoco.mutate({
      projetoId: null,
      corretoresIds: [],
      observacoes: "",
    });
    setProjetoSelecionado(null);
    setCorretoresSelecionados([]);
    setObservacoes("");
  };
  
  if (!isGestor) {
    return (
      <DashboardLayout>
        <div className="p-8 text-center">
          <p className="text-muted-foreground">Acesso restrito a gestores</p>
        </div>
      </DashboardLayout>
    );
  }
  
  const isLoading = loadingConfig || loadingProjetos || loadingCorretores;
  
  return (
    <DashboardLayout>
      <div className="p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Target className="h-8 w-8 text-primary" />
              Projeto Foco do Mês
            </h1>
            <p className="text-muted-foreground mt-2">
              Configure um projeto prioritário com distribuição dedicada via webhook
            </p>
          </div>
          
          {config && config.projetoId && (
            <div className="flex items-center gap-2">
              <Button
                variant={config.ativo ? "destructive" : "default"}
                onClick={() => toggleAtivo.mutate({ ativo: !config.ativo })}
                disabled={toggleAtivo.isPending}
              >
                {toggleAtivo.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : config.ativo ? (
                  <>
                    <XCircle className="h-4 w-4 mr-2" />
                    Desativar
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Ativar
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
        
        {/* Cards de Status */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Status</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {config?.ativo ? (
                  <span className="text-green-500">Ativo</span>
                ) : (
                  <span className="text-muted-foreground">Inativo</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {config?.ativo ? "Distribuição prioritária ativa" : "Usando fila geral"}
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Projeto Foco</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {config?.projeto?.nome || "Nenhum"}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Projeto prioritário configurado
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Corretores</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {config?.corretoresIds?.length || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Na fila do projeto foco
              </p>
            </CardContent>
          </Card>
        </div>
        
        {/* Configuração */}
        <Card>
          <CardHeader>
            <CardTitle>Configuração</CardTitle>
            <CardDescription>
              Selecione o projeto foco e os corretores que receberão leads deste projeto
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {/* Seleção de Projeto */}
                <div className="space-y-2">
                  <Label>Projeto Foco</Label>
                  <Select
                    value={projetoSelecionado?.toString() || ""}
                    onValueChange={(value) => setProjetoSelecionado(Number(value))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um projeto" />
                    </SelectTrigger>
                    <SelectContent>
                      {projetos?.map((projeto) => (
                        <SelectItem key={projeto.id} value={projeto.id.toString()}>
                          {projeto.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    Leads deste projeto serão distribuídos prioritariamente para os corretores selecionados
                  </p>
                </div>
                
                {/* Seleção de Corretores */}
                <div className="space-y-2">
                  <Label>Corretores da Fila Foco</Label>
                  <div className="border rounded-lg p-4 space-y-3 max-h-[400px] overflow-y-auto">
                    {corretores?.map((corretor) => (
                      <div
                        key={corretor.id}
                        className="flex items-center space-x-3 p-3 rounded-lg hover:bg-accent transition-colors"
                      >
                        <Checkbox
                          id={`corretor-${corretor.id}`}
                          checked={corretoresSelecionados.includes(corretor.id)}
                          onCheckedChange={() => handleToggleCorretor(corretor.id)}
                        />
                        <label
                          htmlFor={`corretor-${corretor.id}`}
                          className="flex-1 cursor-pointer"
                        >
                          <div className="font-medium">{corretor.name}</div>
                          <div className="text-sm text-muted-foreground">{corretor.email}</div>
                        </label>
                        <div>
                          {corretor.status === "presente" ? (
                            <span className="text-xs bg-green-500/10 text-green-500 px-2 py-1 rounded">
                              Presente
                            </span>
                          ) : (
                            <span className="text-xs bg-gray-500/10 text-gray-500 px-2 py-1 rounded">
                              Ausente
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Corretores selecionados receberão leads do projeto foco <strong>sem limite diário</strong>
                  </p>
                </div>
                
                {/* Observações */}
                <div className="space-y-2">
                  <Label>Observações (opcional)</Label>
                  <Textarea
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value)}
                    placeholder="Adicione observações sobre esta configuração..."
                    rows={3}
                  />
                </div>
                
                {/* Botões */}
                <div className="flex gap-3">
                  <Button
                    onClick={handleSalvar}
                    disabled={setProjetoFoco.isPending}
                    className="flex-1"
                  >
                    {setProjetoFoco.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Salvar Configuração
                      </>
                    )}
                  </Button>
                  
                  {config?.projetoId && (
                    <Button
                      variant="outline"
                      onClick={handleDesativar}
                      disabled={setProjetoFoco.isPending}
                    >
                      Limpar Configuração
                    </Button>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
        
        {/* Informações */}
        <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-900">
          <CardHeader>
            <CardTitle className="text-blue-900 dark:text-blue-100">Como funciona?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
            <p>
              <strong>Fila Projeto Foco:</strong> Leads do projeto selecionado são distribuídos apenas para os corretores da fila foco, <strong>sem limite diário</strong>.
            </p>
            <p>
              <strong>Fila Geral:</strong> Leads de outros projetos continuam sendo distribuídos para todos os corretores elegíveis, <strong>com limite diário</strong> configurado.
            </p>
            <p>
              <strong>Fallback:</strong> Se todos os corretores da fila foco estiverem ausentes, o lead do projeto foco vai para a fila geral.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

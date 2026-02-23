import { useState, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Target, Users, Zap, Loader2, Plus, Copy, Trash2, Power, PowerOff, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function ProjetoFoco() {
  const { user } = useAuth();
  const isGestor = user?.role === "gestor" || user?.role === "admin" || user?.role === "superintendente";
  const utils = trpc.useUtils();
  
  // Estados
  const [corretoresSelecionados, setCorretoresSelecionados] = useState<number[]>([]);
  const [showWebhookDialog, setShowWebhookDialog] = useState(false);
  const [webhookNome, setWebhookNome] = useState("");
  const [webhookFonte, setWebhookFonte] = useState<"facebook" | "instagram" | "google" | "rdstation" | "outro">("facebook");
  const [webhookProjeto, setWebhookProjeto] = useState<number | undefined>();
  
  // Queries
  const { data: config, isLoading: loadingConfig } = trpc.fila.getProjetoFoco.useQuery();
  const { data: corretores, isLoading: loadingCorretores } = trpc.corretores.list.useQuery();
  const { data: webhooks, isLoading: loadingWebhooks } = trpc.webhook.list.useQuery();
  const { data: projetos } = trpc.projects.list.useQuery();
  const { data: estoque } = trpc.distribution.getEstatisticasEstoque.useQuery();
  
  // Filtrar apenas webhooks da Fila Foco
  const webhooksFoco = webhooks?.filter(w => w.tipoFila === 'foco') || [];
  
  // Mutations
  const setProjetoFoco = trpc.fila.setProjetoFoco.useMutation({
    onSuccess: () => {
      toast.success("Corretores da Fila Foco atualizados!");
      utils.fila.getProjetoFoco.invalidate();
    },
    onError: (error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });
  
  const createWebhook = trpc.webhook.create.useMutation({
    onSuccess: () => {
      toast.success("Webhook criado com sucesso!");
      utils.webhook.list.invalidate();
      setShowWebhookDialog(false);
      setWebhookNome("");
      setWebhookFonte("facebook");
      setWebhookProjeto(undefined);
    },
    onError: (error) => {
      toast.error(`Erro ao criar webhook: ${error.message}`);
    },
  });
  
  const toggleWebhook = trpc.webhook.toggle.useMutation({
    onSuccess: () => {
      toast.success("Status do webhook atualizado!");
      utils.webhook.list.invalidate();
    },
    onError: (error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });
  
  const deleteWebhook = trpc.webhook.delete.useMutation({
    onSuccess: () => {
      toast.success("Webhook excluído!");
      utils.webhook.list.invalidate();
    },
    onError: (error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });
  
  // Inicializar corretores selecionados quando config carregar
  useEffect(() => {
    if (config && config.corretoresIds) {
      setCorretoresSelecionados(config.corretoresIds);
    }
  }, [config]);
  
  const handleToggleCorretor = (corretorId: number) => {
    setCorretoresSelecionados(prev =>
      prev.includes(corretorId)
        ? prev.filter(id => id !== corretorId)
        : [...prev, corretorId]
    );
  };
  
  const handleSalvarCorretores = () => {
    if (corretoresSelecionados.length === 0) {
      toast.error("Selecione pelo menos um corretor");
      return;
    }
    
    setProjetoFoco.mutate({
      projetoId: null, // Não precisa mais de projeto
      corretoresIds: corretoresSelecionados,
      observacoes: "",
    });
  };
  
  const handleCriarWebhook = () => {
    if (!webhookNome.trim()) {
      toast.error("Digite um nome para o webhook");
      return;
    }
    
    createWebhook.mutate({
      nome: webhookNome,
      fonte: webhookFonte,
      projectIdPadrao: webhookProjeto,
      tipoFila: 'foco',
    });
  };
  
  const handleCopyWebhookUrl = (token: string) => {
    const url = `${window.location.origin}/api/webhook/facebook-foco/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("URL copiada!");
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
  
  const isLoading = loadingConfig || loadingCorretores || loadingWebhooks;
  
  // Contar corretores presentes na fila
  const corretoresPresentes = corretores?.filter(c => 
    corretoresSelecionados.includes(c.id) && c.status === 'presente'
  ).length || 0;
  
  return (
    <DashboardLayout>
      <div className="p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Target className="h-8 w-8 text-primary" />
              Fila Foco
            </h1>
            <p className="text-muted-foreground mt-2">
              Distribua leads prioritários sem limites diários para corretores selecionados
            </p>
          </div>
        </div>
        
        {/* Cards de Status */}
        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Corretores na Fila</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{corretoresSelecionados.length}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {corretoresPresentes} presentes agora
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Webhooks Ativos</CardTitle>
              <Zap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {webhooksFoco.filter(w => w.ativo).length}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                de {webhooksFoco.length} configurados
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Leads Hoje</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground mt-1">
                distribuídos automaticamente
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total via Webhook</CardTitle>
              <Zap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {webhooksFoco.reduce((acc, w) => acc + (w.leadsRecebidos || 0), 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                leads recebidos
              </p>
            </CardContent>
          </Card>
          
          <Card className={estoque && estoque.porFila.foco > 0 ? "border-orange-200 bg-orange-50/50" : ""}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Estoque Foco</CardTitle>
              <Package className={`h-4 w-4 ${estoque && estoque.porFila.foco > 0 ? "text-orange-600" : "text-muted-foreground"}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${estoque && estoque.porFila.foco > 0 ? "text-orange-600" : ""}`}>
                {estoque?.porFila.foco || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {estoque && estoque.porFila.foco > 0 ? (
                  <span className="text-orange-600 font-medium">
                    aguardando distribuição
                  </span>
                ) : (
                  "nenhum em espera"
                )}
              </p>
            </CardContent>
          </Card>
        </div>
        
        {/* Fila de Corretores */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Fila de Corretores
              </CardTitle>
              <CardDescription>
                Ordem de distribuição dos leads. O primeiro da fila recebe o próximo lead.
              </CardDescription>
            </div>
            <Button
              onClick={handleSalvarCorretores}
              disabled={setProjetoFoco.isPending || corretoresSelecionados.length === 0}
            >
              {setProjetoFoco.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar Fila"
              )}
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-3">
                {corretores?.map((corretor, index) => {
                  const isSelected = corretoresSelecionados.includes(corretor.id);
                  const posicao = corretoresSelecionados.indexOf(corretor.id) + 1;
                  
                  return (
                    <div
                      key={corretor.id}
                      className={`flex items-center gap-4 p-4 rounded-lg border transition-colors ${
                        isSelected ? 'bg-accent border-primary' : 'hover:bg-accent/50'
                      }`}
                    >
                      {isSelected && (
                        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary text-primary-foreground font-bold">
                          {posicao}
                        </div>
                      )}
                      
                      <Checkbox
                        id={`corretor-${corretor.id}`}
                        checked={isSelected}
                        onCheckedChange={() => handleToggleCorretor(corretor.id)}
                      />
                      
                      <div className="flex-1">
                        <div className="font-medium">{corretor.name}</div>
                        <div className="text-sm text-muted-foreground">{corretor.email}</div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <div className="text-sm text-muted-foreground">
                          Máx/dia: <span className="font-medium">{corretor.limiteDiarioWebhook || 10}</span>
                        </div>
                        
                        {corretor.status === "presente" ? (
                          <span className="text-xs bg-green-500/10 text-green-500 px-3 py-1 rounded-full font-medium">
                            Presente
                          </span>
                        ) : (
                          <span className="text-xs bg-gray-500/10 text-gray-500 px-3 py-1 rounded-full font-medium">
                            Ausente
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Integrações (Webhooks) */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Integrações (Webhooks)
              </CardTitle>
              <CardDescription>
                Configure webhooks para receber leads automaticamente do Facebook Ads e outras fontes.
              </CardDescription>
            </div>
            <Button onClick={() => setShowWebhookDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Webhook
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {webhooksFoco.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum webhook configurado. Clique em "Novo Webhook" para criar.
              </div>
            ) : (
              webhooksFoco.map((webhook) => (
                <div
                  key={webhook.id}
                  className="border rounded-lg p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${webhook.ativo ? 'bg-green-500' : 'bg-gray-400'}`} />
                      <div>
                        <div className="font-medium">{webhook.nome}</div>
                        <div className="text-sm text-muted-foreground">
                          {webhook.leadsRecebidos || 0} leads recebidos
                          {webhook.ultimoLeadRecebido && (
                            <> · Último: {new Date(webhook.ultimoLeadRecebido).toLocaleString('pt-BR')}</>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleWebhook.mutate({ webhookId: webhook.id, ativo: !webhook.ativo })}
                        disabled={toggleWebhook.isPending}
                      >
                        {webhook.ativo ? (
                          <PowerOff className="h-4 w-4" />
                        ) : (
                          <Power className="h-4 w-4" />
                        )}
                      </Button>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteWebhook.mutate({ webhookId: webhook.id })}
                        disabled={deleteWebhook.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">URL do Webhook:</Label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        readOnly
                        value={`${window.location.origin}/api/webhook/facebook-foco/${webhook.webhookToken}`}
                        className="flex-1 px-3 py-2 bg-muted border rounded-md text-sm font-mono"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopyWebhookUrl(webhook.webhookToken)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Use esta URL no Facebook Ads Manager para enviar leads automaticamente.
                    </p>
                  </div>
                </div>
              ))
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
              <strong>Fila Foco:</strong> Leads recebidos via webhooks configurados nesta página são distribuídos APENAS para os corretores selecionados, <strong>sem limite diário</strong>.
            </p>
            <p>
              <strong>Distribuição Round-Robin:</strong> O primeiro corretor presente na fila recebe o lead e vai para o final da fila.
            </p>
            <p>
              <strong>Webhooks Exclusivos:</strong> Cada webhook criado aqui usa o endpoint <code className="bg-white dark:bg-slate-900 px-1 py-0.5 rounded">/api/webhook/facebook-foco/:token</code> e distribui apenas para esta fila.
            </p>
          </CardContent>
        </Card>
      </div>
      
      {/* Dialog de Criar Webhook */}
      <Dialog open={showWebhookDialog} onOpenChange={setShowWebhookDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Novo Webhook</DialogTitle>
            <DialogDescription>
              Configure um webhook para receber leads automaticamente da Fila Foco
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="webhook-nome">Nome do Webhook</Label>
              <Input
                id="webhook-nome"
                placeholder="Ex: Campanha Rio Branco"
                value={webhookNome}
                onChange={(e) => setWebhookNome(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="webhook-fonte">Fonte</Label>
              <Select value={webhookFonte} onValueChange={(v: any) => setWebhookFonte(v)}>
                <SelectTrigger id="webhook-fonte">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="facebook">Facebook</SelectItem>
                  <SelectItem value="instagram">Instagram</SelectItem>
                  <SelectItem value="google">Google</SelectItem>
                  <SelectItem value="rdstation">RD Station</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="webhook-projeto">Projeto Padrão (opcional)</Label>
              <Select 
                value={webhookProjeto?.toString() || "_none"} 
                onValueChange={(v) => setWebhookProjeto(v === "_none" ? undefined : Number(v))}
              >
                <SelectTrigger id="webhook-projeto">
                  <SelectValue placeholder="Selecione um projeto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Nenhum</SelectItem>
                  {projetos?.map((projeto) => (
                    <SelectItem key={projeto.id} value={projeto.id.toString()}>
                      {projeto.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowWebhookDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCriarWebhook} disabled={createWebhook.isPending}>
              {createWebhook.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Criando...
                </>
              ) : (
                "Criar Webhook"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

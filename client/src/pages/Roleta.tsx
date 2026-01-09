import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { 
  RefreshCw, 
  Play, 
  Settings, 
  Copy, 
  Plus, 
  Trash2, 
  ExternalLink,
  Users,
  Zap,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle
} from "lucide-react";

export default function Roleta() {
  const { user } = useAuth();
  const [novoWebhookOpen, setNovoWebhookOpen] = useState(false);
  const [novoWebhook, setNovoWebhook] = useState({ nome: "", fonte: "facebook" as const, projectIdPadrao: "" });
  const [mappingDialogOpen, setMappingDialogOpen] = useState(false);
  const [selectedWebhookId, setSelectedWebhookId] = useState<number | null>(null);
  const [newFormId, setNewFormId] = useState("");
  const [newProjectId, setNewProjectId] = useState("");
  
  // Queries
  const { data: fila, refetch: refetchFila, isLoading: loadingFila } = trpc.fila.list.useQuery();
  const { data: webhooks, refetch: refetchWebhooks, isLoading: loadingWebhooks } = trpc.webhook.list.useQuery();
  const { data: projetos } = trpc.projects.list.useQuery();
  
  // Mutations
  const inicializarFila = trpc.fila.inicializar.useMutation({
    onSuccess: () => {
      refetchFila();
      toast.success("Fila inicializada com sucesso!");
    },
  });
  
  const toggleAtivo = trpc.fila.toggleAtivo.useMutation({
    onSuccess: () => {
      refetchFila();
      toast.success("Corretor atualizado!");
    },
  });
  
  const updateMaxLeads = trpc.fila.updateMaxLeads.useMutation({
    onSuccess: () => {
      refetchFila();
      toast.success("Limite atualizado!");
    },
  });
  
  const resetarContadores = trpc.fila.resetarContadores.useMutation({
    onSuccess: () => {
      refetchFila();
      toast.success("Contadores resetados!");
    },
  });
  
  const criarWebhook = trpc.webhook.create.useMutation({
    onSuccess: (data) => {
      refetchWebhooks();
      setNovoWebhookOpen(false);
      setNovoWebhook({ nome: "", fonte: "facebook", projectIdPadrao: "" });
      toast.success(`Webhook criado com sucesso! Token: ${data.webhookToken}`);
    },
  });
  
  const toggleWebhook = trpc.webhook.toggle.useMutation({
    onSuccess: () => {
      refetchWebhooks();
      toast.success("Webhook atualizado!");
    },
  });
  
  const deleteWebhook = trpc.webhook.delete.useMutation({
    onSuccess: () => {
      refetchWebhooks();
      toast.success("Webhook excluído!");
    },
  });
  
  const updateFormIdMapping = trpc.webhook.updateFormIdMapping.useMutation({
    onSuccess: () => {
      refetchWebhooks();
      setMappingDialogOpen(false);
      setNewFormId("");
      setNewProjectId("");
      toast.success("Mapeamento atualizado!");
    },
    onError: (error) => {
      toast.error("Erro ao atualizar mapeamento", {
        description: error.message,
      });
    },
  });
  
  // Verificar permissão
  if (user?.role !== 'gestor' && user?.role !== 'admin') {
    return (
      <DashboardLayout>
        <div className="container py-8">
          <div className="flex items-center justify-center h-full">
            <Card className="max-w-md">
              <CardHeader>
                <CardTitle className="text-red-500">Acesso Negado</CardTitle>
                <CardDescription>
                  Apenas gestores podem acessar a configuração da roleta de distribuição.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </DashboardLayout>
    );
  }
  
  const copiarUrl = (token: string) => {
    const baseUrl = window.location.origin;
    const url = `${baseUrl}/api/webhook/facebook/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("URL copiada! Cole no Facebook Ads Manager");
  };
  
  const getInitials = (name: string | null) => {
    if (!name) return "??";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };
  
  return (
    <DashboardLayout>
      <div className="container py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Roleta de Distribuição</h1>
        <p className="text-muted-foreground mt-1">
          Configure a distribuição automática de leads do Facebook Ads
        </p>
      </div>
      
      {/* Cards de estatísticas */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Corretores na Fila</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fila?.length || 0}</div>
            <p className="text-xs text-muted-foreground">
              {fila?.filter(f => f.ativo).length || 0} ativos
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Webhooks Ativos</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{webhooks?.filter(w => w.ativo).length || 0}</div>
            <p className="text-xs text-muted-foreground">
              de {webhooks?.length || 0} configurados
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Leads Hoje</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {fila?.reduce((acc, f) => acc + f.leadsRecebidosHoje, 0) || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              distribuídos automaticamente
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total via Webhook</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {webhooks?.reduce((acc, w) => acc + w.leadsRecebidos, 0) || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              leads recebidos
            </p>
          </CardContent>
        </Card>
      </div>
      
      {/* Fila de Distribuição */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Fila de Corretores
              </CardTitle>
              <CardDescription>
                Ordem de distribuição dos leads. O primeiro da fila recebe o próximo lead.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => resetarContadores.mutate()}
                disabled={resetarContadores.isPending}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Resetar Contadores
              </Button>
              <Button 
                size="sm"
                onClick={() => inicializarFila.mutate()}
                disabled={inicializarFila.isPending}
              >
                <Play className="h-4 w-4 mr-2" />
                Inicializar Fila
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingFila ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : !fila || fila.length === 0 ? (
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">Nenhum corretor na fila</p>
              <Button onClick={() => inicializarFila.mutate()}>
                Inicializar Fila
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {fila.map((item, index) => (
                <div 
                  key={item.id}
                  className={`flex items-center justify-between p-4 rounded-lg border ${
                    item.ativo && item.corretorStatus === 'presente' 
                      ? 'bg-green-50 border-green-200' 
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                      index === 0 ? 'bg-yellow-500 text-white' : 'bg-gray-300 text-gray-700'
                    }`}>
                      {index + 1}
                    </div>
                    
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={item.corretorFoto || undefined} />
                      <AvatarFallback>{getInitials(item.corretorNome)}</AvatarFallback>
                    </Avatar>
                    
                    <div>
                      <div className="font-medium">{item.corretorNome || 'Sem nome'}</div>
                      <div className="text-sm text-muted-foreground flex items-center gap-2">
                        <Badge variant={item.corretorStatus === 'presente' ? 'default' : 'secondary'}>
                          {item.corretorStatus === 'presente' ? 'Presente' : 'Ausente'}
                        </Badge>
                        <span>•</span>
                        <span>{item.leadsRecebidosHoje}/{item.maxLeadsDia} leads hoje</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`max-${item.id}`} className="text-sm text-muted-foreground">
                        Máx/dia:
                      </Label>
                      <Input
                        id={`max-${item.id}`}
                        type="number"
                        min={1}
                        max={100}
                        value={item.maxLeadsDia}
                        onChange={(e) => {
                          const value = parseInt(e.target.value);
                          if (value >= 1 && value <= 100) {
                            updateMaxLeads.mutate({ corretorId: item.corretorId, maxLeadsDia: value });
                          }
                        }}
                        className="w-16 h-8"
                      />
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`ativo-${item.id}`} className="text-sm text-muted-foreground">
                        Ativo:
                      </Label>
                      <Switch
                        id={`ativo-${item.id}`}
                        checked={item.ativo}
                        onCheckedChange={(checked) => {
                          toggleAtivo.mutate({ corretorId: item.corretorId, ativo: checked });
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Webhooks */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Integrações (Webhooks)
              </CardTitle>
              <CardDescription>
                Configure webhooks para receber leads automaticamente do Facebook Ads e outras fontes.
              </CardDescription>
            </div>
            <Dialog open={novoWebhookOpen} onOpenChange={setNovoWebhookOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Webhook
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Criar Novo Webhook</DialogTitle>
                  <DialogDescription>
                    Configure um webhook para receber leads automaticamente.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="nome">Nome da Integração</Label>
                    <Input
                      id="nome"
                      placeholder="Ex: Campanha Lançamento Verão"
                      value={novoWebhook.nome}
                      onChange={(e) => setNovoWebhook({ ...novoWebhook, nome: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fonte">Fonte</Label>
                    <Select 
                      value={novoWebhook.fonte} 
                      onValueChange={(value: any) => setNovoWebhook({ ...novoWebhook, fonte: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="facebook">Facebook Ads</SelectItem>
                        <SelectItem value="instagram">Instagram Ads</SelectItem>
                        <SelectItem value="google">Google Ads</SelectItem>
                        <SelectItem value="rdstation">RD Station</SelectItem>
                        <SelectItem value="outro">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="projeto">Projeto Padrão (opcional)</Label>
                    <Select 
                      value={novoWebhook.projectIdPadrao} 
                      onValueChange={(value) => setNovoWebhook({ ...novoWebhook, projectIdPadrao: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um projeto" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Nenhum</SelectItem>
                        {projetos?.map((p) => (
                          <SelectItem key={p.id} value={p.id.toString()}>
                            {p.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setNovoWebhookOpen(false)}>
                    Cancelar
                  </Button>
                  <Button 
                    onClick={() => criarWebhook.mutate({
                      nome: novoWebhook.nome,
                      fonte: novoWebhook.fonte,
                      projectIdPadrao: novoWebhook.projectIdPadrao ? parseInt(novoWebhook.projectIdPadrao) : undefined,
                    })}
                    disabled={!novoWebhook.nome || criarWebhook.isPending}
                  >
                    Criar Webhook
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {loadingWebhooks ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : !webhooks || webhooks.length === 0 ? (
            <div className="text-center py-8">
              <Zap className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">Nenhum webhook configurado</p>
              <Button onClick={() => setNovoWebhookOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Primeiro Webhook
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {webhooks.map((webhook) => (
                <div 
                  key={webhook.id}
                  className={`p-4 rounded-lg border ${
                    webhook.ativo ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${webhook.ativo ? 'bg-green-500' : 'bg-gray-400'}`} />
                      <div>
                        <div className="font-medium">{webhook.nome}</div>
                        <div className="text-sm text-muted-foreground flex items-center gap-2">
                          <Badge variant="outline">{webhook.fonte}</Badge>
                          <span>•</span>
                          <span>{webhook.leadsRecebidos} leads recebidos</span>
                          {webhook.ultimoLeadRecebido && (
                            <>
                              <span>•</span>
                              <span>Último: {new Date(webhook.ultimoLeadRecebido).toLocaleDateString('pt-BR')}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={webhook.ativo}
                        onCheckedChange={(checked) => {
                          toggleWebhook.mutate({ webhookId: webhook.id, ativo: checked });
                        }}
                      />
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => {
                          if (confirm('Tem certeza que deseja excluir este webhook?')) {
                            deleteWebhook.mutate({ webhookId: webhook.id });
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="bg-white p-3 rounded border">
                    <div className="text-xs text-muted-foreground mb-1">URL do Webhook:</div>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-sm bg-gray-100 p-2 rounded overflow-x-auto">
                        {window.location.origin}/api/webhook/facebook/{webhook.webhookToken}
                      </code>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => copiarUrl(webhook.webhookToken)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Use esta URL no Facebook Ads Manager para enviar leads automaticamente.
                    </p>
                  </div>
                  
                  {/* Mapeamento de Form IDs */}
                  <div className="mt-3 bg-white p-3 rounded border">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs font-medium">Mapeamento de Form IDs</div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          setSelectedWebhookId(webhook.id);
                          setMappingDialogOpen(true);
                        }}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Adicionar
                      </Button>
                    </div>
                    {(() => {
                      try {
                        const mapping = webhook.formIdMapping ? JSON.parse(webhook.formIdMapping) : {};
                        return mapping && Object.keys(mapping).length > 0;
                      } catch {
                        return false;
                      }
                    })() ? (
                      <div className="space-y-1">
                        {Object.entries(JSON.parse(webhook.formIdMapping || '{}') as Record<string, number>).map(
                          ([formId, projectId]) => {
                            const project = projetos?.find((p) => p.id === projectId);
                            return (
                              <div
                                key={formId}
                                className="flex items-center justify-between p-2 bg-gray-50 rounded text-xs"
                              >
                                <div>
                                  <span className="font-mono">{formId}</span>
                                  <span className="text-muted-foreground mx-2">→</span>
                                  <span>{project?.nome || `Projeto #${projectId}`}</span>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                  onClick={() => {
                                    const currentMapping = JSON.parse(webhook.formIdMapping || '{}');
                                    delete currentMapping[formId];
                                    updateFormIdMapping.mutate({
                                      webhookId: webhook.id,
                                      formIdMapping: currentMapping,
                                    });
                                  }}
                                >
                                  <Trash2 className="h-3 w-3 text-red-500" />
                                </Button>
                              </div>
                            );
                          }
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Nenhum mapeamento configurado. Clique em "Adicionar" para mapear Form IDs para projetos.
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Instruções */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Como Configurar o Facebook Ads
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-medium">1. Crie um webhook acima</h4>
            <p className="text-sm text-muted-foreground">
              Clique em "Novo Webhook" e dê um nome para identificar a campanha.
            </p>
          </div>
          
          <div className="space-y-2">
            <h4 className="font-medium">2. Copie a URL do webhook</h4>
            <p className="text-sm text-muted-foreground">
              Clique no botão de copiar ao lado da URL gerada.
            </p>
          </div>
          
          <div className="space-y-2">
            <h4 className="font-medium">3. Configure no Facebook Ads Manager</h4>
            <p className="text-sm text-muted-foreground">
              No Facebook Business Suite, vá em Configurações → Integrações → Webhooks.
              Cole a URL copiada e configure para enviar os campos: nome, email e telefone.
            </p>
          </div>
          
          <div className="space-y-2">
            <h4 className="font-medium">4. Teste a integração</h4>
            <p className="text-sm text-muted-foreground">
              Envie um lead de teste pelo Facebook e verifique se ele aparece no CRM.
            </p>
          </div>
          
          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <h4 className="font-medium text-yellow-800 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Importante
            </h4>
            <p className="text-sm text-yellow-700 mt-1">
              Certifique-se de que há pelo menos um corretor com status "Presente" e ativo na fila 
              para que os leads sejam distribuídos automaticamente.
            </p>
          </div>
        </CardContent>
      </Card>
      
      {/* Dialog de Mapeamento de Form IDs */}
      <Dialog open={mappingDialogOpen} onOpenChange={setMappingDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Mapeamento de Form ID</DialogTitle>
            <DialogDescription>
              Configure qual projeto deve ser atribuído automaticamente quando um lead vier de um formulário específico do Facebook.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="formId">Form ID do Facebook</Label>
              <Input
                id="formId"
                placeholder="Ex: 123456789012345"
                value={newFormId}
                onChange={(e) => setNewFormId(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Você encontra o Form ID no Facebook Ads Manager, nas configurações do formulário.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="projectId">Projeto</Label>
              <Select value={newProjectId} onValueChange={setNewProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o projeto" />
                </SelectTrigger>
                <SelectContent>
                  {projetos?.map((p) => (
                    <SelectItem key={p.id} value={p.id.toString()}>
                      {p.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setMappingDialogOpen(false);
                setNewFormId("");
                setNewProjectId("");
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (!selectedWebhookId || !newFormId || !newProjectId) {
                  toast.error("Preencha todos os campos");
                  return;
                }
                const webhook = webhooks?.find((w) => w.id === selectedWebhookId);
                const currentMapping = JSON.parse(webhook?.formIdMapping || '{}');
                currentMapping[newFormId] = parseInt(newProjectId);
                updateFormIdMapping.mutate({
                  webhookId: selectedWebhookId,
                  formIdMapping: currentMapping,
                });
              }}
              disabled={!newFormId || !newProjectId || updateFormIdMapping.isPending}
            >
              Adicionar Mapeamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </DashboardLayout>
  );
}

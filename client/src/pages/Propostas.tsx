import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { FileText, Plus, Eye, Send, Copy, ExternalLink, Loader2, Search, Building2, User, DollarSign, Calendar } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

const STATUS_COLORS: Record<string, string> = {
  rascunho: "bg-slate-500",
  enviada: "bg-blue-500",
  visualizada: "bg-amber-500",
  aceita: "bg-green-500",
  recusada: "bg-red-500",
  expirada: "bg-gray-500"
};

const STATUS_LABELS: Record<string, string> = {
  rascunho: "Rascunho",
  enviada: "Enviada",
  visualizada: "Visualizada",
  aceita: "Aceita",
  recusada: "Recusada",
  expirada: "Expirada"
};

export default function Propostas() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [searchLead, setSearchLead] = useState("");
  const [selectedLead, setSelectedLead] = useState<any>(null);
  
  const [novaProposta, setNovaProposta] = useState({
    leadId: 0,
    projectId: 0,
    nomeCliente: "",
    emailCliente: "",
    telefoneCliente: "",
    unidade: "",
    tipologia: "",
    metragem: 0,
    valorImovel: 0,
    valorEntrada: 0,
    valorFinanciamento: 0,
    parcelas: 360,
    valorParcela: 0,
    taxaJuros: "9.5% a.a.",
    desconto: 0,
    motivoDesconto: "",
    mensagemPersonalizada: "",
    validoAte: ""
  });

  // Queries
  const { data: propostas, isLoading } = trpc.propostas.list.useQuery();
  const { data: projetos } = trpc.projects.list.useQuery();
  const { data: leadsSearch } = trpc.searchLeads.byIdentifier.useQuery(
    { identifier: searchLead },
    { enabled: searchLead.length >= 3 }
  );

  // Mutations
  const createProposta = trpc.propostas.create.useMutation({
    onSuccess: () => {
      utils.propostas.list.invalidate();
      setShowCreateDialog(false);
      resetForm();
      toast.success("Proposta criada com sucesso!");
    }
  });

  const enviarProposta = trpc.propostas.enviar.useMutation({
    onSuccess: () => {
      utils.propostas.list.invalidate();
      toast.success("Proposta enviada!");
    }
  });

  const resetForm = () => {
    setNovaProposta({
      leadId: 0,
      projectId: 0,
      nomeCliente: "",
      emailCliente: "",
      telefoneCliente: "",
      unidade: "",
      tipologia: "",
      metragem: 0,
      valorImovel: 0,
      valorEntrada: 0,
      valorFinanciamento: 0,
      parcelas: 360,
      valorParcela: 0,
      taxaJuros: "9.5% a.a.",
      desconto: 0,
      motivoDesconto: "",
      mensagemPersonalizada: "",
      validoAte: ""
    });
    setSelectedLead(null);
    setSearchLead("");
  };

  const handleSelectLead = (lead: any) => {
    setSelectedLead(lead);
    setNovaProposta({
      ...novaProposta,
      leadId: lead.id,
      nomeCliente: lead.nome || "",
      emailCliente: lead.email || "",
      telefoneCliente: lead.telefone || "",
      projectId: lead.projectId || 0
    });
    setSearchLead("");
  };

  const calcularFinanciamento = () => {
    const valorFinanciamento = novaProposta.valorImovel - novaProposta.valorEntrada - novaProposta.desconto;
    const taxaMensal = 0.0079; // ~9.5% a.a.
    const parcelas = novaProposta.parcelas || 360;
    const valorParcela = valorFinanciamento * (taxaMensal * Math.pow(1 + taxaMensal, parcelas)) / (Math.pow(1 + taxaMensal, parcelas) - 1);
    
    setNovaProposta({
      ...novaProposta,
      valorFinanciamento,
      valorParcela: Math.round(valorParcela)
    });
  };

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/proposta/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiado!");
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value / 100);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Propostas Digitais</h1>
            <p className="text-slate-400">Crie e gerencie propostas interativas para seus clientes</p>
          </div>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button className="bg-amber-500 hover:bg-amber-600">
                <Plus className="h-4 w-4 mr-2" />
                Nova Proposta
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-slate-800 border-slate-700 max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-white">Criar Nova Proposta</DialogTitle>
                <DialogDescription className="text-slate-400">
                  Preencha os dados para gerar uma proposta digital interativa
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-6 py-4">
                {/* Busca de Lead */}
                <div className="space-y-2">
                  <Label className="text-slate-300">Cliente</Label>
                  {selectedLead ? (
                    <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                      <div>
                        <p className="font-medium text-white">{selectedLead.nome}</p>
                        <p className="text-sm text-slate-400">{selectedLead.telefone}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedLead(null)}
                        className="text-slate-400"
                      >
                        Alterar
                      </Button>
                    </div>
                  ) : (
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        value={searchLead}
                        onChange={(e) => setSearchLead(e.target.value)}
                        placeholder="Buscar por nome, telefone ou email..."
                        className="pl-10 bg-slate-700 border-slate-600 text-white"
                      />
                      {leadsSearch && leadsSearch.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-slate-700 border border-slate-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                          {leadsSearch.map((lead) => (
                            <button
                              key={lead.id}
                              onClick={() => handleSelectLead(lead)}
                              className="w-full p-3 text-left hover:bg-slate-600 border-b border-slate-600 last:border-0"
                            >
                              <p className="font-medium text-white">{lead.nome}</p>
                              <p className="text-sm text-slate-400">{lead.telefone} • {lead.email}</p>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Projeto */}
                <div className="space-y-2">
                  <Label className="text-slate-300">Empreendimento</Label>
                  <Select 
                    value={novaProposta.projectId ? String(novaProposta.projectId) : ""}
                    onValueChange={(v) => setNovaProposta({ ...novaProposta, projectId: Number(v) })}
                  >
                    <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                      <SelectValue placeholder="Selecione o empreendimento" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-700 border-slate-600">
                      {projetos?.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)} className="text-white">
                          {p.nome} - {p.construtora}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Dados do Imóvel */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-slate-300">Unidade</Label>
                    <Input
                      value={novaProposta.unidade}
                      onChange={(e) => setNovaProposta({ ...novaProposta, unidade: e.target.value })}
                      placeholder="Ex: Apto 101, Torre A"
                      className="bg-slate-700 border-slate-600 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300">Tipologia</Label>
                    <Input
                      value={novaProposta.tipologia}
                      onChange={(e) => setNovaProposta({ ...novaProposta, tipologia: e.target.value })}
                      placeholder="Ex: 2 dorms, 1 suíte"
                      className="bg-slate-700 border-slate-600 text-white"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-300">Metragem (m²)</Label>
                  <Input
                    type="number"
                    value={novaProposta.metragem || ""}
                    onChange={(e) => setNovaProposta({ ...novaProposta, metragem: Number(e.target.value) })}
                    placeholder="Ex: 65"
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                </div>

                {/* Valores */}
                <div className="space-y-4 p-4 bg-slate-700/30 rounded-lg">
                  <h4 className="font-medium text-white flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-amber-500" />
                    Valores
                  </h4>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-slate-300">Valor do Imóvel (R$)</Label>
                      <Input
                        type="number"
                        value={novaProposta.valorImovel / 100 || ""}
                        onChange={(e) => setNovaProposta({ ...novaProposta, valorImovel: Number(e.target.value) * 100 })}
                        placeholder="Ex: 250000"
                        className="bg-slate-700 border-slate-600 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-300">Entrada (R$)</Label>
                      <Input
                        type="number"
                        value={novaProposta.valorEntrada / 100 || ""}
                        onChange={(e) => setNovaProposta({ ...novaProposta, valorEntrada: Number(e.target.value) * 100 })}
                        placeholder="Ex: 25000"
                        className="bg-slate-700 border-slate-600 text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-slate-300">Desconto (R$)</Label>
                      <Input
                        type="number"
                        value={novaProposta.desconto / 100 || ""}
                        onChange={(e) => setNovaProposta({ ...novaProposta, desconto: Number(e.target.value) * 100 })}
                        placeholder="Ex: 5000"
                        className="bg-slate-700 border-slate-600 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-300">Parcelas</Label>
                      <Select 
                        value={String(novaProposta.parcelas)}
                        onValueChange={(v) => setNovaProposta({ ...novaProposta, parcelas: Number(v) })}
                      >
                        <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-700 border-slate-600">
                          <SelectItem value="180" className="text-white">180 meses (15 anos)</SelectItem>
                          <SelectItem value="240" className="text-white">240 meses (20 anos)</SelectItem>
                          <SelectItem value="300" className="text-white">300 meses (25 anos)</SelectItem>
                          <SelectItem value="360" className="text-white">360 meses (30 anos)</SelectItem>
                          <SelectItem value="420" className="text-white">420 meses (35 anos)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={calcularFinanciamento}
                    className="w-full border-slate-600 text-slate-300"
                  >
                    Calcular Financiamento
                  </Button>

                  {novaProposta.valorFinanciamento > 0 && (
                    <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Valor Financiado:</span>
                        <span className="text-white font-medium">{formatCurrency(novaProposta.valorFinanciamento)}</span>
                      </div>
                      <div className="flex justify-between text-sm mt-1">
                        <span className="text-slate-400">Parcela Estimada:</span>
                        <span className="text-green-400 font-medium">{formatCurrency(novaProposta.valorParcela)}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Mensagem Personalizada */}
                <div className="space-y-2">
                  <Label className="text-slate-300">Mensagem Personalizada (opcional)</Label>
                  <Textarea
                    value={novaProposta.mensagemPersonalizada}
                    onChange={(e) => setNovaProposta({ ...novaProposta, mensagemPersonalizada: e.target.value })}
                    placeholder="Adicione uma mensagem especial para o cliente..."
                    className="bg-slate-700 border-slate-600 text-white"
                    rows={3}
                  />
                </div>

                {/* Validade */}
                <div className="space-y-2">
                  <Label className="text-slate-300">Válido até (opcional)</Label>
                  <Input
                    type="date"
                    value={novaProposta.validoAte}
                    onChange={(e) => setNovaProposta({ ...novaProposta, validoAte: e.target.value })}
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                </div>
              </div>

              <DialogFooter>
                <Button 
                  variant="outline" 
                  onClick={() => { setShowCreateDialog(false); resetForm(); }}
                  className="border-slate-600 text-slate-300"
                >
                  Cancelar
                </Button>
                <Button 
                  onClick={() => createProposta.mutate({
                    ...novaProposta,
                    validoAte: novaProposta.validoAte || undefined
                  })}
                  disabled={createProposta.isPending || !novaProposta.leadId || !novaProposta.projectId || !novaProposta.valorImovel}
                  className="bg-amber-500 hover:bg-amber-600"
                >
                  {createProposta.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Criar Proposta
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Lista de Propostas */}
        <div className="grid gap-4">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
            </div>
          ) : propostas && propostas.length > 0 ? (
            propostas.map((proposta) => (
              <Card key={proposta.id} className="bg-slate-800/50 border-slate-700">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-lg bg-amber-500/20 flex items-center justify-center">
                        <FileText className="h-6 w-6 text-amber-500" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-white">{proposta.nomeCliente}</h3>
                          <Badge className={`${STATUS_COLORS[proposta.status]} text-white`}>
                            {STATUS_LABELS[proposta.status]}
                          </Badge>
                        </div>
                        <p className="text-sm text-slate-400 mt-1">
                          {proposta.unidade} • {proposta.tipologia}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-sm">
                          <span className="text-green-400 font-medium">
                            {formatCurrency(proposta.valorImovel)}
                          </span>
                          {proposta.visualizacoes > 0 && (
                            <span className="text-slate-400 flex items-center gap-1">
                              <Eye className="h-3 w-3" />
                              {proposta.visualizacoes} visualizações
                            </span>
                          )}
                          <span className="text-slate-500">
                            {format(new Date(proposta.createdAt), "dd/MM/yyyy", { locale: ptBR })}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {proposta.status === "rascunho" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => enviarProposta.mutate({ id: proposta.id })}
                          disabled={enviarProposta.isPending}
                          className="border-blue-500 text-blue-400 hover:bg-blue-500/10"
                        >
                          <Send className="h-4 w-4 mr-1" />
                          Enviar
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyLink(proposta.token)}
                        className="text-slate-400 hover:text-white"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(`/proposta/${proposta.token}`, '_blank')}
                        className="text-slate-400 hover:text-white"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="py-12 text-center">
                <FileText className="h-12 w-12 mx-auto text-slate-600 mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">Nenhuma proposta criada</h3>
                <p className="text-slate-400 mb-4">
                  Crie propostas digitais interativas para seus clientes
                </p>
                <Button 
                  onClick={() => setShowCreateDialog(true)}
                  className="bg-amber-500 hover:bg-amber-600"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Primeira Proposta
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

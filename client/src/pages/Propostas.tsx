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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Plus, Eye, Send, Copy, ExternalLink, Loader2, Search, Building2, User, DollarSign, Calendar, Upload, Table, Pencil, Trash2, ImageIcon, BookOpen, FileDown, X } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import TabelaPagamento, { ParcelaPagamento } from "@/components/TabelaPagamento";
import UploadSimulacao, { DadosSimulacao } from "@/components/UploadSimulacao";
import UploadBook, { ImagemExtraida } from "@/components/UploadBook";
import UploadPlanta from "@/components/UploadPlanta";

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

// Parcelas padrão para inicializar a tabela
const PARCELAS_PADRAO: ParcelaPagamento[] = [
  { id: "1", tipo: "financiamento", nome: "Financiamento", quantidade: 1, valorUnitario: 0, total: 0 },
  { id: "2", tipo: "fgts", nome: "FGTS", quantidade: 1, valorUnitario: 0, total: 0 },
  { id: "3", tipo: "subsidio", nome: "Subsídio", quantidade: 1, valorUnitario: 0, total: 0 },
  { id: "4", tipo: "entrada", nome: "Entrada", quantidade: 1, valorUnitario: 0, total: 0 },
  { id: "5", tipo: "mensais", nome: "Mensais", quantidade: 36, valorUnitario: 0, total: 0 },
  { id: "6", tipo: "anuais", nome: "Anuais", quantidade: 3, valorUnitario: 0, total: 0 },
];

export default function Propostas() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingPropostaId, setEditingPropostaId] = useState<number | null>(null);
  const [searchLead, setSearchLead] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [searchCliente, setSearchCliente] = useState("");
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("dados");
  const [parcelas, setParcelas] = useState<ParcelaPagamento[]>(PARCELAS_PADRAO);
  const [dadosSimulacao, setDadosSimulacao] = useState<DadosSimulacao | null>(null);
  
  // Estados para Book e Planta
  const [imagensBook, setImagensBook] = useState<ImagemExtraida[]>([]);
  const [plantaUrl, setPlantaUrl] = useState<string>("");
  
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
    validoAte: "",
    // Novos campos do PDF
    rendaFamiliar: 0,
    dataNascimento: "",
    prazoMeses: 0,
    primeiraPrestacao: 0,
    jurosEfetivos: "",
    tabelaPagamento: ""
  });

  // Queries
  const { data: propostas, isLoading } = trpc.propostas.list.useQuery();
  const { data: projetos } = trpc.projects.list.useQuery();
  const { data: leadsSearch } = trpc.searchLeads.byIdentifier.useQuery(
    { query: searchLead },
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

  const deleteProposta = trpc.propostas.delete.useMutation({
    onSuccess: () => {
      utils.propostas.list.invalidate();
      toast.success("Proposta excluída com sucesso!");
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao excluir proposta");
    }
  });

  const gerarPDF = trpc.propostas.gerarPDF.useMutation({
    onSuccess: (data) => {
      // Abrir o HTML gerado em nova aba para impressão/download como PDF
      window.open(data.htmlUrl, '_blank');
      toast.success("PDF gerado com sucesso! Use Ctrl+P para salvar como PDF.");
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao gerar PDF");
    }
  });

  const updateProposta = trpc.propostas.update.useMutation({
    onSuccess: () => {
      utils.propostas.list.invalidate();
      setShowCreateDialog(false);
      setIsEditing(false);
      setEditingPropostaId(null);
      resetForm();
      toast.success("Proposta atualizada com sucesso!");
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao atualizar proposta");
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
      validoAte: "",
      rendaFamiliar: 0,
      dataNascimento: "",
      prazoMeses: 0,
      primeiraPrestacao: 0,
      jurosEfetivos: "",
      tabelaPagamento: ""
    });
    setSelectedLead(null);
    setSearchLead("");
    setParcelas(PARCELAS_PADRAO);
    setDadosSimulacao(null);
    setImagensBook([]);
    setPlantaUrl("");
    setActiveTab("dados");
    setIsEditing(false);
    setEditingPropostaId(null);
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

  const handleDadosSimulacao = (dados: DadosSimulacao) => {
    setDadosSimulacao(dados);
    
    // Atualizar campos da proposta com dados extraídos
    setNovaProposta(prev => ({
      ...prev,
      valorImovel: dados.valorImovel,
      valorEntrada: dados.valorEntrada,
      valorFinanciamento: dados.valorFinanciamento,
      valorParcela: dados.primeiraPrestacao,
      taxaJuros: dados.jurosEfetivos,
      parcelas: dados.prazoMeses,
      rendaFamiliar: dados.rendaFamiliar,
      dataNascimento: dados.dataNascimento,
      prazoMeses: dados.prazoMeses,
      primeiraPrestacao: dados.primeiraPrestacao,
      jurosEfetivos: dados.jurosEfetivos
    }));
    
    // Atualizar tabela de pagamento com valores do financiamento
    const novasParcelas = [...parcelas];
    const idxFinanciamento = novasParcelas.findIndex(p => p.tipo === "financiamento");
    if (idxFinanciamento >= 0) {
      novasParcelas[idxFinanciamento].valorUnitario = dados.valorFinanciamento;
      novasParcelas[idxFinanciamento].total = dados.valorFinanciamento;
    }
    const idxEntrada = novasParcelas.findIndex(p => p.tipo === "entrada");
    if (idxEntrada >= 0) {
      novasParcelas[idxEntrada].valorUnitario = dados.valorEntrada;
      novasParcelas[idxEntrada].total = dados.valorEntrada;
    }
    setParcelas(novasParcelas);
    
    toast.success("Dados da simulação aplicados à proposta!");
  };

  const handleParcelasChange = (novasParcelas: ParcelaPagamento[]) => {
    setParcelas(novasParcelas);
    // Salvar tabela como JSON para incluir na proposta
    setNovaProposta(prev => ({
      ...prev,
      tabelaPagamento: JSON.stringify(novasParcelas)
    }));
  };

  const handleImagensBook = (imagens: ImagemExtraida[]) => {
    setImagensBook(imagens);
  };

  const handlePlantaUpload = (url: string) => {
    setPlantaUrl(url);
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
    }).format(value);
  };

  const totalParcelas = parcelas.reduce((acc, p) => acc + p.total, 0);
  const imagensSelecionadas = imagensBook.filter(img => img.selecionada);

  const handleCreateProposta = () => {
    // Preparar imagens selecionadas do Book
    const imagensUrls = imagensSelecionadas.map(img => img.url);
    
    // Preparar planta
    const plantasUrls = plantaUrl ? [plantaUrl] : [];
    
    if (isEditing && editingPropostaId) {
      // Atualizar proposta existente
      updateProposta.mutate({
        id: editingPropostaId,
        data: {
          nomeCliente: novaProposta.nomeCliente,
          emailCliente: novaProposta.emailCliente || undefined,
          telefoneCliente: novaProposta.telefoneCliente || undefined,
          unidade: novaProposta.unidade || undefined,
          tipologia: novaProposta.tipologia || undefined,
          metragem: novaProposta.metragem || undefined,
          valorImovel: novaProposta.valorImovel,
          valorEntrada: novaProposta.valorEntrada || undefined,
          valorFinanciamento: novaProposta.valorFinanciamento || undefined,
          parcelas: novaProposta.parcelas || undefined,
          valorParcela: novaProposta.valorParcela || undefined,
          taxaJuros: novaProposta.taxaJuros || undefined,
          desconto: novaProposta.desconto || undefined,
          motivoDesconto: novaProposta.motivoDesconto || undefined,
          mensagemPersonalizada: novaProposta.mensagemPersonalizada || undefined,
          tabelaPagamento: novaProposta.tabelaPagamento || undefined,
          imagensSelecionadas: imagensUrls.length > 0 ? imagensUrls : undefined,
          plantasSelecionadas: plantasUrls.length > 0 ? plantasUrls : undefined,
          validoAte: novaProposta.validoAte || undefined
        }
      });
    } else {
      // Criar nova proposta
      createProposta.mutate({
        ...novaProposta,
        tabelaPagamento: novaProposta.tabelaPagamento || undefined,
        imagensSelecionadas: imagensUrls,
        plantasSelecionadas: plantasUrls,
        validoAte: novaProposta.validoAte || undefined
      });
    }
  };

  const handleEditProposta = (proposta: any) => {
    setIsEditing(true);
    setEditingPropostaId(proposta.id);
    setNovaProposta({
      leadId: proposta.leadId || 0,
      projectId: proposta.projectId || 0,
      nomeCliente: proposta.nomeCliente || "",
      emailCliente: proposta.emailCliente || "",
      telefoneCliente: proposta.telefoneCliente || "",
      unidade: proposta.unidade || "",
      tipologia: proposta.tipologia || "",
      metragem: proposta.metragem || 0,
      valorImovel: proposta.valorImovel || 0,
      valorEntrada: proposta.valorEntrada || 0,
      valorFinanciamento: proposta.valorFinanciamento || 0,
      parcelas: proposta.parcelas || 360,
      valorParcela: proposta.valorParcela || 0,
      taxaJuros: proposta.taxaJuros || "9.5% a.a.",
      desconto: proposta.desconto || 0,
      motivoDesconto: proposta.motivoDesconto || "",
      mensagemPersonalizada: proposta.mensagemPersonalizada || "",
      validoAte: proposta.validoAte ? new Date(proposta.validoAte).toISOString().split('T')[0] : "",
      rendaFamiliar: 0,
      dataNascimento: "",
      prazoMeses: proposta.parcelas || 0,
      primeiraPrestacao: proposta.valorParcela || 0,
      jurosEfetivos: proposta.taxaJuros || "",
      tabelaPagamento: proposta.tabelaPagamento || ""
    });
    
    // Carregar tabela de pagamento se existir
    if (proposta.tabelaPagamento) {
      try {
        const tabelaSalva = JSON.parse(proposta.tabelaPagamento);
        setParcelas(tabelaSalva);
      } catch (e) {
        console.error('Erro ao parsear tabela de pagamento:', e);
      }
    }
    
    // Carregar imagens e plantas se existirem
    if (proposta.imagensSelecionadas) {
      try {
        const imgs = JSON.parse(proposta.imagensSelecionadas);
        setImagensBook(imgs.map((url: string, idx: number) => ({
          id: `img-${idx}`,
          url,
          descricao: `Imagem ${idx + 1}`,
          selecionada: true
        })));
      } catch (e) {
        console.error('Erro ao parsear imagens:', e);
      }
    }
    
    if (proposta.plantasSelecionadas) {
      try {
        const plantas = JSON.parse(proposta.plantasSelecionadas);
        if (plantas.length > 0) {
          setPlantaUrl(plantas[0]);
        }
      } catch (e) {
        console.error('Erro ao parsear plantas:', e);
      }
    }
    
    setShowCreateDialog(true);
    setActiveTab("dados");
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
            <DialogContent className="bg-slate-800 border-slate-600 w-[95vw] !max-w-[900px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-white">{isEditing ? 'Editar Proposta' : 'Criar Nova Proposta'}</DialogTitle>
                <DialogDescription className="text-slate-400">
                  {isEditing ? 'Atualize os dados da proposta' : 'Preencha os dados para gerar uma proposta digital interativa'}
                </DialogDescription>
              </DialogHeader>
              
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-4 bg-slate-700/50">
                  <TabsTrigger value="dados" className="data-[state=active]:bg-amber-500">
                    <User className="h-4 w-4 mr-2" />
                    Dados
                  </TabsTrigger>
                  <TabsTrigger value="simulacao" className="data-[state=active]:bg-amber-500">
                    <Upload className="h-4 w-4 mr-2" />
                    Simulação
                  </TabsTrigger>
                  <TabsTrigger value="book" className="data-[state=active]:bg-amber-500">
                    <BookOpen className="h-4 w-4 mr-2" />
                    Book/Planta
                  </TabsTrigger>
                  <TabsTrigger value="pagamento" className="data-[state=active]:bg-amber-500">
                    <Table className="h-4 w-4 mr-2" />
                    Pagamento
                  </TabsTrigger>
                </TabsList>
                
                {/* Aba 1: Dados do Cliente e Imóvel */}
                <TabsContent value="dados" className="space-y-6 py-4">
                  {/* Busca de Lead */}
                  <div className="space-y-2">
                    <Label className="text-white font-medium">Cliente</Label>
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
                    <Label className="text-white font-medium">Empreendimento</Label>
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
                      <Label className="text-white font-medium">Unidade</Label>
                      <Input
                        value={novaProposta.unidade}
                        onChange={(e) => setNovaProposta({ ...novaProposta, unidade: e.target.value })}
                        placeholder="Ex: Apto 101, Torre A"
                        className="bg-slate-700 border-slate-600 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-white font-medium">Tipologia</Label>
                      <Input
                        value={novaProposta.tipologia}
                        onChange={(e) => setNovaProposta({ ...novaProposta, tipologia: e.target.value })}
                        placeholder="Ex: 2 dorms, 1 suíte"
                        className="bg-slate-700 border-slate-600 text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-white font-medium">Metragem (m²)</Label>
                      <Input
                        type="number"
                        value={novaProposta.metragem || ""}
                        onChange={(e) => setNovaProposta({ ...novaProposta, metragem: Number(e.target.value) })}
                        placeholder="Ex: 65"
                        className="bg-slate-700 border-slate-600 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-white font-medium">Valor do Imóvel (R$)</Label>
                      <Input
                        type="number"
                        value={novaProposta.valorImovel || ""}
                        onChange={(e) => setNovaProposta({ ...novaProposta, valorImovel: Number(e.target.value) })}
                        placeholder="Ex: 250000"
                        className="bg-slate-700 border-slate-600 text-white"
                      />
                    </div>
                  </div>

                  {/* Mensagem Personalizada */}
                  <div className="space-y-2">
                    <Label className="text-white font-medium">Mensagem Personalizada (opcional)</Label>
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
                    <Label className="text-white font-medium">Válido até (opcional)</Label>
                    <Input
                      type="date"
                      value={novaProposta.validoAte}
                      onChange={(e) => setNovaProposta({ ...novaProposta, validoAte: e.target.value })}
                      className="bg-slate-700 border-slate-600 text-white"
                    />
                  </div>
                </TabsContent>
                
                {/* Aba 2: Upload de Simulação */}
                <TabsContent value="simulacao" className="space-y-6 py-4">
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-white font-medium mb-2">Upload do PDF de Simulação</h4>
                      <p className="text-slate-400 text-sm mb-4">
                        Faça upload do PDF de simulação de financiamento (Portal CRM ou Simulador CAIXA) 
                        para extrair automaticamente os dados do cliente.
                      </p>
                    </div>
                    
                    <UploadSimulacao onDadosExtraidos={handleDadosSimulacao} />
                    
                    {dadosSimulacao && (
                      <div className="mt-4 p-4 bg-slate-700/30 rounded-lg">
                        <h5 className="text-white font-medium mb-3">Dados Extraídos</h5>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-slate-400">Renda Familiar:</span>
                            <span className="text-white ml-2">{formatCurrency(dadosSimulacao.rendaFamiliar)}</span>
                          </div>
                          <div>
                            <span className="text-slate-400">Data Nascimento:</span>
                            <span className="text-white ml-2">{dadosSimulacao.dataNascimento}</span>
                          </div>
                          <div>
                            <span className="text-slate-400">Valor do Imóvel:</span>
                            <span className="text-white ml-2">{formatCurrency(dadosSimulacao.valorImovel)}</span>
                          </div>
                          <div>
                            <span className="text-slate-400">Financiamento:</span>
                            <span className="text-green-400 ml-2">{formatCurrency(dadosSimulacao.valorFinanciamento)}</span>
                          </div>
                          <div>
                            <span className="text-slate-400">Prazo:</span>
                            <span className="text-white ml-2">{dadosSimulacao.prazoMeses} meses</span>
                          </div>
                          <div>
                            <span className="text-slate-400">1ª Prestação:</span>
                            <span className="text-amber-400 ml-2">{formatCurrency(dadosSimulacao.primeiraPrestacao)}</span>
                          </div>
                          <div>
                            <span className="text-slate-400">Juros Efetivos:</span>
                            <span className="text-white ml-2">{dadosSimulacao.jurosEfetivos}</span>
                          </div>
                          <div>
                            <span className="text-slate-400">Entrada:</span>
                            <span className="text-white ml-2">{formatCurrency(dadosSimulacao.valorEntrada)}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </TabsContent>
                
                {/* Aba 3: Book e Planta */}
                <TabsContent value="book" className="space-y-6 py-4">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Upload do Book */}
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-white font-medium mb-2 flex items-center gap-2">
                          <BookOpen className="h-5 w-5 text-amber-500" />
                          Book do Projeto
                        </h4>
                        <p className="text-slate-400 text-sm mb-4">
                          Faça upload do PDF do Book do empreendimento para extrair automaticamente 
                          as imagens de perspectiva (fachada, áreas de lazer, etc.)
                        </p>
                      </div>
                      
                      <UploadBook 
                        onImagensExtraidas={handleImagensBook}
                        imagensSelecionadas={imagensBook}
                        maxImagens={4}
                        projetoNome={projetos?.find(p => p.id === novaProposta.projectId)?.nome || "Empreendimento"}
                      />
                      
                      {imagensSelecionadas.length > 0 && (
                        <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                          <p className="text-green-400 text-sm">
                            ✓ {imagensSelecionadas.length} imagem(ns) selecionada(s) para a proposta
                          </p>
                        </div>
                      )}
                    </div>
                    
                    {/* Upload da Planta */}
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-white font-medium mb-2 flex items-center gap-2">
                          <ImageIcon className="h-5 w-5 text-amber-500" />
                          Planta da Unidade
                        </h4>
                        <p className="text-slate-400 text-sm mb-4">
                          Faça upload da imagem da planta baixa da unidade escolhida pelo cliente.
                        </p>
                      </div>
                      
                      <UploadPlanta 
                        onPlantaUpload={handlePlantaUpload}
                        plantaUrl={plantaUrl}
                        label=""
                      />
                      
                      {plantaUrl && (
                        <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                          <p className="text-green-400 text-sm">
                            ✓ Planta da unidade carregada
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </TabsContent>
                
                {/* Aba 4: Tabela de Pagamento */}
                <TabsContent value="pagamento" className="space-y-6 py-4">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-white font-medium">Tabela de Pagamento</h4>
                        <p className="text-slate-400 text-sm">
                          Configure as parcelas e condições de pagamento da proposta
                        </p>
                      </div>
                      {novaProposta.valorImovel > 0 && (
                        <div className="text-right">
                          <p className="text-slate-400 text-sm">Valor do Imóvel</p>
                          <p className="text-white font-bold">{formatCurrency(novaProposta.valorImovel)}</p>
                        </div>
                      )}
                    </div>
                    
                    <TabelaPagamento
                      parcelas={parcelas}
                      onChange={handleParcelasChange}
                      valorImovel={novaProposta.valorImovel}
                    />
                    
                    {novaProposta.valorImovel > 0 && totalParcelas !== novaProposta.valorImovel && (
                      <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                        <p className="text-amber-400 text-sm">
                          ⚠️ O total das parcelas ({formatCurrency(totalParcelas)}) não corresponde ao valor do imóvel ({formatCurrency(novaProposta.valorImovel)}).
                          Diferença: {formatCurrency(novaProposta.valorImovel - totalParcelas)}
                        </p>
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>

              <DialogFooter className="mt-6">
                <Button 
                  variant="outline" 
                  onClick={() => { setShowCreateDialog(false); resetForm(); }}
                  className="border-slate-600 text-slate-300"
                >
                  Cancelar
                </Button>
                <Button 
                  onClick={handleCreateProposta}
                  disabled={(createProposta.isPending || updateProposta.isPending) || (!isEditing && (!novaProposta.leadId || !novaProposta.projectId)) || !novaProposta.valorImovel}
                  className="bg-amber-500 hover:bg-amber-600"
                >
                  {(createProposta.isPending || updateProposta.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {isEditing ? 'Salvar Alterações' : 'Criar Proposta'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filtros da lista */}
        {!isLoading && propostas && propostas.length > 0 && (
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                value={searchCliente}
                onChange={(e) => setSearchCliente(e.target.value)}
                placeholder="Buscar por cliente..."
                className="pl-10 pr-10 bg-slate-800 border-slate-600 text-white"
              />
              {searchCliente && (
                <button
                  onClick={() => setSearchCliente("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  aria-label="Limpar busca"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48 bg-slate-800 border-slate-600 text-white">
                <SelectValue placeholder="Todos os status" />
              </SelectTrigger>
              <SelectContent className="bg-slate-700 border-slate-600">
                <SelectItem value="todos">Todos os status</SelectItem>
                <SelectItem value="rascunho">Rascunho</SelectItem>
                <SelectItem value="enviada">Enviada</SelectItem>
                <SelectItem value="visualizada">Visualizada</SelectItem>
                <SelectItem value="aceita">Aceita</SelectItem>
                <SelectItem value="recusada">Recusada</SelectItem>
                <SelectItem value="expirada">Expirada</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Lista de Propostas */}
        <div className="grid gap-4">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
            </div>
          ) : propostas && propostas.length > 0 ? (
            propostas
              .filter((p) => (statusFilter === "todos" || p.status === statusFilter) && (!searchCliente || p.nomeCliente.toLowerCase().includes(searchCliente.toLowerCase())))
              .map((proposta) => (
              <Card key={proposta.id} className="bg-slate-800 border-slate-600 shadow-lg hover:border-slate-500 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-lg bg-amber-500/20 flex items-center justify-center">
                        <FileText className="h-6 w-6 text-amber-500" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-white text-lg">{proposta.nomeCliente}</h3>
                          <Badge className={`${STATUS_COLORS[proposta.status]} text-white`}>
                            {STATUS_LABELS[proposta.status]}
                          </Badge>
                        </div>
                        <p className="text-sm text-slate-300 mt-1">
                          {proposta.unidade} • {proposta.tipologia}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-sm">
                          <span className="text-green-400 font-medium">
                            {formatCurrency(proposta.valorImovel)}
                          </span>
                          {proposta.visualizacoes > 0 && (
                            <span className="text-slate-300 flex items-center gap-1">
                              <Eye className="h-3 w-3" />
                              {proposta.visualizacoes} visualizações
                            </span>
                          )}
                          <span className="text-slate-400">
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
                        title="Copiar link"
                        aria-label="Copiar link da proposta"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(`/proposta/${proposta.token}`, '_blank')}
                        className="text-slate-400 hover:text-white"
                        title="Abrir proposta"
                        aria-label="Abrir proposta em nova aba"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => gerarPDF.mutate({ propostaId: proposta.id })}
                        disabled={gerarPDF.isPending}
                        className="text-slate-400 hover:text-green-400"
                        title="Baixar PDF"
                        aria-label="Baixar PDF da proposta"
                      >
                        {gerarPDF.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <FileDown className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditProposta(proposta)}
                        className="text-slate-400 hover:text-blue-400"
                        title="Editar proposta"
                        aria-label="Editar proposta"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-slate-400 hover:text-red-400"
                            title="Excluir proposta"
                            aria-label="Excluir proposta"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="bg-slate-800 border-slate-700">
                          <AlertDialogHeader>
                            <AlertDialogTitle className="text-white">Excluir Proposta</AlertDialogTitle>
                            <AlertDialogDescription className="text-slate-400">
                              Tem certeza que deseja excluir a proposta de {proposta.nomeCliente}? Esta ação não pode ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel className="bg-slate-700 text-white border-slate-600 hover:bg-slate-600">Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteProposta.mutate({ id: proposta.id })}
                              className="bg-red-500 hover:bg-red-600"
                            >
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
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

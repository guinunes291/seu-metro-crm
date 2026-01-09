import { useState, useRef } from "react";
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Building2, User, Phone, Mail, MapPin, Ruler, DollarSign, Calendar, CheckCircle2, Loader2, FileText, Home } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function PropostaPublica() {
  const { token } = useParams<{ token: string }>();
  const [showAceiteDialog, setShowAceiteDialog] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  // Buscar proposta
  const { data: proposta, isLoading, error } = trpc.propostas.getByToken.useQuery(
    { token: token || "" },
    { enabled: !!token }
  );

  // Mutation para aceitar
  const aceitarProposta = trpc.propostas.aceitar.useMutation({
    onSuccess: () => {
      setShowAceiteDialog(false);
      window.location.reload();
    }
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  // Funções de assinatura
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    setIsDrawing(true);
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const handleAceitar = () => {
    const canvas = canvasRef.current;
    const assinatura = canvas ? canvas.toDataURL() : undefined;
    
    aceitarProposta.mutate({
      token: token || "",
      assinatura
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    );
  }

  if (error || !proposta) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <CardTitle>Proposta não encontrada</CardTitle>
          </CardHeader>
          <CardContent className="text-center text-slate-600">
            Esta proposta não existe ou expirou.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200">
      {/* Header */}
      <div className="bg-slate-900 text-white py-6">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img 
                src="https://files.manuscdn.com/user_upload_by_module/session_file/310419663032188321/GbWwMKwbYWojThOs.png" 
                alt="Seu Metro Quadrado" 
                className="h-16 w-auto object-contain"
              />
              <div>
                <h1 className="text-xl font-bold">Seu Metro Quadrado</h1>
                <p className="text-sm text-slate-400">Proposta Comercial</p>
              </div>
            </div>
            {proposta.status === "aceita" && (
              <div className="flex items-center gap-2 bg-green-500/20 text-green-400 px-4 py-2 rounded-full">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">Proposta Aceita</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Saudação */}
        <Card>
          <CardContent className="p-6">
            <h2 className="text-2xl font-bold text-slate-900 mb-2">
              Olá, {proposta.nomeCliente}!
            </h2>
            <p className="text-slate-600">
              {proposta.mensagemPersonalizada || 
                "É com grande satisfação que apresentamos esta proposta exclusiva para você. Confira abaixo todos os detalhes do imóvel selecionado especialmente para atender às suas necessidades."}
            </p>
          </CardContent>
        </Card>

        {/* Dados do Empreendimento */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Building2 className="h-5 w-5 text-amber-400" />
              {proposta.projeto?.nome}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 text-slate-200">
                <MapPin className="h-5 w-5 text-amber-400" />
                <span>{proposta.projeto?.endereco || proposta.projeto?.bairro}</span>
              </div>
              <div className="flex items-center gap-3 text-slate-200">
                <Building2 className="h-5 w-5 text-amber-400" />
                <span>{proposta.projeto?.construtora}</span>
              </div>
            </div>
            
            {proposta.projeto?.descricao && (
              <p className="text-slate-300 text-sm">{proposta.projeto.descricao}</p>
            )}
          </CardContent>
        </Card>

        {/* Dados da Unidade */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <FileText className="h-5 w-5 text-amber-400" />
              Detalhes da Unidade
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="text-center p-4 bg-slate-700/50 rounded-lg border border-slate-600">
                <p className="text-sm text-amber-400 mb-1">Unidade</p>
                <p className="text-xl font-bold text-white">{proposta.unidade || "-"}</p>
              </div>
              <div className="text-center p-4 bg-slate-700/50 rounded-lg border border-slate-600">
                <p className="text-sm text-amber-400 mb-1">Tipologia</p>
                <p className="text-xl font-bold text-white">{proposta.tipologia || "-"}</p>
              </div>
              <div className="text-center p-4 bg-slate-700/50 rounded-lg border border-slate-600">
                <p className="text-sm text-amber-400 mb-1">Área</p>
                <p className="text-xl font-bold text-white">{proposta.metragem ? `${proposta.metragem}m²` : "-"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Valores */}
        <Card className="border-amber-200 bg-amber-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-900">
              <DollarSign className="h-5 w-5 text-amber-500" />
              Condições Comerciais
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center py-3 border-b border-amber-200">
                <span className="text-slate-600">Valor do Imóvel</span>
                <span className="text-2xl font-bold text-slate-900">{formatCurrency(proposta.valorImovel)}</span>
              </div>
              
              {proposta.desconto && proposta.desconto > 0 && (
                <div className="flex justify-between items-center py-3 border-b border-amber-200">
                  <span className="text-slate-600">Desconto Especial</span>
                  <span className="text-lg font-medium text-green-600">- {formatCurrency(proposta.desconto)}</span>
                </div>
              )}
              
              {/* Exibir tabela de pagamento customizada se existir */}
              {(() => {
                console.log('[PropostaPublica] tabelaPagamento raw:', proposta.tabelaPagamento);
                try {
                  if (proposta.tabelaPagamento) {
                    const parcelas = JSON.parse(proposta.tabelaPagamento);
                    console.log('[PropostaPublica] parcelas parsed:', parcelas);
                    return parcelas.length > 0;
                  }
                  return false;
                } catch (e) {
                  console.error('[PropostaPublica] Erro ao parsear tabelaPagamento:', e);
                  return false;
                }
              })() ? (
                <>
                  {JSON.parse(proposta.tabelaPagamento).map((parcela: any, index: number) => (
                    parcela.valorTotal > 0 && (
                      <div key={index} className="flex justify-between items-center py-3 border-b border-amber-200">
                        <div>
                          <span className="text-slate-700 font-medium">{parcela.tipo}</span>
                          {parcela.quantidade > 1 && (
                            <span className="text-slate-500 text-sm ml-2">({parcela.quantidade}x)</span>
                          )}
                        </div>
                        <span className="text-lg font-medium text-slate-900">{formatCurrency(parcela.valorTotal)}</span>
                      </div>
                    )
                  ))}
                </>
              ) : (
                /* Fallback para valores fixos se não houver tabela customizada */
                <>
                  {proposta.valorEntrada && proposta.valorEntrada > 0 && (
                    <div className="flex justify-between items-center py-3 border-b border-amber-200">
                      <span className="text-slate-600">Entrada</span>
                      <span className="text-lg font-medium text-slate-900">{formatCurrency(proposta.valorEntrada)}</span>
                    </div>
                  )}
                  
                  {proposta.valorFinanciamento && proposta.valorFinanciamento > 0 && (
                    <>
                      <div className="flex justify-between items-center py-3 border-b border-amber-200">
                        <span className="text-slate-600">Valor Financiado</span>
                        <span className="text-lg font-medium text-slate-900">{formatCurrency(proposta.valorFinanciamento)}</span>
                      </div>
                      <div className="flex justify-between items-center py-3 border-b border-amber-200">
                        <span className="text-slate-600">Prazo</span>
                        <span className="text-lg font-medium text-slate-900">{proposta.parcelas} meses</span>
                      </div>
                      <div className="flex justify-between items-center py-3 border-b border-amber-200">
                        <span className="text-slate-600">Taxa de Juros</span>
                        <span className="text-lg font-medium text-slate-900">{proposta.taxaJuros}</span>
                      </div>
                    </>
                  )}
                  
                  {proposta.valorParcela && proposta.valorParcela > 0 && (
                    <div className="flex justify-between items-center py-4 bg-amber-100 rounded-lg px-4">
                      <span className="text-slate-700 font-medium">Parcela Estimada</span>
                      <span className="text-2xl font-bold text-amber-600">{formatCurrency(proposta.valorParcela)}/mês</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Corretor */}
        {proposta.corretor && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-slate-900">
                <User className="h-5 w-5 text-amber-500" />
                Seu Corretor
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                {proposta.corretor.fotoUrl ? (
                  <img 
                    src={proposta.corretor.fotoUrl} 
                    alt={proposta.corretor.name || ""} 
                    className="w-16 h-16 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center">
                    <User className="h-8 w-8 text-amber-500" />
                  </div>
                )}
                <div>
                  <p className="font-bold text-slate-900">{proposta.corretor.name}</p>
                  {proposta.corretor.telefone && (
                    <a href={`tel:${proposta.corretor.telefone}`} className="flex items-center gap-2 text-slate-600 hover:text-amber-600">
                      <Phone className="h-4 w-4" />
                      {proposta.corretor.telefone}
                    </a>
                  )}
                  {proposta.corretor.email && (
                    <a href={`mailto:${proposta.corretor.email}`} className="flex items-center gap-2 text-slate-700 hover:text-amber-600 font-medium">
                      <Mail className="h-4 w-4" />
                      {proposta.corretor.email}
                    </a>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Validade e Aceite */}
        {proposta.status !== "aceita" && proposta.status !== "recusada" && (
          <Card className="border-green-200 bg-green-50/50">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div>
                  <p className="text-slate-600">
                    {proposta.validoAte 
                      ? `Esta proposta é válida até ${format(new Date(proposta.validoAte), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`
                      : "Proposta sem prazo de validade definido"}
                  </p>
                </div>
                <Button 
                  onClick={() => setShowAceiteDialog(true)}
                  className="bg-green-600 hover:bg-green-700 text-white px-8"
                  size="lg"
                >
                  <CheckCircle2 className="h-5 w-5 mr-2" />
                  Aceitar Proposta
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Aceite já realizado */}
        {proposta.status === "aceita" && proposta.aceiteEm && (
          <Card className="border-green-300 bg-green-100">
            <CardContent className="p-6 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-green-800 mb-2">Proposta Aceita!</h3>
              <p className="text-green-700">
                Aceita em {format(new Date(proposta.aceiteEm), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
              <p className="text-sm text-green-600 mt-2">
                Nosso corretor entrará em contato para os próximos passos.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center text-slate-500 text-sm py-4">
          <p>Seu Metro Quadrado © {new Date().getFullYear()}</p>
          <p>Proposta gerada em {format(new Date(proposta.createdAt), "dd/MM/yyyy", { locale: ptBR })}</p>
        </div>
      </div>

      {/* Dialog de Aceite */}
      <Dialog open={showAceiteDialog} onOpenChange={setShowAceiteDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Aceitar Proposta</DialogTitle>
            <DialogDescription>
              Ao aceitar, você confirma o interesse nesta proposta. Nosso corretor entrará em contato para dar continuidade.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <p className="text-sm text-slate-600 mb-2">Assinatura Digital (opcional)</p>
              <div className="border-2 border-dashed border-slate-300 rounded-lg p-2 bg-white">
                <canvas
                  ref={canvasRef}
                  width={350}
                  height={150}
                  className="w-full cursor-crosshair"
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                />
              </div>
              {hasSignature && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={clearSignature}
                  className="mt-2 text-slate-500"
                >
                  Limpar assinatura
                </Button>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowAceiteDialog(false)}
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleAceitar}
              disabled={aceitarProposta.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {aceitarProposta.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar Aceite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

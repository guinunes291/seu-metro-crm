import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Upload, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function Configuracoes() {
  const [, setLocation] = useLocation();
  const [abaAtiva, setAbaAtiva] = useState("pessoais");
  const [uploading, setUploading] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);
  
  // Query para verificar perfil
  const { data: verificacao, refetch: refetchVerificacao } = trpc.onboarding.verificar.useQuery();
  
  // Estado do formulário
  const [formData, setFormData] = useState({
    // Dados pessoais
    name: "",
    cpf: "",
    dataNascimento: "",
    email: "",
    telefone: "",
    fotoUrl: "",
    
    // Dados profissionais
    creci: "",
    situacao: "ativo" as "ativo" | "inativo",
    dataCredenciamento: "",
    dataDescredenciamento: "",
    status: "ausente" as "presente" | "ausente",
    
    // Endereço
    cep: "",
    logradouro: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    estado: "",
  });

  // Preencher formulário com dados do usuário
  useEffect(() => {
    if (verificacao?.user) {
      const user = verificacao.user;
      setFormData({
        name: user.name || "",
        cpf: user.cpf || "",
        dataNascimento: user.dataNascimento ? new Date(user.dataNascimento).toISOString().split("T")[0] : "",
        email: user.email || "",
        telefone: user.telefone || "",
        fotoUrl: user.fotoUrl || "",
        creci: user.creci || "",
        situacao: user.situacao || "ativo",
        dataCredenciamento: user.dataCredenciamento ? new Date(user.dataCredenciamento).toISOString().split("T")[0] : "",
        dataDescredenciamento: user.dataDescredenciamento ? new Date(user.dataDescredenciamento).toISOString().split("T")[0] : "",
        status: user.status || "ausente",
        cep: user.cep || "",
        logradouro: user.logradouro || "",
        numero: user.numero || "",
        complemento: user.complemento || "",
        bairro: user.bairro || "",
        cidade: user.cidade || "",
        estado: user.estado || "",
      });
    }
  }, [verificacao]);

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleBuscarCEP = async () => {
    if (formData.cep.length < 8) {
      alert("Digite um CEP válido com 8 dígitos");
      return;
    }

    setBuscandoCep(true);
    try {
      const cepLimpo = formData.cep.replace(/\D/g, "");
      const response = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
      const data = await response.json();
      
      if (data.erro) {
        alert("CEP não encontrado");
        return;
      }
      
      setFormData(prev => ({
        ...prev,
        logradouro: data.logradouro || "",
        bairro: data.bairro || "",
        cidade: data.localidade || "",
        estado: data.uf || "",
        complemento: data.complemento || prev.complemento,
      }));
      alert("CEP encontrado! Endereço preenchido automaticamente.");
    } catch (error) {
      alert("CEP não encontrado ou serviço indisponível");
    } finally {
      setBuscandoCep(false);
    }
  };

  const handleUploadFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Por favor, selecione uma imagem");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("A imagem deve ter no máximo 5MB");
      return;
    }

    setUploading(true);

    try {
      const formDataUpload = new FormData();
      formDataUpload.append("file", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formDataUpload,
      });

      if (!response.ok) {
        throw new Error("Erro no upload");
      }

      const { url } = await response.json();
      
      handleChange("fotoUrl", url);
      alert("Foto enviada com sucesso!");
    } catch (error) {
      console.error("Erro no upload:", error);
      alert("Não foi possível enviar a foto");
    } finally {
      setUploading(false);
    }
  };

  const handleSalvar = () => {
    const dados: any = { ...formData };
    
    if (dados.dataNascimento) {
      dados.dataNascimento = new Date(dados.dataNascimento);
    }
    if (dados.dataCredenciamento) {
      dados.dataCredenciamento = new Date(dados.dataCredenciamento);
    }
    if (dados.dataDescredenciamento) {
      dados.dataDescredenciamento = new Date(dados.dataDescredenciamento);
    }

    atualizarMutation.mutate(dados);
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(n => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (!verificacao) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const { completo, camposFaltantes } = verificacao;

  return (
    <div className="container max-w-4xl py-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Configurar Perfil</CardTitle>
          <CardDescription>
            Complete seu perfil para ter acesso completo ao sistema
          </CardDescription>
          
          {!completo && camposFaltantes.length > 0 && (
            <Alert className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Campos obrigatórios faltantes:</strong> {camposFaltantes.join(", ")}
              </AlertDescription>
            </Alert>
          )}
          
          {completo && (
            <Alert className="mt-4 border-green-500 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Seu perfil está completo!
              </AlertDescription>
            </Alert>
          )}
        </CardHeader>
        
        <CardContent>
          <Tabs value={abaAtiva} onValueChange={setAbaAtiva}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="pessoais">Dados Pessoais</TabsTrigger>
              <TabsTrigger value="profissional">Profissional</TabsTrigger>
              <TabsTrigger value="endereco">Endereço</TabsTrigger>
            </TabsList>
            
            {/* ABA DADOS PESSOAIS */}
            <TabsContent value="pessoais" className="space-y-4 mt-6">
              {/* Foto de Perfil */}
              <div className="flex flex-col items-center gap-4 pb-6 border-b">
                <Avatar className="h-24 w-24">
                  <AvatarImage src={formData.fotoUrl} />
                  <AvatarFallback className="text-2xl">
                    {formData.name ? getInitials(formData.name) : "?"}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex flex-col items-center gap-2">
                  <Label htmlFor="foto" className="cursor-pointer">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={uploading}
                      asChild
                    >
                      <span>
                        {uploading ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Enviando...
                          </>
                        ) : (
                          <>
                            <Upload className="h-4 w-4 mr-2" />
                            Enviar Foto
                          </>
                        )}
                      </span>
                    </Button>
                  </Label>
                  <input
                    id="foto"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleUploadFoto}
                    disabled={uploading}
                  />
                  <p className="text-xs text-muted-foreground">
                    PNG, JPG ou JPEG até 5MB
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="name">Nome Completo *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleChange("name", e.target.value)}
                    placeholder="Seu nome completo"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cpf">CPF *</Label>
                  <Input
                    id="cpf"
                    value={formData.cpf}
                    onChange={(e) => handleChange("cpf", e.target.value)}
                    placeholder="000.000.000-00"
                    maxLength={14}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dataNascimento">Data de Nascimento *</Label>
                  <Input
                    id="dataNascimento"
                    type="date"
                    value={formData.dataNascimento}
                    onChange={(e) => handleChange("dataNascimento", e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleChange("email", e.target.value)}
                    placeholder="seu@email.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="telefone">Telefone *</Label>
                  <Input
                    id="telefone"
                    value={formData.telefone}
                    onChange={(e) => handleChange("telefone", e.target.value)}
                    placeholder="(11) 99999-9999"
                    maxLength={15}
                  />
                </div>
              </div>
            </TabsContent>

            {/* ABA PROFISSIONAL */}
            <TabsContent value="profissional" className="space-y-4 mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="creci">CRECI (opcional)</Label>
                  <Input
                    id="creci"
                    value={formData.creci}
                    onChange={(e) => handleChange("creci", e.target.value)}
                    placeholder="Número do CRECI"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="situacao">Situação (opcional)</Label>
                  <Select
                    value={formData.situacao}
                    onValueChange={(value) => handleChange("situacao", value)}
                  >
                    <SelectTrigger id="situacao">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ativo">Ativo</SelectItem>
                      <SelectItem value="inativo">Inativo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dataCredenciamento">Data de Credenciamento *</Label>
                  <Input
                    id="dataCredenciamento"
                    type="date"
                    value={formData.dataCredenciamento}
                    onChange={(e) => handleChange("dataCredenciamento", e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dataDescredenciamento">Data de Descredenciamento (opcional)</Label>
                  <Input
                    id="dataDescredenciamento"
                    type="date"
                    value={formData.dataDescredenciamento}
                    onChange={(e) => handleChange("dataDescredenciamento", e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">Status de Plantão *</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => handleChange("status", value)}
                  >
                    <SelectTrigger id="status">
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

            {/* ABA ENDEREÇO */}
            <TabsContent value="endereco" className="space-y-4 mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cep">CEP *</Label>
                  <div className="flex gap-2">
                    <Input
                      id="cep"
                      value={formData.cep}
                      onChange={(e) => handleChange("cep", e.target.value)}
                      placeholder="00000-000"
                      maxLength={9}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleBuscarCEP}
                      disabled={buscandoCep}
                    >
                      {buscandoCep ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Buscar"
                      )}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="logradouro">Logradouro *</Label>
                  <Input
                    id="logradouro"
                    value={formData.logradouro}
                    onChange={(e) => handleChange("logradouro", e.target.value)}
                    placeholder="Rua, Avenida, etc."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="numero">Número *</Label>
                  <Input
                    id="numero"
                    value={formData.numero}
                    onChange={(e) => handleChange("numero", e.target.value)}
                    placeholder="Número"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="complemento">Complemento (opcional)</Label>
                  <Input
                    id="complemento"
                    value={formData.complemento}
                    onChange={(e) => handleChange("complemento", e.target.value)}
                    placeholder="Apto, Bloco, etc."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bairro">Bairro *</Label>
                  <Input
                    id="bairro"
                    value={formData.bairro}
                    onChange={(e) => handleChange("bairro", e.target.value)}
                    placeholder="Bairro"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cidade">Cidade *</Label>
                  <Input
                    id="cidade"
                    value={formData.cidade}
                    onChange={(e) => handleChange("cidade", e.target.value)}
                    placeholder="Cidade"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="estado">Estado *</Label>
                  <Select
                    value={formData.estado}
                    onValueChange={(value) => handleChange("estado", value)}
                  >
                    <SelectTrigger id="estado">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AC">AC</SelectItem>
                      <SelectItem value="AL">AL</SelectItem>
                      <SelectItem value="AP">AP</SelectItem>
                      <SelectItem value="AM">AM</SelectItem>
                      <SelectItem value="BA">BA</SelectItem>
                      <SelectItem value="CE">CE</SelectItem>
                      <SelectItem value="DF">DF</SelectItem>
                      <SelectItem value="ES">ES</SelectItem>
                      <SelectItem value="GO">GO</SelectItem>
                      <SelectItem value="MA">MA</SelectItem>
                      <SelectItem value="MT">MT</SelectItem>
                      <SelectItem value="MS">MS</SelectItem>
                      <SelectItem value="MG">MG</SelectItem>
                      <SelectItem value="PA">PA</SelectItem>
                      <SelectItem value="PB">PB</SelectItem>
                      <SelectItem value="PR">PR</SelectItem>
                      <SelectItem value="PE">PE</SelectItem>
                      <SelectItem value="PI">PI</SelectItem>
                      <SelectItem value="RJ">RJ</SelectItem>
                      <SelectItem value="RN">RN</SelectItem>
                      <SelectItem value="RS">RS</SelectItem>
                      <SelectItem value="RO">RO</SelectItem>
                      <SelectItem value="RR">RR</SelectItem>
                      <SelectItem value="SC">SC</SelectItem>
                      <SelectItem value="SP">SP</SelectItem>
                      <SelectItem value="SE">SE</SelectItem>
                      <SelectItem value="TO">TO</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-2 mt-6 pt-6 border-t">
            <Button
              onClick={handleSalvar}
              disabled={atualizarMutation.isPending}
              className="min-w-[120px]"
            >
              {atualizarMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

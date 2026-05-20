import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, Plus, Calendar, Users, Loader2 } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";

function tipoLabel(t: string) {
  if (t === "terca") return "Terça-feira";
  if (t === "quinta") return "Quinta-feira";
  return "Avulsa";
}

function statusVariant(s: string): "default" | "secondary" | "outline" {
  if (s === "em_andamento") return "default";
  if (s === "concluida") return "secondary";
  return "outline";
}

function statusLabel(s: string) {
  const m: Record<string, string> = { agendada: "Agendada", em_andamento: "Em andamento", concluida: "Concluída" };
  return m[s] ?? s;
}

export default function SessoesOferta() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  const isGestor = user?.role === "gestor" || user?.role === "admin" || user?.role === "superintendente";

  const { data: sessoes, isLoading } = trpc.ofertaAtiva.sessoes.list.useQuery(undefined, { enabled: isGestor });

  const [createOpen, setCreateOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<"terca" | "quinta" | "avulsa">("avulsa");
  const [dataHora, setDataHora] = useState("");
  const [descricao, setDescricao] = useState("");

  const createMutation = trpc.ofertaAtiva.sessoes.create.useMutation({
    onSuccess: () => {
      utils.ofertaAtiva.sessoes.list.invalidate();
      setCreateOpen(false);
      setNome("");
      setTipo("avulsa");
      setDataHora("");
      setDescricao("");
    },
  });

  if (!isGestor) {
    return (
      <DashboardLayout>
        <div className="text-center py-20 text-muted-foreground">Acesso restrito a gestores.</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/oferta-ativa")}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                Sessões de Oferta
              </h1>
              <p className="text-sm text-muted-foreground">Gerencie campanhas de ofertão para o time</p>
            </div>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Nova Sessão
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova Sessão de Oferta</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div>
                  <Label>Nome *</Label>
                  <Input
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Ex: Ofertão Terça 20/05"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Tipo</Label>
                  <Select value={tipo} onValueChange={(v) => setTipo(v as any)}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="terca">Terça-feira</SelectItem>
                      <SelectItem value="quinta">Quinta-feira</SelectItem>
                      <SelectItem value="avulsa">Avulsa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Data e Hora *</Label>
                  <Input
                    type="datetime-local"
                    value={dataHora}
                    onChange={(e) => setDataHora(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Descrição (opcional)</Label>
                  <Input
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                    placeholder="Objetivo da sessão..."
                    className="mt-1"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
                <Button
                  onClick={() => createMutation.mutate({ nome, tipo, dataHora, descricao: descricao || undefined })}
                  disabled={!nome.trim() || !dataHora || createMutation.isPending}
                >
                  {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Criar Sessão
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />
            ))}
          </div>
        ) : !sessoes || sessoes.length === 0 ? (
          <div className="text-center py-20 border border-dashed rounded-xl">
            <Calendar className="w-12 h-12 mx-auto text-muted-foreground/40 mb-4" />
            <p className="text-lg font-medium text-muted-foreground">Nenhuma sessão criada</p>
            <p className="text-sm text-muted-foreground mb-6">Crie uma sessão para organizar o ofertão do time.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sessoes.map((sessao) => (
              <div
                key={sessao.id}
                className="bg-white border rounded-xl p-4 hover:shadow-sm transition-shadow cursor-pointer"
                onClick={() => navigate(`/sessoes-oferta/${sessao.id}`)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{sessao.nome}</h3>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-muted-foreground">
                        {tipoLabel(sessao.tipo)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(sessao.dataHora).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    {sessao.descricao && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{sessao.descricao}</p>
                    )}
                  </div>
                  <Badge variant={statusVariant(sessao.status)}>{statusLabel(sessao.status)}</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

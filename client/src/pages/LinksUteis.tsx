import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Link2, Lock, Loader2 } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { toast } from "sonner";

function isGestorLevel(role: string) {
  return role === "gestor" || role === "admin" || role === "superintendente";
}

export default function LinksUteis() {
  const { user, loading } = useAuth();
  const utils = trpc.useUtils();

  const hasPermission =
    !loading &&
    user !== null &&
    ((user as any).acessaLinksUteis === true || isGestorLevel(user.role));

  const { data: links, isLoading } = trpc.linksUteis.list.useQuery(undefined, {
    enabled: hasPermission,
    staleTime: 5 * 60_000,
  });

  const registrarAcessoMutation = trpc.linksUteis.registrarAcesso.useMutation();

  function handleAcessar(link: { id: number; url: string; titulo: string }) {
    window.open(link.url, "_blank", "noopener,noreferrer");
    registrarAcessoMutation.mutate({ linkId: link.id });
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (!hasPermission) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
          <Lock className="w-12 h-12 text-muted-foreground/40" />
          <div>
            <p className="text-lg font-semibold text-muted-foreground">Acesso restrito</p>
            <p className="text-sm text-muted-foreground mt-1">
              Você não tem permissão para acessar esta área.
              <br />
              Solicite ao administrador para habilitar seu acesso.
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Agrupa por categoria, ordena A-Z
  const porCategoria: Record<string, typeof links> = {};
  if (links) {
    for (const link of links) {
      if (!porCategoria[link.categoria]) porCategoria[link.categoria] = [];
      porCategoria[link.categoria]!.push(link);
    }
  }
  const categorias = Object.keys(porCategoria).sort();

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-8 p-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Link2 className="w-6 h-6 text-primary" />
            Links Úteis
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Atalhos rápidos para ferramentas, grupos e materiais comerciais
          </p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-28 bg-muted rounded-xl animate-pulse" />
            ))}
          </div>
        ) : categorias.length === 0 ? (
          <div className="text-center py-20 border border-dashed rounded-xl">
            <Link2 className="w-12 h-12 mx-auto text-muted-foreground/40 mb-4" />
            <p className="text-lg font-medium text-muted-foreground">Nenhum link disponível</p>
            <p className="text-sm text-muted-foreground">Links serão adicionados em breve pelo administrador.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {categorias.map((categoria) => (
              <section key={categoria}>
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-base font-semibold text-gray-800">{categoria}</h2>
                  <div className="flex-1 h-px bg-border" />
                  <Badge variant="secondary" className="text-xs">
                    {porCategoria[categoria]!.length}
                  </Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {porCategoria[categoria]!.map((link) => (
                    <div
                      key={link.id}
                      className="bg-white border rounded-xl p-4 flex flex-col gap-3 hover:shadow-md transition-shadow group"
                    >
                      <div className="flex-1">
                        <p className="font-semibold text-sm text-gray-900 leading-tight">{link.titulo}</p>
                        {link.descricao && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{link.descricao}</p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        className="w-full"
                        onClick={() => handleAcessar(link)}
                      >
                        <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                        Acessar
                      </Button>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

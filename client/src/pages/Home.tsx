import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Loader2, Building2 } from "lucide-react";
import { getLoginUrl } from "@/const";
import { useEffect } from "react";
import { useLocation } from "wouter";

/**
 * All content in this page are only for example, replace with your own feature implementation
 * When building pages, remember your instructions in Frontend Workflow, Frontend Best Practices, Design Guide and Common Pitfalls
 */
export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && isAuthenticated) {
      setLocation("/dashboard");
    }
  }, [loading, isAuthenticated, setLocation]);

  // If theme is switchable in App.tsx, we can implement theme toggling like this:
  // const { theme, toggleTheme } = useTheme();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <Loader2 className="animate-spin h-12 w-12 mx-auto text-primary" />
          <p className="mt-4 text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-primary/5 to-primary/10">
      <div className="max-w-md w-full mx-auto px-6 text-center">
        <div className="mb-8">
          <Building2 className="h-20 w-20 mx-auto text-primary mb-4" />
          <h1 className="text-4xl font-bold tracking-tight mb-2">Seu Metro Quadrado</h1>
          <p className="text-xl text-muted-foreground">CRM Imobiliário</p>
        </div>
        
        <div className="bg-card p-8 rounded-lg shadow-lg border">
          <h2 className="text-2xl font-semibold mb-4">Bem-vindo!</h2>
          <p className="text-muted-foreground mb-6">
            Faça login para acessar a plataforma de gestão de leads e vendas
          </p>
          <Button
            size="lg"
            className="w-full"
            onClick={() => window.location.href = getLoginUrl()}
          >
            Entrar no Sistema
          </Button>
        </div>
        
        <p className="mt-6 text-sm text-muted-foreground">
          SEU METRO QUADRADO
        </p>
      </div>
    </div>
  );
}

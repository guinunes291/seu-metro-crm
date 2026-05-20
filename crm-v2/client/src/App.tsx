import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Route, Switch } from "wouter";
import { trpc, makeTrpcClient } from "./lib/trpc.js";
import { useCurrentUser } from "./hooks/useCurrentUser.js";
import DashboardLayout from "./components/layout/DashboardLayout.js";
import DashboardPage from "./features/dashboard/DashboardPage.js";
import LeadsPage from "./features/leads/LeadsPage.js";
import DistribuicaoPage from "./features/distribuicao/DistribuicaoPage.js";
import WebhooksPage from "./features/webhooks/WebhooksPage.js";
import UsuariosPage from "./features/usuarios/UsuariosPage.js";
import ProjetosPage from "./features/projetos/ProjetosPage.js";

function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm text-center">
        <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 text-white text-2xl">
          🏢
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">CRM Imobiliário</h1>
        <p className="text-gray-500 text-sm mb-6">Gestão inteligente de leads</p>
        <a
          href="/api/oauth/login"
          className="block w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors"
        >
          Entrar com Manus
        </a>
      </div>
    </div>
  );
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useCurrentUser();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <LoginPage />;

  return <DashboardLayout>{children}</DashboardLayout>;
}

function Router() {
  return (
    <AuthGuard>
      <Switch>
        <Route path="/" component={DashboardPage} />
        <Route path="/leads" component={LeadsPage} />
        <Route path="/distribuicao" component={DistribuicaoPage} />
        <Route path="/projetos" component={ProjetosPage} />
        <Route path="/usuarios" component={UsuariosPage} />
        <Route path="/webhooks" component={WebhooksPage} />
        <Route>
          <div className="text-center py-20">
            <p className="text-4xl mb-2">404</p>
            <p className="text-gray-500">Página não encontrada</p>
          </div>
        </Route>
      </Switch>
    </AuthGuard>
  );
}

export default function App() {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: { retry: 1, refetchOnWindowFocus: false },
    },
  }));
  const [trpcClient] = useState(() => makeTrpcClient());

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <Router />
      </QueryClientProvider>
    </trpc.Provider>
  );
}

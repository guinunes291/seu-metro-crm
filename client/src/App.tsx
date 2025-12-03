import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Projetos from "./pages/Projetos";
import Leads from "./pages/Leads";
import Distribuicao from "./pages/Distribuicao";
import Relatorios from "./pages/Relatorios";
import Configuracoes from "./pages/Configuracoes";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/dashboard"} component={Dashboard} />
      <Route path={"/projetos"} component={Projetos} />
      <Route path={"/leads"} component={Leads} />
      <Route path={"/distribuicao"} component={Distribuicao} />
      <Route path={"/relatorios"} component={Relatorios} />
      <Route path={"/configuracoes"} component={Configuracoes} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;

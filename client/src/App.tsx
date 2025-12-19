import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { CompareProvider } from "./contexts/CompareContext";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Projetos from "./pages/Projetos";
import Leads from "./pages/Leads";

import Relatorios from "./pages/Relatorios";
import Configuracoes from "./pages/Configuracoes";
import ImportarSheets from "./pages/ImportarSheets";
import ProjetoDetalhes from "@/pages/ProjetoDetalhes";
import ImportarProjetos from "@/pages/ImportarProjetos";
import Corretores from "@/pages/Corretores";
import MinhaPerformance from "@/pages/MinhaPerformance";
import ImportarCSV from "@/pages/ImportarCSV";
import ControleDistribuicao from "@/pages/ControleDistribuicao";
import Notificacoes from "@/pages/Notificacoes";
import LeadsPorCorretor from "@/pages/LeadsPorCorretor";
import Kanban from "@/pages/Kanban";
import Metas from "@/pages/Metas";
import Roleta from "@/pages/Roleta";
import HistoricoDistribuicao from "@/pages/HistoricoDistribuicao";
import BoasVindas from "@/pages/BoasVindas";
import TarefasDoDia from "@/pages/TarefasDoDia";
import RankingTV from "@/pages/RankingTV";



function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/dashboard"} component={Dashboard} />
      <Route path={"/projetos"} component={Projetos} />
      <Route path="/leads" component={Leads} />
      <Route path="/relatorios" component={Relatorios} />
      <Route path="/configuracoes" component={Configuracoes} />
      <Route path="/importar-sheets" component={ImportarSheets} />
      <Route path="/projetos/:id" component={ProjetoDetalhes} />
      <Route path="/importar-projetos" component={ImportarProjetos} />
      <Route path="/corretores" component={Corretores} />
      <Route path="/minha-performance" component={MinhaPerformance} />
      <Route path="/importar-csv" component={ImportarCSV} />
      <Route path="/controle-distribuicao" component={ControleDistribuicao} />
      <Route path="/notificacoes" component={Notificacoes} />
      <Route path="/leads-por-corretor" component={LeadsPorCorretor} />
      <Route path="/kanban" component={Kanban} />
      <Route path="/metas" component={Metas} />
      <Route path="/roleta" component={Roleta} />
      <Route path="/historico-distribuicao" component={HistoricoDistribuicao} />
      <Route path="/boas-vindas" component={BoasVindas} />
      <Route path="/tarefas-do-dia" component={TarefasDoDia} />
      <Route path="/ranking-tv" component={RankingTV} />

      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <CompareProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </CompareProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;

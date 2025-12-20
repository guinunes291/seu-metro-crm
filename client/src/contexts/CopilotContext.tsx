// Contexto para compartilhar informações do lead com o SMQ Copilot flutuante
import { createContext, useContext, useState, ReactNode } from 'react';

export interface LeadContext {
  id: number;
  nome: string;
  telefone?: string;
  email?: string;
  status: string;
  projeto?: string;
  projetoId?: number;
  origem?: string;
  observacoes?: string;
  faixaRenda?: string;
  campanha?: string;
  diasFollowupConsecutivos?: number;
  ultimoContato?: string;
}

interface CopilotContextType {
  // Lead atualmente selecionado para contexto
  selectedLead: LeadContext | null;
  setSelectedLead: (lead: LeadContext | null) => void;
  
  // Controle do chat flutuante
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  
  // Abrir o Copilot com um lead específico
  openWithLead: (lead: LeadContext) => void;
  
  // Limpar o contexto do lead
  clearLeadContext: () => void;
}

const CopilotContext = createContext<CopilotContextType | undefined>(undefined);

export function CopilotProvider({ children }: { children: ReactNode }) {
  const [selectedLead, setSelectedLead] = useState<LeadContext | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const openWithLead = (lead: LeadContext) => {
    setSelectedLead(lead);
    setIsOpen(true);
  };

  const clearLeadContext = () => {
    setSelectedLead(null);
  };

  return (
    <CopilotContext.Provider
      value={{
        selectedLead,
        setSelectedLead,
        isOpen,
        setIsOpen,
        openWithLead,
        clearLeadContext,
      }}
    >
      {children}
    </CopilotContext.Provider>
  );
}

export function useCopilot() {
  const context = useContext(CopilotContext);
  if (context === undefined) {
    throw new Error('useCopilot must be used within a CopilotProvider');
  }
  return context;
}

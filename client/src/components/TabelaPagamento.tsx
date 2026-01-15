import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";

export interface ParcelaPagamento {
  id: string;
  tipo: string;
  nome: string;
  quantidade: number;
  valorUnitario: number;
  total: number;
  dataPagamento?: string; // Data de pagamento ou início (formato YYYY-MM-DD)
}

const TIPOS_PARCELA = [
  { value: "financiamento", label: "Financiamento" },
  { value: "fgts", label: "FGTS" },
  { value: "subsidio", label: "Subsídio" },
  { value: "entrada", label: "Entrada" },
  { value: "mensais", label: "Mensais" },
  { value: "mensais_regressivas", label: "Mensais (Fluxo Regressivo)" },
  { value: "mensais_pos_chaves", label: "Mensais Pós Chaves" },
  { value: "anuais", label: "Anuais" },
  { value: "outras", label: "Outras" },
  { value: "adimplencia", label: "Parcela Adimplência (Bônus)" },
];

interface TabelaPagamentoProps {
  parcelas: ParcelaPagamento[];
  onChange: (parcelas: ParcelaPagamento[]) => void;
  valorImovel?: number;
  readOnly?: boolean;
}

export default function TabelaPagamento({ parcelas, onChange, valorImovel = 0, readOnly = false }: TabelaPagamentoProps) {
  const [localParcelas, setLocalParcelas] = useState<ParcelaPagamento[]>(parcelas);
  const [inputValues, setInputValues] = useState<Record<string, string>>({});

  useEffect(() => {
    setLocalParcelas(parcelas);
    // Inicializar valores de input
    const newInputValues: Record<string, string> = {};
    parcelas.forEach(p => {
      newInputValues[p.id] = p.valorUnitario > 0 ? formatNumber(p.valorUnitario) : '';
    });
    setInputValues(newInputValues);
  }, [parcelas]);

  const addParcela = () => {
    const novaParcela: ParcelaPagamento = {
      id: `parcela-${Date.now()}`,
      tipo: "outras",
      nome: "Outras",
      quantidade: 1,
      valorUnitario: 0,
      total: 0,
    };
    const novasParcelas = [...localParcelas, novaParcela];
    setLocalParcelas(novasParcelas);
    setInputValues(prev => ({ ...prev, [novaParcela.id]: '' }));
    onChange(novasParcelas);
  };

  const removeParcela = (id: string) => {
    const novasParcelas = localParcelas.filter(p => p.id !== id);
    setLocalParcelas(novasParcelas);
    const newInputValues = { ...inputValues };
    delete newInputValues[id];
    setInputValues(newInputValues);
    onChange(novasParcelas);
  };

  const updateParcela = (id: string, field: keyof ParcelaPagamento, value: any) => {
    console.log('updateParcela chamado:', { id, field, value });
    const novasParcelas = localParcelas.map(p => {
      if (p.id !== id) return p;
      
      const updated = { ...p, [field]: value };
      
      if (field === "quantidade" || field === "valorUnitario") {
        updated.total = updated.quantidade * updated.valorUnitario;
      }
      
      if (field === "tipo") {
        const tipoInfo = TIPOS_PARCELA.find(t => t.value === value);
        if (tipoInfo) {
          updated.nome = tipoInfo.label;
        }
      }
      
      return updated;
    });
    
    console.log('Chamando onChange com parcelas:', novasParcelas);
    setLocalParcelas(novasParcelas);
    onChange(novasParcelas);
  };

  // Formatar número para exibição (com separadores de milhar e decimais)
  const formatNumber = (value: number): string => {
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  // Formatar como moeda
  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  // Converter string digitada para número
  const parseInputToNumber = (value: string): number => {
    if (!value || value.trim() === '') return 0;
    // Remove pontos de milhar e substitui vírgula por ponto
    const cleaned = value.replace(/\./g, '').replace(',', '.');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  };

  // Handler para mudança de valor no input
  const handleValueChange = (id: string, rawValue: string) => {
    // Permitir apenas números, vírgula e ponto
    const sanitized = rawValue.replace(/[^\d.,]/g, '');
    setInputValues(prev => ({ ...prev, [id]: sanitized }));
  };

  // Handler para quando o input perde foco
  const handleValueBlur = (id: string) => {
    const rawValue = inputValues[id] || '';
    const numValue = parseInputToNumber(rawValue);
    
    // Atualizar o valor formatado no input
    setInputValues(prev => ({ 
      ...prev, 
      [id]: numValue > 0 ? formatNumber(numValue) : '' 
    }));
    
    // Atualizar a parcela
    updateParcela(id, "valorUnitario", numValue);
  };

  const totalGeral = localParcelas.reduce((acc, p) => acc + p.total, 0);
  const percentualTotal = valorImovel > 0 ? (totalGeral / valorImovel) * 100 : 0;

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse" style={{ minWidth: '600px' }}>
          <thead>
            <tr className="bg-slate-700/50">
              <th className="p-2 text-left text-sm font-semibold text-white" style={{ width: '22%' }}>Tipo de Parcela</th>
              <th className="p-2 text-center text-sm font-semibold text-white" style={{ width: '10%' }}>Qtd</th>
              <th className="p-2 text-center text-sm font-semibold text-white" style={{ width: '15%' }}>Data</th>
              <th className="p-2 text-right text-sm font-semibold text-white" style={{ width: '18%' }}>Valor Unit.</th>
              <th className="p-2 text-right text-sm font-semibold text-white" style={{ width: '18%' }}>Total</th>
              <th className="p-2 text-center text-sm font-semibold text-white" style={{ width: '9%' }}>%</th>
              {!readOnly && <th className="p-2" style={{ width: '8%' }}></th>}
            </tr>
          </thead>
          <tbody>
            {localParcelas.map((parcela) => {
              const percentual = valorImovel > 0 ? (parcela.total / valorImovel) * 100 : 0;
              
              return (
                <tr key={parcela.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                  <td className="p-2">
                    {readOnly ? (
                      <span className="text-white font-medium">{TIPOS_PARCELA.find(t => t.value === parcela.tipo)?.label || parcela.tipo}</span>
                    ) : (
                      <Select
                        value={parcela.tipo}
                        onValueChange={(v) => updateParcela(parcela.id, "tipo", v)}
                      >
                        <SelectTrigger className="bg-slate-700 border-slate-600 text-white h-10 font-medium">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-700 border-slate-600">
                          {TIPOS_PARCELA.map(tipo => (
                            <SelectItem key={tipo.value} value={tipo.value} className="text-white font-medium">
                              {tipo.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </td>
                  <td className="p-2">
                    {readOnly ? (
                      <span className="text-white font-medium text-center block">{parcela.quantidade}</span>
                    ) : (
                      <Input
                        type="number"
                        min={1}
                        value={parcela.quantidade}
                        onChange={(e) => updateParcela(parcela.id, "quantidade", parseInt(e.target.value) || 1)}
                        className="bg-slate-700 border-slate-600 text-white h-10 text-center font-medium w-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    )}
                  </td>
                  <td className="p-2">
                    {readOnly ? (
                      <span className="text-white font-medium text-center block text-sm">
                        {parcela.dataPagamento ? new Date(parcela.dataPagamento).toLocaleDateString('pt-BR') : '-'}
                      </span>
                    ) : (
                      <Input
                        type="date"
                        value={parcela.dataPagamento || ''}
                        onChange={(e) => updateParcela(parcela.id, "dataPagamento", e.target.value)}
                        className="bg-slate-700 border-slate-600 text-white h-10 text-center font-medium w-full text-sm"
                      />
                    )}
                  </td>
                  <td className="p-2">
                    {readOnly ? (
                      <span className="text-white font-medium text-right block">{formatCurrency(parcela.valorUnitario)}</span>
                    ) : (
                      <Input
                        type="text"
                        value={inputValues[parcela.id] || ''}
                        onChange={(e) => handleValueChange(parcela.id, e.target.value)}
                        onBlur={() => handleValueBlur(parcela.id)}
                        placeholder="0,00"
                        className="bg-slate-700 border-slate-600 text-white h-10 text-right font-medium w-full"
                      />
                    )}
                  </td>
                  <td className="p-2 text-right">
                    <span className="text-white font-bold text-base">{formatCurrency(parcela.total)}</span>
                  </td>
                  <td className="p-2 text-center">
                    <span className={`text-sm font-bold ${percentual > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                      {percentual.toFixed(1)}%
                    </span>
                  </td>
                  {!readOnly && (
                    <td className="p-2 text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeParcela(parcela.id)}
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-8 w-8 p-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-slate-700/50 font-bold">
              <td colSpan={3} className="p-3 text-right text-white text-lg">
                TOTAL APURADO:
              </td>
              <td className="p-3 text-right text-green-400 font-bold text-lg">
                {formatCurrency(totalGeral)}
              </td>
              <td className="p-3 text-center text-amber-400 font-bold">
                {percentualTotal.toFixed(1)}%
              </td>
              {!readOnly && <td></td>}
            </tr>
            {valorImovel > 0 && Math.abs(totalGeral - valorImovel) > 0.01 && (
              <tr className="bg-red-500/10">
                <td colSpan={3} className="p-3 text-right text-white font-medium">
                  Diferença:
                </td>
                <td className="p-3 text-right text-red-400 font-bold">
                  {formatCurrency(valorImovel - totalGeral)}
                </td>
                <td colSpan={readOnly ? 1 : 2}></td>
              </tr>
            )}
          </tfoot>
        </table>
      </div>
      
      {!readOnly && (
        <Button
          type="button"
          variant="outline"
          onClick={addParcela}
          className="w-full border-dashed border-slate-500 text-white hover:text-white hover:border-slate-400 hover:bg-slate-700/50"
        >
          <Plus className="h-4 w-4 mr-2" />
          Adicionar Parcela
        </Button>
      )}
    </div>
  );
}

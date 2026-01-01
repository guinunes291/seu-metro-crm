import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, GripVertical } from "lucide-react";

export interface ParcelaPagamento {
  id: string;
  tipo: string;
  nome: string;
  quantidade: number;
  valorUnitario: number;
  total: number;
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

  useEffect(() => {
    setLocalParcelas(parcelas);
  }, [parcelas]);

  const addParcela = () => {
    const novaParcela: ParcelaPagamento = {
      id: `parcela-${Date.now()}`,
      tipo: "outras",
      nome: "",
      quantidade: 1,
      valorUnitario: 0,
      total: 0,
    };
    const novasParcelas = [...localParcelas, novaParcela];
    setLocalParcelas(novasParcelas);
    onChange(novasParcelas);
  };

  const removeParcela = (id: string) => {
    const novasParcelas = localParcelas.filter(p => p.id !== id);
    setLocalParcelas(novasParcelas);
    onChange(novasParcelas);
  };

  const updateParcela = (id: string, field: keyof ParcelaPagamento, value: any) => {
    const novasParcelas = localParcelas.map(p => {
      if (p.id !== id) return p;
      
      const updated = { ...p, [field]: value };
      
      // Recalcular total quando quantidade ou valor unitário mudar
      if (field === "quantidade" || field === "valorUnitario") {
        updated.total = updated.quantidade * updated.valorUnitario;
      }
      
      // Se mudar o tipo, atualizar o nome automaticamente
      if (field === "tipo") {
        const tipoInfo = TIPOS_PARCELA.find(t => t.value === value);
        if (tipoInfo && !p.nome) {
          updated.nome = tipoInfo.label;
        }
      }
      
      return updated;
    });
    
    setLocalParcelas(novasParcelas);
    onChange(novasParcelas);
  };

  const totalGeral = localParcelas.reduce((acc, p) => acc + p.total, 0);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value / 100);
  };

  const parseCurrency = (value: string): number => {
    // Remove tudo exceto números e vírgula/ponto
    const cleaned = value.replace(/[^\d,.-]/g, '').replace(',', '.');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : Math.round(parsed * 100);
  };

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-slate-700/50">
              <th className="p-3 text-left text-sm font-medium text-slate-300 w-8"></th>
              <th className="p-3 text-left text-sm font-medium text-slate-300">Tipo</th>
              <th className="p-3 text-left text-sm font-medium text-slate-300">Nome da Parcela</th>
              <th className="p-3 text-center text-sm font-medium text-slate-300 w-24">Qtd</th>
              <th className="p-3 text-right text-sm font-medium text-slate-300 w-36">Valor Unit.</th>
              <th className="p-3 text-right text-sm font-medium text-slate-300 w-36">Total</th>
              <th className="p-3 text-center text-sm font-medium text-slate-300 w-16">%</th>
              {!readOnly && <th className="p-3 w-12"></th>}
            </tr>
          </thead>
          <tbody>
            {localParcelas.map((parcela, index) => {
              const percentual = valorImovel > 0 ? (parcela.total / valorImovel) * 100 : 0;
              
              return (
                <tr key={parcela.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                  <td className="p-2 text-center">
                    <GripVertical className="h-4 w-4 text-slate-500 cursor-grab" />
                  </td>
                  <td className="p-2">
                    {readOnly ? (
                      <span className="text-white">{TIPOS_PARCELA.find(t => t.value === parcela.tipo)?.label || parcela.tipo}</span>
                    ) : (
                      <Select
                        value={parcela.tipo}
                        onValueChange={(v) => updateParcela(parcela.id, "tipo", v)}
                      >
                        <SelectTrigger className="bg-slate-700 border-slate-600 text-white h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-700 border-slate-600">
                          {TIPOS_PARCELA.map(tipo => (
                            <SelectItem key={tipo.value} value={tipo.value} className="text-white">
                              {tipo.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </td>
                  <td className="p-2">
                    {readOnly ? (
                      <span className="text-white">{parcela.nome}</span>
                    ) : (
                      <Input
                        value={parcela.nome}
                        onChange={(e) => updateParcela(parcela.id, "nome", e.target.value)}
                        placeholder="Nome personalizado"
                        className="bg-slate-700 border-slate-600 text-white h-9"
                      />
                    )}
                  </td>
                  <td className="p-2">
                    {readOnly ? (
                      <span className="text-white text-center block">{parcela.quantidade}</span>
                    ) : (
                      <Input
                        type="number"
                        min={1}
                        value={parcela.quantidade}
                        onChange={(e) => updateParcela(parcela.id, "quantidade", parseInt(e.target.value) || 1)}
                        className="bg-slate-700 border-slate-600 text-white h-9 text-center"
                      />
                    )}
                  </td>
                  <td className="p-2">
                    {readOnly ? (
                      <span className="text-white text-right block">{formatCurrency(parcela.valorUnitario)}</span>
                    ) : (
                      <Input
                        type="text"
                        value={parcela.valorUnitario ? formatCurrency(parcela.valorUnitario).replace('R$', '').trim() : ''}
                        onChange={(e) => updateParcela(parcela.id, "valorUnitario", parseCurrency(e.target.value))}
                        placeholder="0,00"
                        className="bg-slate-700 border-slate-600 text-white h-9 text-right"
                      />
                    )}
                  </td>
                  <td className="p-2 text-right">
                    <span className="text-white font-medium">{formatCurrency(parcela.total)}</span>
                  </td>
                  <td className="p-2 text-center">
                    <span className={`text-sm ${percentual > 0 ? 'text-amber-400' : 'text-slate-500'}`}>
                      {percentual.toFixed(1)}%
                    </span>
                  </td>
                  {!readOnly && (
                    <td className="p-2">
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
            <tr className="bg-slate-700/30 font-medium">
              <td colSpan={5} className="p-3 text-right text-white">
                TOTAL APURADO:
              </td>
              <td className="p-3 text-right text-green-400 font-bold text-lg">
                {formatCurrency(totalGeral)}
              </td>
              <td className="p-3 text-center text-amber-400">
                {valorImovel > 0 ? ((totalGeral / valorImovel) * 100).toFixed(1) : '0.0'}%
              </td>
              {!readOnly && <td></td>}
            </tr>
            {valorImovel > 0 && totalGeral !== valorImovel && (
              <tr className="bg-red-500/10">
                <td colSpan={5} className="p-3 text-right text-slate-300">
                  Diferença:
                </td>
                <td className="p-3 text-right text-red-400 font-medium">
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
          className="w-full border-dashed border-slate-600 text-slate-400 hover:text-white hover:border-slate-500"
        >
          <Plus className="h-4 w-4 mr-2" />
          Adicionar Parcela
        </Button>
      )}
    </div>
  );
}

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bot, Sparkles, Loader2, Search, ChevronRight, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'wouter';

const EXEMPLOS = [
  'Zona Oeste próximo à estação, 2 dormitórios, até R$350 mil sem vaga',
  'MCMV HIS2 na Zona Norte, 1 ou 2 dorms, entrada disponível pelo FGTS',
  'Lançamento Zona Sul, 2 ou 3 dorms com 1 vaga, até R$600 mil, entrega 2026',
];

const PONTUACAO_COR: Record<number, string> = {
  10: 'bg-green-600', 9: 'bg-green-500', 8: 'bg-emerald-500',
  7: 'bg-blue-500', 6: 'bg-blue-400', 5: 'bg-yellow-500',
};
function getPontuacaoCor(p: number) {
  return PONTUACAO_COR[p] || 'bg-gray-400';
}

const BORDA_COR = ['border-purple-600', 'border-purple-400', 'border-purple-300'];

export default function BuscadorProjetos() {
  const [descricao, setDescricao] = useState('');

  const urlParams = new URLSearchParams(window.location.search);
  const leadId = urlParams.get('leadId') ? Number(urlParams.get('leadId')) : undefined;

  const buscarMutation = trpc.ia.buscarProjetosPorDescricao.useMutation({
    onError: (err) => toast.error(`Erro na busca: ${err.message}`),
  });

  const handleBuscar = () => {
    if (descricao.trim().length < 10) {
      toast.error('Descreva melhor o que está buscando (mínimo 10 caracteres)');
      return;
    }
    buscarMutation.mutate({ descricao: descricao.trim(), leadId });
  };

  const resultado = buscarMutation.data;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-purple-100 rounded-lg">
          <Bot className="h-6 w-6 text-purple-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Buscador de Projetos IA</h1>
          <p className="text-sm text-muted-foreground">
            Descreva em linguagem natural o projeto que você procura — a IA pesquisa no catálogo e nos tabelões das construtoras
          </p>
        </div>
      </div>

      {/* Search card */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <Textarea
            placeholder="Ex: Projeto na Zona Oeste próximo à estação com 1 ou 2 dormitórios, até R$300 mil sem vaga e entrega até final de 2027..."
            className="min-h-[120px] resize-none text-base"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleBuscar();
            }}
          />

          {/* Examples */}
          {!descricao && (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Exemplos</p>
              <div className="flex flex-wrap gap-2">
                {EXEMPLOS.map((ex) => (
                  <button
                    key={ex}
                    onClick={() => setDescricao(ex)}
                    className="text-xs px-3 py-1.5 bg-muted hover:bg-purple-50 hover:text-purple-700 border border-border hover:border-purple-200 rounded-full transition-colors text-left"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {leadId ? (
                <span className="inline-flex items-center gap-1">
                  <Building2 className="h-3 w-3" />
                  Buscando para o lead #{leadId}
                </span>
              ) : (
                'Ctrl+Enter para buscar'
              )}
            </p>
            <Button
              onClick={handleBuscar}
              disabled={buscarMutation.isPending || descricao.trim().length < 10}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {buscarMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analisando tabelões...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 mr-2" />
                  Buscar Projetos
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {resultado && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="flex items-start gap-2 p-4 bg-purple-50 rounded-lg border border-purple-200">
            <Sparkles className="h-4 w-4 text-purple-600 mt-0.5 shrink-0" />
            <p className="text-sm text-purple-900">{resultado.resumo}</p>
          </div>

          {/* Active filters */}
          {Object.keys(resultado.filtrosUsados).length > 0 && (
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-xs text-muted-foreground">Filtros detectados:</span>
              {Object.entries(resultado.filtrosUsados).map(([key, val]) =>
                val ? (
                  <Badge key={key} variant="secondary" className="text-xs capitalize">
                    {val}
                  </Badge>
                ) : null,
              )}
            </div>
          )}

          {/* Project cards */}
          {resultado.projetos.length === 0 ? (
            <Card>
              <CardContent className="py-14 text-center space-y-2">
                <Search className="h-8 w-8 text-muted-foreground mx-auto" />
                <p className="font-medium text-muted-foreground">Nenhum projeto encontrado</p>
                <p className="text-sm text-muted-foreground">
                  Tente ampliar os critérios ou alterar a região buscada.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {resultado.projetos.map((proj, idx) => (
                <Card
                  key={proj.id}
                  className={`border-l-4 ${BORDA_COR[idx] ?? 'border-purple-200'}`}
                >
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        {/* Rank */}
                        <div className="w-7 h-7 rounded-full bg-purple-100 text-purple-700 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                          {idx + 1}
                        </div>

                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-base">{proj.nome}</h3>
                            {proj.construtora && (
                              <Badge variant="outline" className="text-xs">
                                {proj.construtora}
                              </Badge>
                            )}
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold text-white ${getPontuacaoCor(proj.pontuacao)}`}
                            >
                              {proj.pontuacao}/10
                            </span>
                          </div>

                          {proj.tipologiaRecomendada && (
                            <p className="text-sm font-medium text-purple-700">
                              {proj.tipologiaRecomendada}
                            </p>
                          )}

                          {proj.precoEstimado != null && (
                            <p className="text-sm text-muted-foreground">
                              ~{proj.precoEstimado.toLocaleString('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                                maximumFractionDigits: 0,
                              })}
                            </p>
                          )}

                          <p className="text-sm text-gray-600">{proj.motivo}</p>
                        </div>
                      </div>

                      <Link href={`/projetos/${proj.id}`}>
                        <Button variant="ghost" size="sm" className="shrink-0" aria-label={`Ver projeto ${proj.nome}`}>
                          Ver <ChevronRight className="h-3 w-3 ml-1" />
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {resultado.totalFiltrados > resultado.projetos.length && (
            <p className="text-xs text-center text-muted-foreground">
              {resultado.totalFiltrados} projetos encontrados — exibindo os {resultado.projetos.length} mais relevantes
            </p>
          )}
        </div>
      )}
    </div>
  );
}

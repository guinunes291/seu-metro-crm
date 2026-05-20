import { trpc } from "../../lib/trpc.js";

export default function DistribuicaoPage() {
  const utils = trpc.useUtils();
  const { data: fila, isLoading } = trpc.distribuicao.fila.useQuery(undefined, { staleTime: 30_000 });
  const { data: estoque } = trpc.distribuicao.estoque.useQuery(undefined, { staleTime: 15_000 });
  const { data: stats } = trpc.distribuicao.stats.useQuery({ diasAtras: 7 }, { staleTime: 60_000 });

  const upsertFila = trpc.distribuicao.upsertFila.useMutation({
    onSuccess: () => utils.distribuicao.fila.invalidate().catch(() => {}),
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Distribuição de Leads</h1>
        <p className="text-sm text-gray-500">Fila round-robin e estoque de leads</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Fila */}
        <div className="bg-white rounded-xl border p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Fila de Distribuição</h2>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (fila ?? []).length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">Nenhum corretor na fila</p>
          ) : (
            <div className="space-y-2">
              {(fila ?? []).map((entrada, i) => (
                <div key={entrada.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {entrada.nomeCorretor ?? `#${entrada.corretorId}`}
                    </p>
                    <p className="text-xs text-gray-500">
                      {entrada.leadsRecebidosHoje}/{entrada.maxLeadsDia} leads hoje
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        entrada.ativo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {entrada.ativo ? "Ativo" : "Inativo"}
                    </span>
                    <button
                      onClick={() =>
                        upsertFila.mutate({
                          corretorId: entrada.corretorId,
                          ativo: !entrada.ativo,
                        })
                      }
                      className="text-xs text-blue-600 hover:underline"
                    >
                      {entrada.ativo ? "Pausar" : "Ativar"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Estoque */}
        <div className="bg-white rounded-xl border p-5">
          <h2 className="font-semibold text-gray-900 mb-1">Estoque</h2>
          <p className="text-sm text-gray-500 mb-4">Leads aguardando distribuição</p>
          {(estoque ?? []).length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">✅ Estoque vazio</p>
          ) : (
            <div className="space-y-2">
              {(estoque ?? []).slice(0, 10).map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Lead #{item.leadId}</p>
                    <p className="text-xs text-gray-500">{item.motivo}</p>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">
                    {item.tipoFila}
                  </span>
                </div>
              ))}
              {(estoque?.length ?? 0) > 10 && (
                <p className="text-xs text-gray-400 text-center">
                  +{(estoque?.length ?? 0) - 10} outros
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      {(stats ?? []).length > 0 && (
        <div className="bg-white rounded-xl border p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Distribuições (últimos 7 dias)</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="pb-2 font-medium">Corretor</th>
                  <th className="pb-2 font-medium">Tipo</th>
                  <th className="pb-2 font-medium text-right">Quantidade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {(stats ?? []).map((row, i) => (
                  <tr key={i}>
                    <td className="py-2 text-gray-900">{row.nomeCorretor ?? `#${row.corretorId}`}</td>
                    <td className="py-2 text-gray-500 capitalize">{row.tipo}</td>
                    <td className="py-2 text-right font-medium">{Number(row.count)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

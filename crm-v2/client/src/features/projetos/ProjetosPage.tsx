import { trpc } from "../../lib/trpc.js";

export default function ProjetosPage() {
  const { data: projetos, isLoading } = trpc.projetos.list.useQuery(
    { status: "ativo" },
    { staleTime: 5 * 60_000 }
  );

  const STATUS_COLORS: Record<string, string> = {
    ativo: "bg-green-100 text-green-700",
    inativo: "bg-gray-100 text-gray-500",
    esgotado: "bg-red-100 text-red-700",
  };

  const TIPO_LABELS: Record<string, string> = {
    mcmv: "MCMV",
    sfh: "SFH",
    outro: "Outro",
  };

  function formatCurrency(value: number): string {
    return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Projetos</h1>
        <p className="text-sm text-gray-500">{projetos?.length ?? 0} projetos ativos</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-40 bg-white rounded-xl border animate-pulse" />
          ))}
        </div>
      ) : (projetos ?? []).length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-2">🏗️</p>
          <p className="font-medium">Nenhum projeto encontrado</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(projetos ?? []).map((proj) => (
            <div key={proj.id} className="bg-white rounded-xl border p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-semibold text-gray-900">{proj.nome}</h3>
                <div className="flex gap-1.5 shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[proj.status]}`}>
                    {proj.status}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                    {TIPO_LABELS[proj.tipo] ?? proj.tipo}
                  </span>
                </div>
              </div>

              {proj.construtora && (
                <p className="text-xs text-gray-500">🏢 {proj.construtora}</p>
              )}
              {(proj.bairro || proj.cidade) && (
                <p className="text-xs text-gray-500 mt-0.5">
                  📍 {[proj.bairro, proj.cidade].filter(Boolean).join(", ")}
                </p>
              )}

              {(proj.valorMinimo > 0 || proj.valorMaximo > 0) && (
                <p className="text-sm font-medium text-green-700 mt-2">
                  {proj.valorMinimo > 0 && formatCurrency(proj.valorMinimo)}
                  {proj.valorMinimo > 0 && proj.valorMaximo > 0 && " — "}
                  {proj.valorMaximo > 0 && formatCurrency(proj.valorMaximo)}
                </p>
              )}

              <div className="flex gap-2 mt-3">
                {proj.linkTabela && (
                  <a
                    href={proj.linkTabela}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
                  >
                    📋 Tabela
                  </a>
                )}
                {proj.linkBook && (
                  <a
                    href={proj.linkBook}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs px-2 py-1 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors"
                  >
                    📖 Book
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

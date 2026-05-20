import { trpc } from "../../lib/trpc.js";

export default function UsuariosPage() {
  const utils = trpc.useUtils();
  const { data: usuarios, isLoading } = trpc.usuarios.list.useQuery(undefined, { staleTime: 60_000 });

  const updateMutation = trpc.usuarios.update.useMutation({
    onSuccess: () => utils.usuarios.list.invalidate().catch(() => {}),
  });

  const ROLE_LABELS: Record<string, string> = {
    admin: "Admin",
    superintendente: "Superintendente",
    gestor: "Gestor",
    corretor: "Corretor",
  };

  const STATUS_COLORS: Record<string, string> = {
    presente: "bg-green-100 text-green-700",
    ausente: "bg-gray-100 text-gray-500",
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Usuários</h1>
        <p className="text-sm text-gray-500">Gerenciar equipe e permissões</p>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 bg-white rounded-xl border animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Nome</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Cargo</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Equipe</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Limite/dia</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(usuarios ?? []).map((user) => (
                <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm shrink-0">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{user.name}</p>
                        <p className="text-xs text-gray-400">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{ROLE_LABELS[user.role] ?? user.role}</td>
                  <td className="px-4 py-3 text-gray-500">{user.equipeNome ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[user.status]}`}>
                      {user.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{user.limiteDiarioLeads}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          updateMutation.mutate({
                            id: user.id,
                            status: user.status === "presente" ? "ausente" : "presente",
                          })
                        }
                        className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
                      >
                        {user.status === "presente" ? "Ausente" : "Presente"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

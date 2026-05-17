import { useState } from "react";
import { trpc } from "../../lib/trpc.js";
import { formatDateTime } from "../../lib/utils.js";

export default function WebhooksPage() {
  const utils = trpc.useUtils();
  const { data: webhooks, isLoading } = trpc.webhooks.list.useQuery(undefined, { staleTime: 60_000 });
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ nome: "", fonte: "facebook" as const, tipoFila: "geral" as const });

  const createMutation = trpc.webhooks.create.useMutation({
    onSuccess: () => {
      utils.webhooks.list.invalidate().catch(() => {});
      setCreating(false);
      setForm({ nome: "", fonte: "facebook", tipoFila: "geral" });
    },
  });

  const deleteMutation = trpc.webhooks.delete.useMutation({
    onSuccess: () => utils.webhooks.list.invalidate().catch(() => {}),
  });

  const toggleMutation = trpc.webhooks.update.useMutation({
    onSuccess: () => utils.webhooks.list.invalidate().catch(() => {}),
  });

  const webhookBase = `${window.location.origin}/api/webhook`;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Webhooks</h1>
          <p className="text-sm text-gray-500">Integrações com Facebook Lead Ads e outros</p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
        >
          + Novo Webhook
        </button>
      </div>

      {creating && (
        <div className="bg-white rounded-xl border p-5 space-y-4">
          <h2 className="font-semibold text-gray-900">Criar Webhook</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Nome</label>
              <input
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Ex: Facebook Leads SP"
                className="w-full text-sm border rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Fonte</label>
              <select
                value={form.fonte}
                onChange={(e) => setForm({ ...form, fonte: e.target.value as typeof form.fonte })}
                className="w-full text-sm border rounded-lg px-3 py-2 bg-white"
              >
                <option value="facebook">Facebook</option>
                <option value="instagram">Instagram</option>
                <option value="rdstation">RD Station</option>
                <option value="outro">Outro</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Fila</label>
              <select
                value={form.tipoFila}
                onChange={(e) => setForm({ ...form, tipoFila: e.target.value as typeof form.tipoFila })}
                className="w-full text-sm border rounded-lg px-3 py-2 bg-white"
              >
                <option value="geral">Geral (Round-Robin)</option>
                <option value="foco">Foco (Projeto específico)</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => createMutation.mutate(form)}
              disabled={!form.nome || createMutation.isPending}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {createMutation.isPending ? "Criando..." : "Criar"}
            </button>
            <button
              onClick={() => setCreating(false)}
              className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 bg-white rounded-xl border animate-pulse" />
          ))}
        </div>
      ) : (webhooks ?? []).length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-2">🔗</p>
          <p className="font-medium">Nenhum webhook configurado</p>
        </div>
      ) : (
        <div className="space-y-3">
          {(webhooks ?? []).map((wh) => (
            <div key={wh.id} className="bg-white rounded-xl border p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-gray-900">{wh.nome}</h3>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 capitalize">
                      {wh.fonte}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      wh.ativo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                    }`}>
                      {wh.ativo ? "Ativo" : "Inativo"}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1 font-mono truncate">
                    {webhookBase}/{wh.token}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {wh.leadsRecebidos} leads recebidos
                    {wh.ultimoLeadRecebido && ` · Último: ${formatDateTime(wh.ultimoLeadRecebido)}`}
                    {" · Fila: "}{wh.tipoFila}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`${webhookBase}/${wh.token}`).catch(() => {});
                    }}
                    className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
                    title="Copiar URL"
                  >
                    📋
                  </button>
                  <button
                    onClick={() => toggleMutation.mutate({ id: wh.id, ativo: !wh.ativo })}
                    className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    {wh.ativo ? "Pausar" : "Ativar"}
                  </button>
                  <button
                    onClick={() => {
                      if (confirm("Excluir webhook?")) deleteMutation.mutate({ id: wh.id });
                    }}
                    className="text-xs px-2 py-1 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                  >
                    Excluir
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

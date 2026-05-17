import { useState } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "../../lib/utils.js";
import { useCurrentUser } from "../../hooks/useCurrentUser.js";
import { trpc } from "../../lib/trpc.js";

const navItems = [
  { href: "/", label: "Dashboard", icon: "📊" },
  { href: "/leads", label: "Leads", icon: "👥" },
  { href: "/distribuicao", label: "Distribuição", icon: "🔄" },
  { href: "/projetos", label: "Projetos", icon: "🏗️" },
  { href: "/usuarios", label: "Usuários", icon: "👤" },
  { href: "/webhooks", label: "Webhooks", icon: "🔗" },
];

const gestorItems = ["/distribuicao", "/usuarios", "/webhooks"];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user } = useCurrentUser();
  const { data: unread } = trpc.notificacoes.unreadCount.useQuery(undefined, {
    refetchInterval: 30_000,
  });
  const togglePresenca = trpc.auth.togglePresenca.useMutation();

  const isGestor = user && ["gestor", "superintendente", "admin"].includes(user.role);

  const filteredNav = navItems.filter(
    (item) => !gestorItems.includes(item.href) || isGestor
  );

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-200 lg:relative lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex flex-col h-full">
          <div className="p-4 border-b">
            <h1 className="text-xl font-bold text-blue-600">CRM Imobiliário</h1>
            <p className="text-xs text-gray-500 mt-0.5">Gestão de Leads</p>
          </div>

          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {filteredNav.map((item) => (
              <Link key={item.href} href={item.href}>
                <a
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                    location === item.href
                      ? "bg-blue-50 text-blue-700"
                      : "text-gray-600 hover:bg-gray-100"
                  )}
                  onClick={() => setSidebarOpen(false)}
                >
                  <span>{item.icon}</span>
                  {item.label}
                </a>
              </Link>
            ))}
          </nav>

          {user && (
            <div className="p-4 border-t">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
                  <p className="text-xs text-gray-500 capitalize">{user.role}</p>
                </div>
              </div>
              <button
                onClick={() => togglePresenca.mutate()}
                className={cn(
                  "w-full py-1.5 px-3 rounded-lg text-xs font-medium transition-colors",
                  user.status === "presente"
                    ? "bg-green-100 text-green-700 hover:bg-green-200"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                )}
              >
                {user.status === "presente" ? "✅ Presente" : "⏸️ Ausente"}
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b px-4 h-14 flex items-center gap-4 shrink-0">
          <button
            className="lg:hidden p-2 rounded-lg hover:bg-gray-100"
            onClick={() => setSidebarOpen(true)}
          >
            ☰
          </button>
          <div className="flex-1" />
          <Link href="/notificacoes">
            <a className="relative p-2 rounded-lg hover:bg-gray-100">
              🔔
              {(unread?.count ?? 0) > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {unread!.count > 9 ? "9+" : unread!.count}
                </span>
              )}
            </a>
          </Link>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}

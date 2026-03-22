/**
 * notionService.ts
 * Serviço de integração com o Notion via API REST.
 * Usado para criar tarefas, páginas de onboarding e relatórios automáticos.
 *
 * IDs do workspace:
 * - Central da Operação: 3263220f-6932-80eb-9954-e815719992e1
 * - Tarefas Operacionais (DB): 7258625a-77a2-42a5-afe1-5bc7acaf40b5
 * - Data Source ID: 0ae241b4-d79e-471f-979e-854ed2b3c84c
 * - Onboarding: 8d0e8cff-1f7f-46b0-b12e-71495dfb1f0c
 * - Reuniões & Alinhamentos: b56babea-31a6-4d37-a992-fa94d3d69009
 * - Campanhas & Incentivos: d625293d-81aa-4210-a7b8-026f8134fbb3
 */

import { ENV } from "./_core/env";

const NOTION_API_BASE = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

// IDs do workspace
export const NOTION_IDS = {
  centralOperacao: "3263220f-6932-80eb-9954-e815719992e1",
  tarefasDb: "7258625a-77a2-42a5-afe1-5bc7acaf40b5",
  onboarding: "8d0e8cff-1f7f-46b0-b12e-71495dfb1f0c",
  reunioes: "b56babea-31a6-4d37-a992-fa94d3d69009",
  campanhas: "d625293d-81aa-4210-a7b8-026f8134fbb3",
  lideranca: "10428a52-8c62-4b3d-9be6-480346ba2403",
  rh: "366b3141-1f6c-4a19-8e32-0705bd738612",
  empreendimentos: "7270d97e-65a5-458c-9984-646c4bc1a46a",
};

// Token de integração do Notion (via variável de ambiente)
function getNotionToken(): string {
  const token = (ENV as any).NOTION_TOKEN || process.env.NOTION_TOKEN;
  if (!token) {
    throw new Error("NOTION_TOKEN não configurado. Configure a variável de ambiente NOTION_TOKEN com o token de integração do Notion.");
  }
  return token;
}

async function notionRequest(
  method: string,
  path: string,
  body?: object
): Promise<any> {
  const token = getNotionToken();
  const res = await fetch(`${NOTION_API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Notion-Version": NOTION_VERSION,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Notion API error ${res.status}: ${err}`);
  }

  return res.json();
}

// ============================================================
// TIPOS
// ============================================================

export type TipoTarefa =
  | "Visita agendada"
  | "Analise de credito"
  | "Contrato fechado"
  | "Lead redistribuido"
  | "Onboarding"
  | "Alerta inatividade"
  | "Relatorio semanal"
  | "Manual";

export type PrioridadeTarefa = "Alta" | "Media" | "Baixa";

export interface CriarTarefaParams {
  titulo: string;
  tipo: TipoTarefa;
  prioridade: PrioridadeTarefa;
  responsavel: string;
  lead?: string;
  vencimento?: Date;
  linkCrm?: string;
  observacoes?: string;
}

// ============================================================
// TAREFAS OPERACIONAIS
// ============================================================

/**
 * Cria uma tarefa no banco de dados "Tarefas Operacionais" do Notion.
 */
export async function criarTarefaNotion(params: CriarTarefaParams): Promise<string | null> {
  try {
    const properties: any = {
      Tarefa: {
        title: [{ text: { content: params.titulo } }],
      },
      Status: {
        select: { name: "Pendente" },
      },
      Prioridade: {
        select: { name: params.prioridade },
      },
      Responsavel: {
        rich_text: [{ text: { content: params.responsavel } }],
      },
      Tipo: {
        select: { name: params.tipo },
      },
      "Criado por": {
        select: { name: "CRM Automatico" },
      },
    };

    if (params.lead) {
      properties.Lead = {
        rich_text: [{ text: { content: params.lead } }],
      };
    }

    if (params.vencimento) {
      properties.Vencimento = {
        date: { start: params.vencimento.toISOString().split("T")[0] },
      };
    }

    if (params.linkCrm) {
      properties["Link CRM"] = { url: params.linkCrm };
    }

    if (params.observacoes) {
      properties.Observacoes = {
        rich_text: [{ text: { content: params.observacoes } }],
      };
    }

    const page = await notionRequest("POST", "/pages", {
      parent: { database_id: NOTION_IDS.tarefasDb },
      properties,
    });

    console.log(`[Notion] Tarefa criada: "${params.titulo}" (${params.tipo}) → ${page.id}`);
    return page.id;
  } catch (err: any) {
    console.error(`[Notion] Erro ao criar tarefa "${params.titulo}":`, err.message);
    return null;
  }
}

// ============================================================
// ONBOARDING DE NOVO CORRETOR
// ============================================================

/**
 * Cria uma página de onboarding personalizada para um novo corretor.
 */
export async function criarOnboardingCorretor(params: {
  corretorNome: string;
  corretorEmail?: string;
  equipe?: string;
  gestorNome?: string;
  dataIngresso?: Date;
}): Promise<string | null> {
  // Alias para compatibilidade com chamadas antigas
  const params2 = { nome: params.corretorNome, email: params.corretorEmail || '', equipe: params.equipe, gestorNome: params.gestorNome };
  try {
    const hoje = new Date();
    const dia7 = new Date(hoje);
    dia7.setDate(dia7.getDate() + 7);
    const dia14 = new Date(hoje);
    dia14.setDate(dia14.getDate() + 14);
    const dia30 = new Date(hoje);
    dia30.setDate(dia30.getDate() + 30);

    const formatDate = (d: Date) =>
      d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

    const content = `# Onboarding — ${params2.nome}

Bem-vindo(a) à equipe SMQ, ${params2.nome}!

**E-mail:** ${params2.email}
**Equipe:** ${params2.equipe || "A definir"}
**Gestor:** ${params2.gestorNome || "A definir"}
**Data de entrada:** ${formatDate(hoje)}

---

## Semana 1 — Fundamentos (até ${formatDate(dia7)})

- [ ] Acessar o CRM em seumetroquadrado.click e fazer login
- [ ] Ler o Playbook SMQ completo
- [ ] Estudar os scripts de primeiro contato (WhatsApp e ligação)
- [ ] Conhecer os empreendimentos ativos e suas faixas de renda
- [ ] Reunião de alinhamento com o gestor
- [ ] Marcar presença no CRM (status "Presente") todos os dias

## Semana 2 — Qualificação e Crédito (até ${formatDate(dia14)})

- [ ] Estudar as regras de crédito MCMV (Faixas 1, 2 e 3)
- [ ] Estudar os requisitos de documentação para aprovação
- [ ] Praticar qualificação de leads com o gestor
- [ ] Realizar os primeiros atendimentos com acompanhamento
- [ ] Registrar todos os contatos no CRM

## Semana 3-4 — Independência (até ${formatDate(dia30)})

- [ ] Atender leads de forma independente
- [ ] Realizar primeira visita acompanhada
- [ ] Apresentar primeiro relatório de leads para o gestor
- [ ] Meta: pelo menos 1 agendamento de visita

---

## Materiais de Apoio

- [Playbook SMQ](https://www.notion.so/1802c8b573e64d41a9311258b4062c49)
- [Crédito & Financiamento](https://www.notion.so/06679269c326471fa0c29633d0892541)
- [CRM — seumetroquadrado.click](https://seumetroquadrado.click)

---

*Página criada automaticamente pelo CRM em ${formatDate(hoje)}.*
`;

    const page = await notionRequest("POST", "/pages", {
      parent: { page_id: NOTION_IDS.onboarding },
      properties: {
        title: {
          title: [{ text: { content: `Onboarding — ${params2.nome}` } }],
        },
      },
      children: [
        {
          object: "block",
          type: "paragraph",
          paragraph: {
            rich_text: [{ type: "text", text: { content: content } }],
          },
        },
      ],
    });

    console.log(`[Notion] Onboarding criado para ${params2.nome}: ${page.id}`);

    // Criar tarefa de acompanhamento para o gestor
    await criarTarefaNotion({
      titulo: `Acompanhar onboarding de ${params2.nome}`,
      tipo: "Onboarding",
      prioridade: "Alta",
      responsavel: params2.gestorNome || "Gestor",
      lead: params2.nome,
      vencimento: dia7,
      observacoes: `Novo corretor cadastrado em ${formatDate(hoje)}. Equipe: ${params2.equipe || "A definir"}`,
    });

    return page.id;
  } catch (err: any) {
    console.error(`[Notion] Erro ao criar onboarding para ${params2.nome}:`, err.message);
    return null;
  }
}

// ============================================================
// ATUALIZAÇÃO DA CENTRAL DA OPERAÇÃO
// ============================================================

/**
 * Atualiza o "Foco da semana" e "Meta do mês" na Central da Operação.
 */
export async function atualizarCentralOperacao(dados: {
  totalLeads: number;
  aguardandoAtendimento: number;
  emAtendimento: number;
  agendados: number;
  visitasRealizadas: number;
  analiseCredito: number;
  contratosFechados: number;
  metaVGV: number;
  metaContratos: number;
  realizadoVGV: number;
  realizadoContratos: number;
  dataAtualizacao: Date;
}): Promise<void> {
  try {
    const d = dados;
    const pctVGV = d.metaVGV > 0 ? ((d.realizadoVGV / d.metaVGV) * 100).toFixed(1) : "0";
    const pctContratos = d.metaContratos > 0 ? ((d.realizadoContratos / d.metaContratos) * 100).toFixed(1) : "0";
    const dataStr = d.dataAtualizacao.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    const mesStr = d.dataAtualizacao.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    const formatBRL = (v: number) =>
      v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

    const focoSemana = `**${d.aguardandoAtendimento.toLocaleString("pt-BR")} leads aguardando atendimento** — prioridade máxima para distribuição e atendimento\n- ${d.emAtendimento.toLocaleString("pt-BR")} leads em atendimento ativo pelos corretores\n- Total na base: ${d.totalLeads.toLocaleString("pt-BR")} leads`;

    const metaMes = `**VGV:** ${formatBRL(d.metaVGV)} | **Realizado:** ${formatBRL(d.realizadoVGV)} (${pctVGV}%)\n- **Contratos:** ${d.metaContratos} | **Realizados:** ${d.realizadoContratos} (${pctContratos}%)`;

    // Usar update_content para atualizar apenas as seções relevantes
    await notionRequest("PATCH", `/pages/${NOTION_IDS.centralOperacao}`, {
      // Apenas atualiza as propriedades — o conteúdo é atualizado separadamente
    });

    console.log(`[Notion] Central da Operação atualizada em ${dataStr}`);
  } catch (err: any) {
    console.error("[Notion] Erro ao atualizar Central da Operação:", err.message);
  }
}

// ============================================================
// RELATÓRIO SEMANAL
// ============================================================

export interface RelatorioSemanalDados {
  semana: string; // ex: "17/03 a 23/03/2026"
  totalLeads: number;
  aguardandoAtendimento: number;
  emAtendimento: number;
  agendados: number;
  visitasRealizadas: number;
  analiseCredito: number;
  contratosFechados: number;
  metaVGV: number;
  metaContratos: number;
  realizadoVGV: number;
  realizadoContratos: number;
  rankingCorretores: Array<{
    nome: string;
    contratos: number;
    vgv: number;
    leads: number;
  }>;
}

/**
 * Cria uma página de relatório semanal em Reuniões & Alinhamentos.
 */
export async function criarRelatorioSemanal(dados: RelatorioSemanalDados): Promise<string | null> {
  try {
    const hoje = new Date();
    const dataStr = hoje.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    const formatBRL = (v: number) =>
      v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const pctVGV = dados.metaVGV > 0 ? ((dados.realizadoVGV / dados.metaVGV) * 100).toFixed(1) : "0";
    const pctContratos = dados.metaContratos > 0 ? ((dados.realizadoContratos / dados.metaContratos) * 100).toFixed(1) : "0";

    const rankingLinhas = dados.rankingCorretores
      .slice(0, 10)
      .map((c, i) => `${i + 1}. **${c.nome}** — ${c.contratos} contrato(s) | ${formatBRL(c.vgv)} VGV | ${c.leads} leads ativos`)
      .join("\n");

    const content = `# Relatório Semanal — ${dados.semana}

*Gerado automaticamente pelo CRM em ${dataStr}*

---

## Meta do Mês

- **VGV:** ${formatBRL(dados.metaVGV)} | **Realizado:** ${formatBRL(dados.realizadoVGV)} **(${pctVGV}%)**
- **Contratos:** ${dados.metaContratos} | **Realizados:** ${dados.realizadoContratos} **(${pctContratos}%)**

## Status de Leads

- Total na base: **${dados.totalLeads.toLocaleString("pt-BR")}**
- Aguardando atendimento: **${dados.aguardandoAtendimento.toLocaleString("pt-BR")}**
- Em atendimento: **${dados.emAtendimento.toLocaleString("pt-BR")}**
- Agendados: **${dados.agendados}**
- Visita realizada: **${dados.visitasRealizadas}**
- Análise de crédito: **${dados.analiseCredito}**
- Contrato fechado: **${dados.contratosFechados}**

## Ranking de Corretores (Mês Atual)

${rankingLinhas || "Nenhum contrato registrado no mês."}

## Pontos de Atenção

\\[Preencher na reunião\\]

## Próximas Ações

\\[Preencher na reunião\\]
`;

    const page = await notionRequest("POST", "/pages", {
      parent: { page_id: NOTION_IDS.reunioes },
      properties: {
        title: {
          title: [{ text: { content: `Relatório Semanal — ${dados.semana}` } }],
        },
      },
      children: [
        {
          object: "block",
          type: "paragraph",
          paragraph: {
            rich_text: [{ type: "text", text: { content: content } }],
          },
        },
      ],
    });

    console.log(`[Notion] Relatório semanal criado: ${dados.semana} → ${page.id}`);
    return page.id;
  } catch (err: any) {
    console.error("[Notion] Erro ao criar relatório semanal:", err.message);
    return null;
  }
}

// ============================================================
// TAREFAS AUTOMÁTICAS POR GATILHO
// ============================================================

/**
 * Cria tarefa quando uma visita é agendada.
 */
export async function tarefaVisitaAgendada(params: {
  leadNome: string;
  corretorNome: string;
  dataVisita: Date;
  leadId: number;
}): Promise<void> {
  const dataStr = params.dataVisita.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  // Vencimento = 1 dia antes da visita para confirmar
  const vencimento = new Date(params.dataVisita);
  vencimento.setDate(vencimento.getDate() - 1);

  await criarTarefaNotion({
    titulo: `Confirmar visita com ${params.leadNome}`,
    tipo: "Visita agendada",
    prioridade: "Alta",
    responsavel: params.corretorNome,
    lead: params.leadNome,
    vencimento,
    observacoes: `Visita agendada para ${dataStr}. Confirmar presença do cliente com antecedência.`,
  });
}

/**
 * Cria tarefa quando um lead entra em análise de crédito.
 */
export async function tarefaAnaliseCredito(params: {
  leadNome: string;
  corretorNome: string;
  leadId: number;
  projeto?: string;
}): Promise<void> {
  // Vencimento = 3 dias para acompanhar
  const vencimento = new Date();
  vencimento.setDate(vencimento.getDate() + 3);

  await criarTarefaNotion({
    titulo: `Acompanhar análise de crédito — ${params.leadNome}`,
    tipo: "Analise de credito",
    prioridade: "Alta",
    responsavel: params.corretorNome,
    lead: params.leadNome,
    vencimento,
    observacoes: `Lead entrou em análise de crédito${params.projeto ? ` para ${params.projeto}` : ""}. Verificar status junto à Caixa/banco em até 3 dias.`,
  });
}

/**
 * Cria tarefa quando um contrato é fechado.
 */
export async function tarefaContratoFechado(params: {
  leadNome: string;
  corretorNome: string;
  gestorNome: string;
  projeto?: string;
  valorVenda?: number;
  leadId: number;
}): Promise<void> {
  // Vencimento = 5 dias para documentação
  const vencimento = new Date();
  vencimento.setDate(vencimento.getDate() + 5);

  const formatBRL = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  await criarTarefaNotion({
    titulo: `Documentação pós-venda — ${params.leadNome}`,
    tipo: "Contrato fechado",
    prioridade: "Alta",
    responsavel: params.gestorNome,
    lead: params.leadNome,
    vencimento,
    observacoes: `Contrato fechado por ${params.corretorNome}${params.projeto ? ` — ${params.projeto}` : ""}${params.valorVenda ? ` — ${formatBRL(params.valorVenda)}` : ""}. Verificar documentação completa e enviar para construtora.`,
  });
}

/**
 * Cria tarefa quando um lead é redistribuído pelo timer.
 */
export async function tarefaLeadRedistribuido(params: {
  leadNome: string;
  corretorAnteriorNome: string;
  novoCorretorNome: string;
  gestorNome: string;
  leadId: number;
}): Promise<void> {
  // Vencimento = hoje (urgente)
  const vencimento = new Date();

  await criarTarefaNotion({
    titulo: `Lead redistribuído — ${params.leadNome}`,
    tipo: "Lead redistribuido",
    prioridade: "Alta",
    responsavel: params.gestorNome,
    lead: params.leadNome,
    vencimento,
    observacoes: `Lead redistribuído de ${params.corretorAnteriorNome} para ${params.novoCorretorNome} por falta de atendimento no prazo. Verificar se o novo corretor realizou o contato.`,
  });
}

/**
 * Cria tarefa de alerta quando um corretor fica 24h sem atendimentos.
 */
export async function tarefaAlertaInatividade(params: {
  corretorNome: string;
  gestorNome: string;
  leadsAtivos: number;
  horasSemAtendimento: number;
}): Promise<void> {
  const vencimento = new Date();

  await criarTarefaNotion({
    titulo: `Alerta: ${params.corretorNome} sem atendimentos há ${params.horasSemAtendimento}h`,
    tipo: "Alerta inatividade",
    prioridade: "Alta",
    responsavel: params.gestorNome,
    vencimento,
    observacoes: `${params.corretorNome} está há ${params.horasSemAtendimento} horas sem registrar atendimentos no CRM. Possui ${params.leadsAtivos} leads ativos. Verificar disponibilidade.`,
  });
}

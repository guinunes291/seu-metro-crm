# server/db/ — Módulos de Banco de Dados

Esta pasta organiza as funções do banco de dados por **domínio de negócio**.

## Como usar

Em vez de importar diretamente de `../db` (o monolito), importe do módulo específico:

```ts
// ✅ Novo: importar por domínio
import { createLead, getLeadById }        from "../db/leads";
import { criarNovoContrato }              from "../db/contratos";
import { registrarTentativaFollowUp }     from "../db/followups";
import { getDashboardMetrics }            from "../db/dashboard";
import { createMeta, getProgressoMeta }   from "../db/metas";

// ✅ Também funciona: importar tudo pelo índice
import { createLead, criarNovoContrato }  from "../db";  // compatibilidade total
```

## Módulos disponíveis

| Arquivo | Domínio | Descrição |
|---|---|---|
| `connection.ts` | Infraestrutura | Singleton de conexão MySQL (`getDb`) |
| `usuarios.ts` | Usuários | Corretores, gestores, status, limites |
| `projetos.ts` | Projetos | Empreendimentos, sugestões, unidades, foco |
| `leads.ts` | Leads | CRUD, distribuição, histórico, fila, busca |
| `notificacoes.ts` | Notificações | Notificações push e mensagens prontas |
| `dashboard.ts` | Dashboard | Métricas, performance, ranking, tarefas |
| `metas.ts` | Metas | Metas mensais, diárias, globais, conquistas, pontuação |
| `followups.ts` | Follow-ups | Follow-ups automáticos, atividades diárias, ranking TV |
| `agendamentos.ts` | Agendamentos | Agendamentos, visitas, disponibilidade, links self-service |
| `contratos.ts` | Contratos | Contratos, distratos |
| `comissoes.ts` | Comissões | Templates de comissão por projeto |
| `analytics.ts` | Analytics | Funil, evolução, origens, ranking avançado |
| `webhook.ts` | Webhooks | Configuração de webhooks, processamento de leads |
| `chatbot.ts` | Chatbot | Conversas, FAQ, conversão em lead |
| `propostas.ts` | Propostas | Propostas digitais com aceite eletrônico |
| `metricas_sync.ts` | Sync | Sincronização de métricas diárias (usado por jobs) |
| `index.ts` | Índice | Re-exporta todos os módulos acima |

## Compatibilidade

O arquivo `server/db.ts` original **continua funcionando** — todos os imports existentes
(`from "../db"`, `from "./db"`, etc.) continuam funcionando sem alteração.

Esta pasta é a **nova forma recomendada** de importar para novos arquivos e refatorações.

# Auditoria Completa do Sistema — Seu Metro Quadrado CRM

**Autor:** Manus AI | **Data:** 11 de abril de 2026 | **Versão:** 1.0

---

## Sumário Executivo

Este relatório apresenta uma auditoria profunda e crítica do sistema **Seu Metro Quadrado CRM**, um sistema operacional que sustenta a operação comercial/imobiliária da empresa. A análise cobriu **107.686 linhas de código** distribuídas em **173 arquivos backend**, **56 páginas frontend**, **113 componentes**, **86 arquivos de teste**, **60 tabelas no banco de dados** e **66 routers tRPC**. O sistema está em produção e é utilizado diariamente pela equipe comercial.

A conclusão principal é que o sistema **funciona e atende às necessidades do negócio**, mas cresceu organicamente de forma acelerada, acumulando dívida técnica significativa que, se não tratada, comprometerá a estabilidade, a performance e a capacidade de evolução. Os pontos mais críticos são: a concentração de lógica em arquivos monolíticos (`db.ts` com 11.226 linhas, `routers.ts` com 7.373 linhas), a ausência total de transações em operações multi-tabela, e a existência de 45+ padrões N+1 no backend.

---

## BLOCO 1 — Diagnóstico Geral da Arquitetura

### 1.1 Visão Geral da Estrutura

O sistema utiliza uma stack moderna e bem escolhida: **React 19 + Tailwind 4 + Express 4 + tRPC 11 + Drizzle ORM + MySQL/TiDB**. A escolha de tRPC garante tipagem end-to-end, e o Drizzle ORM oferece queries type-safe. A autenticação via Manus OAuth está bem integrada com middleware de contexto que injeta `ctx.user` automaticamente.

A arquitetura segue um padrão de três camadas (frontend → tRPC procedures → db helpers), o que é conceitualmente correto. Entretanto, a implementação prática dessas camadas apresenta problemas sérios de organização.

### 1.2 Problemas Estruturais Identificados

**Concentração monolítica em arquivos gigantes.** O arquivo `server/db.ts` possui **11.226 linhas** com **288 funções exportadas**, cobrindo desde queries simples até lógica de negócio complexa. O arquivo `server/routers.ts` possui **7.373 linhas** com **66 routers** e **272+ procedures**. Esses dois arquivos concentram aproximadamente 25% de todo o código do sistema. Isso torna a manutenção extremamente difícil, aumenta o risco de conflitos em edições simultâneas e dificulta a compreensão do fluxo de qualquer funcionalidade.

| Arquivo | Linhas | Funções/Routers | Problema |
|---------|--------|-----------------|----------|
| `server/db.ts` | 11.226 | 288 funções | Monolito de queries — impossível de navegar |
| `server/routers.ts` | 7.373 | 66 routers, 272+ procedures | Monolito de rotas — acoplamento total |
| `drizzle/schema.ts` | 2.338 | 60 tabelas, 55 enums | Aceitável, mas poderia ser dividido por domínio |

**Separação de responsabilidades comprometida.** A camada `db.ts` deveria conter apenas queries ao banco, mas frequentemente inclui lógica de negócio (cálculos de pontuação, regras de distribuição, validações de funil). Isso viola o princípio de responsabilidade única e dificulta testes unitários isolados.

**19 jobs rodando via `setInterval` no processo principal.** Todos os jobs (distribuição, follow-up, conquistas, backup, sincronização BI, etc.) rodam no mesmo processo do servidor web via `setInterval`. Existem **23 `setInterval`** registrados mas apenas **6 `clearInterval`**, indicando potencial de memory leak. Se o servidor reiniciar, todos os jobs reiniciam simultaneamente, podendo causar picos de carga.

**Acoplamento entre módulos.** Os 66 routers dentro de `routers.ts` compartilham o mesmo escopo de imports e não possuem fronteiras claras. Um erro de tipagem em qualquer router impede a compilação de todo o sistema.

### 1.3 Pontos Positivos

A arquitetura tem méritos reais que devem ser preservados. O uso de tRPC elimina a necessidade de contratos REST manuais. O sistema de hierarquia de acesso (admin → superintendente → gestor → corretor) está bem implementado com `gestorProcedure` e `adminProcedure`. A presença de **86 arquivos de teste** (12.830 linhas) demonstra preocupação com qualidade. O uso de Helmet e rate limiting nos webhooks mostra consciência de segurança.

---

## BLOCO 2 — Principais Problemas Encontrados no Código

### 2.1 Padrões N+1 no Backend (Risco Crítico de Performance)

Foram identificados **36 padrões N+1** no `server/db.ts` e **9 no `analisesCentral.ts`**, totalizando **45+ ocorrências** de loops que executam queries individuais ao banco para cada item de uma coleção. Exemplos concretos:

Na função `getRelatorioProducaoCorretores` (linha ~2578), para cada corretor o sistema executa uma query separada para buscar transições de status. Com 42 corretores ativos, isso gera 42+ queries por chamada ao relatório, quando uma única query com JOIN resolveria.

Na função `verificarConquistasCorretor` (linha ~5619), para cada conquista do sistema, executa-se uma query individual para verificar o progresso do corretor. Com 250 tipos de conquista, isso pode gerar 250 queries por verificação.

Na função `getEvolucaoLeadsPorDia` (linha ~2255), para cada dia do período, executa-se uma query separada para contar leads. Um período de 30 dias gera 30 queries quando uma única query com `GROUP BY DATE` resolveria.

### 2.2 Ausência Total de Transações (Risco Crítico de Integridade)

O sistema possui **zero transações** (`db.transaction`) em todo o código, apesar de ter **20+ funções que executam múltiplas operações de escrita**. As mais críticas são:

| Função | Escritas | Risco |
|--------|----------|-------|
| `criarNovoContrato` | 8 operações | Se falhar na 5a operação, contrato fica parcialmente criado |
| `redistribuirLeadsDoCorretor` | 5 operações | Leads podem ficar sem corretor se falhar no meio |
| `registrarTentativaFollowUp` | 5 operações | Follow-up pode ficar em estado inconsistente |
| `deleteLead` | 3 operações (delete history, distribution, lead) | Histórico pode ser deletado mas lead permanecer |
| `atualizarContrato` | 3 operações | Comissão pode ser criada sem contrato atualizado |
| `deleteProposta` | 2 operações (visitantes + proposta) | Visitantes deletados mas proposta permanece |

Sem transações, qualquer falha parcial (timeout, erro de rede, constraint violation) deixa o banco em estado inconsistente. Isso é especialmente perigoso em `criarNovoContrato` e `redistribuirLeadsDoCorretor`, que são operações críticas do negócio.

### 2.3 Código Morto e Arquivos Obsoletos

Foram identificados **21 funções completamente mortas** (sem nenhuma referência no código):

`countLeadsWebhookRecebidosHoje`, `deleteProjectSuggestion`, `createProperty`, `getPropertiesByProject`, `getLeadsByCorretor`, `getLeadsNaoDistribuidos`, `getLeadsPendentesFollowup`, `createDistributionLog`, `getDistributionHistory`, `updateConversionStats`, `atualizarPosicaoFila`, `updateTarefa`, `createFollowUp`, `getFollowUpByLead`, `registrarClienteCadastrado`, `getTransicoesCorretor`, `getVisitaById`, `createFaqChatbot`, `getLeadsComInteracaoHoje`, `getCorretoresByEquipe`, `createDocumentacao`, `createAnaliseCredito`.

Além disso, existem **3 arquivos de backup/obsoletos** que não deveriam estar no repositório: `LockedTabOverlay.OLD.tsx`, `useFollowUpProgress.OLD.ts`, `Relatorios.tsx.backup`. O arquivo `server/followupJob.ts` está **completamente vazio** (0 linhas).

### 2.4 Tratamento de Erros Deficiente

Das 288 funções em `db.ts`, apenas **25 possuem try-catch** (8,7%). Mais grave: existem **16 catch blocks vazios** (`catch {}` ou `catch(e) {}`) no `routers.ts`, que engolem erros silenciosamente sem logging nem tratamento. Isso significa que falhas em operações críticas podem passar despercebidas.

### 2.5 Console.log em Produção

Existem **42 `console.log`** em `db.ts` e **25 em `routers.ts`** — total de **67 console.log** em código de produção. Isso polui os logs do servidor, dificulta debugging real e pode expor dados sensíveis.

---

## BLOCO 3 — Falhas Funcionais e Incoerências com o Negócio

### 3.1 Módulos que Fazem Sentido Manter

O sistema cobre bem as necessidades operacionais. Os módulos de **gestão de leads**, **funil de vendas**, **agendamentos**, **visitas**, **análise de crédito**, **contratos**, **comissões**, **distribuição automática**, **follow-ups**, **presença**, **conquistas/gamificação** e **dashboards** são todos relevantes para a operação e devem ser mantidos.

### 3.2 Módulos Redundantes ou Mal Encaixados

**Relatórios vs. Central de Análises vs. Dashboard vs. Analytics.** Existem 4 routers diferentes que servem propósitos sobrepostos: `relatorios`, `centralAnalises`, `dashboard` e `analytics`. Isso gera confusão sobre onde buscar dados e duplica lógica de agregação. A recomendação é consolidar em um único módulo de análises.

**Múltiplos sistemas de sincronização.** Existem 5 módulos de sincronização diferentes: `sheetsSync`, `sheetsSyncReal`, `sheetsImport`, `sheetsBackup`, `biSync`. Cada um tem seu próprio job e lógica. Isso indica que a integração com Google Sheets cresceu de forma descontrolada e precisa ser consolidada.

**Chatbot com FAQ manual.** O módulo de chatbot (`conversasChatbot`, `faqChatbot`) parece subutilizado. A tabela `faqChatbot` existe no schema mas a função `createFaqChatbot` é código morto. Se o chatbot não está sendo usado ativamente, o módulo deveria ser simplificado ou removido.

**Tabela `properties` sem uso.** A tabela `properties` existe no schema com funções `createProperty` e `getPropertiesByProject`, mas ambas são código morto. Isso indica uma feature planejada mas nunca implementada.

**Tabela `conversionStats` sem uso.** A função `updateConversionStats` é código morto, indicando que as estatísticas de conversão não estão sendo populadas.

### 3.3 Fluxos Incompletos

**TODOs no código de produção.** Existem 3 TODOs ativos que indicam funcionalidades incompletas:
- `relatorios.ts:103` — "TODO: Implementar quando houver campo de valor" (ticket médio)
- `relatorios.ts:212` — "TODO: Implementar cálculo real baseado em leadHistory"
- `sheetsSync.ts:74` — "TODO: Implementar atualização real na planilha usando Google Sheets API"

**Rota duplicada.** A rota `/configuracoes` está definida duas vezes no `App.tsx`, o que pode causar comportamento imprevisível no roteamento.

**Páginas sem DashboardLayout.** 17 páginas internas não utilizam o `DashboardLayout`, quebrando a consistência de navegação. Algumas são justificáveis (páginas públicas como `AgendamentoPublico`, `ChatbotPublico`, `PropostaPublica`), mas outras como `ConfiguracaoWebhooks`, `GoogleSheetsSync`, `ImportarCSV`, `LogTransferencias`, `MinhaEquipe`, `TemplatesComissao` e `RelatorioEscolhasDiarias` deveriam usar o layout padrão.

### 3.4 N+1 no Frontend

Na página `Agendamentos.tsx`, cada card de agendamento executa 3 queries individuais (`getById` para lead, corretor e projeto). Com 50 agendamentos na tela, isso gera 150 requests ao backend. O correto seria o endpoint de listagem já retornar os dados relacionados via JOIN.

---

## BLOCO 4 — O que Deve Ser Padronizado

### 4.1 Nomenclatura de Tabelas

O schema utiliza **nomenclatura mista** para tabelas: 21 tabelas usam nomes simples em inglês/português sem underscore (`users`, `leads`, `agendamentos`, `conquistas`), enquanto 38 tabelas usam snake_case (`lead_status_transitions`, `historico_presenca`, `carteira_ativa`). A recomendação é adotar **snake_case** como padrão universal, mas **sem renomear as tabelas existentes** (risco ao banco). Novas tabelas devem seguir snake_case.

### 4.2 Nomenclatura de Routers

Os 66 routers misturam português e inglês sem critério:

| Padrão | Exemplos |
|--------|----------|
| Português | `relatorios`, `corretores`, `conquistas`, `presenca`, `equipes`, `metas`, `tarefas`, `visitas` |
| Inglês | `leads`, `projects`, `dashboard`, `distribution`, `performance`, `ranking`, `push`, `backup` |
| Mistura | `dashboardCorretor`, `metasDiarias`, `historicoDistribuicao`, `logTransferencias` |

A recomendação é manter o padrão atual (não renomear para não quebrar o frontend), mas definir que **novos routers devem usar camelCase em português** para consistência com o domínio do negócio.

### 4.3 Nomenclatura de Status

Os status de leads usam uma mistura de formatos:

| Campo | Valores | Problema |
|-------|---------|----------|
| `situacao` (leads) | `novo`, `em_atendimento`, `aguardando`, `agendado`, `visita_realizada`, `analise_credito`, `contrato_fechado`, `perdido` | snake_case — OK |
| `status` (agendamentos) | `pendente`, `confirmado`, `realizado`, `cancelado`, `reagendado` | Sem prefixo — OK |
| `status` (contratos) | `em_andamento`, `concluido`, `cancelado`, `distratado` | snake_case — OK |
| `role` (users) | `admin`, `user`, `corretor`, `gestor`, `superintendente` | Mistura EN/PT |

O campo `role` mistura inglês (`admin`, `user`) com português (`corretor`, `gestor`, `superintendente`). Idealmente seria tudo em português, mas **alterar enums existentes é arriscado** e não deve ser feito sem migração cuidadosa.

### 4.4 Estrutura de Respostas

As procedures tRPC não seguem um padrão consistente de resposta. Algumas retornam o objeto direto, outras retornam `{ success: true, data: ... }`, outras retornam `{ message: "..." }`. A recomendação é padronizar: queries retornam dados diretos, mutations retornam `{ success: boolean, data?: T, message?: string }`.

### 4.5 Mensagens de Erro

As mensagens de erro misturam português e inglês, e muitas são genéricas ("Erro ao processar", "Operação falhou"). Devem ser padronizadas em português com contexto específico ("Não foi possível criar o agendamento: corretor não encontrado").


---

## BLOCO 5 — O que Deve Ser Removido, Simplificado ou Refeito

### 5.1 Remoção Segura (Impacto Zero no Banco)

Estas ações envolvem apenas remoção de código-fonte, sem qualquer alteração no banco de dados:

**21 funções mortas em `db.ts`.** As funções listadas no Bloco 2.3 podem ser removidas com segurança. Nenhuma é referenciada em nenhum arquivo do projeto. A remoção reduz o tamanho do `db.ts` em aproximadamente 400-500 linhas.

**3 arquivos obsoletos.** `LockedTabOverlay.OLD.tsx`, `useFollowUpProgress.OLD.ts` e `Relatorios.tsx.backup` devem ser removidos do repositório. São artefatos de desenvolvimento que poluem a base de código.

**Arquivo vazio `followupJob.ts`.** Possui 0 linhas e não é importado em lugar nenhum. Deve ser removido.

**2 páginas não roteadas.** `ComponentShowcase.tsx` (1.437 linhas — página de demonstração de componentes) e `ProjetosMapView.tsx` não estão registradas no `App.tsx`. Se não são acessíveis, devem ser removidas ou, no caso do ComponentShowcase, mantidas apenas em ambiente de desenvolvimento.

**Rota duplicada `/configuracoes`.** Remover a segunda definição da rota no `App.tsx`.

### 5.2 Simplificação Recomendada

**Consolidar módulos de sincronização Google Sheets.** Os 5 módulos (`sheetsSync`, `sheetsSyncReal`, `sheetsImport`, `sheetsBackup`, `biSync`) devem ser consolidados em 2: um módulo de **importação** (sheets → sistema) e um de **exportação/backup** (sistema → sheets/BI). Prioridade: **importante**.

**Consolidar módulos de análise.** Os routers `relatorios`, `centralAnalises`, `dashboard`, `analytics` e `dashboardPerformance` possuem sobreposição significativa. Devem ser consolidados em: `dashboard` (visão operacional em tempo real) e `analises` (relatórios gerenciais com filtros de período). Prioridade: **desejável**.

### 5.3 Refatoração Necessária (Sem Risco ao Banco)

**Dividir `server/db.ts` em módulos por domínio.** O arquivo de 11.226 linhas deve ser dividido em módulos temáticos. A estrutura recomendada é:

```
server/db/
  index.ts          → Re-exporta tudo (compatibilidade)
  leads.ts          → Queries de leads (~2000 linhas)
  users.ts          → Queries de usuários/corretores (~800 linhas)
  projects.ts       → Queries de projetos (~600 linhas)
  agendamentos.ts   → Queries de agendamentos/visitas (~500 linhas)
  contratos.ts      → Queries de contratos/comissões (~800 linhas)
  distribution.ts   → Queries de distribuição/roleta (~600 linhas)
  followups.ts      → Queries de follow-ups (~400 linhas)
  performance.ts    → Queries de performance/ranking (~600 linhas)
  analytics.ts      → Queries de relatórios/dashboards (~1500 linhas)
  conquistas.ts     → Queries de gamificação (~500 linhas)
  presenca.ts       → Queries de presença (~400 linhas)
  config.ts         → Queries de configuração (~300 linhas)
  helpers.ts        → Funções utilitárias compartilhadas
```

O `index.ts` deve re-exportar todas as funções para manter compatibilidade com os imports existentes. Essa refatoração é **puramente de código** — não altera o banco de dados.

**Dividir `server/routers.ts` em routers separados.** Apenas 4 routers já foram extraídos (`carteiraAtiva`, `comissoes`, `templates`, `ia`). Os outros 62 devem seguir o mesmo padrão. A estrutura recomendada é:

```
server/routers/
  index.ts          → Monta o appRouter combinando sub-routers
  leads.ts          → Router de leads
  projects.ts       → Router de projetos
  corretores.ts     → Router de corretores
  agendamentos.ts   → Router de agendamentos
  ...               → Um arquivo por domínio
```

Prioridade: **urgente** — é a refatoração de maior impacto na manutenibilidade.

---

## BLOCO 6 — Melhorias de Performance e Otimização

### 6.1 Gargalos Críticos

**Padrões N+1 (45+ ocorrências).** Este é o gargalo de performance mais grave do sistema. Cada padrão N+1 multiplica o número de queries por N (número de itens na coleção). Com 42 corretores, um relatório que deveria fazer 1 query faz 42+. A correção envolve substituir loops com queries individuais por JOINs ou subqueries.

| Função | Queries Atuais | Queries Ideais | Impacto |
|--------|---------------|----------------|---------|
| `getRelatorioProducaoCorretores` | ~42 por chamada | 1-2 | Dashboard de gestão fica lento |
| `verificarConquistasCorretor` | ~250 por corretor | 1-3 | Job de conquistas sobrecarrega o banco |
| `getEvolucaoLeadsPorDia` | ~30 por período | 1 | Relatório de evolução demora |
| `getRelatorioLeadsTimerPorCorretor` | ~42 por chamada | 1-2 | Central de análises lenta |

Prioridade: **urgente** — impacto direto na experiência do usuário.

**Ausência de paginação em queries de listagem.** Das 290 queries com `.from()` no `db.ts`, apenas **102 usam `.limit()`**. Isso significa que ~188 queries retornam **todos os registros** sem limite. Com o crescimento do banco (atualmente ~31.000 leads), queries sem paginação se tornarão progressivamente mais lentas.

As queries mais críticas sem paginação são as de listagem de leads, histórico de distribuição, log de transferências e notificações. Prioridade: **importante**.

### 6.2 Gargalos no Frontend

**Páginas monolíticas.** 27 páginas possuem mais de 500 linhas, com `Leads.tsx` chegando a 2.202 linhas. Páginas grandes causam re-renderizações desnecessárias porque qualquer mudança de estado re-renderiza todo o componente. A solução é extrair sub-componentes e usar `React.memo` para componentes pesados. Atualmente, **zero componentes** usam `React.memo`.

**Queries N+1 no frontend.** Na página `Agendamentos.tsx`, cada card individual faz 3 queries (`getById` para lead, corretor e projeto). Com 50 agendamentos, são 150 requests. O endpoint de listagem deveria retornar dados já enriquecidos.

**Polling agressivo.** A página de Leads faz polling a cada **30 segundos** (`refetchInterval: 30000`). Com múltiplos usuários simultâneos, isso gera carga constante no servidor. A recomendação é aumentar para 60-120 segundos ou implementar WebSocket para atualizações em tempo real.

### 6.3 Jobs Concorrentes

Os 19 jobs rodando via `setInterval` no processo principal competem por recursos com as requisições HTTP. Jobs pesados como `verificarConquistasCorretor` (que pode gerar 250+ queries por execução) e `sincronizarBI` podem causar latência nas respostas da API durante sua execução.

A recomendação de longo prazo é migrar jobs para um worker separado ou usar uma fila de tarefas (como BullMQ). No curto prazo, escalonar os intervalos para evitar execução simultânea e adicionar logging de duração.

### 6.4 Índices do Banco

O schema define **143 índices**, o que é um número saudável para 60 tabelas. Entretanto, a análise das queries mais frequentes sugere que alguns índices compostos estão faltando:

- `leads`: índice composto em `(corretorId, situacao, createdAt)` para queries de funil por corretor
- `lead_status_transitions`: índice composto em `(leadId, toStatus, createdAt)` para relatórios de conversão
- `atividades_diarias`: índice composto em `(corretorId, data)` para dashboard de performance diária

Prioridade: **importante** — melhora performance sem risco ao banco (adicionar índice é operação segura e reversível).

---

## BLOCO 7 — Segurança, Permissões e Integridade dos Dados

### 7.1 Autenticação e Autorização

**Autenticação:** Bem implementada via Manus OAuth com session cookies. O middleware de contexto (`server/_core/context.ts`) injeta `ctx.user` automaticamente em todas as procedures.

**Autorização:** O sistema implementa 4 níveis de acesso via procedures tipadas:

| Procedure | Uso | Contagem |
|-----------|-----|----------|
| `publicProcedure` | Rotas sem autenticação | 17 |
| `protectedProcedure` | Qualquer usuário autenticado | 46 |
| `gestorProcedure` | Gestores, superintendentes e admins | 175 |
| `adminProcedure` | Apenas admins e superintendentes | 34 |

A distribuição é adequada: a maioria das operações de gestão requer `gestorProcedure` (175), e operações administrativas requerem `adminProcedure` (34). As 17 procedures públicas são justificáveis (login, webhooks, páginas públicas de agendamento/proposta).

### 7.2 Vulnerabilidades Identificadas

**Catch blocks vazios (16 ocorrências no `routers.ts`).** Erros são silenciosamente engolidos, o que pode mascarar falhas de autorização ou integridade. Exemplo: se uma verificação de permissão falhar dentro de um catch vazio, o usuário pode receber uma resposta vazia em vez de um erro 403.

**Webhooks sem validação de payload.** Os webhooks do Facebook (`/api/webhook/facebook/:token`) validam o token mas não validam a estrutura do payload recebido. Um payload malformado pode causar erros não tratados. A recomendação é adicionar validação Zod no corpo da requisição.

**Rate limiting apenas em webhooks.** O rate limiting está configurado apenas para `/api/webhook` (10 req/min). As rotas tRPC (`/api/trpc`) não possuem rate limiting, o que significa que um usuário autenticado pode fazer requests ilimitados. A recomendação é adicionar rate limiting por usuário nas rotas tRPC.

**Ausência de audit log.** O sistema não registra quem fez o quê e quando para operações sensíveis (deletar lead, transferir lead, alterar contrato, mudar permissões). Isso dificulta a investigação de problemas e não atende requisitos de compliance.

### 7.3 Segregação de Dados por Equipe

A função `getCorretoresIdsParaFiltro` em `server/equipes.ts` implementa corretamente a hierarquia de acesso: gestores veem apenas sua equipe, superintendentes veem todas as equipes que gerenciam, admins veem tudo. Esse filtro é aplicado consistentemente nas queries de leads e relatórios. **Este é um ponto forte do sistema.**

### 7.4 Proteção contra Deleção Indevida

O sistema **não implementa soft delete**. Todas as operações de delete são permanentes (`db.delete(...).where(...)`). A função `deleteLead` remove o lead e todo seu histórico (3 deletes sem transação). Se um gestor deletar um lead por engano, não há como recuperar.

A recomendação é implementar soft delete para entidades críticas (leads, contratos, propostas) adicionando um campo `deletedAt` e filtrando nas queries. Isso requer migração de schema, mas é uma operação aditiva (adicionar coluna) que não afeta dados existentes.

### 7.5 Validação de Inputs

O uso de Zod para validação de inputs é extensivo (1.042 usos de `z.` no `routers.ts`, 265 `.input(z.)`). Isso é positivo e significa que a maioria das procedures valida seus inputs antes de processá-los. Entretanto, a validação no nível de `db.ts` é praticamente inexistente — as funções confiam que os dados já foram validados pelo router.

---

## BLOCO 8 — Revisão da Modelagem e Camada de Banco de Dados

### 8.1 Visão Geral do Schema

O banco possui **60 tabelas** com **55 enums**, **143 índices** e **28 referências com foreign key**. A modelagem cobre adequadamente os domínios do negócio: leads, projetos, corretores, agendamentos, visitas, contratos, comissões, follow-ups, presença, gamificação e configurações.

### 8.2 Integridade Referencial

**Problema grave: maioria das tabelas sem foreign keys.** Das 60 tabelas, **54 não possuem referências de foreign key apontando para elas**. Isso significa que a integridade referencial depende exclusivamente do código da aplicação. Se um corretor for deletado, seus leads, agendamentos, follow-ups, conquistas, presença e comissões ficam órfãos no banco.

As tabelas que possuem `onDelete: "cascade"` são: `desbloqueioCorretor`, `leadEstoque`, `historicoAtribuicoes`, `interacoes`, `documentacoes`, `analises_credito`. Isso é parcialmente correto, mas tabelas críticas como `leads`, `agendamentos`, `contratos` e `comissoes` não possuem cascade definido.

**Recomendação:** Não adicionar cascade em tabelas existentes sem análise profunda do impacto. Para novas tabelas, sempre definir `onDelete` explicitamente. Para tabelas existentes, a proteção deve ser feita no nível da aplicação (verificar dependências antes de deletar).

### 8.3 Campos Ausentes Identificados

| Tabela | Campo Ausente | Justificativa |
|--------|---------------|---------------|
| `leads` | `deletedAt` | Soft delete para recuperação |
| `contratos` | `deletedAt` | Soft delete para recuperação |
| `leads` | `ultimaInteracao` | Evitar query extra para "último contato" |
| `conversionStats` | `createdAt` | Rastreabilidade temporal |
| `leadEstoque` | `createdAt` | Rastreabilidade temporal |
| `historicoAtribuicoes` | `createdAt` | Rastreabilidade temporal |
| `jobControl` | `createdAt` | Rastreabilidade temporal |

### 8.4 Tabelas Potencialmente Desnecessárias

| Tabela | Motivo | Recomendação |
|--------|--------|--------------|
| `properties` | Funções mortas, nunca populada | Manter no schema, não deletar (risco zero de manter) |
| `conversionStats` | Função de update é código morto | Verificar se há dados; se vazia, pode ser ignorada |
| `faqChatbot` | Função de criação é código morto | Verificar uso real do chatbot |

**IMPORTANTE:** Nunca deletar tabelas do banco, mesmo que pareçam desnecessárias. O custo de manter uma tabela vazia é zero, mas o risco de deletar uma tabela com dados é catastrófico.

### 8.5 Migrações

O sistema possui **16 migrações** (`0000` a `0015`), o que é um número saudável para o tamanho do projeto. As migrações são gerenciadas pelo Drizzle Kit (`pnpm db:push`), que é uma ferramenta confiável. O fluxo de migração está correto: editar schema → gerar migração → aplicar.

### 8.6 Nomenclatura Mista

Conforme detalhado no Bloco 4.1, a nomenclatura de tabelas é mista (21 sem underscore, 38 com underscore). As colunas seguem padrão camelCase no código TypeScript, que o Drizzle mapeia automaticamente. Isso é aceitável e não requer alteração.


---

## BLOCO 9 — Riscos Críticos e Prioridades Máximas

### 9.1 Classificação de Riscos

| # | Risco | Severidade | Probabilidade | Impacto no Negócio |
|---|-------|------------|---------------|---------------------|
| 1 | Operações multi-tabela sem transação | **Crítico** | Alta | Dados inconsistentes em contratos, leads e comissões |
| 2 | Padrões N+1 (45+ ocorrências) | **Crítico** | Certa | Degradação progressiva de performance com crescimento do banco |
| 3 | Delete permanente sem soft delete | **Alto** | Média | Perda irreversível de dados operacionais por erro humano |
| 4 | Catch blocks vazios (16 ocorrências) | **Alto** | Alta | Falhas silenciosas em operações críticas |
| 5 | Jobs sem isolamento (19 no processo principal) | **Médio** | Média | Latência em picos de carga dos jobs |
| 6 | Ausência de audit log | **Médio** | Baixa | Impossibilidade de investigar problemas |
| 7 | Monolito db.ts/routers.ts | **Médio** | Certa | Dificuldade crescente de manutenção |
| 8 | Polling agressivo no frontend (30s) | **Baixo** | Certa | Carga desnecessária no servidor |

### 9.2 Risco #1 em Detalhe: Ausência de Transações

A função `criarNovoContrato` executa **8 operações de escrita** sequenciais: cria contrato, atualiza lead, registra transição de status, cria comissão do corretor, cria comissão do gestor, registra atividade, notifica gestor e atualiza métricas. Se qualquer operação intermediária falhar (timeout, constraint violation, erro de rede), o sistema fica em estado inconsistente. Por exemplo: contrato criado mas comissão não registrada, ou lead atualizado mas transição não registrada.

**Cenário real de risco:** Durante pico de uso (segunda-feira de manhã, quando todos os corretores registram contratos do fim de semana), um timeout no banco pode causar contratos parcialmente criados. O gestor vê o contrato no sistema mas a comissão não aparece, gerando conflito operacional.

**Solução:** Envolver todas as operações em `db.transaction()`. O Drizzle ORM suporta transações nativamente:

```typescript
await db.transaction(async (tx) => {
  const contrato = await tx.insert(contratos).values({...});
  await tx.update(leads).set({...}).where(...);
  await tx.insert(leadStatusTransitions).values({...});
  await tx.insert(comissoes).values({...});
  // Se qualquer operação falhar, TUDO é revertido automaticamente
});
```

### 9.3 Risco #2 em Detalhe: Padrões N+1

Com 31.000+ leads e 42 corretores ativos, os relatórios gerenciais já devem apresentar lentidão perceptível. À medida que o banco cresce (projeção: 50.000+ leads em 6 meses), a degradação será exponencial. Um relatório que hoje leva 3 segundos passará a levar 8-10 segundos, tornando a Central de Análises inutilizável para tomada de decisão em tempo real.

---

## BLOCO 10 — Plano de Melhorias Recomendado

### 10.1 Fase 1 — Correções Urgentes (1-2 semanas)

Estas correções devem ser implementadas imediatamente por representarem risco à integridade dos dados ou à operação.

**1. Adicionar transações em operações multi-tabela.**
Envolver as 20+ funções identificadas no Bloco 2.2 em `db.transaction()`. Começar pelas mais críticas: `criarNovoContrato`, `redistribuirLeadsDoCorretor`, `deleteLead`, `registrarTentativaFollowUp`. Risco ao banco: **nenhum** — transações são uma camada de proteção, não alteram estrutura. Estratégia: implementar uma função por vez, testar, deploy.

**2. Substituir catch blocks vazios por logging.**
Substituir os 16 `catch {}` por `catch (error) { console.error('[NomeDoRouter] Erro:', error); throw error; }`. Risco: **nenhum** — apenas adiciona visibilidade.

**3. Corrigir os 5 padrões N+1 mais críticos.**
Reescrever `getRelatorioProducaoCorretores`, `getEvolucaoLeadsPorDia`, `getRelatorioLeadsTimerPorCorretor`, `getEquipesComparativo` e `getFunilConversaoGeral` para usar JOINs em vez de loops. Risco ao banco: **nenhum** — são apenas queries SELECT.

### 10.2 Fase 2 — Melhorias Importantes (2-4 semanas)

**4. Dividir `server/db.ts` em módulos.**
Criar diretório `server/db/` com arquivos por domínio. Manter `server/db.ts` como re-export para compatibilidade. Risco: **nenhum** — refatoração puramente de código.

**5. Dividir `server/routers.ts` em routers separados.**
Extrair cada router para seu próprio arquivo em `server/routers/`. Manter `server/routers.ts` como agregador. Risco: **nenhum** — refatoração puramente de código.

**6. Implementar soft delete para leads e contratos.**
Adicionar coluna `deletedAt timestamp NULL` nas tabelas `leads` e `contratos`. Atualizar queries de listagem para filtrar `WHERE deletedAt IS NULL`. Criar endpoint de "restaurar" para gestores. Risco ao banco: **mínimo** — adicionar coluna nullable é operação segura e reversível.

Estratégia de migração segura:
- Fazer backup completo antes da migração
- Adicionar coluna com `ALTER TABLE leads ADD COLUMN deletedAt TIMESTAMP NULL` (operação não-destrutiva)
- Atualizar queries gradualmente (uma por vez)
- Testar em staging antes de produção
- Manter plano de rollback: `ALTER TABLE leads DROP COLUMN deletedAt`

**7. Adicionar paginação nas queries de listagem.**
Implementar paginação cursor-based nas 10 queries mais pesadas (leads, histórico, notificações, log de transferências). Risco: **nenhum** — apenas limita resultados.

**8. Remover código morto.**
Deletar as 21 funções mortas, 3 arquivos obsoletos e o arquivo vazio. Risco: **nenhum** — código não referenciado.

### 10.3 Fase 3 — Melhorias Desejáveis (1-2 meses)

**9. Implementar audit log.**
Criar tabela `audit_log` com campos: `id`, `userId`, `action`, `entityType`, `entityId`, `oldValue` (JSON), `newValue` (JSON), `createdAt`. Registrar operações sensíveis (delete, update de status, transferência de lead, alteração de contrato). Risco ao banco: **nenhum** — tabela nova.

**10. Consolidar módulos de sincronização.**
Unificar os 5 módulos de Google Sheets em 2 (importação e exportação). Risco: **baixo** — refatoração de código com testes.

**11. Corrigir N+1 restantes (40 ocorrências).**
Reescrever progressivamente as funções restantes com padrões N+1. Priorizar por frequência de uso.

**12. Adicionar índices compostos.**
Criar os 3 índices compostos identificados no Bloco 6.4. Risco ao banco: **nenhum** — adicionar índice é operação segura, reversível e não bloqueia leitura.

**13. Migrar jobs para worker separado.**
Extrair os 19 jobs para um processo worker dedicado, separado do servidor web. Isso isola a carga dos jobs e permite escalar independentemente.

**14. Adicionar rate limiting nas rotas tRPC.**
Implementar rate limiting por usuário (ex: 100 req/min) nas rotas tRPC para prevenir abuso.

**15. Padronizar páginas sem DashboardLayout.**
Adicionar DashboardLayout nas 10+ páginas internas que não o utilizam.

---

## BLOCO 11 — Cuidados Obrigatórios para Qualquer Implementação Futura

### 11.1 Regras Invioláveis

Toda implementação futura no sistema deve seguir estas regras sem exceção:

**Regra 1: Nunca executar operações destrutivas no banco sem backup verificado.** Antes de qualquer `ALTER TABLE`, `DROP`, `DELETE` em massa ou migração, deve existir um backup completo e verificado (testado com restore). O sistema já possui `backupJob.ts` — garantir que está funcionando e que os backups são verificáveis.

**Regra 2: Toda migração de schema deve ser aditiva primeiro.** Adicionar colunas/tabelas novas (operação segura) → migrar dados → verificar integridade → só então remover colunas/tabelas antigas (se necessário). Nunca fazer rename ou drop direto.

**Regra 3: Toda operação multi-tabela deve usar transação.** Qualquer nova função que execute 2+ operações de escrita deve usar `db.transaction()`. Sem exceção.

**Regra 4: Toda query de listagem deve ter paginação.** Novas queries que retornam listas devem incluir `limit` e `offset` ou cursor-based pagination.

**Regra 5: Nunca deletar dados permanentemente em entidades de negócio.** Leads, contratos, propostas, comissões e agendamentos devem usar soft delete (`deletedAt`). Apenas dados técnicos (logs, cache, sessões) podem usar hard delete.

**Regra 6: Toda procedure deve ter input validation com Zod.** Mutations sem validação de input são vetores de ataque e fonte de bugs.

**Regra 7: Todo novo router deve ser criado em arquivo separado.** Nunca adicionar mais código ao `routers.ts` monolítico. Criar arquivo em `server/routers/novoRouter.ts` e importar no index.

### 11.2 Checklist para Novas Features

Antes de considerar uma feature como "pronta", verificar:

1. Inputs validados com Zod
2. Procedure usa nível de acesso correto (public/protected/gestor/admin)
3. Operações multi-tabela envolvidas em transação
4. Queries de listagem possuem paginação
5. Estados de loading, erro e vazio tratados no frontend
6. Teste unitário escrito e passando
7. Console.log de debug removidos
8. Código morto limpo

---

## BLOCO 12 — Estratégia Segura para Evoluir sem Risco ao Banco de Dados

### 12.1 Princípio Fundamental

> **O banco de dados é o ativo mais valioso do sistema.** Código pode ser reescrito em dias; dados operacionais de meses de trabalho são irrecuperáveis se perdidos.

### 12.2 Protocolo de Alteração de Schema

Toda alteração no schema (`drizzle/schema.ts`) deve seguir este protocolo:

**Passo 1 — Avaliação de Impacto.**
Antes de editar o schema, documentar: qual tabela será alterada, qual operação (ADD COLUMN, ALTER COLUMN, DROP COLUMN, CREATE TABLE, DROP TABLE), quantos registros existem na tabela, quais queries/funções serão afetadas.

**Passo 2 — Backup.**
Executar backup completo do banco antes da migração. Verificar que o backup é restaurável (testar em ambiente separado se possível).

**Passo 3 — Migração Aditiva.**
Executar apenas operações aditivas (ADD COLUMN, CREATE TABLE, CREATE INDEX). Nunca executar DROP ou RENAME diretamente.

**Passo 4 — Verificação.**
Após a migração, verificar: contagem de registros nas tabelas afetadas (deve ser igual ao antes), queries existentes continuam funcionando, novos campos possuem valores default corretos.

**Passo 5 — Rollback Plan.**
Documentar o comando de rollback para cada alteração. Exemplo: se adicionou coluna, o rollback é `ALTER TABLE x DROP COLUMN y`.

### 12.3 Operações Proibidas

As seguintes operações **nunca** devem ser executadas sem aprovação explícita e plano de migração completo:

- `DROP TABLE` em qualquer tabela com dados
- `TRUNCATE TABLE` em qualquer tabela
- `ALTER TABLE ... DROP COLUMN` em colunas com dados
- `ALTER TABLE ... MODIFY COLUMN` que altere tipo de dado de forma incompatível
- `DELETE FROM ... WHERE 1=1` (delete sem filtro)
- `UPDATE ... SET ... WHERE 1=1` (update sem filtro)
- Qualquer operação que altere ou remova dados existentes em massa

### 12.4 Estratégia de Backup

O sistema já possui `backupJob.ts` que executa backups periódicos. A recomendação é:

1. Verificar que o backup está funcionando (checar logs)
2. Testar restore do backup periodicamente (pelo menos 1x por mês)
3. Manter pelo menos 7 dias de backups
4. Antes de qualquer migração, fazer backup manual adicional
5. Documentar o procedimento de restore

### 12.5 Estratégia de Evolução Gradual

Para evoluir o sistema com segurança, seguir a abordagem **Strangler Fig Pattern**:

1. **Criar novo código ao lado do antigo** (não substituir)
2. **Redirecionar gradualmente** o tráfego para o novo código
3. **Verificar que o novo código funciona** em produção
4. **Só então remover** o código antigo

Exemplo prático para a refatoração do `db.ts`:
- Criar `server/db/leads.ts` com as funções de leads
- Manter as funções originais em `server/db.ts`
- Atualizar imports gradualmente (um router por vez)
- Quando todos os imports apontarem para o novo módulo, remover do `db.ts`

---

## Resumo Final

O sistema **Seu Metro Quadrado CRM** é funcional, cobre bem as necessidades do negócio e possui uma base tecnológica sólida (tRPC, Drizzle, React). Entretanto, o crescimento acelerado gerou dívida técnica significativa que precisa ser tratada antes que comprometa a operação.

As **3 ações mais urgentes** são:

1. **Adicionar transações** nas operações multi-tabela (protege integridade dos dados)
2. **Corrigir os 5 padrões N+1 mais críticos** (melhora performance imediata)
3. **Substituir catch blocks vazios** por logging adequado (visibilidade de erros)

Estas 3 ações podem ser implementadas em **1-2 semanas**, não alteram o banco de dados e reduzem significativamente o risco operacional.

A refatoração estrutural (dividir monolitos, consolidar módulos, implementar soft delete) deve ser feita na sequência, de forma gradual e com testes a cada passo.

**A diretriz de preservação total do banco de dados deve permanecer como prioridade absoluta em toda evolução futura do sistema.**

---

*Relatório gerado por Manus AI em 11 de abril de 2026.*

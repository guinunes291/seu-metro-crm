# Central de Análises — Redesign Completo

## BLOCO 1 — Diagnóstico Crítico da Estrutura Atual

A página atual de Relatórios (`Relatorios.tsx`, 665 linhas) apresenta uma estrutura de abas planas com 5 tabs: Produção por Corretor, Funil, Facebook Timer, Evolução e Origem. Embora funcional, a análise revela problemas estruturais significativos:

**Problemas identificados:**

1. **Fragmentação sem hierarquia**: As 5 abas estão no mesmo nível, sem distinção entre o que é leitura rápida e o que é aprofundamento. O gestor precisa clicar em cada aba para montar o quadro completo.

2. **Ausência de visão por equipe/gestor**: Não existe nenhum recorte por equipe ou gestor. Toda a operação aparece como uma massa homogênea, impossibilitando comparações entre times.

3. **Metas completamente ausentes**: Apesar de existirem tabelas `metas`, `metasGlobais` e procedures `metas.getProgressoTodos`, a página de Relatórios não exibe nenhuma informação de meta vs. realizado. O gestor não sabe se está no caminho certo.

4. **Sem alertas ou semáforos**: Não há indicação visual de risco. Corretores zerados, equipes abaixo da meta, funil travado — tudo precisa ser descoberto manualmente lendo números.

5. **KPIs superficiais**: Os 6 KPIs do topo (Leads, Agendamentos, Visitas, Análises, Contratos, VGV) são apenas contadores absolutos. Faltam: comparativo com período anterior, % de atingimento de meta, tendência, projeção.

6. **Funil sem gargalos**: O funil visual mostra barras, mas não destaca onde está a maior perda, nem compara por corretor/equipe.

7. **Evolução limitada**: A aba de Evolução mostra apenas VGV ao longo do tempo, sem cruzar com metas, sem mostrar leads/agendamentos/visitas em paralelo.

8. **Origem sem profundidade**: A aba de Origem mostra volume e fechados, mas não mostra taxa de conversão por origem, nem custo por lead, nem qual origem gera mais VGV.

9. **Relatórios existentes dispersos**: Existem procedures ricas no backend (`analytics.rankingCorretores`, `analytics.produtividadePorCorretor`, `analytics.tempoMedioPorEtapa`, `analytics.cargaTrabalho`, `analytics.previsaoVendas`, `dashboardPerformance.getData`) que NÃO são usadas na página de Relatórios.

10. **Menu deslocado**: "Relatórios" está dentro do grupo "Sistema" no menu lateral, junto com Google Sheets, Sincronização BI e Limpeza de Duplicatas. Deveria ser um item de primeiro nível ou estar em "Performance".

---

## BLOCO 2 — Decisão Estratégica: Recriar

**Decisão: RECRIAR a página inteira.**

A estrutura atual não suporta a profundidade necessária. As 5 abas planas precisam ser substituídas por uma arquitetura de navegação em camadas com:
- Camada 1: Visão executiva (KPIs + alertas + semáforos) — acima da dobra
- Camada 2: Abas estratégicas com drill-down
- Camada 3: Detalhamento por corretor/equipe ao clicar

O que reaproveitar:
- TabelaProducao (componente de tabela por corretor) — refatorar para incluir equipe/gestor
- FacebookTimerRelatorio — manter como sub-aba
- Lógica de DateRangeFilter — manter
- Backend procedures existentes (analytics.*, dashboard.*, metas.*)

O que recriar:
- Toda a estrutura de abas
- KPIs com meta vs. realizado e tendência
- Visão por equipe e gestor
- Funil com gargalos
- Alertas automáticos

---

## BLOCO 3 — Arquitetura Ideal da Central de Análises

### Nova estrutura de abas:

| # | Aba | Objetivo | Prioridade |
|---|-----|----------|------------|
| 1 | **Visão Geral** | KPIs executivos + alertas + semáforos + meta vs realizado | Essencial |
| 2 | **Produtividade** | Tabela completa por corretor com funil, taxas, status, equipe | Essencial |
| 3 | **Equipes** | Comparativo entre equipes/gestores, ranking de times | Essencial |
| 4 | **Funil & Gargalos** | Funil visual com taxas entre etapas, perda, comparativo | Essencial |
| 5 | **Metas** | Meta vs realizado por corretor/equipe, projeção, ritmo | Essencial |
| 6 | **Evolução** | Gráficos temporais de leads, agendamentos, visitas, vendas, VGV | Importante |
| 7 | **Origens & Campanhas** | Análise por origem/campanha com conversão e VGV | Importante |
| 8 | **Facebook ADS** | Leads perdidos por timer, taxa de atendimento | Importante |

### Acima da dobra (sempre visível):
- Barra de filtros globais (período, equipe, gestor, empreendimento)
- 4-6 KPIs com meta vs realizado, tendência e semáforo
- Alertas automáticos (corretores zerados, equipes em risco, funil travado)

---

## BLOCO 4 — Relatórios e Indicadores Essenciais

### KPIs da Visão Geral:
1. **Vendas vs Meta** (contratos fechados / meta de contratos) — semáforo verde/amarelo/vermelho
2. **VGV vs Meta** (VGV realizado / meta VGV) — com projeção
3. **Taxa de Conversão Geral** (contratos / leads) — tendência
4. **Leads Recebidos** — volume com comparativo período anterior
5. **Agendamentos** — volume com taxa sobre leads
6. **Visitas Realizadas** — volume com taxa sobre agendamentos

### Alertas automáticos:
- Corretores com 0 agendamentos no período
- Equipes abaixo de 50% da meta
- Funil com perda > 80% em alguma etapa
- Corretores sem leads recebidos

---

## BLOCO 5 — Visão por Corretor, Equipe e Gestor

### Tabela de Produtividade (aba Produtividade):
Colunas: Pos | Corretor | Equipe | Leads | Agend | Tx% | Visitas | Tx% | Análises | Contratos | VGV | Meta | % Atingido | Status

### Visão por Equipe (aba Equipes):
Cards por equipe mostrando: nome, gestor, total leads, contratos, VGV, % meta, ranking
Tabela comparativa entre equipes

---

## BLOCO 6 — Funil, Metas e Gargalos

### Funil com gargalos:
- Barras horizontais com volume por etapa
- Setas entre etapas mostrando taxa de conversão e perda
- Destaque vermelho na etapa com maior perda percentual
- Filtro por equipe/corretor para comparar funis

### Metas:
- Tabela: Corretor | Meta Contratos | Realizado | % | Meta VGV | Realizado | % | Projeção | Ritmo necessário
- Semáforo: verde (>80%), amarelo (50-80%), vermelho (<50%)

---

## BLOCO 7 — Filtros, Acessos e Hierarquia

### Filtros globais (barra superior):
- Período (hoje, semana, mês, customizado)
- Equipe (dropdown, apenas admin/superintendente)
- Gestor (dropdown, apenas admin)
- Empreendimento (dropdown)

### Hierarquia de acesso:
- **Admin (Guilherme)**: Vê tudo, filtra por qualquer equipe/gestor
- **Superintendente (Dayane)**: Vê equipes atribuídas a ela
- **Gestor**: Vê apenas sua equipe
- **Corretor**: Vê apenas seus próprios números (se acessar)

Já implementado via `getCorretoresIdsParaFiltro()`.

---

## BLOCO 8 — UX, Design e Experiência de Uso

- Fundo claro, cards com sombra suave
- Semáforos com cores consistentes: verde (#22c55e), amarelo (#eab308), vermelho (#ef4444)
- Tabelas com linhas alternadas, hover, sticky header
- KPIs em grid responsivo (6 cols desktop, 3 tablet, 2 mobile)
- Abas com ícones para rápida identificação
- Drill-down via expansão de linha (não navegação para outra página)
- Tooltips em valores truncados
- Loading skeletons em vez de spinners

---

## BLOCO 9 — Estrutura Técnica e de Dados

### Dados já disponíveis no schema:
- `leads` — status, corretor, projeto, origem, timestamps
- `leadStatusTransitions` — histórico completo do funil
- `equipes` — nome, gestor, superintendente, meta mensal
- `metas` — meta por corretor/mês/ano (leads, agendamentos, visitas, contratos, VGV)
- `metasGlobais` — meta global da operação
- `users` — role, equipeId, status

### Procedures backend já existentes (para reaproveitar):
- `dashboard.metrics` — KPIs gerais
- `relatorios.producaoPorCorretor` — tabela de produção
- `analytics.funilConversao` — funil geral
- `analytics.evolucaoVendas` — evolução temporal
- `analytics.origemLeadsMaisEfetiva` — análise por origem
- `metas.getProgressoTodos` — progresso de metas
- `dashboardPerformance.getData` — performance completa
- `equipes.list` — lista de equipes

### Novas procedures necessárias:
1. `analises.visaoGeral` — KPIs + meta vs realizado + alertas
2. `analises.comparativoEquipes` — ranking e comparativo entre equipes
3. `analises.funilComGargalos` — funil com destaque de gargalos e perda
4. `analises.metasProgresso` — meta vs realizado por corretor com projeção

---

## BLOCO 10 — O que Remover, Criar, Mover ou Recriar

| Ação | Item | Motivo |
|------|------|--------|
| RECRIAR | Página Relatorios.tsx inteira | Estrutura atual não suporta profundidade |
| MOVER | "Relatórios" do menu Sistema → item próprio "Análises" | Visibilidade e importância |
| CRIAR | Aba Visão Geral com KPIs + alertas | Não existe camada executiva |
| CRIAR | Aba Equipes com comparativo | Não existe visão por equipe |
| CRIAR | Aba Metas com projeção | Metas existem no banco mas não são exibidas |
| MELHORAR | Tabela de Produtividade | Adicionar coluna equipe, meta, % atingido |
| MELHORAR | Funil | Adicionar gargalos, perda entre etapas |
| MANTER | Facebook Timer | Funcional e útil |
| MANTER | Evolução | Melhorar com mais métricas |
| MANTER | Origem | Melhorar com taxas de conversão |

---

## BLOCO 11 — Proposta Final

### Arquitetura final:

**Menu lateral**: Novo grupo "Análises" com ícone BarChart3, posição entre "Performance" e "Gestão"

**Página: Central de Análises**

1. **Barra de filtros** (sticky): Período | Equipe | Empreendimento
2. **Painel executivo** (acima da dobra): 6 KPIs com meta vs realizado + alertas
3. **Abas**:
   - Produtividade (tabela por corretor com equipe e meta)
   - Equipes (comparativo entre times)
   - Funil & Gargalos (funil visual com perda)
   - Metas (meta vs realizado com projeção)
   - Evolução (gráficos temporais)
   - Origens (análise por canal)
   - Facebook ADS (timer e perda)

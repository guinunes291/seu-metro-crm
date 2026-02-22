# Dashboards Looker Studio - Seu Metro Quadrado CRM

Guia completo para criar dashboards visuais e interativos no Looker Studio (Google Data Studio) conectados à planilha de sincronização BI do CRM.

---

## 📊 Visão Geral

O sistema sincroniza automaticamente dados do CRM para o Google Sheets a cada 1 hora, permitindo criar dashboards profissionais no Looker Studio com:

- **Atualização automática** dos dados (sincronização a cada 1 hora)
- **Gráficos interativos** com filtros dinâmicos
- **Métricas calculadas** automaticamente
- **Compartilhamento** com equipe e gestores
- **Acesso mobile** via app Looker Studio

---

## 🔗 Planilha de Dados

**URL da Planilha BI:**  
https://docs.google.com/spreadsheets/d/1or0l4OToJUsGW8FpyGjSOovjc27riV4Wmi0YWQze8X8

**Abas disponíveis:**
1. **Leads** - Todos os leads do sistema com status, corretor, projeto, origem
2. **Contratos** - Contratos fechados com VGV, corretor, cliente, projeto, data
3. **Métricas Diárias** - KPIs agregados por dia (últimos 90 dias)
4. **Performance Corretores** - Métricas individuais de cada corretor

---

## 🚀 Como Criar os Dashboards

### Passo 1: Acessar o Looker Studio

1. Acesse https://lookerstudio.google.com
2. Faça login com sua conta Google
3. Clique em **"Criar"** → **"Relatório"**

### Passo 2: Conectar a Planilha

1. Na tela de seleção de fonte de dados, escolha **"Google Planilhas"**
2. Cole a URL da planilha BI: `https://docs.google.com/spreadsheets/d/1or0l4OToJUsGW8FpyGjSOovjc27riV4Wmi0YWQze8X8`
3. Selecione a aba desejada (Leads, Contratos, Métricas Diárias ou Performance Corretores)
4. Clique em **"Adicionar"**

### Passo 3: Configurar Campos Calculados

Antes de criar gráficos, adicione estes campos calculados essenciais:

#### Taxa de Conversão (%)
```
(CASE
  WHEN Total de Leads > 0 
  THEN (Contratos Fechados / Total de Leads) * 100
  ELSE 0
END)
```

#### VGV Médio
```
(CASE
  WHEN Contratos Fechados > 0
  THEN VGV Total / Contratos Fechados
  ELSE 0
END)
```

#### Ticket Médio Formatado
```
CONCAT("R$ ", FORMAT_NUMBER(VGV Médio, "#,##0.00"))
```

#### Mês/Ano
```
FORMAT_DATETIME("%B %Y", Data)
```

---

## 📈 Dashboard 1: Performance Geral

**Objetivo:** Visão consolidada de todos os KPIs principais do CRM

### Componentes Recomendados

#### 1. Cartões de Métricas (Scorecards)
- **Total de Leads** (número grande, com comparação ao período anterior)
- **Contratos Fechados** (número grande, com % de crescimento)
- **VGV Total** (formatado em R$, com tendência)
- **Taxa de Conversão** (%, com indicador de meta)

#### 2. Gráfico de Linha: Evolução Temporal
- **Eixo X:** Data (agrupado por mês)
- **Eixo Y:** Total de Leads, Contratos Fechados
- **Série secundária:** Taxa de Conversão (%)

#### 3. Gráfico de Funil: Jornada do Lead
- **Etapas:** Novo → Aguardando → Em Atendimento → Agendado → Visita → Análise Crédito → Contrato
- **Métrica:** Contagem de leads em cada status

#### 4. Gráfico de Barras: Origem dos Leads
- **Dimensão:** Origem (Facebook, Google Sheets, Site, etc.)
- **Métrica:** Total de Leads
- **Ordenação:** Decrescente

#### 5. Tabela: Top 10 Projetos
- **Colunas:** Projeto, Total de Leads, Contratos Fechados, VGV Total, Taxa de Conversão
- **Ordenação:** VGV Total (decrescente)

### Filtros Interativos
- **Período:** Seletor de data (últimos 30/60/90 dias, personalizado)
- **Equipe:** Dropdown com todas as equipes
- **Projeto:** Dropdown com todos os projetos
- **Status:** Checkbox múltipla com todos os status

---

## 👥 Dashboard 2: Análise de Equipes

**Objetivo:** Comparar performance entre equipes e identificar oportunidades

### Componentes Recomendados

#### 1. Tabela de Ranking
- **Colunas:** Equipe, Total Leads, Contratos, VGV Total, Taxa Conversão, Ticket Médio
- **Ordenação:** VGV Total (decrescente)
- **Formatação condicional:** Verde para acima da meta, vermelho para abaixo

#### 2. Gráfico de Barras Empilhadas: Distribuição de Status por Equipe
- **Eixo X:** Equipe
- **Eixo Y:** Quantidade de leads
- **Empilhamento:** Status (cores diferentes para cada status)

#### 3. Gráfico de Dispersão: VGV vs Taxa de Conversão
- **Eixo X:** Taxa de Conversão (%)
- **Eixo Y:** VGV Total
- **Bolhas:** Tamanho = Total de Leads
- **Cor:** Equipe

#### 4. Gráfico de Linha: Evolução Mensal por Equipe
- **Eixo X:** Mês
- **Eixo Y:** VGV Total
- **Linhas:** Uma linha por equipe (cores diferentes)

#### 5. Mapa de Calor: Performance Semanal
- **Linhas:** Equipe
- **Colunas:** Semana do ano
- **Métrica:** Contratos Fechados
- **Cor:** Gradiente (vermelho = baixo, verde = alto)

---

## 🏆 Dashboard 3: Performance Individual

**Objetivo:** Métricas detalhadas de cada corretor para gestão e gamificação

### Componentes Recomendados

#### 1. Seletor de Corretor
- **Tipo:** Dropdown
- **Campo:** Nome do Corretor
- **Ação:** Filtra todo o dashboard

#### 2. Cartões de Métricas do Corretor
- **Leads Recebidos** (total)
- **Contratos Fechados** (total + % de conversão)
- **VGV Total** (R$ formatado)
- **Ticket Médio** (R$ formatado)
- **Ranking na Equipe** (posição)

#### 3. Gráfico de Gauge: Taxa de Conversão
- **Métrica:** Taxa de Conversão (%)
- **Faixas:** 0-5% (vermelho), 5-10% (amarelo), 10-20% (verde), 20%+ (verde escuro)
- **Meta:** Linha indicadora em 15%

#### 4. Gráfico de Barras: Distribuição de Leads por Status
- **Eixo X:** Status
- **Eixo Y:** Quantidade de leads
- **Cor:** Status (cores consistentes com o funil)

#### 5. Tabela de Contratos Fechados
- **Colunas:** Cliente, Projeto, VGV, Data da Venda
- **Ordenação:** Data da Venda (decrescente)
- **Limite:** 20 registros mais recentes

#### 6. Gráfico de Linha: Evolução Mensal
- **Eixo X:** Mês
- **Eixo Y:** Leads Recebidos, Contratos Fechados
- **Série secundária:** Taxa de Conversão (%)

---

## 🏢 Dashboard 4: Análise de Projetos

**Objetivo:** Identificar projetos mais rentáveis e oportunidades de melhoria

### Componentes Recomendados

#### 1. Tabela de Projetos
- **Colunas:** Projeto, Construtora, Total Leads, Contratos, VGV Total, Taxa Conversão
- **Ordenação:** VGV Total (decrescente)
- **Formatação condicional:** Destaque para projetos acima da meta

#### 2. Gráfico de Pizza: Distribuição de VGV por Projeto
- **Fatias:** Top 10 projetos + "Outros"
- **Métrica:** VGV Total
- **Rótulos:** Nome do projeto + % do total

#### 3. Gráfico de Barras Horizontais: Leads por Projeto
- **Eixo Y:** Projeto (Top 15)
- **Eixo X:** Total de Leads
- **Cor:** Gradiente baseado na quantidade

#### 4. Gráfico de Dispersão: Leads vs Taxa de Conversão
- **Eixo X:** Total de Leads
- **Eixo Y:** Taxa de Conversão (%)
- **Bolhas:** Tamanho = VGV Total
- **Cor:** Construtora

#### 5. Linha do Tempo: Evolução de Vendas por Projeto
- **Eixo X:** Data (agrupado por mês)
- **Eixo Y:** Contratos Fechados
- **Linhas:** Top 5 projetos (cores diferentes)

---

## 🎨 Dicas de Design

### Paleta de Cores Recomendada
- **Primária:** `#3b82f6` (azul)
- **Sucesso:** `#10b981` (verde)
- **Alerta:** `#f59e0b` (amarelo)
- **Erro:** `#ef4444` (vermelho)
- **Neutro:** `#6b7280` (cinza)

### Formatação de Números
- **Moeda:** `R$ #,##0.00`
- **Percentual:** `#0.0%`
- **Inteiro:** `#,##0`

### Boas Práticas
1. **Use títulos descritivos** em cada gráfico
2. **Adicione legendas** quando necessário
3. **Mantenha consistência** de cores entre dashboards
4. **Evite poluição visual** - máximo 6-8 gráficos por página
5. **Teste em mobile** - certifique-se que é responsivo

---

## 🔄 Atualização Automática

Os dashboards se atualizam automaticamente quando:
- A planilha é sincronizada (a cada 1 hora via job automático)
- Você clica em "Atualizar dados" no Looker Studio
- Você abre o dashboard (cache de 12 horas)

Para forçar atualização imediata:
1. Acesse **Sistema → Sincronização BI** no CRM
2. Clique em **"Sincronizar Agora"**
3. Aguarde 30 segundos
4. Recarregue o dashboard no Looker Studio

---

## 📱 Compartilhamento e Permissões

### Compartilhar Dashboard
1. Clique em **"Compartilhar"** no canto superior direito
2. Escolha o tipo de acesso:
   - **Visualizador:** Pode apenas ver o dashboard
   - **Editor:** Pode editar gráficos e layout
3. Adicione emails ou gere link público

### Permissões Recomendadas
- **Admin:** Editor
- **Superintendente:** Visualizador (todos os dashboards)
- **Gestor:** Visualizador (Dashboard Geral + Equipes)
- **Corretor:** Visualizador (apenas Dashboard Individual filtrado)

---

## 🆘 Solução de Problemas

### Dados não aparecem
- Verifique se a planilha tem dados nas abas
- Confirme que a sincronização está ativa (Sistema → Sincronização BI)
- Atualize a fonte de dados no Looker Studio

### Gráficos quebrados
- Verifique se os nomes das colunas não mudaram
- Recarregue a estrutura da fonte de dados
- Recrie campos calculados se necessário

### Performance lenta
- Limite o período de análise (últimos 90 dias)
- Use agregações ao invés de dados brutos
- Reduza o número de gráficos por página

---

## 📚 Recursos Adicionais

- **Documentação oficial:** https://support.google.com/looker-studio
- **Galeria de templates:** https://lookerstudio.google.com/gallery
- **Comunidade:** https://support.google.com/looker-studio/community

---

## ✅ Checklist de Implementação

- [ ] Acessar Looker Studio e fazer login
- [ ] Conectar planilha BI como fonte de dados
- [ ] Criar campos calculados (Taxa de Conversão, VGV Médio, etc.)
- [ ] Criar Dashboard 1: Performance Geral
- [ ] Criar Dashboard 2: Análise de Equipes
- [ ] Criar Dashboard 3: Performance Individual
- [ ] Criar Dashboard 4: Análise de Projetos
- [ ] Configurar filtros interativos em todos os dashboards
- [ ] Testar visualização em mobile
- [ ] Compartilhar com equipe (permissões adequadas)
- [ ] Adicionar links dos dashboards no CRM (página Sincronização BI)

---

**Data de criação:** 22/02/2026  
**Versão:** 1.0  
**Autor:** Sistema Seu Metro Quadrado CRM

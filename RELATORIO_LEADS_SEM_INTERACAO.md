# Relatório: Levantamento de Leads Sem Interação (2+ Dias)

**Data do Levantamento:** 15 de Janeiro de 2026  
**Horário:** 13:56 (GMT-3 São Paulo)

---

## 📊 Resumo Executivo

O levantamento identificou uma **situação crítica** no sistema de gestão de leads:

- **3.075 leads** (65% do total ativo) estão sem interação há mais de 2 dias
- **3.073 leads** (99,9%) **NUNCA tiveram nenhuma interação registrada**
- Apenas 2 leads tiveram alguma interação mas estão parados há 2+ dias

---

## 🔴 Problemas Críticos Identificados

### 1. Ausência Total de Follow-up
- **99,9% dos leads parados nunca foram contatados**
- Indica falha grave no sistema de distribuição ou falta de uso pelos corretores
- Leads mais antigos: **24 dias** sem nenhum contato

### 2. Leads Sem Corretor Atribuído
- **1.083 leads** (35% do total) estão sem corretor
- Estes leads nunca entrarão no fluxo de atendimento

### 3. Dados Incompletos
- **2.793 leads** (91%) sem origem registrada
- Provavelmente importações antigas de planilhas sem metadados

---

## 📈 Distribuição por Status

| Status | Quantidade | Percentual |
|--------|------------|------------|
| Aguardando Atendimento | 1.532 | 49,8% |
| Em Atendimento | 925 | 30,1% |
| Novo | 550 | 17,9% |
| Contrato Fechado | 58 | 1,9% |
| Agendado | 4 | 0,1% |
| Perdido | 4 | 0,1% |
| Análise de Crédito | 2 | 0,1% |
| **TOTAL** | **3.075** | **100%** |

### Análise por Status

**Aguardando Atendimento (1.532 leads):**
- Status indica que o lead foi distribuído mas o corretor ainda não iniciou contato
- Representa quase metade dos leads parados
- Sugere sobrecarga dos corretores ou falta de follow-up sistemático

**Em Atendimento (925 leads):**
- Status indica que o corretor já iniciou contato
- Porém, sem interação há 2+ dias sugere abandono do lead
- Deveria ter follow-up diário conforme regra 5/5

**Novo (550 leads):**
- Leads recém-chegados que ainda não foram trabalhados
- Parte pode estar sem corretor atribuído

---

## 👥 Distribuição por Corretor (Top 10)

| Corretor | Leads Sem Interação 2+ Dias | Total de Leads | % Sem Interação |
|----------|----------------------------|----------------|-----------------|
| **Sem corretor** | 1.083 | 1.083 | 100% |
| Gabriel Salles | 292 | 306 | 95,4% |
| Igor Nigro | 263 | 414 | 63,5% |
| Leticia Castro | 225 | 312 | 72,1% |
| Breno Brunelli | 214 | 394 | 54,3% |
| Mikael Alves | 207 | 220 | 94,1% |
| Andrew | 203 | 584 | 34,8% |
| kauanthyago34 | 158 | 263 | 60,1% |
| ivenspagule | 124 | 337 | 36,8% |
| Paula Akahoshi | 108 | 126 | 85,7% |

### Análise por Corretor

**Andrew (584 leads totais):**
- Maior carteira de leads do sistema
- 203 leads parados (34,8%) - percentual relativamente baixo
- Indica que está trabalhando a maioria dos leads, mas tem sobrecarga

**Gabriel Salles (306 leads):**
- 95,4% dos leads parados - taxa crítica
- Sugere falta de engajamento ou sobrecarga extrema

**Mikael Alves (220 leads):**
- 94,1% dos leads parados - segunda pior taxa
- Necessita intervenção urgente

**Leads sem corretor (1.083):**
- Representa 35% do problema total
- Necessita redistribuição imediata

---

## 🎯 Distribuição por Origem

| Origem | Quantidade | Percentual |
|--------|------------|------------|
| Sem origem | 2.793 | 90,8% |
| Outro | 140 | 4,6% |
| Facebook | 132 | 4,3% |
| Indicação | 8 | 0,3% |
| Site | 1 | 0,0% |
| WhatsApp | 1 | 0,0% |
| **TOTAL** | **3.075** | **100%** |

### Análise por Origem

- **90,8% sem origem registrada**: Importações antigas de planilhas
- **Facebook (132 leads)**: Campanha ativa mas sem follow-up adequado
- **Indicação (8 leads)**: Leads valiosos sendo desperdiçados

---

## ⏰ Leads Mais Antigos Sem Interação (Top 10)

| ID | Nome | Status | Dias Parados | Corretor |
|----|------|--------|--------------|----------|
| 60684 | Gilvania Rodrigues | Aguardando Atendimento | 24 | Andrew |
| 60683 | Isaac Augusto | Aguardando Atendimento | 24 | Andrew |
| 61090 | ANA | Aguardando Atendimento | 24 | Andrew |
| 61096 | NATALIA | Aguardando Atendimento | 24 | Andrew |
| 60602 | Ariane Trajano | Aguardando Atendimento | 24 | Andrew |
| 60606 | Tatuador - Rulli | Aguardando Atendimento | 24 | Andrew |
| 60610 | Dayane Braga | Aguardando Atendimento | 24 | Andrew |
| 60455 | Antônio Blasioli | Aguardando Atendimento | 24 | Andrew |
| 60614 | Guilherme Maciel | Aguardando Atendimento | 24 | Andrew |
| 60457 | João Batista Gaiardo | Aguardando Atendimento | 24 | Andrew |

---

## 🚨 Recomendações Urgentes

### 1. Redistribuição Imediata (Prioridade CRÍTICA)

**Leads sem corretor (1.083):**
- Executar redistribuição equilibrada entre todos os corretores ativos
- Usar sistema de histórico para evitar retorno ao mesmo corretor

**Leads parados 7+ dias (estimativa: ~1.500):**
- Redistribuir para corretores com menor carga
- Priorizar leads com origem valiosa (Facebook, Indicação, Site)

### 2. Intervenção com Corretores (Prioridade ALTA)

**Gabriel Salles e Mikael Alves (95%+ parados):**
- Reunião individual para entender bloqueios
- Treinamento em sistema de follow-up
- Possível redução temporária de carteira

**Andrew (584 leads):**
- Reduzir carteira para ~300 leads
- Redistribuir 284 leads mais antigos

### 3. Implementação de Automações (Prioridade ALTA)

**Job de Redistribuição Automática:**
- Executar diariamente às 09:00
- Redistribuir leads "Aguardando Atendimento" há 2+ dias
- Redistribuir leads "Em Atendimento" sem interação há 2+ dias

**Alertas para Gestores:**
- Notificação diária de leads parados por corretor
- Dashboard com taxa de follow-up em tempo real

### 4. Limpeza e Organização de Dados (Prioridade MÉDIA)

**Preencher origem dos leads:**
- Analisar padrões de importação histórica
- Atribuir origem "outro" ou "importacao_historica"

**Leads muito antigos (20+ dias):**
- Avaliar viabilidade de contato
- Considerar mover para "Perdido" + Lixeira

---

## 📋 Plano de Ação Sugerido

### Semana 1 (Imediato)

1. **Dia 1:** Redistribuir 1.083 leads sem corretor
2. **Dia 2:** Executar redistribuição de leads parados 7+ dias
3. **Dia 3:** Reunião com Gabriel Salles e Mikael Alves
4. **Dia 4:** Implementar job de redistribuição automática
5. **Dia 5:** Treinamento geral da equipe em follow-up

### Semana 2

1. Monitorar taxa de follow-up diária
2. Ajustar distribuição conforme performance
3. Implementar dashboard de leads em risco
4. Revisar e otimizar processo

### Mês 1

1. Meta: Reduzir leads parados para <20%
2. Meta: Taxa de follow-up diário >80%
3. Meta: Tempo médio de primeiro contato <24h

---

## 📊 Métricas de Sucesso

| Métrica | Atual | Meta Semana 2 | Meta Mês 1 |
|---------|-------|---------------|------------|
| Leads parados 2+ dias | 3.075 (65%) | 1.500 (30%) | 940 (20%) |
| Leads sem corretor | 1.083 (23%) | 0 (0%) | 0 (0%) |
| Taxa de follow-up | ~1% | 50% | 80% |
| Tempo 1º contato | N/A | 48h | 24h |

---

## 🔍 Conclusão

O sistema está com **falha crítica no processo de follow-up**. A situação requer **ação imediata** para evitar perda massiva de oportunidades de venda. A implementação das recomendações acima pode recuperar até **3.000 leads** que atualmente estão sendo desperdiçados.

**Impacto Estimado:**
- Se taxa de conversão média é 2,7% (conforme dashboard)
- 3.000 leads × 2,7% = **81 contratos potenciais** sendo perdidos
- Valor médio por contrato: R$ 300.000
- **Perda potencial: R$ 24.300.000**

---

**Relatório gerado automaticamente pelo Sistema Seu Metro Quadrado - CRM Imobiliário**

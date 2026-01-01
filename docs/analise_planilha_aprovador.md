# Análise da Planilha de Aprovador

## Estrutura Identificada

### Aba "CAPA MESA" - Campos Principais

**Dados do Imóvel:**
- Torre: 1
- Unidade: 4
- Valor de Venda: R$ 235.000
- Valor de Avaliação CEF: R$ 235.000
- Valor da Unidade com Bônus: R$ 219.900

**Dados do Cliente:**
- Renda Mensal: R$ 2.500
- Renda Informal: R$ 0
- % sob renda: 35%

**Financiamento:**
- Financiamento Máx: R$ 188.000
- Parcela Máx: R$ 875
- Entrada Mín: R$ 0
- Pós Chaves Máx: R$ 4.700
- Capacidade Pagamento CEF: R$ 960

**Tabela de Pagamento (estrutura principal):**
| Tipo | Qtd | Valor Parcela | Total | % |
|------|-----|---------------|-------|---|
| Financiamento | 1 | 178.000 | 178.000 | 80,9% |
| FGTS | 1 | 0 | 0 | 0% |
| Subsídio | 1 | 5.000 | 5.000 | 2,3% |
| Entrada | 1 | 500 | 500 | 0,2% |
| Mensais (fluxo regressivo) | 36 | - | 23.073,75 | 10,5% |
| Mensais | 12 | 310,52 | 3.726,25 | 1,7% |
| Anuais | 3 | 3.200 | 9.600 | 4,4% |
| Outras | 1 | 0 | 0 | 0% |
| *Parcela Adimplência | 1 | 15.100 | 15.100 | - |
| **Total Apurado** | - | - | **235.000** | 100% |

**Parecer Prévio de Crédito:**
- Composição de Entrada (Finan, FGTS, Subs e Entrada): Aprovada
- Entrada (Total): Aprovada
- Entrada (Parcela): Não
- Mensais Pós Chaves: Aprovada, sem fiador
- Anuais: Reprovada, deve ser menor ou igual à Renda Mensal
- Outras: Sem Outras
- Parcela Bônus: Aprovada

### Aba "Fluxo Financeiro"
- Detalhamento das 36 parcelas mensais regressivas
- Cada parcela com data e valor específico
- Fator de regressão aplicado

### Aba "Pós Obra e Comprometimento"
- Cálculos de comprometimento pós-obra
- Análise de capacidade de pagamento

### Aba "Tabela vendas Geral"
- Tabela geral de vendas com 327 linhas
- Provavelmente lista de unidades disponíveis

## Campos Obrigatórios para a Proposta

1. **Renda**: Renda Mensal + Renda Informal
2. **Financiamento**: Valor do financiamento aprovado

## Tabela Editável para o Corretor

A tabela deve conter:
- Nome da Parcela
- Quantidade de parcelas
- Valor unitário
- Total

Tipos de parcela:
1. Financiamento
2. FGTS
3. Subsídio
4. Entrada
5. Mensais (fluxo regressivo ou fixo)
6. Anuais
7. Outras
8. Parcela Adimplência (bônus)

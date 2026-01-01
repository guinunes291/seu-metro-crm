# Campos a Extrair dos PDFs de Simulação

## Modelo 1: Portal CRM (Caixa)

### Seção Principal - Simulador Detalhamento

| Campo | Exemplo | Obrigatório |
|-------|---------|-------------|
| Valor do imóvel | R$ 350.000,00 | Sim |
| Prazo Máximo | 254 meses | Sim |
| Sistema de Amortização | PRICE FGTS | Não |
| Cota máx. financiamento | 80% | Não |
| Valor de entrada | R$ 80.787,35 | Sim |
| Entrada Atualizada | Não | Não |
| Prazo | 254 meses | Sim |
| Valor de Financiamento | R$ 269.212,65 | **Sim (crítico)** |
| Apólice de Seguro | 68880 | Não |

### Seção Resumo (lado direito)

| Campo | Exemplo | Obrigatório |
|-------|---------|-------------|
| Origem De Recurso | FGTS - FUNDO DE GARANTIA POR TEMPO DE SERVIÇO | Não |
| Tipo De Pessoa | Física | Não |
| Categoria De Pessoa | CATEGORIA 1 - CONDIÇÕES NORMAIS | Não |
| Tipo De Financiamento | RESIDENCIAL URBANO | Não |
| Categoria De Imóvel | CONSTRUÇÃO/AQ TER CONST - IM. PLANTA E COLETIVAS | Não |
| Cidade | São Paulo - SP | Não |
| Valor Do Imóvel | R$ 350.000,00 | Sim |
| Prazo De Obra | 36 Meses | Não |
| Renda Familiar | R$ 8.000,00 | **Sim (crítico)** |
| FGTS Há Mais De 3 Anos | Sim | Não |
| Proponente Já Beneficiado Com Subsídio Do FGTS Após 16/05/05 | Não | Não |
| Número De Participantes | 1 | Não |
| Pactuação | 100,00% | Não |
| Nascimento | 11/09/1969 | **Sim (crítico)** |

### Seção Prestação

| Campo | Exemplo | Obrigatório |
|-------|---------|-------------|
| Primeira Prestação | R$ 2.399,99 | **Sim (crítico)** |
| Juros Nominais | 7,6600% | Não |
| Juros Efetivos | 7,9348% | **Sim (crítico)** |

### Seção Taxas a Vista

| Campo | Exemplo | Obrigatório |
|-------|---------|-------------|
| Seguro à vista | R$ 230,52 | Não |
| Tarifas | R$ 0,00 | Não |
| IOF | R$ 0,00 | Não |
| TOTAL | R$ 230,52 | Não |

### Seção Componentes da Prestação

| Campo | Exemplo | Obrigatório |
|-------|---------|-------------|
| Amortização + Juros | R$ 2.144,47 | Não |
| Seguro DFI | R$ 24,85 | Não |
| Seguro MIP | R$ 205,67 | Não |
| Total Seguros | R$ 230,52 | Não |
| Taxa de administração | R$ 25,00 | Não |
| Taxa de risco de crédito | R$ 0,00 | Não |
| Taxa operacional mensal | R$ 0,00 | Não |
| TOTAL | R$ 2.399,99 | Não |

## Campos Críticos para Extração (Resumo)

1. **Valor do Imóvel**: R$ 350.000,00
2. **Renda Familiar**: R$ 8.000,00
3. **Data de Nascimento**: 11/09/1969
4. **Valor de Financiamento**: R$ 269.212,65
5. **Prazo**: 254 meses
6. **Primeira Prestação**: R$ 2.399,99
7. **Juros Efetivos**: 7,9348%
8. **Valor de Entrada**: R$ 80.787,35

## Modelo 2: Simulador Habitacional CAIXA (Site Caixa)

### Seção 1 - Dados Iniciais

| Campo | Exemplo | Obrigatório |
|-------|---------|-------------|
| Tipo de pessoa | Pessoa Física | Não |
| Tipo de financiamento | Residencial | Não |
| Tipo de imóvel | Aquisição de Imóvel Novo | Não |
| Valor aproximado do imóvel | R$ 350.000,00 | **Sim (crítico)** |
| Localização | SÃO PAULO-SP | Não |
| Possui imóvel na cidade | Não | Não |
| Portabilidade de Crédito | Não | Não |

### Seção 2 - Seus Dados

| Campo | Exemplo | Obrigatório |
|-------|---------|-------------|
| Renda bruta familiar | R$ 8.000,00 | **Sim (crítico)** |
| Data de nascimento do participante de maior idade | 11/09/1969 | **Sim (crítico)** |
| Possui 3 anos de FGTS | Sim | Não |
| Já foi beneficiado com subsídio FGTS | Não | Não |
| Mais de um comprador/dependente | Não | Não |
| Relacionamento com a Caixa | Não | Não |

### Seção 4 - Resultados

| Campo | Exemplo | Obrigatório |
|-------|---------|-------------|
| Valor do imóvel | R$ 350.000,00 | Sim |
| Prazo máximo | 420 meses | Não |
| Prazo escolhido | 290 meses | **Sim (crítico)** |
| Cota máxima do financiamento | 80% | Não |
| Valor da entrada | R$ 71.058,65 | Sim |
| Valor do financiamento | R$ 278.941,35 | **Sim (crítico)** |
| Sistema de amortização | PRICE/TR | Não |

### Seção Juros e Prestações

| Campo | Exemplo | Obrigatório |
|-------|---------|-------------|
| Juros Nominais | 7.66% a.a. | Não |
| Juros Efetivos | 7.93% a.a. | **Sim (crítico)** |
| 1ª Prestação | R$ 2.377,61 | **Sim (crítico)** |
| Última Prestação | R$ 2.139,65 | Não |

## Mapeamento de Campos Entre os Dois Modelos

| Campo Unificado | Portal CRM | Simulador CAIXA |
|-----------------|------------|------------------|
| Valor do Imóvel | Valor do imóvel | Valor aproximado do imóvel |
| Renda Familiar | Renda Familiar | Renda bruta familiar |
| Data Nascimento | Nascimento | Data de nascimento do participante de maior idade |
| Valor Financiamento | Valor de Financiamento | Valor do financiamento |
| Prazo | Prazo | Prazo escolhido |
| Primeira Prestação | Primeira Prestação | 1ª Prestação |
| Juros Efetivos | Juros Efetivos | Juros Efetivos |
| Valor Entrada | Valor de entrada | Valor da entrada |

## Estratégia de Extração

O sistema usará LLM (GPT) para extrair os dados do PDF, pois:
1. Os PDFs podem ter layouts diferentes
2. Os nomes dos campos variam entre os modelos
3. A posição dos dados pode mudar

O LLM receberá o texto extraído do PDF e retornará um JSON estruturado com os campos mapeados.

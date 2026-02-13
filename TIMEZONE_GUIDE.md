# Guia de Uso de Timezone no Sistema

## Princípio Fundamental

**Todos os cálculos de data/hora devem usar o fuso horário de São Paulo (America/Sao_Paulo = UTC-3)**

O banco de dados armazena timestamps em UTC, mas todas as operações de comparação, filtro e cálculo devem ser feitas no timezone de SP.

## Funções Disponíveis (server/timezone.ts)

### Para Timestamps "Agora"
```typescript
import { agora } from './timezone';
const dataHoraAtual = agora(); // Retorna Date no fuso de SP
```

### Para Início/Fim do Dia
```typescript
import { inicioDoDiaHoje, fimDoDiaHoje } from './timezone';

const inicio = inicioDoDiaHoje(); // 00:00:00 de hoje em SP (em UTC)
const fim = fimDoDiaHoje();       // 23:59:59 de hoje em SP (em UTC)
```

### Para Parsing de Datas do Usuário
```typescript
import { parsearDataISO, inicioDoDia, fimDoDia } from './timezone';

// Converter "2026-02-13" para Date no fuso de SP
const data = parsearDataISO("2026-02-13");

// Obter início/fim de um dia específico
const inicio = inicioDoDia(data); // 00:00:00 daquele dia em SP
const fim = fimDoDia(data);       // 23:59:59 daquele dia em SP
```

### Para Filtros de Data em Queries
```typescript
import { converterFiltrosData } from './timezone';

// Converter filtros opcionais de string para Date
const { dataInicio, dataFim } = converterFiltrosData(
  input?.dataInicio, // "2026-02-01" ou undefined
  input?.dataFim      // "2026-02-28" ou undefined
);

// Usar nos filtros do Drizzle
.where(and(
  dataInicio ? gte(tabela.createdAt, dataInicio) : undefined,
  dataFim ? lte(tabela.createdAt, dataFim) : undefined
))
```

## Quando Usar Cada Função

### ✅ USE timezone.ts quando:
- Filtrar registros por data (queries de dashboard, relatórios)
- Calcular início/fim do dia para comparações
- Sincronizar métricas diárias
- Parsear datas fornecidas pelo usuário (strings ISO)

### ❌ NÃO USE timezone.ts quando:
- Criar timestamps "agora" para novos registros → use `new Date()` diretamente
- Armazenar timestamps de eventos históricos → use o timestamp fornecido
- Comparar dois timestamps já existentes → use diretamente

## Exemplos Práticos

### ❌ ERRADO - Filtro de data sem timezone
```typescript
const conditions = [];
if (input?.dataInicio) {
  conditions.push(gte(leads.createdAt, new Date(input.dataInicio)));
}
if (input?.dataFim) {
  conditions.push(lte(leads.createdAt, new Date(input.dataFim)));
}
```

**Problema:** `new Date("2026-02-13")` interpreta como UTC, não como SP!

### ✅ CORRETO - Filtro de data com timezone
```typescript
const { converterFiltrosData } = await import('./timezone');
const { dataInicio, dataFim } = converterFiltrosData(input?.dataInicio, input?.dataFim);

const conditions = [];
if (dataInicio) {
  conditions.push(gte(leads.createdAt, dataInicio));
}
if (dataFim) {
  conditions.push(lte(leads.createdAt, dataFim));
}
```

### ❌ ERRADO - Calcular "hoje" manualmente
```typescript
const hoje = new Date();
hoje.setHours(0, 0, 0, 0); // ❌ Usa timezone do servidor!
```

### ✅ CORRETO - Usar função de timezone
```typescript
const { inicioDoDiaHoje } = await import('./timezone');
const hoje = inicioDoDiaHoje(); // ✅ Sempre 00:00 de SP
```

## Correções Aplicadas

### Funções de Sincronização (CRÍTICO)
- ✅ `sincronizarInteracoesDoDia()` - usa `inicioDoDiaHoje()` e `fimDoDiaHoje()`
- ✅ `sincronizarVisitasDoDia()` - usa `inicioDoDiaHoje()` e `fimDoDiaHoje()`
- ✅ `sincronizarDocumentacoesDoDia()` - usa `inicioDoDiaHoje()` e `fimDoDiaHoje()`
- ✅ `sincronizarAnalisesCreditoDoDia()` - usa `inicioDoDiaHoje()` e `fimDoDiaHoje()`
- ✅ `sincronizarContratosDoDia()` - usa `inicioDoDiaHoje()` e `fimDoDiaHoje()`

### Procedures tRPC
- ✅ `ranking.porDia` - usa `inicioDoDiaHoje()`
- ✅ `presenca.estatisticas` - usa `converterFiltrosData()`

### Pendentes
- ⚠️ ~50 queries com filtros de data ainda usam `new Date(input.dataInicio/Fim)`
- Essas queries afetam apenas visualizações, não a contabilização de métricas
- Devem ser corrigidas gradualmente conforme necessário

## Checklist para Novos Desenvolvimentos

Ao criar novas queries ou procedures que envolvem datas:

- [ ] Filtros de data usam `converterFiltrosData()`?
- [ ] Comparações com "hoje" usam `inicioDoDiaHoje()` ou `fimDoDiaHoje()`?
- [ ] Parsing de datas do usuário usa `parsearDataISO()`?
- [ ] Timestamps "agora" usam `new Date()` diretamente (OK)?
- [ ] Documentação atualizada se necessário?

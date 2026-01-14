# Implementação do Novo Fluxo de Follow-up (1 Dia)

## 📋 Resumo Executivo

**Objetivo:** Simplificar o sistema de follow-up de 5 tentativas para apenas 1 tentativa por dia.

**Status Atual:** Rollback realizado. Sistema estável na versão 9f4e9375.

**Complexidade:** Alta (50+ funções afetadas)

**Tempo Estimado:** 2-3 horas de trabalho focado

---

## 🎯 Novo Fluxo Desejado

### Regras de Negócio

1. **Criação de Follow-up:**
   - Apenas quando lead muda de "aguardando_atendimento" → "em_atendimento"
   - Apenas 1 follow-up criado para o próximo dia (9h)
   - Apenas leads "em_atendimento" têm follow-ups ativos

2. **Registro de Tentativa:**
   - **"Respondeu"** → marca follow-up atual como concluído + cria novo para amanhã + atualiza `dataUltimaInteracao`
   - **"Não Respondeu"** → marca follow-up como concluído + ativa `aguardandoTransferencia` + atualiza `dataUltimaInteracao`

3. **Transferência Automática:**
   - Job roda a cada 1 hora
   - Busca leads com `aguardandoTransferencia = true` e `dataUltimaInteracao` > 2 dias
   - Transfere para outro corretor (exceto origem "captacao_corretor")

4. **Sistema de Bloqueio:**
   - Corretor DEVE completar **100%** dos follow-ups do dia
   - Outras abas ficam bloqueadas até completar todos
   - Textos devem mostrar "100%" ao invés de "40%" ou "60%"

---

## 🗄️ Mudanças no Schema do Banco de Dados

### Tabela `follow_ups` - ANTES (Schema Antigo)

```typescript
export const followUps = mysqlTable("follow_ups", {
  id: int("id").autoincrement().primaryKey(),
  leadId: int("leadId").notNull(),
  corretorId: int("corretorId").notNull(),
  
  // ❌ REMOVER
  tentativaAtual: int("tentativaAtual").default(1).notNull(),
  maxTentativas: int("maxTentativas").default(3).notNull(),
  proximaTentativa: timestamp("proximaTentativa").notNull(),
  ultimaTentativa: timestamp("ultimaTentativa"),
  historicoTentativas: text("historicoTentativas"),
  
  status: mysqlEnum("status", ["ativo", "respondido", "encerrado", "convertido", "cancelado"]),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
```

### Tabela `follow_ups` - DEPOIS (Schema Novo)

```typescript
export const followUps = mysqlTable("follow_ups", {
  id: int("id").autoincrement().primaryKey(),
  leadId: int("leadId").notNull(),
  corretorId: int("corretorId").notNull(),
  
  // ✅ ADICIONAR
  dataFollowUp: timestamp("dataFollowUp").notNull(), // Data do follow-up (quando deve ser realizado)
  dataRegistro: timestamp("dataRegistro"), // Data de registro da tentativa (quando foi realizado)
  resultado: mysqlEnum("resultado", ["respondeu", "nao_respondeu"]),
  observacao: text("observacao"),
  
  status: mysqlEnum("status", ["pendente", "concluido"]).default("pendente").notNull(),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  leadIdx: index("followup_lead_idx").on(table.leadId),
  corretorIdx: index("followup_corretor_idx").on(table.corretorId),
  dataFollowUpIdx: index("followup_data_idx").on(table.dataFollowUp),
  statusIdx: index("followup_status_idx").on(table.status),
}));
```

### Tabela `leads` - Adicionar Campos

```typescript
dataUltimaInteracao: timestamp("dataUltimaInteracao"), // Data da última interação do corretor
aguardandoTransferencia: boolean("aguardandoTransferencia").default(false), // Flag para transferência em 2 dias
```

### SQL para Migração

```sql
-- Remover colunas antigas
ALTER TABLE follow_ups DROP COLUMN tentativaAtual;
ALTER TABLE follow_ups DROP COLUMN maxTentativas;
ALTER TABLE follow_ups DROP COLUMN proximaTentativa;
ALTER TABLE follow_ups DROP COLUMN ultimaTentativa;
ALTER TABLE follow_ups DROP COLUMN historicoTentativas;

-- Adicionar novas colunas
ALTER TABLE follow_ups ADD COLUMN dataFollowUp TIMESTAMP NOT NULL;
ALTER TABLE follow_ups ADD COLUMN dataRegistro TIMESTAMP NULL;
ALTER TABLE follow_ups ADD COLUMN resultado ENUM('respondeu', 'nao_respondeu') NULL;
ALTER TABLE follow_ups ADD COLUMN observacao TEXT NULL;

-- Atualizar enum de status
ALTER TABLE follow_ups MODIFY COLUMN status ENUM('pendente', 'concluido') NOT NULL DEFAULT 'pendente';

-- Adicionar índices
CREATE INDEX followup_data_idx ON follow_ups(dataFollowUp);

-- Adicionar campos na tabela leads
ALTER TABLE leads ADD COLUMN dataUltimaInteracao TIMESTAMP NULL;
ALTER TABLE leads ADD COLUMN aguardandoTransferencia BOOLEAN DEFAULT FALSE;
```

---

## 🔧 Funções do Backend a Corrigir

### Arquivo: `server/db.ts`

#### 1. `criarFollowUpParaLead()` - Linha ~3450

**ANTES:**
```typescript
const proximaTentativa = inicioDoDiaSeguinte();
proximaTentativa.setHours(9, 0, 0, 0);

await db.insert(followUps).values({
  leadId,
  corretorId,
  tentativaAtual: 1,
  maxTentativas: 3,
  proximaTentativa,
  status: "ativo",
});
```

**DEPOIS:**
```typescript
const dataFollowUp = inicioDoDiaSeguinte();
dataFollowUp.setHours(9, 0, 0, 0);

await db.insert(followUps).values({
  leadId,
  corretorId,
  dataFollowUp,
  status: "pendente",
});
```

#### 2. `registrarTentativaFollowUp()` - Linha ~3500

**ANTES:**
```typescript
// Lógica complexa com tentativaAtual, maxTentativas, historicoTentativas
```

**DEPOIS:**
```typescript
export async function registrarTentativaFollowUp(
  followUpId: number,
  resultado: "respondeu" | "nao_respondeu",
  observacao?: string
) {
  const agora = new Date();
  
  // Atualizar follow-up atual
  await db.update(followUps)
    .set({
      status: "concluido",
      dataRegistro: agora,
      resultado,
      observacao,
    })
    .where(eq(followUps.id, followUpId));
  
  // Buscar lead associado
  const followUp = await db.query.followUps.findFirst({
    where: eq(followUps.id, followUpId),
  });
  
  if (!followUp) return;
  
  // Atualizar dataUltimaInteracao do lead
  await db.update(leads)
    .set({ dataUltimaInteracao: agora })
    .where(eq(leads.id, followUp.leadId));
  
  if (resultado === "respondeu") {
    // Criar novo follow-up para amanhã
    const dataFollowUp = inicioDoDiaSeguinte();
    dataFollowUp.setHours(9, 0, 0, 0);
    
    await db.insert(followUps).values({
      leadId: followUp.leadId,
      corretorId: followUp.corretorId,
      dataFollowUp,
      status: "pendente",
    });
  } else {
    // Marcar para transferência em 2 dias
    await db.update(leads)
      .set({ aguardandoTransferencia: true })
      .where(eq(leads.id, followUp.leadId));
  }
}
```

#### 3. `getFollowUpsPendentes()` - Linha ~3340

**Substituir:**
- `proximaTentativa` → `dataFollowUp`
- `ultimaTentativa` → `dataRegistro`
- `status: "ativo"` → `status: "pendente"`
- Remover: `tentativaAtual`, `maxTentativas`, `historicoTentativas`

#### 4. `getTotalFollowUpsDoDia()` - Linha ~3365

**Substituir:**
- `proximaTentativa` → `dataFollowUp`
- `status: "ativo"` → `status: "pendente"`

#### 5. `criarOuAtualizarFollowUp()` - Linha ~7157

**Substituir completamente** por nova lógica usando `criarFollowUpParaLead()`

---

## 🎨 Mudanças no Frontend

### Arquivo: `client/src/components/LockedTabOverlay.tsx`

**Linha 13:**
```typescript
// ANTES
 * Overlay semi-transparente que bloqueia abas até atingir 60% de follow-ups

// DEPOIS
 * Overlay semi-transparente que bloqueia abas até atingir 100% de follow-ups
```

**Linha 19:**
```typescript
// ANTES
const faltam = Math.ceil(total * 0.6) - concluidos;

// DEPOIS
const faltam = total - concluidos;
```

**Linha 54:**
```typescript
// ANTES
Meta: 60% dos follow-ups concluídos

// DEPOIS
Meta: 100% dos follow-ups concluídos
```

### Arquivo: `client/src/components/DashboardLayout.tsx`

**Linha 679:**
```typescript
// ANTES
{/* Overlay de bloqueio se não atingiu 40% e não está em Tarefas do Dia ou Modo Blitz (APENAS CORRETORES) */}

// DEPOIS
{/* Overlay de bloqueio se não atingiu 100% e não está em Tarefas do Dia ou Modo Blitz (APENAS CORRETORES) */}
```

### Arquivo: `client/src/pages/TarefasDoDia.tsx`

**Remover:** Contador de tentativas (1/5, 2/5, etc)

### Arquivo: `client/src/pages/ModoBlitz.tsx`

**Remover:** Contador de tentativas

---

## 🤖 Job de Transferência Automática

### Arquivo: `server/transferenciaJob.ts`

```typescript
import { db } from "./db";
import { leads } from "../drizzle/schema";
import { and, eq, lt, sql } from "drizzle-orm";
import { distribuirLeadAutomatico } from "./distribution";

export async function verificarTransferenciasAutomaticas() {
  console.log("[Transferência Job] Verificando leads para transferência...");
  
  const doisDiasAtras = new Date();
  doisDiasAtras.setDate(doisDiasAtras.getDate() - 2);
  
  // Buscar leads aguardando transferência há mais de 2 dias
  const leadsParaTransferir = await db.query.leads.findMany({
    where: and(
      eq(leads.aguardandoTransferencia, true),
      lt(leads.dataUltimaInteracao, doisDiasAtras)
    ),
  });
  
  console.log(`[Transferência Job] Encontrados ${leadsParaTransferir.length} leads para transferir`);
  
  for (const lead of leadsParaTransferir) {
    // Não transferir leads de captação de corretor
    if (lead.origem === "captacao_corretor") {
      console.log(`[Transferência Job] Lead ${lead.id} é de captação de corretor, não será transferido`);
      continue;
    }
    
    try {
      // Distribuir para outro corretor
      const resultado = await distribuirLeadAutomatico(lead.id);
      
      if (resultado.corretorId) {
        // Resetar flag de transferência e atualizar data
        await db.update(leads)
          .set({
            aguardandoTransferencia: false,
            dataUltimaInteracao: new Date(),
          })
          .where(eq(leads.id, lead.id));
        
        console.log(`[Transferência Job] Lead ${lead.id} transferido para corretor ${resultado.corretorId}`);
      }
    } catch (error) {
      console.error(`[Transferência Job] Erro ao transferir lead ${lead.id}:`, error);
    }
  }
  
  console.log("[Transferência Job] Verificação concluída");
}
```

### Adicionar ao `server/distribuicaoJob.ts`

```typescript
import { verificarTransferenciasAutomaticas } from "./transferenciaJob";

// Adicionar ao setInterval existente
setInterval(async () => {
  await verificarTransferenciasAutomaticas();
}, 60 * 60 * 1000); // A cada 1 hora
```

---

## ✅ Checklist de Implementação

### Fase 1: Schema do Banco
- [ ] Atualizar `drizzle/schema.ts` com novo schema de `follow_ups`
- [ ] Adicionar campos `dataUltimaInteracao` e `aguardandoTransferencia` em `leads`
- [ ] Executar SQL de migração manualmente
- [ ] Verificar estrutura da tabela com `SHOW COLUMNS FROM follow_ups`

### Fase 2: Backend - Funções Principais
- [ ] Corrigir `criarFollowUpParaLead()`
- [ ] Reescrever `registrarTentativaFollowUp()`
- [ ] Atualizar `getFollowUpsPendentes()`
- [ ] Atualizar `getTotalFollowUpsDoDia()`
- [ ] Remover/reescrever `criarOuAtualizarFollowUp()`

### Fase 3: Backend - Buscar e Substituir
- [ ] Buscar todas as ocorrências de `proximaTentativa` → substituir por `dataFollowUp`
- [ ] Buscar todas as ocorrências de `ultimaTentativa` → substituir por `dataRegistro`
- [ ] Buscar todas as ocorrências de `tentativaAtual` → remover
- [ ] Buscar todas as ocorrências de `maxTentativas` → remover
- [ ] Buscar todas as ocorrências de `historicoTentativas` → remover
- [ ] Buscar todas as ocorrências de `status: "ativo"` → substituir por `status: "pendente"`

### Fase 4: Job de Transferência
- [ ] Criar `server/transferenciaJob.ts`
- [ ] Adicionar chamada no `server/distribuicaoJob.ts`
- [ ] Testar job manualmente

### Fase 5: Frontend - Textos e Tooltips
- [ ] Atualizar `LockedTabOverlay.tsx` (60% → 100%)
- [ ] Atualizar `DashboardLayout.tsx` (40% → 100%)
- [ ] Remover contadores de tentativas em `TarefasDoDia.tsx`
- [ ] Remover contadores de tentativas em `ModoBlitz.tsx`

### Fase 6: Testes
- [ ] Limpar todos os follow-ups do banco
- [ ] Criar lead e mudar para "em_atendimento"
- [ ] Verificar criação de follow-up para amanhã
- [ ] Testar botão "Respondeu" → deve criar novo follow-up
- [ ] Testar botão "Não Respondeu" → deve marcar para transferência
- [ ] Aguardar 2 dias (ou simular) e verificar transferência automática
- [ ] Verificar bloqueio com 0/0 follow-ups → deve desbloquear

### Fase 7: Checkpoint e Entrega
- [ ] Reiniciar servidor
- [ ] Verificar logs de erro
- [ ] Salvar checkpoint
- [ ] Entregar ao usuário

---

## ⚠️ Problemas Conhecidos

1. **TypeScript Crashando:** Ambiente com segmentation fault (exit code 134). Não afeta execução mas impede validação em tempo real.

2. **Substituições Automáticas:** Script Python pode causar erros de sintaxe. Revisar manualmente após executar.

3. **Cache do React Query:** Frontend pode cachear dados antigos. Instruir usuário a limpar cache do navegador.

---

## 📝 Notas Finais

- **Backup:** Sempre fazer checkpoint antes de mudanças grandes
- **Testes:** Testar CADA mudança incrementalmente
- **Rollback:** Manter versão estável para rollback rápido
- **Documentação:** Atualizar este documento conforme necessário

---

**Criado em:** 14/01/2026  
**Última atualização:** 14/01/2026  
**Status:** Aguardando implementação  
**Versão estável atual:** 9f4e9375

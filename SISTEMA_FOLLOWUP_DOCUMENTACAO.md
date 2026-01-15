# 📋 Documentação Completa do Sistema de Follow-up (ATUAL)

## 🎯 Visão Geral

O sistema de follow-up do CRM Seu Metro Quadrado garante que corretores façam acompanhamento diário de leads em atendimento. O corretor registra **1 tentativa por dia**, e se o cliente não responder, o lead entra em fila de autodistribuição após 2 dias sem nova interação.

---

## 📊 Estrutura de Dados

### Tabela `follow_ups`
```sql
CREATE TABLE follow_ups (
  id INT AUTO_INCREMENT PRIMARY KEY,
  leadId INT NOT NULL,
  corretorId INT NOT NULL,
  dataFollowUp TIMESTAMP NOT NULL,      -- Data que o follow-up deve ser feito
  dataRegistro TIMESTAMP,                -- Quando foi registrado/concluído
  resultado ENUM('respondeu', 'nao_respondeu'),
  observacao TEXT,
  status ENUM('pendente', 'concluido', 'cancelado') DEFAULT 'pendente',
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### Tabela `leads` (campos relevantes)
```sql
status ENUM(...),                        -- Status atual do lead
dataUltimaInteracao TIMESTAMP,           -- Última vez que corretor registrou follow-up
aguardandoTransferencia BOOLEAN,         -- Se true, será transferido em 2 dias sem interação
corretorId INT,                          -- Corretor responsável
```

---

## 🔄 Fluxo Completo do Sistema

### 1. **Criação Automática de Follow-up**

**Quando acontece:** Lead muda para status `em_atendimento`

**Código:** `server/routers.ts` linha 437
```typescript
if (input.data.status === 'em_atendimento' && lead.status !== 'em_atendimento') {
  await db.criarFollowUpParaLead(input.id, lead.corretorId || ctx.user.id);
}
```

**Função:** `server/db.ts` linha 3502
```typescript
export async function criarFollowUpParaLead(leadId: number, corretorId: number) {
  const db = await getDb();
  
  // 1. Verifica se já existe follow-up pendente
  const existente = await db.select()
    .from(followUps)
    .where(and(
      eq(followUps.leadId, leadId),
      eq(followUps.status, "pendente")
    ));
  
  if (existente[0]) return existente[0].id; // Já existe, não cria duplicado
  
  // 2. Cria follow-up para AMANHÃ às 9h (timezone São Paulo)
  const amanha = agora();
  amanha.setDate(amanha.getDate() + 1);
  amanha.setHours(9, 0, 0, 0);
  
  // 3. Insere no banco
  const result = await db.insert(followUps).values({
    leadId,
    corretorId,
    dataFollowUp: amanha,
    status: "pendente"
  });
  
  return result[0].insertId;
}
```

**Resultado:**
- ✅ Follow-up criado para o dia seguinte às 9h
- ✅ Status: `pendente`
- ✅ Lead aparecerá na aba "Tarefas do Dia" no dia agendado

---

### 2. **Exibição na Aba "Tarefas do Dia"**

**Endpoint:** `followUps.doDia` (`server/routers.ts` linha 2055)

**Query:** `server/db.ts` linha 3378
```typescript
export async function getFollowUpsDoDia(corretorId: number) {
  const { inicioDoDiaHoje, fimDoDiaHoje } = await import('./timezone');
  const inicioDeHoje = inicioDoDiaHoje(); // 00:00:00 de hoje (SP)
  const fimDeHoje = fimDoDiaHoje();       // 23:59:59.999 de hoje (SP)
  
  return await db.select({
    id: followUps.id,
    leadId: followUps.leadId,
    dataFollowUp: followUps.dataFollowUp,
    leadNome: leads.nome,
    leadTelefone: leads.telefone,
    leadStatus: leads.status,
    aguardandoTransferencia: leads.aguardandoTransferencia
  })
  .from(followUps)
  .innerJoin(leads, eq(followUps.leadId, leads.id))
  .where(and(
    eq(followUps.corretorId, corretorId),
    eq(followUps.status, "pendente"),
    gte(followUps.dataFollowUp, inicioDeHoje),
    lte(followUps.dataFollowUp, fimDeHoje)
  ))
  .orderBy(followUps.dataFollowUp);
}
```

**Critérios:**
- ✅ `corretorId` = usuário logado
- ✅ `status` = "pendente"
- ✅ `dataFollowUp` entre 00:00 e 23:59 de hoje (timezone SP)

**Interface:** `client/src/pages/TarefasDoDia.tsx`
- Card "Follow-ups" mostra contador: `X clientes aguardando contato`
- Cada lead exibe: Nome, Telefone

---

### 3. **Registro de Tentativa de Follow-up**

**Endpoint:** `followUps.registrarTentativa` (`server/routers.ts` linha 2070)

**Função:** `server/db.ts` linha 3410

#### 3.1. **Cliente RESPONDEU**
```typescript
if (respondeu) {
  const agora = new Date();
  
  // 1. Marcar follow-up atual como concluído
  await db.update(followUps)
    .set({
      status: "concluido",
      resultado: "respondeu",
      dataRegistro: agora,
      updatedAt: agora
    })
    .where(eq(followUps.id, followUpId));
  
  // 2. Atualizar lead: resetar flag de transferência
  await db.update(leads)
    .set({
      dataUltimaInteracao: agora,
      aguardandoTransferencia: false, // ✅ Reseta flag
      updatedAt: agora
    })
    .where(eq(leads.id, atual.leadId));
  
  // 3. Criar novo follow-up para AMANHÃ às 9h
  await criarFollowUpParaLead(atual.leadId, atual.corretorId);
  
  return { 
    status: "respondeu", 
    mensagem: "Cliente respondeu! Novo follow-up agendado para amanhã."
  };
}
```

**Resultado:**
- ✅ Follow-up marcado como `concluido`
- ✅ `aguardandoTransferencia` = false (reseta)
- ✅ `dataUltimaInteracao` atualizada
- ✅ Novo follow-up criado para amanhã às 9h
- ✅ Lead continua com o mesmo corretor
- ✅ Lead sai da lista de "Tarefas do Dia" hoje
- ✅ Lead retorna amanhã na lista

#### 3.2. **Cliente NÃO RESPONDEU**
```typescript
if (!respondeu) {
  const agora = new Date();
  
  // 1. Marcar follow-up atual como concluído
  await db.update(followUps)
    .set({
      status: "concluido",
      resultado: "nao_respondeu",
      dataRegistro: agora,
      updatedAt: agora
    })
    .where(eq(followUps.id, followUpId));
  
  // 2. Marcar lead para transferência em 2 dias
  await db.update(leads)
    .set({
      dataUltimaInteracao: agora,
      aguardandoTransferencia: true, // ✅ Marca para autodistribuição
      updatedAt: agora
    })
    .where(eq(leads.id, atual.leadId));
  
  // ⚠️ NÃO cria novo follow-up automaticamente
  
  return { 
    status: "nao_respondeu", 
    mensagem: "Lead marcado para transferência. Será transferido se não houver nova interação em 2 dias."
  };
}
```

**Resultado:**
- ✅ Follow-up marcado como `concluido`
- ✅ `aguardandoTransferencia` = true (marca para autodistribuição)
- ✅ `dataUltimaInteracao` atualizada
- ❌ **NÃO cria novo follow-up** (lead sai da lista)
- ⏳ Lead será transferido em 2 dias se corretor não registrar nova interação

---

### 4. **Autodistribuição em 2 Dias (Job Automático)**

**Job:** `server/transferenciaJob.ts` (executa a cada 1 hora)

```typescript
export async function verificarTransferenciasAutomaticas() {
  const db = await getDb();
  
  // 1. Calcular data limite (2 dias atrás)
  const dataLimite = new Date();
  dataLimite.setDate(dataLimite.getDate() - 2);
  
  // 2. Buscar leads aguardando transferência há mais de 2 dias
  const leadsParaTransferir = await db.select()
    .from(leads)
    .where(and(
      eq(leads.aguardandoTransferencia, true),
      isNotNull(leads.dataUltimaInteracao),
      lt(leads.dataUltimaInteracao, dataLimite), // Última interação > 2 dias atrás
      eq(leads.status, "em_atendimento")
    ));
  
  // 3. Transferir cada lead
  for (const lead of leadsParaTransferir) {
    // Buscar novo corretor (roleta)
    const novoCorretor = await buscarProximoCorretorDisponivel(lead.corretorId);
    
    // Transferir lead
    await db.update(leads)
      .set({
        corretorId: novoCorretor.id,
        aguardandoTransferencia: false, // Reseta flag
        updatedAt: new Date()
      })
      .where(eq(leads.id, lead.id));
    
    // Criar follow-up para novo corretor (amanhã às 9h)
    await criarFollowUpParaLead(lead.id, novoCorretor.id);
    
    // Registrar no histórico
    await db.insert(historicoDistribuicao).values({
      leadId: lead.id,
      corretorAnterior: lead.corretorId,
      corretorNovo: novoCorretor.id,
      motivo: "transferencia_automatica_2_dias",
      dataDistribuicao: new Date()
    });
    
    console.log(`[Transferência] Lead ${lead.id} transferido de ${lead.corretorId} para ${novoCorretor.id}`);
  }
}
```

**Critérios de Transferência:**
- ✅ `aguardandoTransferencia` = true
- ✅ `dataUltimaInteracao` > 2 dias atrás
- ✅ `status` = "em_atendimento"

**Ação:**
- ✅ Transfere para outro corretor (roleta)
- ✅ Reseta `aguardandoTransferencia` para false
- ✅ Cria novo follow-up para o novo corretor (amanhã às 9h)
- ✅ Registra no histórico de distribuição

**Exceção:** Leads com origem `captacao_corretor` **NÃO são transferidos** automaticamente

---

### 5. **Sistema de Bloqueio (100% de Conclusão)**

**Objetivo:** Bloquear acesso ao sistema se corretor não completar **100%** dos follow-ups do dia

**Endpoint:** `followUps.getProgresso` (`server/routers.ts` linha 2180)

```typescript
getProgresso: corretorProcedure.query(async ({ ctx }) => {
  const { inicioDoDiaHoje } = await import('./timezone');
  const hoje = inicioDoDiaHoje();
  const amanha = new Date(hoje);
  amanha.setDate(amanha.getDate() + 1);
  
  // TOTAL: Todos os follow-ups do dia (pendentes + concluídos)
  const totalFollowUps = await db.getTotalFollowUpsDoDia(ctx.user.id, hoje, amanha);
  
  // CONCLUÍDOS: Follow-ups marcados como concluído hoje
  const concluidosFollowUps = await db.getConcluidosFollowUpsDoDia(ctx.user.id, hoje, amanha);
  
  // CÁLCULO DO PERCENTUAL
  const percentual = totalFollowUps > 0 
    ? Math.round((concluidosFollowUps / totalFollowUps) * 100) 
    : 100; // Se não tem follow-ups, considera 100%
  
  // ✅ REGRA DE BLOQUEIO: 100% para desbloquear
  const desbloqueado = totalFollowUps === 0 || percentual >= 100;
  
  return {
    total: totalFollowUps,
    concluidos: concluidosFollowUps,
    percentual,
    desbloqueado
  };
});
```

**Lógica de Bloqueio:**
- ✅ **0 follow-ups:** Sistema desbloqueado (sem tarefas)
- ✅ **< 100% concluídos:** Sistema BLOQUEADO
- ✅ **= 100% concluídos:** Sistema DESBLOQUEADO

**Interface:** `client/src/components/FollowUpBlockOverlay.tsx`
- Overlay vermelho cobre toda a tela
- Mostra progresso: "X/Y follow-ups concluídos (Z%)"
- Bloqueia navegação até atingir 100%
- Mensagem: "Complete todos os follow-ups para desbloquear o sistema"

---

### 6. **Modo Blitz**

**Objetivo:** Interface simplificada para completar follow-ups rapidamente

**Endpoint:** `followUps.getFollowUpsDoDiaExpandido` (`server/routers.ts` linha 2061)

**Interface:** `client/src/pages/TarefasDoDia.tsx`
- Botão "⚡ Modo Blitz" no topo da página
- Exibe leads um por um em tela cheia
- Botões grandes: "✅ Respondeu" / "❌ Não Respondeu"
- Campo de observação opcional
- Navegação automática para próximo lead após registro
- Contador de progresso: "3/15 concluídos"

**Funcionalidades:**
- ✅ Filtros: Projeto, Origem
- ✅ Ordenação: Mais antigos, Mais recentes
- ✅ Atalhos de teclado (opcional)
- ✅ Barra de progresso visual

---

## 🔧 Funções Principais

### `criarFollowUpParaLead(leadId, corretorId)`
**Localização:** `server/db.ts` linha 3502

**Função:**
- Cria follow-up para amanhã às 9h (timezone SP)
- Verifica se já existe pendente (evita duplicatas)
- Retorna ID do follow-up criado

**Quando é chamada:**
- Lead muda para `em_atendimento`
- Cliente respondeu (cria próximo follow-up)
- Lead foi transferido (cria follow-up para novo corretor)

---

### `getFollowUpsDoDia(corretorId)`
**Localização:** `server/db.ts` linha 3378

**Função:**
- Retorna follow-ups pendentes de hoje (00:00 - 23:59 SP)
- Usado na aba "Tarefas do Dia"
- Join com tabela `leads` para trazer nome, telefone, status

---

### `registrarTentativaFollowUp(followUpId, respondeu, observacao)`
**Localização:** `server/db.ts` linha 3410

**Função:**
- Marca follow-up como concluído
- Atualiza `dataUltimaInteracao` do lead
- Se respondeu: reseta `aguardandoTransferencia` e cria próximo follow-up
- Se não respondeu: marca `aguardandoTransferencia = true` (não cria próximo)

---

### `getProgresso(corretorId)`
**Localização:** `server/routers.ts` linha 2180

**Função:**
- Calcula percentual de conclusão (concluídos / total * 100)
- Determina se sistema está bloqueado/desbloqueado
- Regra: 100% para desbloquear

---

### `getTotalFollowUpsDoDia(corretorId, inicio, fim)`
**Localização:** `server/db.ts`

**Função:**
- Conta TODOS os follow-ups do dia (pendentes + concluídos)
- Usado para cálculo de bloqueio

---

### `getConcluidosFollowUpsDoDia(corretorId, inicio, fim)`
**Localização:** `server/db.ts`

**Função:**
- Conta follow-ups marcados como concluído hoje
- Usado para cálculo de bloqueio

---

### `verificarTransferenciasAutomaticas()`
**Localização:** `server/transferenciaJob.ts`

**Função:**
- Job que roda a cada 1 hora
- Busca leads com `aguardandoTransferencia = true` e `dataUltimaInteracao` > 2 dias
- Transfere para outro corretor via roleta
- Cria follow-up para novo corretor

---

## 📱 Páginas e Componentes

### `TarefasDoDia.tsx`
**Localização:** `client/src/pages/TarefasDoDia.tsx`

**Funcionalidades:**
- Card "Follow-ups" com contador (X clientes aguardando contato)
- Lista de leads pendentes com nome, telefone
- Botão "Modo Blitz" para interface rápida
- Modal de registro de tentativa (Respondeu / Não Respondeu)
- Campo de observação opcional

---

### `FollowUpBlockOverlay.tsx`
**Localização:** `client/src/components/FollowUpBlockOverlay.tsx`

**Funcionalidades:**
- Overlay vermelho de bloqueio
- Barra de progresso (X/Y concluídos)
- Percentual de conclusão
- Mensagem: "Complete 100% dos follow-ups para desbloquear"
- Bloqueia navegação até 100%

---

## 🎮 Gamificação

### Conquistas Relacionadas
- **"Persistente":** 10 follow-ups em um dia
- **"Incansável":** 50 follow-ups em um dia
- **"Máquina de Vendas":** 100 follow-ups em um dia

### Sistema de Pontos
- +10 pontos por follow-up registrado
- +50 pontos por lead que respondeu

---

## 📊 Resumo do Fluxo

```
Lead muda para "Em Atendimento"
         ↓
Follow-up criado para AMANHÃ às 9h
         ↓
Aparece em "Tarefas do Dia" no dia agendado
         ↓
Corretor registra tentativa
         ↓
    ┌────────────┴────────────┐
    ↓                         ↓
RESPONDEU                 NÃO RESPONDEU
    ↓                         ↓
aguardandoTransferencia   aguardandoTransferencia
= false                   = true
    ↓                         ↓
Cria novo follow-up       NÃO cria follow-up
para AMANHÃ               (lead sai da lista)
    ↓                         ↓
Lead continua com         Se 2 dias sem nova
mesmo corretor            interação → TRANSFERE
    ↓                         ↓
Retorna amanhã            Novo corretor recebe
em "Tarefas do Dia"       follow-up para AMANHÃ
```

---

## 🚨 Regras Importantes

1. **1 tentativa por dia:** Corretor registra apenas 1 follow-up por lead por dia
2. **Bloqueio 100%:** Sistema bloqueia se não completar TODOS os follow-ups do dia
3. **Autodistribuição em 2 dias:** Lead é transferido se não houver nova interação em 2 dias após "Não Respondeu"
4. **Exceção de origem:** Leads com origem `captacao_corretor` NÃO são transferidos automaticamente
5. **Horário padrão:** Follow-ups sempre agendados para 9h (timezone São Paulo)
6. **Sem contador de tentativas:** Não há mais contador 1/5, 2/5, etc.

---

## 🔮 Melhorias Futuras

1. **Notificações push:** Lembrar corretores às 9h sobre follow-ups pendentes
2. **Visualização de gestor:** Ver follow-ups de todos os corretores em uma tela
3. **Relatório de efetividade:** Taxa de resposta por corretor/projeto/origem
4. **Follow-ups personalizados:** Permitir agendar para horários diferentes de 9h
5. **Integração com WhatsApp:** Enviar mensagem automática ao registrar follow-up

---

## 📞 Suporte

Para dúvidas ou problemas, contate o time de desenvolvimento.

**Última atualização:** 15/01/2026
**Versão do documento:** 2.0 (Sistema Atual)

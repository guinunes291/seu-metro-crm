# Como Restaurar o Sistema de Bloqueio de Follow-ups

## ⚠️ Instruções de Restauração Rápida

Este guia fornece instruções passo a passo para reativar o sistema de bloqueio gamificado de follow-ups.

---

## Pré-requisitos

- Acesso ao código-fonte do projeto em `/home/ubuntu/seu-metro-crm`
- Permissões para editar arquivos e reiniciar o servidor
- Documentação completa em `SISTEMA_BLOQUEIO_FOLLOWUPS.md`
- Backup do código original em `BACKUP_BLOQUEIO_getProgresso_COMPLETO.ts`

---

## Passo 1: Localizar a Procedure

Abrir o arquivo `server/routers.ts` e buscar pela procedure `progressoFollowUps.getProgresso`.

**Buscar por:** `"BLOQUEIO DESATIVADO"` ou `"getProgresso: corretorProcedure"`

**Localização aproximada:** Linha 2055-2082

---

## Passo 2: Substituir o Código

### Código Atual (Desativado)

```typescript
// Calcular progresso de follow-ups do dia (BLOQUEIO DESATIVADO - SEMPRE DESBLOQUEADO)
getProgresso: corretorProcedure
  .query(async ({ ctx }) => {
    const { inicioDoDiaHoje } = await import('./timezone');
    const hoje = inicioDoDiaHoje();
    const amanha = new Date(hoje);
    amanha.setDate(amanha.getDate() + 1);
    
    // BLOQUEIO DESATIVADO: Calcular métricas apenas para exibição
    const totalFollowUps = await db.getTotalFollowUpsDoDia(ctx.user.id, hoje, amanha);
    const total = totalFollowUps.length;
    
    const concluidos = totalFollowUps.filter(f => {
      if (!f.ultimaTentativa) return false;
      const ultimaTentativaDate = new Date(f.ultimaTentativa);
      return ultimaTentativaDate >= hoje && ultimaTentativaDate < amanha;
    }).length;
    
    const percentual = total > 0 ? Math.round((concluidos / total) * 100) : 100;
    
    // SEMPRE RETORNAR DESBLOQUEADO=TRUE (bloqueio desativado)
    return {
      total,
      concluidos,
      percentual,
      desbloqueado: true, // 🔓 BLOQUEIO DESATIVADO - SEMPRE DESBLOQUEADO
    };
  }),
```

### Código a Restaurar (Ativo)

Copiar o conteúdo completo do arquivo `BACKUP_BLOQUEIO_getProgresso_COMPLETO.ts` e substituir toda a procedure.

**Ou copiar diretamente:**

```typescript
// Calcular progresso de follow-ups do dia (para bloqueio gamificado)
getProgresso: corretorProcedure
  .query(async ({ ctx }) => {
    const { inicioDoDiaHoje } = await import('./timezone');
    const hoje = inicioDoDiaHoje();
    const amanha = new Date(hoje);
    amanha.setDate(amanha.getDate() + 1);
    
    // Verificar se já desbloqueou hoje (persistência de desbloqueio)
    const usuario = await db.getUserById(ctx.user.id);
    const ultimoDesbloqueio = usuario?.ultimoDesbloqueio;
    const jaDesbloqueouHoje = ultimoDesbloqueio && 
      new Date(ultimoDesbloqueio) >= hoje && 
      new Date(ultimoDesbloqueio) < amanha;
    
    // Se já desbloqueou hoje, retornar desbloqueado independente do percentual atual
    if (jaDesbloqueouHoje) {
      const totalFollowUps = await db.getTotalFollowUpsDoDia(ctx.user.id, hoje, amanha);
      const total = totalFollowUps.length;
      const concluidos = totalFollowUps.filter(f => {
        if (!f.ultimaTentativa) return false;
        const ultimaTentativaDate = new Date(f.ultimaTentativa);
        return ultimaTentativaDate >= hoje && ultimaTentativaDate < amanha;
      }).length;
      const percentual = total > 0 ? Math.round((concluidos / total) * 100) : 100;
      
      return {
        total,
        concluidos,
        percentual,
        desbloqueado: true, // Forçar desbloqueado se já desbloqueou hoje
      };
    }
    
    // TOTAL FIXO: Contar TODOS os follow-ups que tinham proximaTentativa <= hoje
    const totalFollowUps = await db.getTotalFollowUpsDoDia(ctx.user.id, hoje, amanha);
    const total = totalFollowUps.length;
    
    // CONCLUÍDOS: Contar follow-ups que tiveram ultimaTentativa atualizada HOJE
    const concluidos = totalFollowUps.filter(f => {
      if (!f.ultimaTentativa) return false;
      const ultimaTentativaDate = new Date(f.ultimaTentativa);
      return ultimaTentativaDate >= hoje && ultimaTentativaDate < amanha;
    }).length;
    
    const percentual = total > 0 ? Math.round((concluidos / total) * 100) : 100;
    const desbloqueado = percentual >= 60;
    
    // Se acabou de desbloquear (>=60%), registrar timestamp
    if (desbloqueado && !jaDesbloqueouHoje) {
      await db.updateUser(ctx.user.id, { ultimoDesbloqueio: new Date() });
    }
    
    return {
      total,
      concluidos,
      percentual,
      desbloqueado,
    };
  }),
```

---

## Passo 3: Salvar e Reiniciar

1. **Salvar** o arquivo `server/routers.ts`
2. **Reiniciar** o servidor com `webdev_restart_server`
3. **Aguardar** o servidor inicializar completamente

---

## Passo 4: Testar o Sistema

### Teste 1: Verificar Bloqueio Inicial

1. Fazer login com uma conta de **corretor**
2. Verificar que o indicador no header mostra **0/X (0%)** em vermelho
3. Tentar acessar uma aba como "Kanban" ou "Agendamentos"
4. **Resultado esperado:** Overlay de bloqueio deve aparecer

### Teste 2: Completar Follow-ups

1. Acessar "Tarefas do Dia" (deve estar sempre acessível)
2. Completar follow-ups até atingir 60% ou mais
3. **Resultado esperado:** 
   - Confete e som de vitória devem tocar
   - Toast de parabéns deve aparecer
   - Indicador muda para verde
   - Todas as abas ficam acessíveis

### Teste 3: Persistência de Desbloqueio

1. Após desbloquear, criar novos follow-ups manualmente
2. Verificar que o percentual pode cair abaixo de 60%
3. **Resultado esperado:** Sistema permanece desbloqueado (verde)

### Teste 4: Reset Diário

1. Aguardar até meia-noite (ou simular mudança de dia)
2. Fazer login novamente
3. **Resultado esperado:** Sistema volta a estar bloqueado se houver follow-ups pendentes

---

## Passo 5: Atualizar TODO

Marcar a tarefa de restauração como concluída em `todo.md`:

```markdown
## 🔓 Sistema de Bloqueio Restaurado

- [x] Restaurar código da procedure getProgresso
- [x] Reiniciar servidor
- [x] Testar bloqueio inicial
- [x] Testar desbloqueio e celebração
- [x] Testar persistência de desbloqueio
- [x] Salvar checkpoint com bloqueio reativado
```

---

## Passo 6: Salvar Checkpoint

Após confirmar que o sistema está funcionando corretamente, salvar um checkpoint:

```
Checkpoint: Sistema de Bloqueio de Follow-ups REATIVADO

Bloqueio gamificado restaurado com sucesso:
✅ Meta de 60% de follow-ups para desbloquear
✅ Persistência de desbloqueio durante o dia
✅ Celebração automática ao atingir meta
✅ Overlay visual em abas bloqueadas
✅ Indicador de progresso no header
✅ Badges de alerta no menu lateral

Código restaurado do checkpoint a7e22434.
Sistema testado e validado com múltiplos cenários.
```

---

## Verificação de Componentes

Todos os componentes visuais já estão implementados e não precisam de modificação:

- ✅ `client/src/hooks/useFollowUpProgress.ts` - Hook de progresso
- ✅ `client/src/components/LockedTabOverlay.tsx` - Overlay de bloqueio
- ✅ `client/src/components/DashboardLayout.tsx` - Indicadores visuais
- ✅ `client/src/lib/celebration.ts` - Celebração (confete + som)

**Apenas o backend precisa ser modificado** (`server/routers.ts`).

---

## Parâmetros Configuráveis

Se desejar ajustar o comportamento do sistema:

### Alterar Meta de Desbloqueio

**Localização:** `server/routers.ts` linha ~47

```typescript
const desbloqueado = percentual >= 60; // Alterar 60 para o valor desejado
```

### Alterar Intervalo de Atualização

**Localização:** `client/src/hooks/useFollowUpProgress.ts` linha 27

```typescript
refetchInterval: 10000, // Alterar para o intervalo desejado em ms
```

### Alterar Duração da Celebração

**Localização:** `client/src/lib/celebration.ts` linha 8

```typescript
const duration = 3000; // Alterar para a duração desejada em ms
```

---

## Rollback (Se Necessário)

Se houver problemas após a restauração, reverter para o checkpoint atual:

```bash
webdev_rollback_checkpoint --version_id 14993c1f
```

Este checkpoint tem o bloqueio **desativado** e é estável.

---

## Documentação Completa

Para entender completamente o funcionamento do sistema, consultar:

📄 **SISTEMA_BLOQUEIO_FOLLOWUPS.md** - Documentação técnica completa com:
- Arquitetura do sistema
- Lógica de backend detalhada
- Componentes visuais e efeitos
- Fluxo de dados completo
- Considerações de design e UX
- Limitações e melhorias futuras

---

## Suporte

Em caso de dúvidas ou problemas durante a restauração:

1. Consultar a documentação completa em `SISTEMA_BLOQUEIO_FOLLOWUPS.md`
2. Verificar logs do servidor para erros
3. Testar com conta de corretor de teste antes de liberar para produção
4. Validar que todos os componentes visuais estão renderizando corretamente

---

**Última atualização:** 12 de janeiro de 2026  
**Checkpoint de backup:** a7e22434 (bloqueio ativo)  
**Checkpoint atual:** 14993c1f (bloqueio desativado)

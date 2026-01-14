# Como Ativar o Sistema de Bloqueio (100% Follow-ups)

## 📋 Status Atual

**Bloqueio:** ❌ DESABILITADO  
**Motivo:** Aguardando implementação do novo fluxo de follow-up de 1 dia  
**Corretores:** ✅ Desbloqueados e trabalhando normalmente

---

## 🎯 Pré-requisitos

Antes de ativar o bloqueio, você DEVE implementar o novo fluxo de follow-up conforme documentado em `IMPLEMENTACAO_FOLLOWUP_1DIA.md`.

**Checklist de pré-requisitos:**
- [ ] Schema do banco de dados atualizado (tabela `follow_ups` com novos campos)
- [ ] Funções do backend atualizadas para novo schema
- [ ] Sistema criando follow-ups automaticamente quando lead muda para "em_atendimento"
- [ ] Botões "Respondeu" e "Não Respondeu" funcionando corretamente
- [ ] Job de transferência automática ativo

---

## 🔧 Passos para Ativação

### 1. Ativar Hook useFollowUpProgress

```bash
cd /home/ubuntu/seu-metro-crm/client/src/hooks

# Fazer backup da versão atual
mv useFollowUpProgress.ts useFollowUpProgress.OLD.ts

# Ativar versão nova
mv useFollowUpProgress.NOVO_FLUXO.ts useFollowUpProgress.ts
```

**O que muda:**
- Bloqueio passa a exigir 100% dos follow-ups (não mais 60%)
- Comentários atualizados

### 2. Ativar Componente LockedTabOverlay

```bash
cd /home/ubuntu/seu-metro-crm/client/src/components

# Fazer backup da versão atual
mv LockedTabOverlay.tsx LockedTabOverlay.OLD.tsx

# Ativar versão nova
mv LockedTabOverlay.NOVO_FLUXO.tsx LockedTabOverlay.tsx
```

**O que muda:**
- Texto atualizado: "Meta: 100% dos follow-ups concluídos"
- Cálculo de "faltam" ajustado para 100%

### 3. Atualizar Hook useFollowUpProgress (Remover Override)

Abra o arquivo `client/src/hooks/useFollowUpProgress.ts` e encontre a linha:

```typescript
desbloqueado: true, // ⚠️ SEMPRE TRUE - Bloqueio desabilitado temporariamente
```

Substitua por:

```typescript
desbloqueado: data?.desbloqueado ?? false,
```

### 4. Reiniciar Servidor

```bash
cd /home/ubuntu/seu-metro-crm
pnpm dev
```

Aguarde o servidor inicializar completamente.

### 5. Testar Bloqueio

1. **Login como corretor** (não gestor)
2. Verificar que o header mostra "Follow-ups: 0/0 (0%)"
3. Tentar acessar qualquer aba (ex: Kanban, Agendamentos)
4. **Resultado esperado:** Overlay de bloqueio aparece exigindo 100% dos follow-ups
5. Ir para "Tarefas do Dia" → deve estar desbloqueado
6. Completar todos os follow-ups do dia
7. **Resultado esperado:** Sistema desbloqueia automaticamente + animação de celebração

---

## 🧪 Testes Recomendados

### Teste 1: Bloqueio com 0 Follow-ups

```
Cenário: Corretor sem follow-ups pendentes
Entrada: 0 follow-ups no banco
Resultado Esperado: Sistema DESBLOQUEADO (0/0 = 100%)
```

### Teste 2: Bloqueio com Follow-ups Pendentes

```
Cenário: Corretor com 5 follow-ups pendentes
Entrada: 5 follow-ups com status "pendente"
Resultado Esperado: Sistema BLOQUEADO até completar os 5
```

### Teste 3: Desbloqueio Progressivo

```
Cenário: Corretor completando follow-ups
Entrada: 
  - Início: 0/5 concluídos → BLOQUEADO
  - Meio: 3/5 concluídos → BLOQUEADO
  - Fim: 5/5 concluídos → DESBLOQUEADO + Celebração
Resultado Esperado: Desbloqueio apenas em 100%
```

### Teste 4: Gestor Sempre Desbloqueado

```
Cenário: Gestor com follow-ups pendentes
Entrada: Login como gestor
Resultado Esperado: SEMPRE DESBLOQUEADO (gestores não têm bloqueio)
```

---

## 🔙 Reverter Bloqueio (Se Necessário)

Se precisar desabilitar o bloqueio novamente:

### Opção 1: Reverter Arquivos

```bash
cd /home/ubuntu/seu-metro-crm/client/src/hooks
mv useFollowUpProgress.ts useFollowUpProgress.NOVO_FLUXO.ts
mv useFollowUpProgress.OLD.ts useFollowUpProgress.ts

cd /home/ubuntu/seu-metro-crm/client/src/components
mv LockedTabOverlay.tsx LockedTabOverlay.NOVO_FLUXO.tsx
mv LockedTabOverlay.OLD.tsx LockedTabOverlay.tsx
```

### Opção 2: Override Rápido

Edite `client/src/hooks/useFollowUpProgress.ts` e force `desbloqueado: true`:

```typescript
return {
  total: data?.total ?? 0,
  concluidos: data?.concluidos ?? 0,
  percentual: data?.percentual ?? 0,
  desbloqueado: true, // ⚠️ SEMPRE TRUE - Bloqueio desabilitado temporariamente
  isLoading,
  refetch,
  showPlusOne,
};
```

---

## ⚠️ Avisos Importantes

1. **Não ative o bloqueio sem implementar o novo fluxo!**  
   Os corretores ficarão bloqueados permanentemente se o sistema não criar follow-ups corretamente.

2. **Teste em ambiente de desenvolvimento primeiro!**  
   Sempre teste o bloqueio com um usuário de teste antes de ativar em produção.

3. **Comunique a equipe!**  
   Avise os corretores sobre a mudança de 60% para 100% antes de ativar.

4. **Monitore os primeiros dias!**  
   Fique atento a problemas de bloqueio incorreto nos primeiros dias após ativação.

---

## 📞 Suporte

Se encontrar problemas após ativar o bloqueio:

1. Verifique os logs do servidor: `pnpm dev` (terminal)
2. Verifique o console do navegador (F12)
3. Verifique se há follow-ups pendentes no banco: `SELECT * FROM follow_ups WHERE status = 'pendente'`
4. Se necessário, desabilite o bloqueio temporariamente (Opção 2 acima)

---

**Criado em:** 14/01/2026  
**Última atualização:** 14/01/2026  
**Versão:** 1.0

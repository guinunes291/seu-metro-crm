# Sistema de Roles (Permissões)

O sistema agora possui 3 níveis de acesso distintos:

## 1. Admin (Administrador)
**Usuário:** Guilherme Nunes (guilherme_97fm@outlook.com)

**Permissões:**
- Acesso total ao sistema
- Todas as permissões de Gestor +
- Configurações críticas do sistema
- Gerenciamento de outros gestores
- Controle exclusivo sobre bloqueio/desbloqueio do sistema de follow-up

**Middleware:** `adminProcedure`

## 2. Gestor
**Usuários:** Futuros gestores a serem criados

**Permissões:**
- Gerenciamento da equipe de corretores
- Visualização de relatórios e dashboards gerenciais
- Distribuição e transferência de leads
- Configuração de metas e limites
- Monitoramento de produtividade
- Execução de testes e simulações do sistema
- **NÃO** tem acesso a configurações críticas do sistema

**Middleware:** `gestorProcedure` (aceita tanto admin quanto gestor)

## 3. Corretor
**Usuários:** Todos os corretores da equipe

**Permissões:**
- Gestão de seus próprios leads
- Registro de interações e follow-ups
- Criação de agendamentos e visitas
- Visualização de seu próprio desempenho
- Acesso ao SMQ Copilot
- **NÃO** tem acesso a dados de outros corretores ou configurações gerenciais

**Middleware:** `protectedProcedure` (qualquer usuário autenticado)

## Implementação Técnica

### Schema do Banco de Dados
```typescript
role: mysqlEnum("role", ["admin", "gestor", "corretor"]).default("corretor").notNull()
```

### Middlewares (server/_core/trpc.ts)

```typescript
// Apenas admin
export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    return next({ ctx });
  })
);

// Admin ou gestor
export const gestorProcedure = t.procedure.use(
  t.middleware(async opts => {
    if (!ctx.user || (ctx.user.role !== 'admin' && ctx.user.role !== 'gestor')) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    return next({ ctx });
  })
);

// Qualquer usuário autenticado
export const protectedProcedure = t.procedure.use(requireUser);
```

### Uso em Procedures

```typescript
// Apenas admin
myProcedure: adminProcedure.mutation(async () => { ... })

// Admin ou gestor
myProcedure: gestorProcedure.query(async () => { ... })

// Qualquer usuário autenticado
myProcedure: protectedProcedure.query(async () => { ... })
```

## Atualização de Role

Para atualizar o role de um usuário:

```sql
UPDATE users SET role = 'admin' WHERE email = 'usuario@email.com';
```

**Importante:** O usuário precisa fazer logout e login novamente para que a sessão seja atualizada com o novo role.

## Próximos Passos

1. Definir quais páginas e procedures devem ser exclusivas de admin
2. Criar interface de gerenciamento de usuários para admin
3. Adicionar indicador visual do role na interface (ex: badge "Admin" no perfil)
4. Implementar auditoria de ações administrativas

# Correção: Filtro de Corretor Não Carregava Lista

## Problema Identificado

O filtro de corretor na página de Leads (Meus Leads) não mostrava os nomes dos corretores no dropdown. O dropdown abria mas exibia apenas opções vazias.

## Causa Raiz

A função `getAllCorretores()` em `server/db.ts` retornava dados da tabela `users` com o campo `name`, mas o frontend em `client/src/pages/Leads.tsx` esperava o campo `nome`:

```typescript
// Frontend esperava:
{corretores?.map((corretor) => (
  <SelectItem key={corretor.id} value={corretor.id.toString()}>
    {corretor.nome}  // ❌ Campo 'nome' não existia
  </SelectItem>
))}
```

## Solução Implementada

Atualizada a função `getAllCorretores()` para mapear o campo `name` para `nome`:

```typescript
export async function getAllCorretores() {
  const db = await getDb();
  if (!db) return [];
  
  const corretores = await db.select().from(users).where(eq(users.role, "corretor"));
  
  // Mapear 'name' para 'nome' para compatibilidade com o frontend
  return corretores.map(c => ({
    ...c,
    nome: c.name
  }));
}
```

## Resultado

✅ Filtro de corretor agora exibe corretamente os 14 corretores cadastrados:
- Andrew
- kauanthyago34
- Leticia Castro
- Breno Brunelli
- Guilherme Nunes
- ivenspagule
- Gabriel Salles
- Igor Nigro
- Kamila Silva
- Aline Silva
- Hellen Rodrigues
- Paula Akahoshi
- Mikael Alves
- sheldonbarbosaa

✅ Filtro funciona corretamente ao selecionar um corretor (testado com "Guilherme Nunes" - filtrou 44 leads)

## Arquivos Modificados

- `server/db.ts` - Função `getAllCorretores()` (linhas 182-193)

## Data da Correção

14 de Janeiro de 2026

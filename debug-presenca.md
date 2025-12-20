# Debug: Dados de Presença não aparecem

## Problema
A página de Histórico de Presença mostra "Nenhum dado disponível" apesar de existirem dados no banco.

## Verificações realizadas
1. Dados existem no banco: 105 registros em resumo_presenca_diaria
2. Query SQL funciona: SELECT * FROM resumo_presenca_diaria WHERE data >= ? AND data <= ? retorna dados
3. Usuário logado é gestor (role = 'gestor')
4. API retorna UNAUTHORIZED quando chamada sem cookie de sessão

## Possível causa
O problema parece estar na autenticação - as queries tRPC estão retornando UNAUTHORIZED.
O usuário está logado (aparece no sidebar), mas as queries de presença podem não estar recebendo o cookie de sessão corretamente.

## Solução proposta
Verificar se o cookie de sessão está sendo enviado corretamente nas requisições tRPC.

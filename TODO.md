# TODO - Sistema de Follow-up

## Ajustes Solicitados (10/01/2026)

- [x] Alterar criarFollowUpsAutomaticos para buscar APENAS leads com status "em_atendimento"
- [x] Corrigir texto "Sem resposta após 3 tentativas" no backend (db.ts)
- [x] Corrigir todos os textos de 5 para 3 tentativas na página Boas-Vindas
- [x] Implementar sistema de transferência automática entre corretores após 3/3
- [x] Campo corretoresJaTentaram já existia no schema
- [x] Lógica de transferência implementada: busca corretor presente que ainda não tentou
- [x] Mover para lixeira apenas quando todos os corretores tentarem 3x
- [x] Leads de Captação Própria resetam contador ao invés de transferir
- [ ] Testar fluxo completo: Em Atendimento → 3 tentativas → Transfere → 3 tentativas → Lixeira

## Bug Reportado (12/01/2026)

- [x] Corrigir bloqueio de Kanban mostrando "Complete seus Follow-ups" quando contador está 0/0
- [x] Investigar inconsistência entre query de bloqueio e query de tarefas do dia
- [x] Sincronizar lógica de contagem de follow-ups pendentes
- [x] Implementada limpeza automática de follow-ups órfãos (leads que saíram de "em_atendimento")

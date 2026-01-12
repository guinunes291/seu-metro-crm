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

## Verificação Solicitada (12/01/2026)

- [ ] Verificar se página Tarefas do Dia busca corretamente leads "Em Atendimento"
- [ ] Confirmar que follow-ups são criados automaticamente para leads "Em Atendimento"
- [ ] Validar que corretor vê esses leads na aba Tarefas do Dia
- [ ] Testar fluxo: Lead → Em Atendimento → Aparece em Tarefas do Dia

## Exceção Temporária (12/01/2026)

- [x] Adicionar exceção de desbloqueio para 12/01/2026
- [x] Forçar sistema desbloqueado para permitir trabalho dos corretores
- [x] Fluxo de follow-ups iniciará normalmente amanhã (13/01/2026)
- [x] Exceção expira automaticamente à meia-noite de 13/01/2026

## Integração Zapier → WhatsApp (12/01/2026)

- [x] Criar função notificarCorretorViaZapier no backend
- [x] Integrar na distribuição automática de leads (distribuirLeadPelaRoleta)
- [x] Enviar apenas para leads de origem webhook (verifica origemWebhook = true)
- [x] Incluir dados: nome corretor, telefone, dados do lead, projeto, campanha
- [x] Documentar configuração do Zap (Webhook → WhatsApp) - Ver ZAPIER_WHATSAPP_SETUP.md

## Bug: Exceção de Desbloqueio não Funcionando (12/01/2026)

- [x] Investigar por que exceção temporária não está desbloqueando o sistema
- [x] Verificar timezone da comparação de datas (problema encontrado: new Date() vs inicioDoDiaHoje)
- [x] Ajustar lógica para garantir desbloqueio para 12/01/2026 (usa hojeData.toISOString())
- [ ] Testar após correção

## Debug: Exceção Ainda Não Funciona (12/01/2026)

- [ ] Adicionar console.log para ver valor de hojeData.toISOString()
- [ ] Verificar se a comparação de string está correta
- [ ] Testar com abordagem alternativa (comparar getDate/getMonth/getFullYear)

## Sistema de Controle de Bloqueio para Owner (12/01/2026)

- [x] Criar tabela systemConfig no schema para armazenar configurações
- [x] Adicionar campo bloqueioFollowUpAtivo (boolean) - Criado via SQL direto
- [x] Criar procedures getSystemConfig e updateBloqueioFollowUp
- [x] Modificar getProgresso para verificar se bloqueio está ativo (verificação prioritária)
- [x] Criar página de configurações exclusiva para owner (ConfiguracoesFollowUp.tsx)
- [x] Adicionar toggle "Sistema de Bloqueio Ativo/Inativo" com Switch
- [x] Adicionar procedures tRPC (systemConfig.get e systemConfig.updateBloqueio)
- [x] Adicionar rota /configuracoes-followup no App.tsx
- [ ] Testar: Inativo → Sistema desbloqueado | Ativo → Sistema com gamificação

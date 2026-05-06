-- Adiciona novas etapas ao funil de vendas: qualificado, proposta_enviada, pos_venda
-- IMPORTANTE: executar em ambiente de staging antes de produção

-- 1. Atualizar enum de status na tabela leads
ALTER TABLE `leads` MODIFY COLUMN `status` ENUM(
  'novo','aguardando_atendimento','em_atendimento',
  'qualificado','agendado','visita_realizada',
  'proposta_enviada','analise_credito','contrato_fechado',
  'pos_venda','perdido'
) NOT NULL DEFAULT 'novo';

--> statement-breakpoint

-- 2. Atualizar enum statusAnterior na tabela lead_status_transitions
ALTER TABLE `lead_status_transitions` MODIFY COLUMN `statusAnterior` ENUM(
  'novo','aguardando_atendimento','em_atendimento',
  'qualificado','agendado','visita_realizada',
  'proposta_enviada','analise_credito','contrato_fechado',
  'pos_venda','perdido'
) NOT NULL;

--> statement-breakpoint

-- 3. Atualizar enum statusNovo na tabela lead_status_transitions
ALTER TABLE `lead_status_transitions` MODIFY COLUMN `statusNovo` ENUM(
  'novo','aguardando_atendimento','em_atendimento',
  'qualificado','agendado','visita_realizada',
  'proposta_enviada','analise_credito','contrato_fechado',
  'pos_venda','perdido'
) NOT NULL;

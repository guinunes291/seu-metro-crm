-- Migration: criar tabela whatsapp_logs para registro de mensagens enviadas via Evolution API
CREATE TABLE IF NOT EXISTS `whatsapp_logs` (
  `id` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
  `leadId` int,
  `corretorId` int,
  `tipo` enum('boas_vindas','lembrete_agendamento','followup_vencido','manual') NOT NULL,
  `mensagem` text NOT NULL,
  `telefone` varchar(30),
  `status` enum('enviado','erro','ignorado') NOT NULL DEFAULT 'enviado',
  `erroDetalhe` text,
  `createdAt` timestamp NOT NULL DEFAULT (now())
);

CREATE INDEX `wlog_lead_idx` ON `whatsapp_logs` (`leadId`);
CREATE INDEX `wlog_corretor_idx` ON `whatsapp_logs` (`corretorId`);
CREATE INDEX `wlog_tipo_idx` ON `whatsapp_logs` (`tipo`);
CREATE INDEX `wlog_created_idx` ON `whatsapp_logs` (`createdAt`);

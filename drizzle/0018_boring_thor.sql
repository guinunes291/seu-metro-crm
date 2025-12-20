CREATE TABLE `lead_status_transitions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`leadId` int NOT NULL,
	`corretorId` int NOT NULL,
	`statusAnterior` enum('novo','aguardando_atendimento','em_atendimento','agendado','visita_realizada','analise_credito','contrato_fechado','perdido') NOT NULL,
	`statusNovo` enum('novo','aguardando_atendimento','em_atendimento','agendado','visita_realizada','analise_credito','contrato_fechado','perdido') NOT NULL,
	`observacao` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `lead_status_transitions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `transition_lead_idx` ON `lead_status_transitions` (`leadId`);--> statement-breakpoint
CREATE INDEX `transition_corretor_idx` ON `lead_status_transitions` (`corretorId`);--> statement-breakpoint
CREATE INDEX `transition_status_novo_idx` ON `lead_status_transitions` (`statusNovo`);--> statement-breakpoint
CREATE INDEX `transition_created_idx` ON `lead_status_transitions` (`createdAt`);
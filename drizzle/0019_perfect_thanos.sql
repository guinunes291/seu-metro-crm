CREATE TABLE `agendamentos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`leadId` int NOT NULL,
	`corretorId` int NOT NULL,
	`projectId` int,
	`projetoCustom` varchar(255),
	`construtora` varchar(255),
	`dataAgendamento` timestamp NOT NULL,
	`horaAgendamento` varchar(5) NOT NULL,
	`status` enum('pendente','confirmado','realizado','cancelado','reagendado') NOT NULL DEFAULT 'pendente',
	`observacoes` text,
	`criadoPorId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `agendamentos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `visitas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`leadId` int NOT NULL,
	`corretorId` int NOT NULL,
	`agendamentoId` int,
	`projectId` int,
	`projetoCustom` varchar(255),
	`construtora` varchar(255),
	`dataVisita` timestamp NOT NULL,
	`horaVisita` varchar(5),
	`resultado` enum('interesse_alto','interesse_medio','interesse_baixo','sem_interesse','pendente_documentacao','encaminhado_analise') NOT NULL DEFAULT 'interesse_medio',
	`observacoes` text,
	`registradoPorId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `visitas_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `agendamento_lead_idx` ON `agendamentos` (`leadId`);--> statement-breakpoint
CREATE INDEX `agendamento_corretor_idx` ON `agendamentos` (`corretorId`);--> statement-breakpoint
CREATE INDEX `agendamento_data_idx` ON `agendamentos` (`dataAgendamento`);--> statement-breakpoint
CREATE INDEX `agendamento_status_idx` ON `agendamentos` (`status`);--> statement-breakpoint
CREATE INDEX `visita_lead_idx` ON `visitas` (`leadId`);--> statement-breakpoint
CREATE INDEX `visita_corretor_idx` ON `visitas` (`corretorId`);--> statement-breakpoint
CREATE INDEX `visita_data_idx` ON `visitas` (`dataVisita`);--> statement-breakpoint
CREATE INDEX `visita_agendamento_idx` ON `visitas` (`agendamentoId`);
CREATE TABLE `follow_ups` (
	`id` int AUTO_INCREMENT NOT NULL,
	`leadId` int NOT NULL,
	`corretorId` int NOT NULL,
	`tentativaAtual` int NOT NULL DEFAULT 1,
	`maxTentativas` int NOT NULL DEFAULT 5,
	`proximaTentativa` timestamp NOT NULL,
	`ultimaTentativa` timestamp,
	`status` enum('ativo','respondido','encerrado','convertido','cancelado') NOT NULL DEFAULT 'ativo',
	`historicoTentativas` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `follow_ups_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tarefas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`corretorId` int NOT NULL,
	`leadId` int,
	`titulo` varchar(255) NOT NULL,
	`descricao` text,
	`tipo` enum('follow_up','agendamento','ligacao','whatsapp','email','visita','documentacao','outro') NOT NULL DEFAULT 'outro',
	`dataAgendada` timestamp NOT NULL,
	`status` enum('pendente','concluida','cancelada') NOT NULL DEFAULT 'pendente',
	`prioridade` enum('baixa','media','alta') NOT NULL DEFAULT 'media',
	`concluidaEm` timestamp,
	`observacoesConclusao` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tarefas_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `followup_lead_idx` ON `follow_ups` (`leadId`);--> statement-breakpoint
CREATE INDEX `followup_corretor_idx` ON `follow_ups` (`corretorId`);--> statement-breakpoint
CREATE INDEX `followup_proxima_idx` ON `follow_ups` (`proximaTentativa`);--> statement-breakpoint
CREATE INDEX `followup_status_idx` ON `follow_ups` (`status`);--> statement-breakpoint
CREATE INDEX `tarefa_corretor_idx` ON `tarefas` (`corretorId`);--> statement-breakpoint
CREATE INDEX `tarefa_lead_idx` ON `tarefas` (`leadId`);--> statement-breakpoint
CREATE INDEX `tarefa_data_idx` ON `tarefas` (`dataAgendada`);--> statement-breakpoint
CREATE INDEX `tarefa_status_idx` ON `tarefas` (`status`);
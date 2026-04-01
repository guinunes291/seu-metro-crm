CREATE TABLE `carteira_ativa` (
	`id` int AUTO_INCREMENT NOT NULL,
	`leadId` int NOT NULL,
	`corretorId` int NOT NULL,
	`dataInicio` timestamp NOT NULL DEFAULT (now()),
	`dataExpiracao` timestamp NOT NULL,
	`totalRenovacoes` int NOT NULL DEFAULT 0,
	`status_carteira` enum('ativa','expirada','encerrada') NOT NULL DEFAULT 'ativa',
	`motivoEncerramento` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `carteira_ativa_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `carteira_tarefas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`carteiraId` int NOT NULL,
	`leadId` int NOT NULL,
	`corretorId` int NOT NULL,
	`descricao` text NOT NULL,
	`dataLembrete` timestamp NOT NULL,
	`concluida` boolean NOT NULL DEFAULT false,
	`dataConclusao` timestamp,
	`notificacaoEnviada` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `carteira_tarefas_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `carteira_lead_idx` ON `carteira_ativa` (`leadId`);--> statement-breakpoint
CREATE INDEX `carteira_corretor_idx` ON `carteira_ativa` (`corretorId`);--> statement-breakpoint
CREATE INDEX `carteira_status_idx` ON `carteira_ativa` (`status_carteira`);--> statement-breakpoint
CREATE INDEX `carteira_lead_corretor_idx` ON `carteira_ativa` (`leadId`,`corretorId`);--> statement-breakpoint
CREATE INDEX `tarefa_carteira_idx` ON `carteira_tarefas` (`carteiraId`);--> statement-breakpoint
CREATE INDEX `tarefa_corretor_idx` ON `carteira_tarefas` (`corretorId`);--> statement-breakpoint
CREATE INDEX `tarefa_data_lembrete_idx` ON `carteira_tarefas` (`dataLembrete`);--> statement-breakpoint
CREATE INDEX `tarefa_concluida_idx` ON `carteira_tarefas` (`concluida`);
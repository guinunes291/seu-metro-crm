CREATE TABLE `system_config` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bloqueio_followup_ativo` boolean NOT NULL DEFAULT true,
	`percentual_minimo_desbloqueio` int NOT NULL DEFAULT 60,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `system_config_id` PRIMARY KEY(`id`)
);

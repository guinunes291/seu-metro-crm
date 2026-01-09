CREATE TABLE `indicacoes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`indicadorId` int NOT NULL,
	`indicadoId` int NOT NULL,
	`codigoUsado` varchar(20) NOT NULL,
	`status` enum('pendente','confirmada','bonus_pago','cancelada') NOT NULL DEFAULT 'pendente',
	`valorBonus` int NOT NULL DEFAULT 50000,
	`dataPagamento` timestamp,
	`ip` varchar(45),
	`userAgent` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `indicacoes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `codigoIndicacao` varchar(20);--> statement-breakpoint
ALTER TABLE `users` ADD `indicadoPorId` int;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_codigoIndicacao_unique` UNIQUE(`codigoIndicacao`);--> statement-breakpoint
CREATE INDEX `indicacoes_indicador_idx` ON `indicacoes` (`indicadorId`);--> statement-breakpoint
CREATE INDEX `indicacoes_indicado_idx` ON `indicacoes` (`indicadoId`);--> statement-breakpoint
CREATE INDEX `indicacoes_status_idx` ON `indicacoes` (`status`);
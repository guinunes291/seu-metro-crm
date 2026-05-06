CREATE TABLE `scripts_vendas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`titulo` varchar(150) NOT NULL,
	`conteudo` text NOT NULL,
	`categoria` enum('primeiro_contato','agendamento','pos_visita','objecao_preco','objecao_documentacao','objecao_credito','nao_compareceu','reativacao','fechamento','outro') NOT NULL DEFAULT 'outro',
	`tipo` enum('whatsapp','telefone','email') NOT NULL DEFAULT 'whatsapp',
	`ativo` boolean NOT NULL DEFAULT true,
	`ordem` int NOT NULL DEFAULT 0,
	`criadoPorId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `scripts_vendas_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `scripts_vendas` ADD CONSTRAINT `scripts_vendas_criadoPorId_users_id_fk` FOREIGN KEY (`criadoPorId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX `script_categoria_idx` ON `scripts_vendas` (`categoria`);
--> statement-breakpoint
CREATE INDEX `script_ativo_idx` ON `scripts_vendas` (`ativo`);

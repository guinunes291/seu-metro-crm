CREATE TABLE `fila_distribuicao` (
	`id` int AUTO_INCREMENT NOT NULL,
	`corretorId` int NOT NULL,
	`posicao` int NOT NULL,
	`ativo` boolean NOT NULL DEFAULT true,
	`maxLeadsDia` int NOT NULL DEFAULT 10,
	`leadsRecebidosHoje` int NOT NULL DEFAULT 0,
	`ultimaDistribuicao` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `fila_distribuicao_id` PRIMARY KEY(`id`),
	CONSTRAINT `fila_distribuicao_corretorId_unique` UNIQUE(`corretorId`)
);
--> statement-breakpoint
CREATE TABLE `webhook_config` (
	`id` int AUTO_INCREMENT NOT NULL,
	`webhookToken` varchar(64) NOT NULL,
	`nome` varchar(100) NOT NULL,
	`fonte` enum('facebook','instagram','google','rdstation','outro') NOT NULL DEFAULT 'facebook',
	`projectIdPadrao` int,
	`ativo` boolean NOT NULL DEFAULT true,
	`leadsRecebidos` int NOT NULL DEFAULT 0,
	`ultimoLeadRecebido` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `webhook_config_id` PRIMARY KEY(`id`),
	CONSTRAINT `webhook_config_webhookToken_unique` UNIQUE(`webhookToken`)
);
--> statement-breakpoint
CREATE INDEX `posicao_idx` ON `fila_distribuicao` (`posicao`);
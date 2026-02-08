CREATE TABLE `metas_globais` (
	`id` int AUTO_INCREMENT NOT NULL,
	`mes` int NOT NULL,
	`ano` int NOT NULL,
	`metaVGV` decimal(15,2) DEFAULT '0',
	`metaContratos` int DEFAULT 0,
	`metaLeads` int DEFAULT 0,
	`metaAgendamentos` int DEFAULT 0,
	`metaVisitas` int DEFAULT 0,
	`observacoes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `metas_globais_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `metas_globais_mes_ano_idx` ON `metas_globais` (`mes`,`ano`);
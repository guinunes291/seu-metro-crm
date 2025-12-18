CREATE TABLE `metas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`corretorId` int NOT NULL,
	`mes` int NOT NULL,
	`ano` int NOT NULL,
	`metaLeads` int NOT NULL DEFAULT 0,
	`metaAgendamentos` int NOT NULL DEFAULT 0,
	`metaVisitas` int NOT NULL DEFAULT 0,
	`metaContratos` int NOT NULL DEFAULT 0,
	`metaVGV` int NOT NULL DEFAULT 0,
	`observacoes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `metas_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `corretor_mes_ano_idx` ON `metas` (`corretorId`,`mes`,`ano`);
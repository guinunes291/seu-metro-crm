CREATE TABLE `equipes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nome` varchar(255) NOT NULL,
	`descricao` text,
	`gestorId` int NOT NULL,
	`cor` varchar(7) NOT NULL DEFAULT '#3b82f6',
	`metaMensal` int NOT NULL DEFAULT 10,
	`ativa` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `equipes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `equipe_gestor_idx` ON `equipes` (`gestorId`);--> statement-breakpoint
CREATE INDEX `equipe_ativa_idx` ON `equipes` (`ativa`);
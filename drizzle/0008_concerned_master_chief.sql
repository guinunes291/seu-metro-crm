CREATE TABLE `templates_comissao` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int,
	`nome` varchar(255) NOT NULL,
	`percentualImobiliaria` decimal(5,2) NOT NULL DEFAULT '3.50',
	`percentualCorretor` decimal(5,2) NOT NULL DEFAULT '1.85',
	`percentualGerente` decimal(5,2) NOT NULL DEFAULT '0.50',
	`percentualSuperintendente` decimal(5,2) NOT NULL DEFAULT '0.30',
	`isPadrao` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `templates_comissao_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `templates_comissao` ADD CONSTRAINT `templates_comissao_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `templates_comissao_project_idx` ON `templates_comissao` (`projectId`);--> statement-breakpoint
CREATE INDEX `templates_comissao_nome_idx` ON `templates_comissao` (`nome`);
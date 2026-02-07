CREATE TABLE `construtoras` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nome` varchar(255) NOT NULL,
	`logoUrl` text,
	`ativo` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `construtoras_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `historicos_precos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projetoId` int NOT NULL,
	`mes` int NOT NULL,
	`ano` int NOT NULL,
	`precoMinimo` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `historicos_precos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `logs_sincronizacao` (
	`id` int AUTO_INCREMENT NOT NULL,
	`status` enum('sucesso','erro','aviso') NOT NULL,
	`mensagem` text NOT NULL,
	`detalhes` text,
	`tabeloesProcessados` int,
	`projetosExtraidos` int,
	`materiaisExtraidos` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `logs_sincronizacao_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `materiais` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projetoId` int NOT NULL,
	`tipo` enum('book','foto','tabela','outro') NOT NULL,
	`nome` varchar(255) NOT NULL,
	`driveUrl` text,
	`s3Url` text,
	`fileKey` varchar(500),
	`mimeType` varchar(100),
	`tamanho` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `materiais_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tabeloes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`construtoraId` int NOT NULL,
	`mes` int NOT NULL,
	`ano` int NOT NULL,
	`drivePdfUrl` text,
	`s3PdfUrl` text,
	`fileKey` varchar(500),
	`statusProcessamento` enum('pendente','processando','concluido','erro') NOT NULL DEFAULT 'pendente',
	`mensagemErro` text,
	`totalProjetos` int,
	`totalLinks` int,
	`processadoEm` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `tabeloes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `projects` ADD `construtoraId` int;--> statement-breakpoint
ALTER TABLE `projects` ADD `imagemCapaUrl` text;--> statement-breakpoint
ALTER TABLE `projects` ADD `bookPdfUrl` text;--> statement-breakpoint
ALTER TABLE `projects` ADD `linkMateriais` text;--> statement-breakpoint
ALTER TABLE `projects` ADD `regiao` varchar(255);--> statement-breakpoint
ALTER TABLE `projects` ADD `latitude` decimal(10,8);--> statement-breakpoint
ALTER TABLE `projects` ADD `longitude` decimal(11,8);--> statement-breakpoint
ALTER TABLE `historicos_precos` ADD CONSTRAINT `historicos_precos_projetoId_projects_id_fk` FOREIGN KEY (`projetoId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `materiais` ADD CONSTRAINT `materiais_projetoId_projects_id_fk` FOREIGN KEY (`projetoId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tabeloes` ADD CONSTRAINT `tabeloes_construtoraId_construtoras_id_fk` FOREIGN KEY (`construtoraId`) REFERENCES `construtoras`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `construtoras_nome_idx` ON `construtoras` (`nome`);--> statement-breakpoint
CREATE INDEX `historicos_precos_projeto_idx` ON `historicos_precos` (`projetoId`);--> statement-breakpoint
CREATE INDEX `historicos_precos_mes_ano_idx` ON `historicos_precos` (`mes`,`ano`);--> statement-breakpoint
CREATE INDEX `logs_sincronizacao_status_idx` ON `logs_sincronizacao` (`status`);--> statement-breakpoint
CREATE INDEX `logs_sincronizacao_created_at_idx` ON `logs_sincronizacao` (`createdAt`);--> statement-breakpoint
CREATE INDEX `materiais_projeto_idx` ON `materiais` (`projetoId`);--> statement-breakpoint
CREATE INDEX `materiais_tipo_idx` ON `materiais` (`tipo`);--> statement-breakpoint
CREATE INDEX `tabeloes_construtora_idx` ON `tabeloes` (`construtoraId`);--> statement-breakpoint
CREATE INDEX `tabeloes_mes_ano_idx` ON `tabeloes` (`mes`,`ano`);--> statement-breakpoint
CREATE INDEX `tabeloes_status_idx` ON `tabeloes` (`statusProcessamento`);--> statement-breakpoint
ALTER TABLE `projects` ADD CONSTRAINT `projects_construtoraId_construtoras_id_fk` FOREIGN KEY (`construtoraId`) REFERENCES `construtoras`(`id`) ON DELETE no action ON UPDATE no action;
CREATE TABLE `configuracao_projeto_foco` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projetoId` int,
	`corretoresIds` json NOT NULL DEFAULT ('[]'),
	`posicaoAtual` int NOT NULL DEFAULT 0,
	`ativo` boolean NOT NULL DEFAULT true,
	`observacoes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `configuracao_projeto_foco_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `config_projeto_foco_projeto_idx` ON `configuracao_projeto_foco` (`projetoId`);
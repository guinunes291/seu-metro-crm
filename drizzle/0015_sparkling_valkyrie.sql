CREATE TABLE `alertas_produtividade` (
	`id` int AUTO_INCREMENT NOT NULL,
	`corretorId` int NOT NULL,
	`data` timestamp NOT NULL,
	`tipo` enum('baixa_produtividade','meta_nao_atingida','inativo') NOT NULL,
	`mensagem` text NOT NULL,
	`percentualMeta` int NOT NULL DEFAULT 0,
	`lido` boolean NOT NULL DEFAULT false,
	`lidoPor` int,
	`lidoEm` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `alertas_produtividade_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `configuracao_pontuacao` (
	`id` int AUTO_INCREMENT NOT NULL,
	`pontosLigacao` int NOT NULL DEFAULT 1,
	`pontosLigacaoAtendida` int NOT NULL DEFAULT 2,
	`pontosWhatsapp` int NOT NULL DEFAULT 1,
	`pontosWhatsappRespondido` int NOT NULL DEFAULT 2,
	`pontosAgendamento` int NOT NULL DEFAULT 15,
	`pontosVisita` int NOT NULL DEFAULT 25,
	`pontosDocumentacao` int NOT NULL DEFAULT 35,
	`pontosVenda` int NOT NULL DEFAULT 80,
	`pontosClienteCadastrado` int NOT NULL DEFAULT 5,
	`pontosAlteracaoStatus` int NOT NULL DEFAULT 2,
	`atualizadoPor` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `configuracao_pontuacao_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `metas_diarias` (
	`id` int AUTO_INCREMENT NOT NULL,
	`corretorId` int NOT NULL,
	`metaLigacoes` int NOT NULL DEFAULT 20,
	`metaWhatsapp` int NOT NULL DEFAULT 30,
	`metaAgendamentos` int NOT NULL DEFAULT 3,
	`metaVisitas` int NOT NULL DEFAULT 2,
	`metaDocumentacoes` int NOT NULL DEFAULT 1,
	`metaVendas` int NOT NULL DEFAULT 1,
	`ativo` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `metas_diarias_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `alertas_corretor_idx` ON `alertas_produtividade` (`corretorId`);--> statement-breakpoint
CREATE INDEX `alertas_data_idx` ON `alertas_produtividade` (`data`);--> statement-breakpoint
CREATE INDEX `alertas_lido_idx` ON `alertas_produtividade` (`lido`);--> statement-breakpoint
CREATE INDEX `metas_diarias_corretor_idx` ON `metas_diarias` (`corretorId`);
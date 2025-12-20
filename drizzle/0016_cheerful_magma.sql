CREATE TABLE `conquistas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`corretorId` int NOT NULL,
	`tipoConquistaId` int NOT NULL,
	`periodoInicio` timestamp,
	`periodoFim` timestamp,
	`valor` int,
	`posicao` int,
	`observacao` text,
	`notificado` boolean NOT NULL DEFAULT false,
	`notificadoEm` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `conquistas_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tipos_conquista` (
	`id` int AUTO_INCREMENT NOT NULL,
	`codigo` varchar(50) NOT NULL,
	`nome` varchar(100) NOT NULL,
	`descricao` text,
	`icone` varchar(50) NOT NULL DEFAULT 'trophy',
	`cor` varchar(20) NOT NULL DEFAULT 'gold',
	`categoria` enum('vendas','produtividade','streak','especial') NOT NULL DEFAULT 'vendas',
	`criterioTipo` enum('meta_semanal','meta_mensal','ranking_semanal','ranking_mensal','streak_dias','total_vendas','total_leads','manual') NOT NULL,
	`criterioValor` int NOT NULL DEFAULT 1,
	`ativo` boolean NOT NULL DEFAULT true,
	`recorrente` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tipos_conquista_id` PRIMARY KEY(`id`),
	CONSTRAINT `tipos_conquista_codigo_unique` UNIQUE(`codigo`)
);
--> statement-breakpoint
CREATE INDEX `conquistas_corretor_idx` ON `conquistas` (`corretorId`);--> statement-breakpoint
CREATE INDEX `conquistas_tipo_idx` ON `conquistas` (`tipoConquistaId`);--> statement-breakpoint
CREATE INDEX `conquistas_periodo_idx` ON `conquistas` (`periodoInicio`,`periodoFim`);
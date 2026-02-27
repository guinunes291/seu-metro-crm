CREATE TABLE `comissoes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`contratoId` int NOT NULL,
	`usuarioId` int NOT NULL,
	`tipo` enum('corretor','gerente','superintendente') NOT NULL,
	`valorBase` decimal(15,2) NOT NULL,
	`percentual` decimal(5,2) NOT NULL,
	`valorComissao` decimal(15,2) NOT NULL,
	`percentualDesconto` decimal(5,2) DEFAULT '0',
	`valorLiquido` decimal(15,2) NOT NULL,
	`status` enum('pendente_assinatura','a_pagar','paga') NOT NULL DEFAULT 'pendente_assinatura',
	`dataPagamento` timestamp,
	`comprovantePagamento` text,
	`observacoes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `comissoes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `comissoes` ADD CONSTRAINT `comissoes_contratoId_contratos_id_fk` FOREIGN KEY (`contratoId`) REFERENCES `contratos`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `comissoes` ADD CONSTRAINT `comissoes_usuarioId_users_id_fk` FOREIGN KEY (`usuarioId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `comissoes_contrato_idx` ON `comissoes` (`contratoId`);--> statement-breakpoint
CREATE INDEX `comissoes_usuario_idx` ON `comissoes` (`usuarioId`);--> statement-breakpoint
CREATE INDEX `comissoes_status_idx` ON `comissoes` (`status`);--> statement-breakpoint
CREATE INDEX `comissoes_tipo_idx` ON `comissoes` (`tipo`);
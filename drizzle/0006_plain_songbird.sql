CREATE TABLE `historico_atribuicoes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`leadId` int NOT NULL,
	`corretorId` int NOT NULL,
	`dataAtribuicao` timestamp NOT NULL DEFAULT (now()),
	`tipoAtribuicao` enum('distribuicao_inicial','redistribuicao_automatica','redistribuicao_manual','transferencia_inatividade') NOT NULL,
	`observacoes` text,
	CONSTRAINT `historico_atribuicoes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `historico_atribuicoes` ADD CONSTRAINT `historico_atribuicoes_leadId_leads_id_fk` FOREIGN KEY (`leadId`) REFERENCES `leads`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `historico_atribuicoes` ADD CONSTRAINT `historico_atribuicoes_corretorId_users_id_fk` FOREIGN KEY (`corretorId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `historico_atribuicoes_lead_corretor_idx` ON `historico_atribuicoes` (`leadId`,`corretorId`);--> statement-breakpoint
CREATE INDEX `historico_atribuicoes_lead_idx` ON `historico_atribuicoes` (`leadId`);--> statement-breakpoint
CREATE INDEX `historico_atribuicoes_corretor_idx` ON `historico_atribuicoes` (`corretorId`);
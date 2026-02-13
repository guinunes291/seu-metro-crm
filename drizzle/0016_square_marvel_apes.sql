CREATE TABLE `alertas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`leadId` int NOT NULL,
	`corretorId` int NOT NULL,
	`remetenteId` int NOT NULL,
	`mensagem` text NOT NULL,
	`lido` boolean NOT NULL DEFAULT false,
	`lidoEm` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `alertas_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `alertas` ADD CONSTRAINT `alertas_leadId_leads_id_fk` FOREIGN KEY (`leadId`) REFERENCES `leads`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `alertas` ADD CONSTRAINT `alertas_corretorId_users_id_fk` FOREIGN KEY (`corretorId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `alertas` ADD CONSTRAINT `alertas_remetenteId_users_id_fk` FOREIGN KEY (`remetenteId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `alertas_corretor_idx` ON `alertas` (`corretorId`);--> statement-breakpoint
CREATE INDEX `alertas_lido_idx` ON `alertas` (`lido`);--> statement-breakpoint
CREATE INDEX `alertas_created_at_idx` ON `alertas` (`createdAt`);
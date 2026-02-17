CREATE TABLE `transfer_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tipo` enum('lead','contrato') NOT NULL,
	`leadId` int,
	`contratoId` int,
	`corretorAnteriorId` int NOT NULL,
	`corretorNovoId` int NOT NULL,
	`transferidoPorId` int NOT NULL,
	`motivo` text,
	`observacoes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `transfer_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `transfer_history` ADD CONSTRAINT `transfer_history_corretorAnteriorId_users_id_fk` FOREIGN KEY (`corretorAnteriorId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `transfer_history` ADD CONSTRAINT `transfer_history_corretorNovoId_users_id_fk` FOREIGN KEY (`corretorNovoId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `transfer_history` ADD CONSTRAINT `transfer_history_transferidoPorId_users_id_fk` FOREIGN KEY (`transferidoPorId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `transfer_lead_idx` ON `transfer_history` (`leadId`);--> statement-breakpoint
CREATE INDEX `transfer_contrato_idx` ON `transfer_history` (`contratoId`);--> statement-breakpoint
CREATE INDEX `transfer_corretor_anterior_idx` ON `transfer_history` (`corretorAnteriorId`);--> statement-breakpoint
CREATE INDEX `transfer_corretor_novo_idx` ON `transfer_history` (`corretorNovoId`);--> statement-breakpoint
CREATE INDEX `transfer_created_at_idx` ON `transfer_history` (`createdAt`);
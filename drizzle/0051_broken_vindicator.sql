CREATE TABLE `lead_estoque` (
	`id` int AUTO_INCREMENT NOT NULL,
	`leadId` int NOT NULL,
	`tipoFila` enum('normal','foco') NOT NULL DEFAULT 'normal',
	`motivoEstoque` text,
	`tentativasDistribuicao` int NOT NULL DEFAULT 0,
	`ultimaTentativa` timestamp,
	`status` enum('aguardando','distribuido','cancelado') NOT NULL DEFAULT 'aguardando',
	`criadoEm` timestamp NOT NULL DEFAULT (now()),
	`distribuidoEm` timestamp,
	`distribuidoParaCorretorId` int,
	CONSTRAINT `lead_estoque_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `lead_estoque` ADD CONSTRAINT `lead_estoque_leadId_leads_id_fk` FOREIGN KEY (`leadId`) REFERENCES `leads`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `lead_estoque_lead_idx` ON `lead_estoque` (`leadId`);--> statement-breakpoint
CREATE INDEX `lead_estoque_status_idx` ON `lead_estoque` (`status`);--> statement-breakpoint
CREATE INDEX `lead_estoque_tipo_fila_idx` ON `lead_estoque` (`tipoFila`);
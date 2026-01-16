CREATE TABLE `analises_credito` (
	`id` int AUTO_INCREMENT NOT NULL,
	`leadId` int NOT NULL,
	`corretorId` int NOT NULL,
	`status` enum('enviada','aprovada','reprovada','pendente') NOT NULL DEFAULT 'enviada',
	`observacoes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `analises_credito_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `contratos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`leadId` int NOT NULL,
	`corretorId` int NOT NULL,
	`valorVenda` decimal(15,2),
	`observacoes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `contratos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `documentacoes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`leadId` int NOT NULL,
	`corretorId` int NOT NULL,
	`tipo` varchar(100),
	`observacoes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `documentacoes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `interacoes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`leadId` int NOT NULL,
	`corretorId` int NOT NULL,
	`tipo` enum('ligacao','whatsapp') NOT NULL,
	`atendida` boolean DEFAULT false,
	`respondida` boolean DEFAULT false,
	`observacoes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `interacoes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `analises_credito` ADD CONSTRAINT `analises_credito_leadId_leads_id_fk` FOREIGN KEY (`leadId`) REFERENCES `leads`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `analises_credito` ADD CONSTRAINT `analises_credito_corretorId_users_id_fk` FOREIGN KEY (`corretorId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `contratos` ADD CONSTRAINT `contratos_leadId_leads_id_fk` FOREIGN KEY (`leadId`) REFERENCES `leads`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `contratos` ADD CONSTRAINT `contratos_corretorId_users_id_fk` FOREIGN KEY (`corretorId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `documentacoes` ADD CONSTRAINT `documentacoes_leadId_leads_id_fk` FOREIGN KEY (`leadId`) REFERENCES `leads`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `documentacoes` ADD CONSTRAINT `documentacoes_corretorId_users_id_fk` FOREIGN KEY (`corretorId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `interacoes` ADD CONSTRAINT `interacoes_leadId_leads_id_fk` FOREIGN KEY (`leadId`) REFERENCES `leads`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `interacoes` ADD CONSTRAINT `interacoes_corretorId_users_id_fk` FOREIGN KEY (`corretorId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `analises_credito_lead_idx` ON `analises_credito` (`leadId`);--> statement-breakpoint
CREATE INDEX `analises_credito_corretor_idx` ON `analises_credito` (`corretorId`);--> statement-breakpoint
CREATE INDEX `analises_credito_created_at_idx` ON `analises_credito` (`createdAt`);--> statement-breakpoint
CREATE INDEX `contratos_lead_idx` ON `contratos` (`leadId`);--> statement-breakpoint
CREATE INDEX `contratos_corretor_idx` ON `contratos` (`corretorId`);--> statement-breakpoint
CREATE INDEX `contratos_created_at_idx` ON `contratos` (`createdAt`);--> statement-breakpoint
CREATE INDEX `documentacoes_lead_idx` ON `documentacoes` (`leadId`);--> statement-breakpoint
CREATE INDEX `documentacoes_corretor_idx` ON `documentacoes` (`corretorId`);--> statement-breakpoint
CREATE INDEX `documentacoes_created_at_idx` ON `documentacoes` (`createdAt`);--> statement-breakpoint
CREATE INDEX `interacoes_lead_idx` ON `interacoes` (`leadId`);--> statement-breakpoint
CREATE INDEX `interacoes_corretor_idx` ON `interacoes` (`corretorId`);--> statement-breakpoint
CREATE INDEX `interacoes_tipo_idx` ON `interacoes` (`tipo`);--> statement-breakpoint
CREATE INDEX `interacoes_created_at_idx` ON `interacoes` (`createdAt`);
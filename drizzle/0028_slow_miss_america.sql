CREATE TABLE `propostas_visitantes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`propostaId` int NOT NULL,
	`visitorId` varchar(64) NOT NULL,
	`ip` varchar(45),
	`userAgent` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `propostas_visitantes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `propostas_visitantes_proposta_idx` ON `propostas_visitantes` (`propostaId`);--> statement-breakpoint
CREATE INDEX `propostas_visitantes_visitor_idx` ON `propostas_visitantes` (`visitorId`);--> statement-breakpoint
CREATE INDEX `propostas_visitantes_unique` ON `propostas_visitantes` (`propostaId`,`visitorId`);
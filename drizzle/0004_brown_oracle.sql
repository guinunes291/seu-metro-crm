CREATE TABLE `log_transferencias` (
	`id` int AUTO_INCREMENT NOT NULL,
	`leadId` int NOT NULL,
	`leadNome` varchar(255) NOT NULL,
	`corretorOrigemId` int,
	`corretorOrigemNome` varchar(255),
	`corretorDestinoId` int,
	`corretorDestinoNome` varchar(255),
	`motivo` varchar(255) NOT NULL,
	`statusFinal` varchar(50) NOT NULL,
	`dataTransferencia` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `log_transferencias_id` PRIMARY KEY(`id`)
);

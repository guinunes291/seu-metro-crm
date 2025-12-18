CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`titulo` varchar(255) NOT NULL,
	`mensagem` text NOT NULL,
	`tipo` enum('lead_recebido','follow_up','sistema','alerta') NOT NULL DEFAULT 'sistema',
	`leadId` int,
	`lida` boolean NOT NULL DEFAULT false,
	`lidaEm` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);

CREATE TABLE `atividades_diarias` (
	`id` int AUTO_INCREMENT NOT NULL,
	`corretorId` int NOT NULL,
	`data` timestamp NOT NULL,
	`ligacoesRealizadas` int NOT NULL DEFAULT 0,
	`ligacoesAtendidas` int NOT NULL DEFAULT 0,
	`whatsappEnviados` int NOT NULL DEFAULT 0,
	`whatsappRespondidos` int NOT NULL DEFAULT 0,
	`agendamentosConfirmados` int NOT NULL DEFAULT 0,
	`visitasRealizadas` int NOT NULL DEFAULT 0,
	`propostasEnviadas` int NOT NULL DEFAULT 0,
	`documentacoesRecolhidas` int NOT NULL DEFAULT 0,
	`analiseCreditoEnviadas` int NOT NULL DEFAULT 0,
	`contratosFechados` int NOT NULL DEFAULT 0,
	`vgvDia` int NOT NULL DEFAULT 0,
	`pontuacaoTotal` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `atividades_diarias_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `atividades_corretor_idx` ON `atividades_diarias` (`corretorId`);--> statement-breakpoint
CREATE INDEX `atividades_data_idx` ON `atividades_diarias` (`data`);--> statement-breakpoint
CREATE INDEX `atividades_corretor_data_idx` ON `atividades_diarias` (`corretorId`,`data`);
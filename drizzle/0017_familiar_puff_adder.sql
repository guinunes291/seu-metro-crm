CREATE TABLE `historico_presenca` (
	`id` int AUTO_INCREMENT NOT NULL,
	`corretorId` int NOT NULL,
	`tipo` enum('entrada','saida') NOT NULL,
	`statusAnterior` enum('presente','ausente') NOT NULL,
	`statusNovo` enum('presente','ausente') NOT NULL,
	`origem` enum('manual','automatico_fim','automatico_3h','sistema') NOT NULL DEFAULT 'manual',
	`dataHora` timestamp NOT NULL DEFAULT (now()),
	`observacao` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `historico_presenca_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `resumo_presenca_diaria` (
	`id` int AUTO_INCREMENT NOT NULL,
	`corretorId` int NOT NULL,
	`data` timestamp NOT NULL,
	`primeiraEntrada` timestamp,
	`ultimaSaida` timestamp,
	`totalMinutosPresente` int NOT NULL DEFAULT 0,
	`totalMinutosAusente` int NOT NULL DEFAULT 0,
	`quantidadeEntradas` int NOT NULL DEFAULT 0,
	`quantidadeSaidas` int NOT NULL DEFAULT 0,
	`statusDia` enum('presente','ausente','parcial','fora_expediente') NOT NULL DEFAULT 'ausente',
	`trabalhouForaExpediente` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `resumo_presenca_diaria_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `presenca_corretor_idx` ON `historico_presenca` (`corretorId`);--> statement-breakpoint
CREATE INDEX `presenca_data_hora_idx` ON `historico_presenca` (`dataHora`);--> statement-breakpoint
CREATE INDEX `presenca_tipo_idx` ON `historico_presenca` (`tipo`);--> statement-breakpoint
CREATE INDEX `presenca_corretor_data_idx` ON `historico_presenca` (`corretorId`,`dataHora`);--> statement-breakpoint
CREATE INDEX `resumo_presenca_corretor_idx` ON `resumo_presenca_diaria` (`corretorId`);--> statement-breakpoint
CREATE INDEX `resumo_presenca_data_idx` ON `resumo_presenca_diaria` (`data`);--> statement-breakpoint
CREATE INDEX `resumo_presenca_corretor_data_idx` ON `resumo_presenca_diaria` (`corretorId`,`data`);
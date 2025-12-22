CREATE TABLE `project_suggestions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nome` varchar(255) NOT NULL,
	`construtora` varchar(255),
	`endereco` text,
	`bairro` varchar(100),
	`cidade` varchar(100) NOT NULL DEFAULT 'São Paulo',
	`estado` varchar(2) NOT NULL DEFAULT 'SP',
	`descricao` text,
	`tipo` enum('mcmv','sfh','outro') NOT NULL DEFAULT 'mcmv',
	`valorMinimo` int,
	`valorMaximo` int,
	`metragemMinima` int,
	`metragemMaxima` int,
	`dormitorios` varchar(50),
	`zona` enum('norte','sul','leste','oeste','centro'),
	`corretorId` int NOT NULL,
	`status` enum('pendente','aprovado','reprovado') NOT NULL DEFAULT 'pendente',
	`motivoReprovacao` text,
	`aprovadoPor` int,
	`dataAprovacao` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `project_suggestions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `projects` ADD `bookUrl` text;
CREATE TABLE `conversion_stats` (
	`id` int AUTO_INCREMENT NOT NULL,
	`corretorId` int NOT NULL,
	`projectId` int NOT NULL,
	`leadsRecebidos` int NOT NULL DEFAULT 0,
	`leadsContatados` int NOT NULL DEFAULT 0,
	`agendamentos` int NOT NULL DEFAULT 0,
	`visitas` int NOT NULL DEFAULT 0,
	`analisesCredito` int NOT NULL DEFAULT 0,
	`contratosFechados` int NOT NULL DEFAULT 0,
	`leadsPerdidos` int NOT NULL DEFAULT 0,
	`taxaConversao` int NOT NULL DEFAULT 0,
	`periodoInicio` timestamp NOT NULL,
	`periodoFim` timestamp NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `conversion_stats_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `distribution_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`leadId` int NOT NULL,
	`corretorId` int NOT NULL,
	`tipo` enum('automatica','manual','inicial') NOT NULL,
	`motivo` text,
	`distribuidoPorId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `distribution_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lead_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`leadId` int NOT NULL,
	`corretorId` int NOT NULL,
	`tipo` enum('ligacao','whatsapp','email','sms','visita','outro') NOT NULL,
	`resultado` enum('contato_realizado','nao_atendeu','agendamento','visita_realizada','proposta_enviada','recusou','outro') NOT NULL,
	`observacoes` text,
	`statusAnterior` varchar(50),
	`statusNovo` varchar(50),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `lead_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `leads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`idPrincipal` varchar(50),
	`nome` varchar(255) NOT NULL,
	`email` varchar(320),
	`telefone` varchar(20) NOT NULL,
	`origem` varchar(255),
	`projectId` int,
	`corretorId` int,
	`dataDistribuicao` timestamp,
	`status` enum('novo','aguardando_atendimento','em_atendimento','agendado','visita_realizada','analise_credito','contrato_fechado','perdido') NOT NULL DEFAULT 'novo',
	`proximoFollowup` timestamp,
	`diasFollowupConsecutivos` int NOT NULL DEFAULT 0,
	`ultimoContato` timestamp,
	`observacoes` text,
	`motivoPerdido` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `leads_id` PRIMARY KEY(`id`),
	CONSTRAINT `leads_idPrincipal_unique` UNIQUE(`idPrincipal`)
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nome` varchar(255) NOT NULL,
	`construtora` varchar(255),
	`endereco` text,
	`bairro` varchar(100),
	`cidade` varchar(100) NOT NULL DEFAULT 'São Paulo',
	`estado` varchar(2) NOT NULL DEFAULT 'SP',
	`zona` varchar(50),
	`descricao` text,
	`tipo` enum('mcmv','sfh','outro') NOT NULL DEFAULT 'mcmv',
	`status` enum('ativo','inativo','esgotado') NOT NULL DEFAULT 'ativo',
	`valorMinimo` int,
	`valorMaximo` int,
	`metragemMinima` int,
	`metragemMaxima` int,
	`dormitorios` varchar(50),
	`vagas` boolean DEFAULT false,
	`imagemPrincipal` text,
	`imagensAdicionais` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `properties` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`unidade` varchar(50) NOT NULL,
	`bloco` varchar(50),
	`andar` int,
	`metragem` int NOT NULL,
	`dormitorios` int NOT NULL,
	`banheiros` int NOT NULL,
	`vagas` int NOT NULL DEFAULT 0,
	`valor` int NOT NULL,
	`status` enum('disponivel','reservado','vendido') NOT NULL DEFAULT 'disponivel',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `properties_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quick_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`corretorId` int,
	`titulo` varchar(100) NOT NULL,
	`mensagem` text NOT NULL,
	`tipo` enum('whatsapp','email','sms') NOT NULL,
	`ordem` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `quick_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','admin','corretor','gestor') NOT NULL DEFAULT 'corretor';--> statement-breakpoint
ALTER TABLE `users` ADD `status` enum('presente','ausente') DEFAULT 'ausente' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `telefone` varchar(20);
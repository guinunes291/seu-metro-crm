CREATE TABLE `bloqueios_agenda` (
	`id` int AUTO_INCREMENT NOT NULL,
	`corretorId` int NOT NULL,
	`dataInicio` timestamp NOT NULL,
	`dataFim` timestamp NOT NULL,
	`tipo` enum('ferias','folga','reuniao','compromisso_pessoal','treinamento','outro') NOT NULL DEFAULT 'outro',
	`motivo` varchar(255),
	`diaInteiro` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `bloqueios_agenda_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `conversas_chatbot` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` varchar(64) NOT NULL,
	`nome` varchar(255),
	`telefone` varchar(20),
	`email` varchar(320),
	`projectId` int,
	`tipoImovel` varchar(100),
	`faixaPreco` varchar(100),
	`regiao` varchar(100),
	`temRenda` boolean,
	`rendaFamiliar` varchar(100),
	`temEntrada` boolean,
	`valorEntrada` varchar(100),
	`prazoCompra` varchar(100),
	`status` enum('em_andamento','qualificado','nao_qualificado','agendamento_solicitado','convertido_lead','abandonado') NOT NULL DEFAULT 'em_andamento',
	`leadId` int,
	`corretorId` int,
	`historico` text,
	`agendamentoRetorno` timestamp,
	`origem` varchar(100),
	`dispositivo` varchar(50),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `conversas_chatbot_id` PRIMARY KEY(`id`),
	CONSTRAINT `conversas_chatbot_sessionId_unique` UNIQUE(`sessionId`)
);
--> statement-breakpoint
CREATE TABLE `disponibilidade_corretor` (
	`id` int AUTO_INCREMENT NOT NULL,
	`corretorId` int NOT NULL,
	`diaSemana` int NOT NULL,
	`horaInicio` varchar(5) NOT NULL,
	`horaFim` varchar(5) NOT NULL,
	`intervaloInicio` varchar(5),
	`intervaloFim` varchar(5),
	`duracaoSlot` int NOT NULL DEFAULT 60,
	`ativo` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `disponibilidade_corretor_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `faq_chatbot` (
	`id` int AUTO_INCREMENT NOT NULL,
	`pergunta` text NOT NULL,
	`resposta` text NOT NULL,
	`palavrasChave` text,
	`categoria` enum('financiamento','documentacao','visita','preco','localizacao','empreendimento','empresa','geral') NOT NULL DEFAULT 'geral',
	`projectId` int,
	`prioridade` int NOT NULL DEFAULT 0,
	`ativo` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `faq_chatbot_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `links_agendamento` (
	`id` int AUTO_INCREMENT NOT NULL,
	`corretorId` int NOT NULL,
	`leadId` int,
	`projectId` int,
	`token` varchar(64) NOT NULL,
	`titulo` varchar(255),
	`mensagemBoasVindas` text,
	`validoAte` timestamp,
	`maxAgendamentos` int,
	`agendamentosRealizados` int NOT NULL DEFAULT 0,
	`ativo` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `links_agendamento_id` PRIMARY KEY(`id`),
	CONSTRAINT `links_agendamento_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `propostas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`leadId` int NOT NULL,
	`corretorId` int NOT NULL,
	`projectId` int NOT NULL,
	`token` varchar(64) NOT NULL,
	`nomeCliente` varchar(255) NOT NULL,
	`emailCliente` varchar(320),
	`telefoneCliente` varchar(20),
	`unidade` varchar(50),
	`tipologia` varchar(100),
	`metragem` int,
	`valorImovel` int NOT NULL,
	`valorEntrada` int,
	`valorFinanciamento` int,
	`parcelas` int,
	`valorParcela` int,
	`taxaJuros` varchar(20),
	`desconto` int,
	`motivoDesconto` varchar(255),
	`mensagemPersonalizada` text,
	`imagensSelecionadas` text,
	`plantasSelecionadas` text,
	`videos` text,
	`validoAte` timestamp,
	`status` enum('rascunho','enviada','visualizada','aceita','recusada','expirada') NOT NULL DEFAULT 'rascunho',
	`visualizacoes` int NOT NULL DEFAULT 0,
	`primeiraVisualizacao` timestamp,
	`ultimaVisualizacao` timestamp,
	`aceiteEm` timestamp,
	`ipAceite` varchar(45),
	`assinaturaDigital` text,
	`pdfUrl` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `propostas_id` PRIMARY KEY(`id`),
	CONSTRAINT `propostas_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE INDEX `bloqueios_corretor_idx` ON `bloqueios_agenda` (`corretorId`);--> statement-breakpoint
CREATE INDEX `bloqueios_data_inicio_idx` ON `bloqueios_agenda` (`dataInicio`);--> statement-breakpoint
CREATE INDEX `bloqueios_data_fim_idx` ON `bloqueios_agenda` (`dataFim`);--> statement-breakpoint
CREATE INDEX `conversas_session_idx` ON `conversas_chatbot` (`sessionId`);--> statement-breakpoint
CREATE INDEX `conversas_status_idx` ON `conversas_chatbot` (`status`);--> statement-breakpoint
CREATE INDEX `conversas_lead_idx` ON `conversas_chatbot` (`leadId`);--> statement-breakpoint
CREATE INDEX `disponibilidade_corretor_idx` ON `disponibilidade_corretor` (`corretorId`);--> statement-breakpoint
CREATE INDEX `disponibilidade_dia_idx` ON `disponibilidade_corretor` (`diaSemana`);--> statement-breakpoint
CREATE INDEX `faq_categoria_idx` ON `faq_chatbot` (`categoria`);--> statement-breakpoint
CREATE INDEX `faq_project_idx` ON `faq_chatbot` (`projectId`);--> statement-breakpoint
CREATE INDEX `links_corretor_idx` ON `links_agendamento` (`corretorId`);--> statement-breakpoint
CREATE INDEX `links_token_idx` ON `links_agendamento` (`token`);--> statement-breakpoint
CREATE INDEX `propostas_lead_idx` ON `propostas` (`leadId`);--> statement-breakpoint
CREATE INDEX `propostas_corretor_idx` ON `propostas` (`corretorId`);--> statement-breakpoint
CREATE INDEX `propostas_project_idx` ON `propostas` (`projectId`);--> statement-breakpoint
CREATE INDEX `propostas_token_idx` ON `propostas` (`token`);--> statement-breakpoint
CREATE INDEX `propostas_status_idx` ON `propostas` (`status`);
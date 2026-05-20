CREATE TABLE `atribuicao_sessao` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessaoId` int NOT NULL,
	`corretorId` int NOT NULL,
	`ofertaId` int,
	`status` enum('pendente','em_andamento','concluida') NOT NULL DEFAULT 'pendente',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `atribuicao_sessao_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `blitz_sessoes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`corretorId` int NOT NULL,
	`tipoBloco` varchar(50) NOT NULL DEFAULT 'ligacoes',
	`iniciadaEm` timestamp NOT NULL,
	`encerradaEm` timestamp NOT NULL,
	`duracaoMinutos` int NOT NULL DEFAULT 0,
	`totalLeads` int NOT NULL DEFAULT 0,
	`totalAtendimentos` int NOT NULL DEFAULT 0,
	`totalNaoAtendimentos` int NOT NULL DEFAULT 0,
	`totalAgendamentos` int NOT NULL DEFAULT 0,
	`taxaAtendimentoPct` decimal(5,2) DEFAULT '0.00',
	`mediaMinPorLead` decimal(6,2) DEFAULT '0.00',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `blitz_sessoes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `item_oferta_ativa` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ofertaId` int NOT NULL,
	`leadId` int NOT NULL,
	`statusKanban` enum('ofertar','tratando','agendou','sem_retorno','perdido') NOT NULL DEFAULT 'ofertar',
	`agendamentoId` int,
	`observacao` text,
	`contatadoEm` timestamp,
	`ordem` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `item_oferta_ativa_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `job_control` (
	`key` varchar(100) NOT NULL,
	`value` text NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `job_control_key` PRIMARY KEY(`key`)
);
--> statement-breakpoint
CREATE TABLE `meu_negocio_parametros` (
	`id` int AUTO_INCREMENT NOT NULL,
	`corretorId` int NOT NULL,
	`ticketMedio` decimal(12,2) NOT NULL DEFAULT '275000.00',
	`comissaoPct` decimal(5,4) NOT NULL DEFAULT '0.0170',
	`metaReceitaMes` decimal(12,2) NOT NULL DEFAULT '10000.00',
	`taxaLeadAgendamento` decimal(5,4) NOT NULL DEFAULT '0.30',
	`taxaAgendamentoVisita` decimal(5,4) NOT NULL DEFAULT '0.70',
	`taxaVisitaProposta` decimal(5,4) NOT NULL DEFAULT '0.50',
	`taxaPropostaVenda` decimal(5,4) NOT NULL DEFAULT '0.40',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `meu_negocio_parametros_id` PRIMARY KEY(`id`),
	CONSTRAINT `meu_negocio_parametros_corretorId_unique` UNIQUE(`corretorId`)
);
--> statement-breakpoint
CREATE TABLE `objecoes_playbook` (
	`id` int AUTO_INCREMENT NOT NULL,
	`fase` varchar(100) NOT NULL,
	`faseSlug` varchar(20) NOT NULL,
	`situacao` varchar(255) NOT NULL,
	`frase` varchar(255) NOT NULL,
	`significado` text,
	`tipoObjecao` varchar(50),
	`temperatura` enum('quente','morno','frio') DEFAULT 'morno',
	`objetivo` text,
	`respostaAcr` text,
	`msgWhatsapp` text,
	`msgWhatsappLonga` text,
	`canal` varchar(30),
	`perguntaQualificacao` text,
	`tagCrm` varchar(100),
	`tempoResposta` varchar(50),
	`prioridade` varchar(20),
	`erroComum` text,
	`ativo` boolean NOT NULL DEFAULT true,
	`ordem` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `objecoes_playbook_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `oferta_ativa` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nome` varchar(255) NOT NULL,
	`descricao` text,
	`corretorId` int,
	`criadoPorId` int NOT NULL,
	`sessaoId` int,
	`status` enum('rascunho','ativa','concluida','arquivada') NOT NULL DEFAULT 'ativa',
	`filtros` json NOT NULL DEFAULT ('{}'),
	`totalLeads` int NOT NULL DEFAULT 0,
	`totalContatados` int NOT NULL DEFAULT 0,
	`totalAvancados` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `oferta_ativa_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pre_analises_mcmv` (
	`id` int AUTO_INCREMENT NOT NULL,
	`corretorId` int NOT NULL,
	`leadId` int,
	`nomeCliente` varchar(255) NOT NULL,
	`rendaFamiliar` decimal(12,2) NOT NULL,
	`tipoVinculo` varchar(50) NOT NULL DEFAULT 'CLT',
	`saldoFgts` decimal(12,2) NOT NULL DEFAULT '0.00',
	`valorImovel` decimal(12,2) NOT NULL,
	`prazoMeses` int NOT NULL DEFAULT 420,
	`possuiRestricao` boolean NOT NULL DEFAULT false,
	`jaBeneficiarioMcmv` boolean NOT NULL DEFAULT false,
	`possuiImovelNome` boolean NOT NULL DEFAULT false,
	`municipio` varchar(100) NOT NULL DEFAULT 'São Paulo',
	`faixaMcmv` varchar(20),
	`subsidioEstimado` decimal(12,2),
	`valorFinanciavel` decimal(12,2),
	`parcelaEstimada` decimal(12,2),
	`comprometimentoPct` decimal(5,4),
	`dentroLimite30pct` boolean,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `pre_analises_mcmv_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `scripts_vendas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`titulo` varchar(150) NOT NULL,
	`conteudo` text NOT NULL,
	`categoria` enum('primeiro_contato','agendamento','pos_visita','objecao_preco','objecao_documentacao','objecao_credito','nao_compareceu','reativacao','fechamento','outro') NOT NULL DEFAULT 'outro',
	`tipo` enum('whatsapp','telefone','email') NOT NULL DEFAULT 'whatsapp',
	`ativo` boolean NOT NULL DEFAULT true,
	`ordem` int NOT NULL DEFAULT 0,
	`criadoPorId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `scripts_vendas_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sessao_oferta` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nome` varchar(255) NOT NULL,
	`tipo` enum('terca','quinta','avulsa') NOT NULL DEFAULT 'avulsa',
	`dataHora` timestamp NOT NULL,
	`criadoPorId` int NOT NULL,
	`status` enum('agendada','em_andamento','concluida') NOT NULL DEFAULT 'agendada',
	`descricao` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sessao_oferta_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `whatsapp_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`leadId` int,
	`corretorId` int,
	`tipo` enum('boas_vindas','lembrete_agendamento','followup_vencido','manual') NOT NULL,
	`mensagem` text NOT NULL,
	`telefone` varchar(30),
	`status` enum('enviado','erro','ignorado') NOT NULL DEFAULT 'enviado',
	`erroDetalhe` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `whatsapp_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
DROP TABLE `system_config`;--> statement-breakpoint
ALTER TABLE `analises_credito` DROP FOREIGN KEY `analises_credito_corretorId_users_id_fk`;
--> statement-breakpoint
ALTER TABLE `comissoes` DROP FOREIGN KEY `comissoes_usuarioId_users_id_fk`;
--> statement-breakpoint
ALTER TABLE `contratos` DROP FOREIGN KEY `contratos_corretorId_users_id_fk`;
--> statement-breakpoint
ALTER TABLE `documentacoes` DROP FOREIGN KEY `documentacoes_corretorId_users_id_fk`;
--> statement-breakpoint
ALTER TABLE `historico_atribuicoes` DROP FOREIGN KEY `historico_atribuicoes_corretorId_users_id_fk`;
--> statement-breakpoint
ALTER TABLE `interacoes` DROP FOREIGN KEY `interacoes_corretorId_users_id_fk`;
--> statement-breakpoint
DROP INDEX `carteira_status_idx` ON `carteira_ativa`;--> statement-breakpoint
ALTER TABLE `agendamentos` MODIFY COLUMN `status` enum('pendente','confirmado','realizado','cancelado','reagendado','nao_compareceu') NOT NULL DEFAULT 'pendente';--> statement-breakpoint
ALTER TABLE `analises_credito` MODIFY COLUMN `corretorId` int;--> statement-breakpoint
ALTER TABLE `comissoes` MODIFY COLUMN `usuarioId` int;--> statement-breakpoint
ALTER TABLE `contratos` MODIFY COLUMN `corretorId` int;--> statement-breakpoint
ALTER TABLE `documentacoes` MODIFY COLUMN `corretorId` int;--> statement-breakpoint
ALTER TABLE `historico_atribuicoes` MODIFY COLUMN `corretorId` int;--> statement-breakpoint
ALTER TABLE `interacoes` MODIFY COLUMN `corretorId` int;--> statement-breakpoint
ALTER TABLE `lead_status_transitions` MODIFY COLUMN `statusAnterior` enum('novo','aguardando_atendimento','em_atendimento','qualificado','agendado','visita_realizada','proposta_enviada','analise_credito','contrato_fechado','pos_venda','perdido') NOT NULL;--> statement-breakpoint
ALTER TABLE `lead_status_transitions` MODIFY COLUMN `statusNovo` enum('novo','aguardando_atendimento','em_atendimento','qualificado','agendado','visita_realizada','proposta_enviada','analise_credito','contrato_fechado','pos_venda','perdido') NOT NULL;--> statement-breakpoint
ALTER TABLE `leads` MODIFY COLUMN `status` enum('novo','aguardando_atendimento','em_atendimento','qualificado','agendado','visita_realizada','proposta_enviada','analise_credito','contrato_fechado','pos_venda','perdido') NOT NULL DEFAULT 'novo';--> statement-breakpoint
ALTER TABLE `agendamentos` ADD `naoCompareceu` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `agendamentos` ADD `motivoNaoCompareceu` varchar(255);--> statement-breakpoint
ALTER TABLE `carteira_ativa` ADD `protecaoAte` timestamp NOT NULL;--> statement-breakpoint
ALTER TABLE `carteira_ativa` ADD `renovacoes` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `carteira_ativa` ADD `observacao` text;--> statement-breakpoint
ALTER TABLE `carteira_ativa` ADD `notificadoExpiracao` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `carteira_ativa` ADD `ativo` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `configuracao_projeto_foco` ADD `webhookNotificacaoCorretor` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `motivoPerdaCategoria` varchar(50);--> statement-breakpoint
ALTER TABLE `leads` ADD `transferidoManualmentePorAdmin` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `leads` ADD `temperatura` enum('quente','morno','frio');--> statement-breakpoint
ALTER TABLE `leads` ADD `rendaInformada` varchar(100);--> statement-breakpoint
ALTER TABLE `leads` ADD `usaFgts` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `leads` ADD `entradaDisponivel` varchar(100);--> statement-breakpoint
ALTER TABLE `leads` ADD `dataNascimento` timestamp;--> statement-breakpoint
ALTER TABLE `leads` ADD `utmSource` varchar(255);--> statement-breakpoint
ALTER TABLE `leads` ADD `utmMedium` varchar(255);--> statement-breakpoint
ALTER TABLE `leads` ADD `utmCampaign` varchar(255);--> statement-breakpoint
ALTER TABLE `leads` ADD `utmContent` varchar(255);--> statement-breakpoint
ALTER TABLE `leads` ADD `utmTerm` varchar(255);--> statement-breakpoint
ALTER TABLE `leads` ADD `primeiroContatoEm` timestamp;--> statement-breakpoint
ALTER TABLE `leads` ADD `tempoAtePrimeiroContato` int;--> statement-breakpoint
ALTER TABLE `scripts_vendas` ADD CONSTRAINT `scripts_vendas_criadoPorId_users_id_fk` FOREIGN KEY (`criadoPorId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `blitz_sessao_corretor_idx` ON `blitz_sessoes` (`corretorId`);--> statement-breakpoint
CREATE INDEX `blitz_sessao_data_idx` ON `blitz_sessoes` (`iniciadaEm`);--> statement-breakpoint
CREATE INDEX `item_oferta_ativa_oferta_idx` ON `item_oferta_ativa` (`ofertaId`);--> statement-breakpoint
CREATE INDEX `item_oferta_ativa_lead_idx` ON `item_oferta_ativa` (`leadId`);--> statement-breakpoint
CREATE INDEX `mn_parametros_corretor_idx` ON `meu_negocio_parametros` (`corretorId`);--> statement-breakpoint
CREATE INDEX `objecao_fase_idx` ON `objecoes_playbook` (`faseSlug`);--> statement-breakpoint
CREATE INDEX `objecao_tipo_idx` ON `objecoes_playbook` (`tipoObjecao`);--> statement-breakpoint
CREATE INDEX `objecao_temp_idx` ON `objecoes_playbook` (`temperatura`);--> statement-breakpoint
CREATE INDEX `pre_analise_corretor_idx` ON `pre_analises_mcmv` (`corretorId`);--> statement-breakpoint
CREATE INDEX `pre_analise_lead_idx` ON `pre_analises_mcmv` (`leadId`);--> statement-breakpoint
CREATE INDEX `script_categoria_idx` ON `scripts_vendas` (`categoria`);--> statement-breakpoint
CREATE INDEX `script_ativo_idx` ON `scripts_vendas` (`ativo`);--> statement-breakpoint
CREATE INDEX `wlog_lead_idx` ON `whatsapp_logs` (`leadId`);--> statement-breakpoint
CREATE INDEX `wlog_corretor_idx` ON `whatsapp_logs` (`corretorId`);--> statement-breakpoint
CREATE INDEX `wlog_tipo_idx` ON `whatsapp_logs` (`tipo`);--> statement-breakpoint
CREATE INDEX `wlog_created_idx` ON `whatsapp_logs` (`createdAt`);--> statement-breakpoint
ALTER TABLE `analises_credito` ADD CONSTRAINT `analises_credito_corretorId_users_id_fk` FOREIGN KEY (`corretorId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `comissoes` ADD CONSTRAINT `comissoes_usuarioId_users_id_fk` FOREIGN KEY (`usuarioId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `contratos` ADD CONSTRAINT `contratos_corretorId_users_id_fk` FOREIGN KEY (`corretorId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `documentacoes` ADD CONSTRAINT `documentacoes_corretorId_users_id_fk` FOREIGN KEY (`corretorId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `historico_atribuicoes` ADD CONSTRAINT `historico_atribuicoes_corretorId_users_id_fk` FOREIGN KEY (`corretorId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `interacoes` ADD CONSTRAINT `interacoes_corretorId_users_id_fk` FOREIGN KEY (`corretorId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `carteira_ativo_idx` ON `carteira_ativa` (`ativo`);--> statement-breakpoint
CREATE INDEX `contratos_corretor_distrato_created_idx` ON `contratos` (`corretorId`,`distrato`,`createdAt`);--> statement-breakpoint
CREATE INDEX `dist_log_lead_idx` ON `distribution_log` (`leadId`);--> statement-breakpoint
CREATE INDEX `dist_log_corretor_idx` ON `distribution_log` (`corretorId`);--> statement-breakpoint
CREATE INDEX `dist_log_created_at_idx` ON `distribution_log` (`createdAt`);--> statement-breakpoint
CREATE INDEX `lead_temperatura_idx` ON `leads` (`temperatura`);--> statement-breakpoint
CREATE INDEX `notification_user_idx` ON `notifications` (`userId`);--> statement-breakpoint
CREATE INDEX `notification_lida_idx` ON `notifications` (`lida`);--> statement-breakpoint
CREATE INDEX `notification_created_at_idx` ON `notifications` (`createdAt`);--> statement-breakpoint
CREATE INDEX `notification_user_lida_idx` ON `notifications` (`userId`,`lida`);--> statement-breakpoint
ALTER TABLE `atividades_diarias` DROP COLUMN `documentacoesRecolhidas`;--> statement-breakpoint
ALTER TABLE `carteira_ativa` DROP COLUMN `dataInicio`;--> statement-breakpoint
ALTER TABLE `carteira_ativa` DROP COLUMN `dataExpiracao`;--> statement-breakpoint
ALTER TABLE `carteira_ativa` DROP COLUMN `totalRenovacoes`;--> statement-breakpoint
ALTER TABLE `carteira_ativa` DROP COLUMN `status_carteira`;--> statement-breakpoint
ALTER TABLE `carteira_ativa` DROP COLUMN `motivoEncerramento`;
CREATE TABLE `agendamentos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`leadId` int NOT NULL,
	`corretorId` int NOT NULL,
	`projectId` int,
	`projetoCustom` varchar(255),
	`construtora` varchar(255),
	`dataAgendamento` timestamp NOT NULL,
	`horaAgendamento` varchar(5) NOT NULL,
	`status` enum('pendente','confirmado','realizado','cancelado','reagendado') NOT NULL DEFAULT 'pendente',
	`observacoes` text,
	`criadoPorId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `agendamentos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `alertas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`leadId` int NOT NULL,
	`corretorId` int NOT NULL,
	`remetenteId` int NOT NULL,
	`mensagem` text NOT NULL,
	`lido` boolean NOT NULL DEFAULT false,
	`lidoEm` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `alertas_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `alertas_produtividade` (
	`id` int AUTO_INCREMENT NOT NULL,
	`corretorId` int NOT NULL,
	`data` timestamp NOT NULL,
	`tipo` enum('baixa_produtividade','meta_nao_atingida','inativo') NOT NULL,
	`mensagem` text NOT NULL,
	`percentualMeta` int NOT NULL DEFAULT 0,
	`lido` boolean NOT NULL DEFAULT false,
	`lidoPor` int,
	`lidoEm` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `alertas_produtividade_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
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
CREATE TABLE `atividades_diarias` (
	`id` int AUTO_INCREMENT NOT NULL,
	`corretorId` int NOT NULL,
	`data` timestamp NOT NULL,
	`clientesCadastrados` int NOT NULL DEFAULT 0,
	`alteracoesStatus` int NOT NULL DEFAULT 0,
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
CREATE TABLE `configuracao_pontuacao` (
	`id` int AUTO_INCREMENT NOT NULL,
	`pontosLigacao` int NOT NULL DEFAULT 1,
	`pontosLigacaoAtendida` int NOT NULL DEFAULT 2,
	`pontosWhatsapp` int NOT NULL DEFAULT 1,
	`pontosWhatsappRespondido` int NOT NULL DEFAULT 2,
	`pontosAgendamento` int NOT NULL DEFAULT 15,
	`pontosVisita` int NOT NULL DEFAULT 25,
	`pontosDocumentacao` int NOT NULL DEFAULT 35,
	`pontosVenda` int NOT NULL DEFAULT 80,
	`pontosClienteCadastrado` int NOT NULL DEFAULT 5,
	`pontosAlteracaoStatus` int NOT NULL DEFAULT 2,
	`atualizadoPor` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `configuracao_pontuacao_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `configuracao_projeto_foco` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projetoId` int,
	`corretoresIds` json,
	`posicaoAtual` int NOT NULL DEFAULT 0,
	`ativo` boolean NOT NULL DEFAULT true,
	`observacoes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `configuracao_projeto_foco_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `conquistas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`corretorId` int NOT NULL,
	`tipoConquistaId` int NOT NULL,
	`periodoInicio` timestamp,
	`periodoFim` timestamp,
	`valor` int,
	`posicao` int,
	`observacao` text,
	`notificado` boolean NOT NULL DEFAULT false,
	`notificadoEm` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `conquistas_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `construtoras` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nome` varchar(255) NOT NULL,
	`logoUrl` text,
	`ativo` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `construtoras_id` PRIMARY KEY(`id`)
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
CREATE TABLE `desbloqueio_corretor` (
	`id` int AUTO_INCREMENT NOT NULL,
	`corretor_id` int NOT NULL,
	`data` date NOT NULL,
	`desbloqueado_por` int,
	`motivo` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `desbloqueio_corretor_id` PRIMARY KEY(`id`)
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
CREATE TABLE `equipes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nome` varchar(255) NOT NULL,
	`descricao` text,
	`gestorId` int NOT NULL,
	`cor` varchar(7) NOT NULL DEFAULT '#3b82f6',
	`metaMensal` int NOT NULL DEFAULT 10,
	`ativa` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `equipes_id` PRIMARY KEY(`id`)
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
CREATE TABLE `fila_distribuicao` (
	`id` int AUTO_INCREMENT NOT NULL,
	`corretorId` int NOT NULL,
	`posicao` int NOT NULL,
	`ativo` boolean NOT NULL DEFAULT true,
	`maxLeadsDia` int NOT NULL DEFAULT 10,
	`leadsRecebidosHoje` int NOT NULL DEFAULT 0,
	`ultimaDistribuicao` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `fila_distribuicao_id` PRIMARY KEY(`id`),
	CONSTRAINT `fila_distribuicao_corretorId_unique` UNIQUE(`corretorId`)
);
--> statement-breakpoint
CREATE TABLE `follow_ups` (
	`id` int AUTO_INCREMENT NOT NULL,
	`leadId` int NOT NULL,
	`corretorId` int NOT NULL,
	`dataFollowUp` timestamp NOT NULL,
	`dataRegistro` timestamp,
	`resultado` enum('respondeu','nao_respondeu'),
	`observacao` text,
	`status` enum('pendente','concluido','cancelado') NOT NULL DEFAULT 'pendente',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `follow_ups_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `historico_atribuicoes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`leadId` int NOT NULL,
	`corretorId` int NOT NULL,
	`dataAtribuicao` timestamp NOT NULL DEFAULT (now()),
	`tipoAtribuicao` enum('distribuicao_inicial','redistribuicao_automatica','redistribuicao_manual','transferencia_inatividade') NOT NULL,
	`observacoes` text,
	CONSTRAINT `historico_atribuicoes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
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
CREATE TABLE `historicos_precos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projetoId` int NOT NULL,
	`mes` int NOT NULL,
	`ano` int NOT NULL,
	`precoMinimo` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `historicos_precos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `indicacoes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`indicadorId` int NOT NULL,
	`indicadoId` int NOT NULL,
	`codigoUsado` varchar(20) NOT NULL,
	`status` enum('pendente','confirmada','bonus_pago','cancelada') NOT NULL DEFAULT 'pendente',
	`valorBonus` int NOT NULL DEFAULT 50000,
	`dataPagamento` timestamp,
	`ip` varchar(45),
	`userAgent` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `indicacoes_id` PRIMARY KEY(`id`)
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
CREATE TABLE `lead_estoque` (
	`id` int AUTO_INCREMENT NOT NULL,
	`leadId` int NOT NULL,
	`tipoFila` enum('normal','foco') NOT NULL DEFAULT 'normal',
	`motivoEstoque` text,
	`tentativasDistribuicao` int NOT NULL DEFAULT 0,
	`ultimaTentativa` timestamp,
	`status` enum('aguardando','distribuido','cancelado') NOT NULL DEFAULT 'aguardando',
	`criadoEm` timestamp NOT NULL DEFAULT (now()),
	`distribuidoEm` timestamp,
	`distribuidoParaCorretorId` int,
	CONSTRAINT `lead_estoque_id` PRIMARY KEY(`id`)
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
CREATE TABLE `lead_status_transitions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`leadId` int NOT NULL,
	`corretorId` int NOT NULL,
	`statusAnterior` enum('novo','aguardando_atendimento','em_atendimento','agendado','visita_realizada','analise_credito','contrato_fechado','perdido') NOT NULL,
	`statusNovo` enum('novo','aguardando_atendimento','em_atendimento','agendado','visita_realizada','analise_credito','contrato_fechado','perdido') NOT NULL,
	`observacao` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `lead_status_transitions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `leads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`idPrincipal` varchar(50),
	`nome` varchar(255) NOT NULL,
	`email` varchar(320),
	`telefone` varchar(20) NOT NULL,
	`cpf` varchar(14),
	`origem` enum('facebook','google_sheets','site','indicacao','captacao_corretor','whatsapp','telefone','plantao','agendamento_self_service','chatbot','outro') DEFAULT 'outro',
	`projectId` int,
	`projetoCustom` varchar(255),
	`corretorId` int,
	`dataDistribuicao` timestamp,
	`timestampRecebimento` timestamp,
	`timerAtivo` boolean DEFAULT false,
	`tentativasRedistribuicao` int DEFAULT 0,
	`status` enum('novo','aguardando_atendimento','em_atendimento','agendado','visita_realizada','analise_credito','contrato_fechado','perdido') NOT NULL DEFAULT 'novo',
	`proximoFollowup` timestamp,
	`diasFollowupConsecutivos` int NOT NULL DEFAULT 0,
	`ultimoContato` timestamp,
	`ultimaInteracao` timestamp,
	`proximaTarefaData` timestamp,
	`observacoes` text,
	`motivoPerdido` text,
	`naLixeira` boolean NOT NULL DEFAULT false,
	`dataMovidoLixeira` timestamp,
	`corretorAnteriorId` int,
	`corretoresQueTentaram` text,
	`campanha` varchar(255),
	`faixaRenda` varchar(100),
	`prefereContatoPor` varchar(50),
	`finalidadeImovel` varchar(50),
	`dataHoraCriacao` timestamp,
	`origemWebhook` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `leads_id` PRIMARY KEY(`id`),
	CONSTRAINT `leads_idPrincipal_unique` UNIQUE(`idPrincipal`)
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
--> statement-breakpoint
CREATE TABLE `logs_sincronizacao` (
	`id` int AUTO_INCREMENT NOT NULL,
	`status` enum('sucesso','erro','aviso') NOT NULL,
	`mensagem` text NOT NULL,
	`detalhes` text,
	`tabeloesProcessados` int,
	`projetosExtraidos` int,
	`materiaisExtraidos` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `logs_sincronizacao_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `materiais` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projetoId` int NOT NULL,
	`tipo` enum('book','foto','tabela','outro') NOT NULL,
	`nome` varchar(255) NOT NULL,
	`driveUrl` text,
	`s3Url` text,
	`fileKey` varchar(500),
	`mimeType` varchar(100),
	`tamanho` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `materiais_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `metas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`corretorId` int NOT NULL,
	`mes` int NOT NULL,
	`ano` int NOT NULL,
	`metaLeads` int NOT NULL DEFAULT 0,
	`metaAgendamentos` int NOT NULL DEFAULT 0,
	`metaVisitas` int NOT NULL DEFAULT 0,
	`metaContratos` int NOT NULL DEFAULT 0,
	`metaVGV` int NOT NULL DEFAULT 0,
	`observacoes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `metas_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `metas_diarias` (
	`id` int AUTO_INCREMENT NOT NULL,
	`corretorId` int NOT NULL,
	`metaLigacoes` int NOT NULL DEFAULT 20,
	`metaWhatsapp` int NOT NULL DEFAULT 30,
	`metaAgendamentos` int NOT NULL DEFAULT 3,
	`metaVisitas` int NOT NULL DEFAULT 2,
	`metaDocumentacoes` int NOT NULL DEFAULT 1,
	`metaVendas` int NOT NULL DEFAULT 1,
	`ativo` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `metas_diarias_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `metas_globais` (
	`id` int AUTO_INCREMENT NOT NULL,
	`mes` int NOT NULL,
	`ano` int NOT NULL,
	`metaVGV` decimal(15,2) DEFAULT '0',
	`metaContratos` int DEFAULT 0,
	`metaLeads` int DEFAULT 0,
	`metaAgendamentos` int DEFAULT 0,
	`metaVisitas` int DEFAULT 0,
	`observacoes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `metas_globais_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
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
--> statement-breakpoint
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
CREATE TABLE `projects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nome` varchar(255) NOT NULL,
	`construtora` varchar(255),
	`endereco` text,
	`bairro` varchar(100),
	`cidade` varchar(100) NOT NULL DEFAULT 'Su00e3o Paulo',
	`estado` varchar(2) NOT NULL DEFAULT 'SP',
	`descricao` text,
	`tipo` enum('mcmv','sfh','outro') NOT NULL DEFAULT 'mcmv',
	`status` enum('ativo','inativo','esgotado') NOT NULL DEFAULT 'ativo',
	`valorMinimo` int,
	`valorMaximo` int,
	`metragemMinima` int,
	`metragemMaxima` int,
	`dormitorios` varchar(50),
	`vagas` int DEFAULT 0,
	`zona` enum('norte','sul','leste','oeste','centro'),
	`enquadramento` enum('HIS1','HIS2','HMP','R2V'),
	`developer` varchar(255),
	`logoUrl` text,
	`imagemPrincipal` text,
	`imagensAdicionais` text,
	`bookUrl` text,
	`construtoraId` int,
	`imagemCapaUrl` text,
	`bookPdfUrl` text,
	`linkMateriais` text,
	`regiao` varchar(255),
	`latitude` decimal(10,8),
	`longitude` decimal(11,8),
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
	`tabelaPagamento` text,
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
CREATE TABLE `push_subscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`endpoint` text NOT NULL,
	`p256dh` text NOT NULL,
	`auth` text NOT NULL,
	`userAgent` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`lastUsedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `push_subscriptions_id` PRIMARY KEY(`id`)
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
CREATE TABLE `tabeloes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`construtoraId` int NOT NULL,
	`mes` int NOT NULL,
	`ano` int NOT NULL,
	`drivePdfUrl` text,
	`s3PdfUrl` text,
	`fileKey` varchar(500),
	`statusProcessamento` enum('pendente','processando','concluido','erro') NOT NULL DEFAULT 'pendente',
	`mensagemErro` text,
	`totalProjetos` int,
	`totalLinks` int,
	`processadoEm` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `tabeloes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tarefas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`corretorId` int NOT NULL,
	`leadId` int,
	`titulo` varchar(255) NOT NULL,
	`descricao` text,
	`tipo` enum('follow_up','agendamento','ligacao','whatsapp','email','visita','documentacao','outro') NOT NULL DEFAULT 'outro',
	`dataAgendada` timestamp NOT NULL,
	`status` enum('pendente','concluida','cancelada') NOT NULL DEFAULT 'pendente',
	`prioridade` enum('baixa','media','alta') NOT NULL DEFAULT 'media',
	`concluidaEm` timestamp,
	`observacoesConclusao` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tarefas_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tipos_conquista` (
	`id` int AUTO_INCREMENT NOT NULL,
	`codigo` varchar(50) NOT NULL,
	`nome` varchar(100) NOT NULL,
	`descricao` text,
	`icone` varchar(50) NOT NULL DEFAULT 'trophy',
	`cor` varchar(20) NOT NULL DEFAULT 'gold',
	`categoria` enum('vendas','produtividade','streak','especial') NOT NULL DEFAULT 'vendas',
	`criterioTipo` enum('meta_semanal','meta_mensal','ranking_semanal','ranking_mensal','streak_dias','total_vendas','total_leads','manual') NOT NULL,
	`criterioValor` int NOT NULL DEFAULT 1,
	`ativo` boolean NOT NULL DEFAULT true,
	`recorrente` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tipos_conquista_id` PRIMARY KEY(`id`),
	CONSTRAINT `tipos_conquista_codigo_unique` UNIQUE(`codigo`)
);
--> statement-breakpoint
CREATE TABLE `transfer_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tipo` enum('lead','contrato') NOT NULL,
	`leadId` int,
	`contratoId` int,
	`corretorAnteriorId` int NOT NULL,
	`corretorNovoId` int NOT NULL,
	`transferidoPorId` int NOT NULL,
	`motivo` text,
	`observacoes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `transfer_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('admin','gestor','corretor') NOT NULL DEFAULT 'corretor',
	`status` enum('presente','ausente') NOT NULL DEFAULT 'ausente',
	`telefone` varchar(20),
	`fotoUrl` text,
	`cpf` varchar(14),
	`dataNascimento` timestamp,
	`creci` varchar(20),
	`dataCredenciamento` timestamp,
	`dataDescredenciamento` timestamp,
	`situacao` enum('ativo','inativo') NOT NULL DEFAULT 'ativo',
	`logradouro` varchar(255),
	`numero` varchar(20),
	`complemento` varchar(100),
	`bairro` varchar(100),
	`cidade` varchar(100),
	`estado` varchar(2),
	`cep` varchar(9),
	`googleCalendarId` varchar(255),
	`googleRefreshToken` text,
	`googleCalendarEnabled` boolean NOT NULL DEFAULT false,
	`codigoIndicacao` varchar(20),
	`indicadoPorId` int,
	`limiteDiarioLeads` int NOT NULL DEFAULT 50,
	`limiteDiarioWebhook` int NOT NULL DEFAULT 10,
	`ultimoDesbloqueio` timestamp,
	`equipeId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`),
	CONSTRAINT `users_codigoIndicacao_unique` UNIQUE(`codigoIndicacao`)
);
--> statement-breakpoint
CREATE TABLE `visitas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`leadId` int NOT NULL,
	`corretorId` int NOT NULL,
	`agendamentoId` int,
	`projectId` int,
	`projetoCustom` varchar(255),
	`construtora` varchar(255),
	`dataVisita` timestamp NOT NULL,
	`horaVisita` varchar(5),
	`resultado` enum('interesse_alto','interesse_medio','interesse_baixo','sem_interesse','pendente_documentacao','encaminhado_analise') NOT NULL DEFAULT 'interesse_medio',
	`observacoes` text,
	`registradoPorId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `visitas_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `webhook_config` (
	`id` int AUTO_INCREMENT NOT NULL,
	`webhookToken` varchar(64) NOT NULL,
	`nome` varchar(100) NOT NULL,
	`fonte` enum('facebook','instagram','google','rdstation','outro') NOT NULL DEFAULT 'facebook',
	`tipoFila` enum('geral','foco') NOT NULL DEFAULT 'geral',
	`projectIdPadrao` int,
	`formIdMapping` text,
	`ativo` boolean NOT NULL DEFAULT true,
	`leadsRecebidos` int NOT NULL DEFAULT 0,
	`ultimoLeadRecebido` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `webhook_config_id` PRIMARY KEY(`id`),
	CONSTRAINT `webhook_config_webhookToken_unique` UNIQUE(`webhookToken`)
);
--> statement-breakpoint
ALTER TABLE `alertas` ADD CONSTRAINT `alertas_leadId_leads_id_fk` FOREIGN KEY (`leadId`) REFERENCES `leads`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `alertas` ADD CONSTRAINT `alertas_corretorId_users_id_fk` FOREIGN KEY (`corretorId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `alertas` ADD CONSTRAINT `alertas_remetenteId_users_id_fk` FOREIGN KEY (`remetenteId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `analises_credito` ADD CONSTRAINT `analises_credito_leadId_leads_id_fk` FOREIGN KEY (`leadId`) REFERENCES `leads`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `analises_credito` ADD CONSTRAINT `analises_credito_corretorId_users_id_fk` FOREIGN KEY (`corretorId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `contratos` ADD CONSTRAINT `contratos_leadId_leads_id_fk` FOREIGN KEY (`leadId`) REFERENCES `leads`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `contratos` ADD CONSTRAINT `contratos_corretorId_users_id_fk` FOREIGN KEY (`corretorId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `desbloqueio_corretor` ADD CONSTRAINT `desbloqueio_corretor_corretor_id_users_id_fk` FOREIGN KEY (`corretor_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `desbloqueio_corretor` ADD CONSTRAINT `desbloqueio_corretor_desbloqueado_por_users_id_fk` FOREIGN KEY (`desbloqueado_por`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `documentacoes` ADD CONSTRAINT `documentacoes_leadId_leads_id_fk` FOREIGN KEY (`leadId`) REFERENCES `leads`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `documentacoes` ADD CONSTRAINT `documentacoes_corretorId_users_id_fk` FOREIGN KEY (`corretorId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `historico_atribuicoes` ADD CONSTRAINT `historico_atribuicoes_leadId_leads_id_fk` FOREIGN KEY (`leadId`) REFERENCES `leads`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `historico_atribuicoes` ADD CONSTRAINT `historico_atribuicoes_corretorId_users_id_fk` FOREIGN KEY (`corretorId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `historicos_precos` ADD CONSTRAINT `historicos_precos_projetoId_projects_id_fk` FOREIGN KEY (`projetoId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `interacoes` ADD CONSTRAINT `interacoes_leadId_leads_id_fk` FOREIGN KEY (`leadId`) REFERENCES `leads`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `interacoes` ADD CONSTRAINT `interacoes_corretorId_users_id_fk` FOREIGN KEY (`corretorId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `lead_estoque` ADD CONSTRAINT `lead_estoque_leadId_leads_id_fk` FOREIGN KEY (`leadId`) REFERENCES `leads`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `materiais` ADD CONSTRAINT `materiais_projetoId_projects_id_fk` FOREIGN KEY (`projetoId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `projects` ADD CONSTRAINT `projects_construtoraId_construtoras_id_fk` FOREIGN KEY (`construtoraId`) REFERENCES `construtoras`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `push_subscriptions` ADD CONSTRAINT `push_subscriptions_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tabeloes` ADD CONSTRAINT `tabeloes_construtoraId_construtoras_id_fk` FOREIGN KEY (`construtoraId`) REFERENCES `construtoras`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `transfer_history` ADD CONSTRAINT `transfer_history_corretorAnteriorId_users_id_fk` FOREIGN KEY (`corretorAnteriorId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `transfer_history` ADD CONSTRAINT `transfer_history_corretorNovoId_users_id_fk` FOREIGN KEY (`corretorNovoId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `transfer_history` ADD CONSTRAINT `transfer_history_transferidoPorId_users_id_fk` FOREIGN KEY (`transferidoPorId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `agendamento_lead_idx` ON `agendamentos` (`leadId`);--> statement-breakpoint
CREATE INDEX `agendamento_corretor_idx` ON `agendamentos` (`corretorId`);--> statement-breakpoint
CREATE INDEX `agendamento_data_idx` ON `agendamentos` (`dataAgendamento`);--> statement-breakpoint
CREATE INDEX `agendamento_status_idx` ON `agendamentos` (`status`);--> statement-breakpoint
CREATE INDEX `alertas_corretor_idx` ON `alertas` (`corretorId`);--> statement-breakpoint
CREATE INDEX `alertas_lido_idx` ON `alertas` (`lido`);--> statement-breakpoint
CREATE INDEX `alertas_created_at_idx` ON `alertas` (`createdAt`);--> statement-breakpoint
CREATE INDEX `alertas_corretor_idx` ON `alertas_produtividade` (`corretorId`);--> statement-breakpoint
CREATE INDEX `alertas_data_idx` ON `alertas_produtividade` (`data`);--> statement-breakpoint
CREATE INDEX `alertas_lido_idx` ON `alertas_produtividade` (`lido`);--> statement-breakpoint
CREATE INDEX `analises_credito_lead_idx` ON `analises_credito` (`leadId`);--> statement-breakpoint
CREATE INDEX `analises_credito_corretor_idx` ON `analises_credito` (`corretorId`);--> statement-breakpoint
CREATE INDEX `analises_credito_created_at_idx` ON `analises_credito` (`createdAt`);--> statement-breakpoint
CREATE INDEX `atividades_corretor_idx` ON `atividades_diarias` (`corretorId`);--> statement-breakpoint
CREATE INDEX `atividades_data_idx` ON `atividades_diarias` (`data`);--> statement-breakpoint
CREATE INDEX `atividades_corretor_data_idx` ON `atividades_diarias` (`corretorId`,`data`);--> statement-breakpoint
CREATE INDEX `bloqueios_corretor_idx` ON `bloqueios_agenda` (`corretorId`);--> statement-breakpoint
CREATE INDEX `bloqueios_data_inicio_idx` ON `bloqueios_agenda` (`dataInicio`);--> statement-breakpoint
CREATE INDEX `bloqueios_data_fim_idx` ON `bloqueios_agenda` (`dataFim`);--> statement-breakpoint
CREATE INDEX `config_projeto_foco_projeto_idx` ON `configuracao_projeto_foco` (`projetoId`);--> statement-breakpoint
CREATE INDEX `conquistas_corretor_idx` ON `conquistas` (`corretorId`);--> statement-breakpoint
CREATE INDEX `conquistas_tipo_idx` ON `conquistas` (`tipoConquistaId`);--> statement-breakpoint
CREATE INDEX `conquistas_periodo_idx` ON `conquistas` (`periodoInicio`,`periodoFim`);--> statement-breakpoint
CREATE INDEX `construtoras_nome_idx` ON `construtoras` (`nome`);--> statement-breakpoint
CREATE INDEX `contratos_lead_idx` ON `contratos` (`leadId`);--> statement-breakpoint
CREATE INDEX `contratos_corretor_idx` ON `contratos` (`corretorId`);--> statement-breakpoint
CREATE INDEX `contratos_created_at_idx` ON `contratos` (`createdAt`);--> statement-breakpoint
CREATE INDEX `conversas_session_idx` ON `conversas_chatbot` (`sessionId`);--> statement-breakpoint
CREATE INDEX `conversas_status_idx` ON `conversas_chatbot` (`status`);--> statement-breakpoint
CREATE INDEX `conversas_lead_idx` ON `conversas_chatbot` (`leadId`);--> statement-breakpoint
CREATE INDEX `disponibilidade_corretor_idx` ON `disponibilidade_corretor` (`corretorId`);--> statement-breakpoint
CREATE INDEX `disponibilidade_dia_idx` ON `disponibilidade_corretor` (`diaSemana`);--> statement-breakpoint
CREATE INDEX `documentacoes_lead_idx` ON `documentacoes` (`leadId`);--> statement-breakpoint
CREATE INDEX `documentacoes_corretor_idx` ON `documentacoes` (`corretorId`);--> statement-breakpoint
CREATE INDEX `documentacoes_created_at_idx` ON `documentacoes` (`createdAt`);--> statement-breakpoint
CREATE INDEX `equipe_gestor_idx` ON `equipes` (`gestorId`);--> statement-breakpoint
CREATE INDEX `equipe_ativa_idx` ON `equipes` (`ativa`);--> statement-breakpoint
CREATE INDEX `faq_categoria_idx` ON `faq_chatbot` (`categoria`);--> statement-breakpoint
CREATE INDEX `faq_project_idx` ON `faq_chatbot` (`projectId`);--> statement-breakpoint
CREATE INDEX `posicao_idx` ON `fila_distribuicao` (`posicao`);--> statement-breakpoint
CREATE INDEX `followup_lead_idx` ON `follow_ups` (`leadId`);--> statement-breakpoint
CREATE INDEX `followup_corretor_idx` ON `follow_ups` (`corretorId`);--> statement-breakpoint
CREATE INDEX `followup_data_idx` ON `follow_ups` (`dataFollowUp`);--> statement-breakpoint
CREATE INDEX `followup_status_idx` ON `follow_ups` (`status`);--> statement-breakpoint
CREATE INDEX `historico_atribuicoes_lead_corretor_idx` ON `historico_atribuicoes` (`leadId`,`corretorId`);--> statement-breakpoint
CREATE INDEX `historico_atribuicoes_lead_idx` ON `historico_atribuicoes` (`leadId`);--> statement-breakpoint
CREATE INDEX `historico_atribuicoes_corretor_idx` ON `historico_atribuicoes` (`corretorId`);--> statement-breakpoint
CREATE INDEX `presenca_corretor_idx` ON `historico_presenca` (`corretorId`);--> statement-breakpoint
CREATE INDEX `presenca_data_hora_idx` ON `historico_presenca` (`dataHora`);--> statement-breakpoint
CREATE INDEX `presenca_tipo_idx` ON `historico_presenca` (`tipo`);--> statement-breakpoint
CREATE INDEX `presenca_corretor_data_idx` ON `historico_presenca` (`corretorId`,`dataHora`);--> statement-breakpoint
CREATE INDEX `historicos_precos_projeto_idx` ON `historicos_precos` (`projetoId`);--> statement-breakpoint
CREATE INDEX `historicos_precos_mes_ano_idx` ON `historicos_precos` (`mes`,`ano`);--> statement-breakpoint
CREATE INDEX `indicacoes_indicador_idx` ON `indicacoes` (`indicadorId`);--> statement-breakpoint
CREATE INDEX `indicacoes_indicado_idx` ON `indicacoes` (`indicadoId`);--> statement-breakpoint
CREATE INDEX `indicacoes_status_idx` ON `indicacoes` (`status`);--> statement-breakpoint
CREATE INDEX `interacoes_lead_idx` ON `interacoes` (`leadId`);--> statement-breakpoint
CREATE INDEX `interacoes_corretor_idx` ON `interacoes` (`corretorId`);--> statement-breakpoint
CREATE INDEX `interacoes_tipo_idx` ON `interacoes` (`tipo`);--> statement-breakpoint
CREATE INDEX `interacoes_created_at_idx` ON `interacoes` (`createdAt`);--> statement-breakpoint
CREATE INDEX `lead_estoque_lead_idx` ON `lead_estoque` (`leadId`);--> statement-breakpoint
CREATE INDEX `lead_estoque_status_idx` ON `lead_estoque` (`status`);--> statement-breakpoint
CREATE INDEX `lead_estoque_tipo_fila_idx` ON `lead_estoque` (`tipoFila`);--> statement-breakpoint
CREATE INDEX `transition_lead_idx` ON `lead_status_transitions` (`leadId`);--> statement-breakpoint
CREATE INDEX `transition_corretor_idx` ON `lead_status_transitions` (`corretorId`);--> statement-breakpoint
CREATE INDEX `transition_status_novo_idx` ON `lead_status_transitions` (`statusNovo`);--> statement-breakpoint
CREATE INDEX `transition_created_idx` ON `lead_status_transitions` (`createdAt`);--> statement-breakpoint
CREATE INDEX `telefone_idx` ON `leads` (`telefone`);--> statement-breakpoint
CREATE INDEX `corretor_idx` ON `leads` (`corretorId`);--> statement-breakpoint
CREATE INDEX `status_idx` ON `leads` (`status`);--> statement-breakpoint
CREATE INDEX `project_idx` ON `leads` (`projectId`);--> statement-breakpoint
CREATE INDEX `lead_cpf_idx` ON `leads` (`cpf`);--> statement-breakpoint
CREATE INDEX `lead_email_idx` ON `leads` (`email`);--> statement-breakpoint
CREATE INDEX `lead_lixeira_idx` ON `leads` (`naLixeira`);--> statement-breakpoint
CREATE INDEX `lead_proximo_followup_idx` ON `leads` (`proximoFollowup`);--> statement-breakpoint
CREATE INDEX `lead_ultima_interacao_idx` ON `leads` (`ultimaInteracao`);--> statement-breakpoint
CREATE INDEX `lead_corretor_status_idx` ON `leads` (`corretorId`,`status`);--> statement-breakpoint
CREATE INDEX `links_corretor_idx` ON `links_agendamento` (`corretorId`);--> statement-breakpoint
CREATE INDEX `links_token_idx` ON `links_agendamento` (`token`);--> statement-breakpoint
CREATE INDEX `logs_sincronizacao_status_idx` ON `logs_sincronizacao` (`status`);--> statement-breakpoint
CREATE INDEX `logs_sincronizacao_created_at_idx` ON `logs_sincronizacao` (`createdAt`);--> statement-breakpoint
CREATE INDEX `materiais_projeto_idx` ON `materiais` (`projetoId`);--> statement-breakpoint
CREATE INDEX `materiais_tipo_idx` ON `materiais` (`tipo`);--> statement-breakpoint
CREATE INDEX `corretor_mes_ano_idx` ON `metas` (`corretorId`,`mes`,`ano`);--> statement-breakpoint
CREATE INDEX `metas_diarias_corretor_idx` ON `metas_diarias` (`corretorId`);--> statement-breakpoint
CREATE INDEX `metas_globais_mes_ano_idx` ON `metas_globais` (`mes`,`ano`);--> statement-breakpoint
CREATE INDEX `project_status_idx` ON `projects` (`status`);--> statement-breakpoint
CREATE INDEX `project_tipo_idx` ON `projects` (`tipo`);--> statement-breakpoint
CREATE INDEX `project_zona_idx` ON `projects` (`zona`);--> statement-breakpoint
CREATE INDEX `project_cidade_idx` ON `projects` (`cidade`);--> statement-breakpoint
CREATE INDEX `project_nome_idx` ON `projects` (`nome`);--> statement-breakpoint
CREATE INDEX `propostas_lead_idx` ON `propostas` (`leadId`);--> statement-breakpoint
CREATE INDEX `propostas_corretor_idx` ON `propostas` (`corretorId`);--> statement-breakpoint
CREATE INDEX `propostas_project_idx` ON `propostas` (`projectId`);--> statement-breakpoint
CREATE INDEX `propostas_token_idx` ON `propostas` (`token`);--> statement-breakpoint
CREATE INDEX `propostas_status_idx` ON `propostas` (`status`);--> statement-breakpoint
CREATE INDEX `propostas_visitantes_proposta_idx` ON `propostas_visitantes` (`propostaId`);--> statement-breakpoint
CREATE INDEX `propostas_visitantes_visitor_idx` ON `propostas_visitantes` (`visitorId`);--> statement-breakpoint
CREATE INDEX `propostas_visitantes_unique` ON `propostas_visitantes` (`propostaId`,`visitorId`);--> statement-breakpoint
CREATE INDEX `resumo_presenca_corretor_idx` ON `resumo_presenca_diaria` (`corretorId`);--> statement-breakpoint
CREATE INDEX `resumo_presenca_data_idx` ON `resumo_presenca_diaria` (`data`);--> statement-breakpoint
CREATE INDEX `resumo_presenca_corretor_data_idx` ON `resumo_presenca_diaria` (`corretorId`,`data`);--> statement-breakpoint
CREATE INDEX `tabeloes_construtora_idx` ON `tabeloes` (`construtoraId`);--> statement-breakpoint
CREATE INDEX `tabeloes_mes_ano_idx` ON `tabeloes` (`mes`,`ano`);--> statement-breakpoint
CREATE INDEX `tabeloes_status_idx` ON `tabeloes` (`statusProcessamento`);--> statement-breakpoint
CREATE INDEX `tarefa_corretor_idx` ON `tarefas` (`corretorId`);--> statement-breakpoint
CREATE INDEX `tarefa_lead_idx` ON `tarefas` (`leadId`);--> statement-breakpoint
CREATE INDEX `tarefa_data_idx` ON `tarefas` (`dataAgendada`);--> statement-breakpoint
CREATE INDEX `tarefa_status_idx` ON `tarefas` (`status`);--> statement-breakpoint
CREATE INDEX `transfer_lead_idx` ON `transfer_history` (`leadId`);--> statement-breakpoint
CREATE INDEX `transfer_contrato_idx` ON `transfer_history` (`contratoId`);--> statement-breakpoint
CREATE INDEX `transfer_corretor_anterior_idx` ON `transfer_history` (`corretorAnteriorId`);--> statement-breakpoint
CREATE INDEX `transfer_corretor_novo_idx` ON `transfer_history` (`corretorNovoId`);--> statement-breakpoint
CREATE INDEX `transfer_created_at_idx` ON `transfer_history` (`createdAt`);--> statement-breakpoint
CREATE INDEX `user_email_idx` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `user_cpf_idx` ON `users` (`cpf`);--> statement-breakpoint
CREATE INDEX `user_role_idx` ON `users` (`role`);--> statement-breakpoint
CREATE INDEX `user_status_idx` ON `users` (`status`);--> statement-breakpoint
CREATE INDEX `user_situacao_idx` ON `users` (`situacao`);--> statement-breakpoint
CREATE INDEX `user_equipe_idx` ON `users` (`equipeId`);--> statement-breakpoint
CREATE INDEX `visita_lead_idx` ON `visitas` (`leadId`);--> statement-breakpoint
CREATE INDEX `visita_corretor_idx` ON `visitas` (`corretorId`);--> statement-breakpoint
CREATE INDEX `visita_data_idx` ON `visitas` (`dataVisita`);--> statement-breakpoint
CREATE INDEX `visita_agendamento_idx` ON `visitas` (`agendamentoId`);
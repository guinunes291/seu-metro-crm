CREATE TABLE IF NOT EXISTS `objecoes_playbook` (
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

CREATE INDEX IF NOT EXISTS `objecao_fase_idx` ON `objecoes_playbook` (`faseSlug`);
CREATE INDEX IF NOT EXISTS `objecao_tipo_idx` ON `objecoes_playbook` (`tipoObjecao`);
CREATE INDEX IF NOT EXISTS `objecao_temp_idx` ON `objecoes_playbook` (`temperatura`);

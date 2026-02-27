ALTER TABLE `contratos` ADD `percentualCorretor` decimal(5,2) DEFAULT '1.85';--> statement-breakpoint
ALTER TABLE `contratos` ADD `percentualGerente` decimal(5,2) DEFAULT '0.50';--> statement-breakpoint
ALTER TABLE `contratos` ADD `percentualSuperintendente` decimal(5,2) DEFAULT '0.30';
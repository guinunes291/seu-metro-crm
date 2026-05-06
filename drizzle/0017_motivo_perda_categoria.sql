-- Adiciona coluna motivoPerdaCategoria como campo estruturado de motivo de perda
-- Campo nullable para não afetar dados existentes
ALTER TABLE `leads` ADD COLUMN `motivoPerdaCategoria` varchar(50) NULL;
--> statement-breakpoint
CREATE INDEX `leads_motivo_perda_idx` ON `leads` (`motivoPerdaCategoria`);

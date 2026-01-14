DROP INDEX `followup_proxima_idx` ON `follow_ups`;--> statement-breakpoint
ALTER TABLE `follow_ups` MODIFY COLUMN `status` enum('pendente','concluido') NOT NULL DEFAULT 'pendente';--> statement-breakpoint
ALTER TABLE `follow_ups` ADD `dataFollowUp` timestamp NOT NULL;--> statement-breakpoint
ALTER TABLE `follow_ups` ADD `dataRegistro` timestamp;--> statement-breakpoint
ALTER TABLE `leads` ADD `diasFollowupConsecutivos` int DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `followup_data_idx` ON `follow_ups` (`dataFollowUp`);--> statement-breakpoint
ALTER TABLE `follow_ups` DROP COLUMN `proximaTentativa`;--> statement-breakpoint
ALTER TABLE `follow_ups` DROP COLUMN `ultimaTentativa`;--> statement-breakpoint
ALTER TABLE `leads` DROP COLUMN `dataUltimaInteracao`;--> statement-breakpoint
ALTER TABLE `leads` DROP COLUMN `aguardandoTransferencia`;
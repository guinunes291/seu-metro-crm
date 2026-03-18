ALTER TABLE `equipes` ADD `superintendenteId` int;--> statement-breakpoint
CREATE INDEX `equipe_superintendente_idx` ON `equipes` (`superintendenteId`);
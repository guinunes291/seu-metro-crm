ALTER TABLE `users` MODIFY COLUMN `limiteDiarioLeads` int NOT NULL DEFAULT 50;--> statement-breakpoint
ALTER TABLE `users` ADD `limiteDiarioWebhook` int DEFAULT 10 NOT NULL;
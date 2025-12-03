ALTER TABLE `projects` MODIFY COLUMN `zona` enum('norte','sul','leste','oeste','centro');--> statement-breakpoint
ALTER TABLE `projects` MODIFY COLUMN `vagas` int;--> statement-breakpoint
ALTER TABLE `projects` MODIFY COLUMN `vagas` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `projects` ADD `enquadramento` enum('HIS1','HIS2','HMP','R2V');--> statement-breakpoint
ALTER TABLE `projects` ADD `developer` varchar(255);
CREATE TABLE `escolha_diaria_follow_up` (
	`id` int AUTO_INCREMENT NOT NULL,
	`corretorId` int NOT NULL,
	`data` timestamp NOT NULL,
	`aceitouFollowUp` boolean NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `escolha_diaria_follow_up_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `escolha_diaria_follow_up` ADD CONSTRAINT `escolha_diaria_follow_up_corretorId_users_id_fk` FOREIGN KEY (`corretorId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `escolha_corretor_data_idx` ON `escolha_diaria_follow_up` (`corretorId`,`data`);--> statement-breakpoint
CREATE INDEX `escolha_corretor_idx` ON `escolha_diaria_follow_up` (`corretorId`);
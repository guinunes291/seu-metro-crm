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
ALTER TABLE `desbloqueio_corretor` ADD CONSTRAINT `desbloqueio_corretor_corretor_id_users_id_fk` FOREIGN KEY (`corretor_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `desbloqueio_corretor` ADD CONSTRAINT `desbloqueio_corretor_desbloqueado_por_users_id_fk` FOREIGN KEY (`desbloqueado_por`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;
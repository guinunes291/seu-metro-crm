ALTER TABLE `users` ADD `cpf` varchar(14);--> statement-breakpoint
ALTER TABLE `users` ADD `dataNascimento` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `creci` varchar(20);--> statement-breakpoint
ALTER TABLE `users` ADD `dataCredenciamento` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `dataDescredenciamento` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `situacao` enum('ativo','inativo') DEFAULT 'ativo' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `logradouro` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `numero` varchar(20);--> statement-breakpoint
ALTER TABLE `users` ADD `complemento` varchar(100);--> statement-breakpoint
ALTER TABLE `users` ADD `bairro` varchar(100);--> statement-breakpoint
ALTER TABLE `users` ADD `cidade` varchar(100);--> statement-breakpoint
ALTER TABLE `users` ADD `estado` varchar(2);--> statement-breakpoint
ALTER TABLE `users` ADD `cep` varchar(9);
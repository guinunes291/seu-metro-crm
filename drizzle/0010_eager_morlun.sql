ALTER TABLE `users` ADD `equipeId` int;--> statement-breakpoint
CREATE INDEX `user_equipe_idx` ON `users` (`equipeId`);
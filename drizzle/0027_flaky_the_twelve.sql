ALTER TABLE `users` ADD `googleCalendarId` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `googleRefreshToken` text;--> statement-breakpoint
ALTER TABLE `users` ADD `googleCalendarEnabled` boolean DEFAULT false NOT NULL;
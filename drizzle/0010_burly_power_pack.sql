ALTER TABLE `contratos` ADD `distrato` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `contratos` ADD `dataDistrato` timestamp;--> statement-breakpoint
ALTER TABLE `contratos` ADD `motivoDistrato` text;--> statement-breakpoint
ALTER TABLE `contratos` ADD `distratadoPorId` int;
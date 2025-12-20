ALTER TABLE `leads` ADD `naLixeira` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `leads` ADD `dataMovidoLixeira` timestamp;--> statement-breakpoint
ALTER TABLE `leads` ADD `corretorAnteriorId` int;
ALTER TABLE `leads` ADD `timestampRecebimento` timestamp;--> statement-breakpoint
ALTER TABLE `leads` ADD `timerAtivo` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `leads` ADD `tentativasRedistribuicao` int DEFAULT 0;
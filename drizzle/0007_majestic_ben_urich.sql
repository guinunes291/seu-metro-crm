CREATE INDEX `lead_cpf_idx` ON `leads` (`cpf`);--> statement-breakpoint
CREATE INDEX `lead_email_idx` ON `leads` (`email`);--> statement-breakpoint
CREATE INDEX `lead_lixeira_idx` ON `leads` (`naLixeira`);--> statement-breakpoint
CREATE INDEX `lead_proximo_followup_idx` ON `leads` (`proximoFollowup`);--> statement-breakpoint
CREATE INDEX `lead_ultima_interacao_idx` ON `leads` (`ultimaInteracao`);--> statement-breakpoint
CREATE INDEX `lead_corretor_status_idx` ON `leads` (`corretorId`,`status`);--> statement-breakpoint
CREATE INDEX `project_status_idx` ON `projects` (`status`);--> statement-breakpoint
CREATE INDEX `project_tipo_idx` ON `projects` (`tipo`);--> statement-breakpoint
CREATE INDEX `project_zona_idx` ON `projects` (`zona`);--> statement-breakpoint
CREATE INDEX `project_cidade_idx` ON `projects` (`cidade`);--> statement-breakpoint
CREATE INDEX `project_nome_idx` ON `projects` (`nome`);--> statement-breakpoint
CREATE INDEX `user_email_idx` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `user_cpf_idx` ON `users` (`cpf`);--> statement-breakpoint
CREATE INDEX `user_role_idx` ON `users` (`role`);--> statement-breakpoint
CREATE INDEX `user_status_idx` ON `users` (`status`);--> statement-breakpoint
CREATE INDEX `user_situacao_idx` ON `users` (`situacao`);
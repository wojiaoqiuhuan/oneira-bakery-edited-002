ALTER TABLE `oneira_operation_summaries` MODIFY COLUMN `type` enum('日报','周报','月报') NOT NULL;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','admin','operator','store') NOT NULL DEFAULT 'user';--> statement-breakpoint
ALTER TABLE `users` ADD `storeName` varchar(120);
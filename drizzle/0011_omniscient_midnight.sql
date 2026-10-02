CREATE TABLE `oneira_daily_targets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`storeName` varchar(120) NOT NULL,
	`targetDate` varchar(10) NOT NULL,
	`targetAmount` double NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `oneira_daily_targets_id` PRIMARY KEY(`id`),
	CONSTRAINT `oneira_daily_target_store_date_unique` UNIQUE(`storeName`,`targetDate`)
);

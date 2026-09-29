CREATE TABLE `oneira_special_dates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`date` varchar(10) NOT NULL,
	`label` varchar(160) NOT NULL,
	`type` enum('节假日','活动日','特别销售') NOT NULL,
	`note` text NOT NULL,
	`stores` text NOT NULL,
	`createdBy` varchar(80) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `oneira_special_dates_id` PRIMARY KEY(`id`)
);

CREATE TABLE `oneira_retrospectives` (
	`id` int AUTO_INCREMENT NOT NULL,
	`storeName` varchar(120) NOT NULL,
	`title` varchar(160) NOT NULL,
	`body` text NOT NULL,
	`tags` text NOT NULL,
	`authorName` varchar(80) NOT NULL,
	`authorOpenId` varchar(64),
	`retroDate` varchar(10) NOT NULL,
	`mood` enum('顺利','有收获','需跟进') NOT NULL DEFAULT '有收获',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `oneira_retrospectives_id` PRIMARY KEY(`id`)
);

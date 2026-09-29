CREATE TABLE `oneira_collaboration_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`type` enum('suggestion','issue') NOT NULL,
	`storeName` varchar(120) NOT NULL,
	`title` varchar(160) NOT NULL,
	`content` text NOT NULL,
	`status` enum('待查看','处理中','已回复','已解决') NOT NULL DEFAULT '待查看',
	`authorName` varchar(80) NOT NULL,
	`authorOpenId` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `oneira_collaboration_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `oneira_collaboration_replies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`itemId` int NOT NULL,
	`authorName` varchar(80) NOT NULL,
	`authorRole` enum('admin','operator','store') NOT NULL,
	`body` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `oneira_collaboration_replies_id` PRIMARY KEY(`id`)
);

CREATE TABLE `oneira_audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`action` varchar(120) NOT NULL,
	`actorName` varchar(80) NOT NULL,
	`actorOpenId` varchar(64) NOT NULL,
	`actorRole` enum('admin','operator','store') NOT NULL,
	`target` varchar(200) NOT NULL,
	`detail` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `oneira_audit_logs_id` PRIMARY KEY(`id`)
);

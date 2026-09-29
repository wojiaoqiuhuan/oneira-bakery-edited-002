CREATE TABLE `oneira_report_template_fields` (
	`id` int AUTO_INCREMENT NOT NULL,
	`templateId` int NOT NULL,
	`fieldId` varchar(80) NOT NULL,
	`label` varchar(160) NOT NULL,
	`group` enum('经营数据','现场记录','问题跟进') NOT NULL,
	`required` boolean NOT NULL DEFAULT false,
	`enabled` boolean NOT NULL DEFAULT true,
	`copyToWechat` boolean NOT NULL DEFAULT true,
	`sortOrder` int NOT NULL DEFAULT 0,
	CONSTRAINT `oneira_report_template_fields_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `oneira_report_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`templateKey` varchar(80) NOT NULL,
	`name` varchar(160) NOT NULL,
	`description` text NOT NULL,
	`updatedBy` varchar(80) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `oneira_report_templates_id` PRIMARY KEY(`id`),
	CONSTRAINT `oneira_report_templates_templateKey_unique` UNIQUE(`templateKey`)
);

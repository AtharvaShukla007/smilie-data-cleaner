CREATE TABLE `api_keys` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(128) NOT NULL,
	`keyHash` varchar(255) NOT NULL,
	`keyPrefix` varchar(16) NOT NULL,
	`permissions` json,
	`lastUsedAt` timestamp,
	`expiresAt` timestamp,
	`isActive` boolean DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `api_keys_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`batchId` int,
	`recordId` int,
	`action` varchar(64) NOT NULL,
	`entityType` varchar(64) NOT NULL,
	`entityId` int,
	`previousValue` json,
	`newValue` json,
	`metadata` json,
	`ipAddress` varchar(64),
	`userAgent` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `data_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`batchId` int NOT NULL,
	`rowIndex` int NOT NULL,
	`originalData` json,
	`cleanedData` json,
	`name` varchar(255),
	`phone` varchar(64),
	`email` varchar(320),
	`addressLine1` text,
	`addressLine2` text,
	`city` varchar(128),
	`state` varchar(128),
	`postalCode` varchar(32),
	`country` varchar(128),
	`cleanedName` varchar(255),
	`cleanedPhone` varchar(64),
	`cleanedEmail` varchar(320),
	`cleanedAddressLine1` text,
	`cleanedAddressLine2` text,
	`cleanedCity` varchar(128),
	`cleanedState` varchar(128),
	`cleanedPostalCode` varchar(32),
	`cleanedCountry` varchar(128),
	`status` enum('pending','cleaned','flagged','approved','rejected') NOT NULL DEFAULT 'pending',
	`qualityScore` int DEFAULT 100,
	`needsReview` boolean DEFAULT false,
	`reviewedBy` int,
	`reviewedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `data_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `processing_jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`batchId` int NOT NULL,
	`userId` int NOT NULL,
	`jobType` enum('clean','validate','export','llm_enhance') NOT NULL,
	`status` enum('queued','processing','completed','failed') NOT NULL DEFAULT 'queued',
	`progress` int DEFAULT 0,
	`totalItems` int DEFAULT 0,
	`processedItems` int DEFAULT 0,
	`errorMessage` text,
	`result` json,
	`startedAt` timestamp,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `processing_jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `upload_batches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`originalFileUrl` text,
	`fileSize` bigint,
	`totalRecords` int DEFAULT 0,
	`cleanedRecords` int DEFAULT 0,
	`errorRecords` int DEFAULT 0,
	`warningRecords` int DEFAULT 0,
	`status` enum('pending','processing','completed','failed') NOT NULL DEFAULT 'pending',
	`region` varchar(64) DEFAULT 'singapore',
	`processedFileUrl` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`completedAt` timestamp,
	CONSTRAINT `upload_batches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `validation_issues` (
	`id` int AUTO_INCREMENT NOT NULL,
	`recordId` int NOT NULL,
	`batchId` int NOT NULL,
	`field` varchar(64) NOT NULL,
	`severity` enum('error','warning','info') NOT NULL DEFAULT 'warning',
	`issueType` varchar(64) NOT NULL,
	`message` text NOT NULL,
	`originalValue` text,
	`suggestedValue` text,
	`isResolved` boolean DEFAULT false,
	`resolvedBy` int,
	`resolvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `validation_issues_id` PRIMARY KEY(`id`)
);

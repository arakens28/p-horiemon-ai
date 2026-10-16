CREATE TABLE `meetings` (
	`record_id` text PRIMARY KEY NOT NULL,
	`meeting_date` text NOT NULL,
	`company` text NOT NULL,
	`meeting_type` text NOT NULL,
	`confidence` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `meetings_date_idx` ON `meetings` (`meeting_date`);--> statement-breakpoint
CREATE INDEX `meetings_type_idx` ON `meetings` (`meeting_type`);
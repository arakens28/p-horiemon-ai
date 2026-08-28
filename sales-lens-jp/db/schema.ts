import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const meetings = sqliteTable(
  "meetings",
  {
    recordId: text("record_id").primaryKey(),
    meetingDate: text("meeting_date").notNull(),
    company: text("company").notNull(),
    meetingType: text("meeting_type").notNull(),
    confidence: text("confidence").notNull(),
    payload: text("payload").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("meetings_date_idx").on(table.meetingDate),
    index("meetings_type_idx").on(table.meetingType),
  ],
);

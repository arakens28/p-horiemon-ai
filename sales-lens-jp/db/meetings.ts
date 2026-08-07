import { env } from "cloudflare:workers";

type MeetingEnvelope = {
  recordId: string;
  meetingDate: string;
  company: string;
  type: string;
  confidence: string;
  [key: string]: unknown;
};

function database() {
  const db = (env as unknown as { DB?: D1Database }).DB;
  if (!db) throw new Error("Cloudflare D1 binding `DB` is unavailable.");
  return db;
}

export async function ensureMeetingsSchema() {
  const db = database();
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS meetings (
      record_id TEXT PRIMARY KEY NOT NULL,
      meeting_date TEXT NOT NULL,
      company TEXT NOT NULL,
      meeting_type TEXT NOT NULL,
      confidence TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS meetings_date_idx ON meetings (meeting_date)"),
    db.prepare("CREATE INDEX IF NOT EXISTS meetings_type_idx ON meetings (meeting_type)"),
  ]);
}

export async function listMeetingPayloads(limit = 100) {
  await ensureMeetingsSchema();
  const result = await database()
    .prepare("SELECT payload, updated_at FROM meetings ORDER BY meeting_date DESC, updated_at DESC LIMIT ?")
    .bind(limit)
    .all<{ payload: string; updated_at: string }>();

  return result.results.map((row) => ({
    ...JSON.parse(row.payload),
    syncedAt: row.updated_at,
  }));
}

export async function upsertMeetingPayloads(items: MeetingEnvelope[]) {
  await ensureMeetingsSchema();
  const db = database();
  const now = new Date().toISOString();
  const statements = items.map((item) =>
    db.prepare(`INSERT INTO meetings (
      record_id, meeting_date, company, meeting_type, confidence, payload, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(record_id) DO UPDATE SET
      meeting_date = excluded.meeting_date,
      company = excluded.company,
      meeting_type = excluded.meeting_type,
      confidence = excluded.confidence,
      payload = excluded.payload,
      updated_at = excluded.updated_at`)
      .bind(item.recordId, item.meetingDate, item.company, item.type, item.confidence, JSON.stringify(item), now, now),
  );

  if (statements.length) await db.batch(statements);
  return { count: statements.length, syncedAt: now };
}

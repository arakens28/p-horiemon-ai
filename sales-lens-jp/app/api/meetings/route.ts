import { env } from "cloudflare:workers";
import { listMeetingPayloads, upsertMeetingPayloads } from "../../../db/meetings";

type IncomingMeeting = {
  recordId?: string;
  meetingDate?: string;
  company?: string;
  type?: string;
  confidence?: string;
  [key: string]: unknown;
};

export async function GET() {
  try {
    const meetings = await listMeetingPayloads();
    return Response.json({ meetings, source: meetings.length ? "live" : "demo" }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return Response.json({ meetings: [], source: "demo", error: error instanceof Error ? error.message : "Database unavailable" }, { status: 200 });
  }
}

export async function POST(request: Request) {
  const configuredSecret = (env as unknown as { SYNC_SECRET?: string }).SYNC_SECRET;
  const authorization = request.headers.get("authorization") ?? "";
  if (!configuredSecret || authorization !== `Bearer ${configuredSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { meetings?: IncomingMeeting[] };
    if (!Array.isArray(body.meetings) || body.meetings.length > 100) {
      return Response.json({ error: "meetings must be an array of at most 100 items" }, { status: 400 });
    }

    const valid = body.meetings.filter((item): item is Required<Pick<IncomingMeeting, "recordId" | "meetingDate" | "company" | "type" | "confidence">> & IncomingMeeting =>
      Boolean(item.recordId && item.meetingDate && item.company && item.type && item.confidence),
    );
    if (valid.length !== body.meetings.length) {
      return Response.json({ error: "Every meeting requires recordId, meetingDate, company, type, and confidence" }, { status: 400 });
    }

    const result = await upsertMeetingPayloads(valid);
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Sync failed" }, { status: 500 });
  }
}

import { sql, eq, desc, asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { emailEvents, trackedEmails } from "@/lib/db/schema";

export type EmailRow = {
  id: string;
  account: string | null;
  recipient: string | null;
  subject: string | null;
  threadId: string | null;
  links: string[];
  createdAt: string;
  opens: number; // deschideri umane (fără prefetch/scanner)
  clicks: number; // click-uri umane
  botOpens: number;
  firstOpenAt: string | null;
  lastOpenAt: string | null;
};

export async function getTrackedEmails(limit = 200): Promise<EmailRow[]> {
  const emails = await db
    .select()
    .from(trackedEmails)
    .orderBy(desc(trackedEmails.createdAt))
    .limit(limit);

  if (emails.length === 0) return [];

  const stats = await db
    .select({
      emailId: emailEvents.emailId,
      opens: sql<number>`count(*) filter (where ${emailEvents.type} = 'open' and not ${emailEvents.isBot})`,
      clicks: sql<number>`count(*) filter (where ${emailEvents.type} = 'click' and not ${emailEvents.isBot})`,
      botOpens: sql<number>`count(*) filter (where ${emailEvents.type} = 'open' and ${emailEvents.isBot})`,
      firstOpenAt: sql<string | null>`min(${emailEvents.createdAt}) filter (where ${emailEvents.type} = 'open' and not ${emailEvents.isBot})`,
      lastOpenAt: sql<string | null>`max(${emailEvents.createdAt}) filter (where ${emailEvents.type} = 'open' and not ${emailEvents.isBot})`,
    })
    .from(emailEvents)
    .groupBy(emailEvents.emailId);

  const byId = new Map(stats.map((s) => [s.emailId, s]));

  return emails.map((e) => {
    const s = byId.get(e.id);
    return {
      id: e.id,
      account: e.account,
      recipient: e.recipient,
      subject: e.subject,
      threadId: e.threadId,
      links: e.links ?? [],
      createdAt: e.createdAt.toISOString(),
      opens: Number(s?.opens ?? 0),
      clicks: Number(s?.clicks ?? 0),
      botOpens: Number(s?.botOpens ?? 0),
      firstOpenAt: s?.firstOpenAt ? new Date(s.firstOpenAt).toISOString() : null,
      lastOpenAt: s?.lastOpenAt ? new Date(s.lastOpenAt).toISOString() : null,
    };
  });
}

export type EmailEvent = {
  type: string;
  linkIdx: number | null;
  linkUrl: string | null;
  isBot: boolean;
  userAgent: string | null;
  createdAt: string;
};

export async function getEmailEvents(emailId: string): Promise<EmailEvent[]> {
  const rows = await db
    .select({
      type: emailEvents.type,
      linkIdx: emailEvents.linkIdx,
      linkUrl: emailEvents.linkUrl,
      isBot: emailEvents.isBot,
      userAgent: emailEvents.userAgent,
      createdAt: emailEvents.createdAt,
    })
    .from(emailEvents)
    .where(eq(emailEvents.emailId, emailId))
    .orderBy(asc(emailEvents.createdAt));

  return rows.map((r) => ({
    type: r.type,
    linkIdx: r.linkIdx,
    linkUrl: r.linkUrl,
    isBot: r.isBot,
    userAgent: r.userAgent,
    createdAt: r.createdAt.toISOString(),
  }));
}

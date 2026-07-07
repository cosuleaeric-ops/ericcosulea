import { sql, eq, desc, asc, and, gt, isNotNull } from "drizzle-orm";
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

export type Alert = {
  id: number; // id-ul event-ului (stabil, folosit de extensie pentru dedup)
  emailId: string;
  subject: string | null;
  alert: string; // reopen_week | high_count
  createdAt: string;
};

// Alertele recente (deschideri notificabile) pentru extensie. Fereastră de 14 zile
// ca extensia să le poată arăta chiar dacă Gmail-ul a fost închis câteva zile.
export async function getRecentAlerts(days = 14): Promise<Alert[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await db
    .select({
      id: emailEvents.id,
      emailId: emailEvents.emailId,
      alert: emailEvents.alert,
      createdAt: emailEvents.createdAt,
      subject: trackedEmails.subject,
    })
    .from(emailEvents)
    .leftJoin(trackedEmails, eq(emailEvents.emailId, trackedEmails.id))
    .where(and(isNotNull(emailEvents.alert), gt(emailEvents.createdAt, since)))
    .orderBy(desc(emailEvents.createdAt))
    .limit(100);

  return rows.map((r) => ({
    id: r.id,
    emailId: r.emailId,
    subject: r.subject,
    alert: r.alert as string,
    createdAt: r.createdAt.toISOString(),
  }));
}

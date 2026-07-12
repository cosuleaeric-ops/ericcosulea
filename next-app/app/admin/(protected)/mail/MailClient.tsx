"use client";

import { useCallback, useEffect, useState } from "react";
import type { EmailRow, EmailEvent } from "@/lib/tracking/queries";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `acum ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `acum ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `acum ${h}h`;
  const d = Math.floor(h / 24);
  return `acum ${d}z`;
}

function fmt(iso: string): string {
  return new Date(iso).toLocaleString("ro-RO", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function EventTimeline({ id }: { id: string }) {
  const [events, setEvents] = useState<EmailEvent[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/track/emails/${id}`)
      .then((r) => r.json())
      .then((d) => alive && setEvents(d.events ?? []))
      .catch(() => alive && setEvents([]));
    return () => {
      alive = false;
    };
  }, [id]);

  if (events === null)
    return <div className="py-6 text-center text-sm text-muted-foreground">se încarcă…</div>;
  // Doar evenimentele REALE — prefetch/scanner/proprii nu se afișează deloc.
  const real = events.filter((e) => !e.isBot);
  if (real.length === 0)
    return <div className="py-6 text-center text-sm text-muted-foreground">nicio deschidere reală încă</div>;

  return (
    <ul className="flex flex-col gap-1.5">
      {real.map((e, i) => (
        <li key={i} className="flex items-center gap-2.5 text-xs text-secondary-foreground">
          <Badge
            className={cn(
              "rounded-md px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase",
              e.type === "open" ? "bg-sky-500/15 text-sky-400" : "bg-green-500/15 text-green-400"
            )}
          >
            {e.type === "open" ? "deschis" : "click"}
          </Badge>
          <span className="text-muted-foreground tabular-nums">{fmt(e.createdAt)}</span>
          {e.type === "click" && e.linkUrl && (
            <span className="max-w-[300px] truncate max-sm:max-w-[160px]" title={e.linkUrl}>
              → {hostOf(e.linkUrl)}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

export default function MailClient({ initial }: { initial: EmailRow[] }) {
  const [emails, setEmails] = useState<EmailRow[]>(initial);
  const [open, setOpen] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const r = await fetch("/api/track/emails");
      const d = await r.json();
      if (d.emails) setEmails(d.emails);
    } catch {
      /* offline / backend jos — reîncercăm la următorul tick */
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Auto-refresh la fiecare 30s.
  useEffect(() => {
    const t = setInterval(refresh, 30_000);
    return () => clearInterval(t);
  }, [refresh]);

  const totalOpened = emails.filter((e) => e.opens > 0).length;
  const openRate = emails.length ? Math.round((totalOpened / emails.length) * 100) : 0;

  return (
    <div className="mx-auto max-w-[900px] px-5 pt-8 pb-20">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">EliteMail</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {emails.length} emailuri · {openRate}% deschise · {totalOpened} cu cel puțin o deschidere
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} disabled={refreshing} className="whitespace-nowrap">
          {refreshing ? "…" : "↻ reîmprospătează"}
        </Button>
      </div>

      {emails.length === 0 && (
        <div className="py-6 text-center text-sm text-muted-foreground">
          Niciun email urmărit încă. Trimite unul din Gmail cu extensia activă.
        </div>
      )}

      <div className="flex flex-col gap-2">
        {emails.map((e) => {
          const isOpen = open === e.id;
          return (
            <Card
              key={e.id}
              className={cn("gap-0 overflow-hidden p-0", e.opens > 0 && "border-sky-500/25")}
            >
              <button
                className="flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left hover:bg-accent"
                onClick={() => setOpen(isOpen ? null : e.id)}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-semibold">{e.subject || "(fără subiect)"}</div>
                  <div className="mt-1 flex flex-wrap gap-2.5 text-xs text-muted-foreground">
                    <span>{e.recipient || "—"}</span>
                    {e.account && <span className="opacity-70">{e.account}</span>}
                    <span className="opacity-70">trimis {timeAgo(e.createdAt)}</span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3.5">
                  <span
                    className={cn("text-[13px] tabular-nums", e.opens > 0 ? "text-foreground" : "text-muted-foreground/70")}
                    title="deschideri umane"
                  >
                    👁 {e.opens}
                  </span>
                  <span
                    className={cn("text-[13px] tabular-nums", e.clicks > 0 ? "text-foreground" : "text-muted-foreground/70")}
                    title="click-uri umane"
                  >
                    🔗 {e.clicks}
                  </span>
                  <span className="min-w-[60px] text-right text-xs text-muted-foreground max-sm:hidden">
                    {e.lastOpenAt ? timeAgo(e.lastOpenAt) : "necitit"}
                  </span>
                </div>
              </button>
              {isOpen && (
                <div className="border-t bg-secondary/50 px-4 pt-3 pb-4">
                  <EventTimeline id={e.id} />
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import type { EmailRow, EmailEvent } from "@/lib/tracking/queries";

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

  if (events === null) return <div className="mt-tl-loading">se încarcă…</div>;
  if (events.length === 0) return <div className="mt-tl-loading">niciun eveniment încă</div>;

  return (
    <ul className="mt-tl">
      {events.map((e, i) => (
        <li key={i} className={`mt-tl-item ${e.isBot ? "mt-tl-bot" : ""}`}>
          <span className={`mt-tag mt-tag-${e.type}`}>{e.type === "open" ? "deschis" : "click"}</span>
          <span className="mt-tl-when">{fmt(e.createdAt)}</span>
          {e.type === "click" && e.linkUrl && (
            <span className="mt-tl-link" title={e.linkUrl}>
              → {hostOf(e.linkUrl)}
            </span>
          )}
          {e.isBot && <span className="mt-tl-flag">prefetch/scanner</span>}
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
    <div className="mt">
      <div className="mt-head">
        <div>
          <h1 className="mt-title">MailTracker</h1>
          <p className="mt-sub">
            {emails.length} emailuri · {openRate}% deschise · {totalOpened} cu cel puțin o deschidere
          </p>
        </div>
        <button className="mt-refresh" onClick={refresh} disabled={refreshing}>
          {refreshing ? "…" : "↻ reîmprospătează"}
        </button>
      </div>

      {emails.length === 0 && (
        <div className="mt-empty">
          Niciun email urmărit încă. Trimite unul din Gmail cu extensia activă.
        </div>
      )}

      <div className="mt-list">
        {emails.map((e) => {
          const isOpen = open === e.id;
          return (
            <div key={e.id} className={`mt-card ${e.opens > 0 ? "mt-seen" : ""}`}>
              <button className="mt-row" onClick={() => setOpen(isOpen ? null : e.id)}>
                <div className="mt-row-main">
                  <div className="mt-subject">{e.subject || "(fără subiect)"}</div>
                  <div className="mt-meta">
                    <span>{e.recipient || "—"}</span>
                    {e.account && <span className="mt-acct">{e.account}</span>}
                    <span className="mt-sent">trimis {timeAgo(e.createdAt)}</span>
                  </div>
                </div>
                <div className="mt-stats">
                  <span className={`mt-stat ${e.opens > 0 ? "mt-on" : ""}`} title="deschideri umane">
                    👁 {e.opens}
                  </span>
                  <span className={`mt-stat ${e.clicks > 0 ? "mt-on" : ""}`} title="click-uri umane">
                    🔗 {e.clicks}
                  </span>
                  <span className="mt-last">{e.lastOpenAt ? timeAgo(e.lastOpenAt) : "necitit"}</span>
                </div>
              </button>
              {isOpen && (
                <div className="mt-detail">
                  {e.botOpens > 0 && (
                    <div className="mt-note">
                      + {e.botOpens} deschideri de prefetch/scanner (Apple Mail, SafeLinks…) — excluse din total.
                    </div>
                  )}
                  <EventTimeline id={e.id} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

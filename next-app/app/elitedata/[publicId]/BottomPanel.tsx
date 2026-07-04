"use client";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, Smartphone, Monitor, Tablet, ChevronRight, Target } from "lucide-react";
import type {
  GoalRow,
  FunnelData,
  UserRow,
  JourneyRow,
} from "@/lib/analytics/queries";
import { formatNumber, formatRelative } from "@/lib/analytics/format";
import { countryFlag } from "@/lib/analytics/labels";
import { TAB_COOKIES, writeCookie } from "../period-persistence";

type TabKey = "goal" | "funnel" | "user" | "journey";
const TABS: { key: TabKey; label: string }[] = [
  { key: "goal", label: "Goal" },
  { key: "funnel", label: "Funnel" },
  { key: "user", label: "User" },
  { key: "journey", label: "Journey" },
];
const isTabKey = (k: string | undefined): k is TabKey =>
  TABS.some((t) => t.key === k);

function DeviceIcon({ d }: { d: string | null }) {
  if (d === "mobile") return <Smartphone size={14} />;
  if (d === "tablet") return <Tablet size={14} />;
  return <Monitor size={14} />;
}

export function BottomPanel({
  sitePublicId,
  goals,
  funnel,
  users,
  journeys,
  loading,
  onGoalAdded,
  initialTab,
}: {
  sitePublicId: string;
  goals: GoalRow[];
  funnel: FunnelData;
  users: UserRow[];
  journeys: JourneyRow[];
  loading: boolean;
  onGoalAdded: () => void;
  initialTab?: string;
}) {
  // Tab-ul salvat vine din cookie (prop de la server) → randăm din prima corect.
  const [tab, setTab] = useState<TabKey>(isTabKey(initialTab) ? initialTab : "goal");
  const select = (k: TabKey) => {
    setTab(k);
    writeCookie(TAB_COOKIES.bottom, k);
  };

  return (
    <div className="dfa-card dfa-bottom">
      <div className="dfa-panel-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`dfa-panel-tab${t.key === tab ? " is-active" : ""}`}
            onClick={() => select(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="dfa-bottom-body">
        {loading ? (
          <div className="dfa-panel-skel">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="dfa-skeleton" style={{ height: 20, width: `${80 - i * 6}%` }} />
            ))}
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
            >
              {tab === "goal" && (
                <GoalTab goals={goals} sitePublicId={sitePublicId} onGoalAdded={onGoalAdded} />
              )}
              {tab === "funnel" && <FunnelTab funnel={funnel} />}
              {tab === "user" && <UserTab users={users} />}
              {tab === "journey" && <JourneyTab journeys={journeys} />}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

function GoalTab({
  goals,
  sitePublicId,
  onGoalAdded,
}: {
  goals: GoalRow[];
  sitePublicId: string;
  onGoalAdded: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const max = goals.length ? Math.max(...goals.map((g) => g.count)) : 0;

  async function add() {
    const n = name.trim();
    if (!n) return;
    setBusy(true);
    try {
      await fetch("/api/analytics/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ site: sitePublicId, name: n }),
      });
      setName("");
      setAdding(false);
      onGoalAdded();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {goals.length === 0 && !adding && (
        <div className="dfa-panel-empty">Niciun goal încă. Adaugă unul mai jos.</div>
      )}
      {goals.map((g) => {
        const pct = max ? (g.count / max) * 100 : 0;
        return (
          <div key={g.name} className="dfa-row">
            <motion.span
              className="dfa-row-bar"
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.45, ease: "easeOut" }}
            />
            <span className="dfa-row-main">
              <span className="dfa-row-ico"><Target size={14} className="dfa-faint" /></span>
              <span className="dfa-row-label">{g.displayName}</span>
            </span>
            <span className="dfa-row-value">
              {formatNumber(g.count)}
              <span className="dfa-goal-rate">{g.rate.toFixed(2)}%</span>
            </span>
          </div>
        );
      })}

      {adding ? (
        <div className="dfa-goal-add">
          <input
            autoFocus
            placeholder="nume_event (ex: cta_subscribe)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
          />
          <button className="dfa-btn" onClick={() => setAdding(false)}>Cancel</button>
          <button className="dfa-btn dfa-btn-primary" onClick={add} disabled={busy}>Add</button>
        </div>
      ) : (
        <button className="dfa-add-goals" onClick={() => setAdding(true)}>
          <Plus size={14} /> Add goals
        </button>
      )}
    </div>
  );
}

function FunnelTab({ funnel }: { funnel: FunnelData }) {
  if (!funnel || !funnel.steps.length) {
    return <div className="dfa-panel-empty">Niciun funnel definit pentru acest site.</div>;
  }
  const top = funnel.steps[0]?.count || 1;
  return (
    <div className="dfa-funnel">
      <div className="dfa-funnel-name">{funnel.name}</div>
      {funnel.steps.map((s, i) => {
        const pct = (s.count / top) * 100;
        const dropoff =
          i > 0 && funnel.steps[i - 1].count
            ? (1 - s.count / funnel.steps[i - 1].count) * 100
            : 0;
        return (
          <div key={i} className="dfa-funnel-step">
            <div className="dfa-funnel-step-head">
              <span className="dfa-funnel-idx">{i + 1}</span>
              <span className="dfa-funnel-label">{s.label}</span>
              <span className="dfa-funnel-count">{formatNumber(s.count)}</span>
            </div>
            <div className="dfa-funnel-bar-track">
              <motion.div
                className="dfa-funnel-bar"
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              />
            </div>
            {i > 0 && dropoff > 0 && (
              <span className="dfa-funnel-drop">−{dropoff.toFixed(0)}% drop-off</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function UserTab({ users }: { users: UserRow[] }) {
  if (!users.length) return <div className="dfa-panel-empty">Niciun vizitator în perioadă.</div>;
  return (
    <div className="dfa-utable">
      <div className="dfa-utable-head">
        <span>Visitor</span>
        <span>Source</span>
        <span className="dfa-th-num">Sessions</span>
        <span className="dfa-th-num">Views</span>
        <span className="dfa-th-num">Last seen</span>
      </div>
      {users.map((u) => (
        <div key={u.id} className="dfa-utable-row">
          <span className="dfa-uvisitor">
            {u.country && <span className="dfa-flag">{countryFlag(u.country)}</span>}
            <DeviceIcon d={u.device} />
            <span className="dfa-anon">#{u.id.slice(0, 6)}</span>
          </span>
          <span className="dfa-muted">{u.referrerSource ?? "—"}</span>
          <span className="dfa-th-num">{u.sessions}</span>
          <span className="dfa-th-num">{u.pageviews}</span>
          <span className="dfa-th-num dfa-muted">{formatRelative(u.lastSeen)}</span>
        </div>
      ))}
    </div>
  );
}

function JourneyTab({ journeys }: { journeys: JourneyRow[] }) {
  if (!journeys.length) return <div className="dfa-panel-empty">Nicio sesiune în perioadă.</div>;
  return (
    <div className="dfa-journeys">
      {journeys.map((j) => (
        <div key={j.id} className="dfa-journey">
          <div className="dfa-journey-meta">
            {j.country && <span className="dfa-flag">{countryFlag(j.country)}</span>}
            <DeviceIcon d={j.device} />
            <span className="dfa-muted">{formatRelative(j.startedAt)}</span>
            <span className="dfa-journey-count">{j.pages.length} pages</span>
          </div>
          <div className="dfa-journey-path">
            {j.pages.map((p, i) => (
              <span key={i} className="dfa-journey-page">
                {p}
                {i < j.pages.length - 1 && <ChevronRight size={12} className="dfa-faint" />}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

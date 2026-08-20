"use client";
import { AnimatePresence, motion } from "framer-motion";
import { X, GitBranch, ExternalLink } from "lucide-react";
import type { Deploy } from "@/lib/analytics/vercel";

function dayTitle(iso: string, tz: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "long",
    month: "short",
    day: "numeric",
  })
    .format(new Date(iso))
    .toUpperCase();
}

function timeLabel(iso: string, tz: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function DeployPanel({
  deploys,
  tz,
  onClose,
}: {
  deploys: Deploy[];
  tz: string;
  onClose: () => void;
}) {
  const title = deploys.length ? dayTitle(deploys[0].ts, tz) : "";
  return (
    <AnimatePresence>
      <motion.div
        className="dfa-modal-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.16 }}
        onClick={onClose}
      >
        <motion.div
          className="dfa-deploy-panel"
          initial={{ opacity: 0, scale: 0.97, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: 8 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="dfa-deploy-head">
            <h3>{title}</h3>
            <button className="dfa-btn dfa-btn-icon" onClick={onClose}>
              <X size={16} />
            </button>
          </div>
          <div className="dfa-deploy-tabs">
            <span className="dfa-deploy-tab">
              <GitBranch size={13} /> Commits ({deploys.length})
            </span>
          </div>
          <div className="dfa-deploy-list">
            {deploys.map((d) => (
              <div key={d.id} className="dfa-deploy-card">
                <div className="dfa-deploy-card-top">
                  {d.branch && (
                    <span className="dfa-deploy-branch">
                      <GitBranch size={12} /> {d.branch}
                    </span>
                  )}
                  {(d.commitUrl || d.url) && (
                    <a
                      className="dfa-deploy-gh"
                      href={d.commitUrl || d.url!}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <ExternalLink size={15} />
                    </a>
                  )}
                </div>
                <div className="dfa-deploy-msg">{d.message}</div>
                <div className="dfa-deploy-meta">
                  {d.author && <span>{d.author}</span>}
                  <span>{timeLabel(d.ts, tz)}</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

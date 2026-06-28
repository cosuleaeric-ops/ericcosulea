"use client";

import { useState } from "react";
import type { projects } from "@/lib/db/schema";

type Project = typeof projects.$inferSelect;

export default function OldProjects({ projects }: { projects: Project[] }) {
  const [open, setOpen] = useState(false);

  if (projects.length === 0) return null;

  return (
    <div className="old-projects">
      <button
        type="button"
        className="old-projects-toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={`old-projects-chevron${open ? " is-open" : ""}`}>›</span>
        proiecte vechi
      </button>
      {open && (
        <div className="projects old-projects-list">
          {projects.map((proj) => (
            <a key={proj.id} className="project" href={proj.url} target="_blank" rel="noopener noreferrer">
              <img className="project-icon-img" src={proj.logo} alt="" />
              <span className="project-text">
                <span className="project-name">{proj.name}</span>
                {proj.description && <span className="project-meta">({proj.description})</span>}
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

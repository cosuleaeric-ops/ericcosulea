"use client";

import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Page = {
  id: number;
  slug: string;
  parentId: number | null;
  title: string;
  description: string | null;
  icon: string | null;
  contentMd: string;
  sort: number;
  createdAt: string;
  updatedAt: string;
};

type Thought = {
  id: number;
  contentMd: string;
  tags: string[];
  createdAt: string;
};

type EditorState = {
  pageId: number | null; // null = pagină nouă
  parentId: number | null;
  title: string;
  description: string;
  icon: string;
  contentMd: string;
};

function relTime(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  const units: [string, number][] = [
    ["year", 31536000],
    ["month", 2592000],
    ["week", 604800],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  const parts: string[] = [];
  let rest = diff;
  for (const [name, secs] of units) {
    if (parts.length === 2) break;
    const v = Math.floor(rest / secs);
    if (v > 0 || parts.length === 1) {
      if (v > 0) parts.push(`${v} ${name}${v > 1 ? "s" : ""}`);
      rest -= v * secs;
    }
  }
  return `${parts.join(", ")} ago`;
}

function thoughtDate(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${date} · ${time}`;
}

function parseTags(text: string): string[] {
  return [...new Set(
    text
      .split(/[,\s]+/)
      .map((t) => t.trim().replace(/^#/, "").toLowerCase())
      .filter(Boolean),
  )];
}

async function api(path: string, method: string, body?: unknown) {
  const res = await fetch(`/api/brain/${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `eroare ${res.status}`);
  return data;
}

function Md({ text }: { text: string }) {
  return (
    <div className="brain-md">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  );
}

function PageIcon({ page }: { page: Page }) {
  if (page.icon) return <span className="brain-tree-emoji">{page.icon}</span>;
  return (
    <svg className="brain-tree-doc" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  );
}

export default function BrainApp({
  initialPages,
  initialThoughts,
}: {
  initialPages: Page[];
  initialThoughts: Thought[];
}) {
  const [pages, setPages] = useState<Page[]>(initialPages);
  const [thoughts, setThoughts] = useState<Thought[]>(initialThoughts);
  const [view, setView] = useState<"pages" | "thoughts">("pages");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);

  // Thoughts
  const [composer, setComposer] = useState({ content: "", tags: "" });
  const [thoughtFilter, setThoughtFilter] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [openThoughts, setOpenThoughts] = useState<Set<number>>(new Set());
  const [thoughtEdit, setThoughtEdit] = useState<{ id: number; content: string; tags: string } | null>(null);

  const byId = useMemo(() => new Map(pages.map((p) => [p.id, p])), [pages]);
  const childrenOf = (parentId: number | null) =>
    pages
      .filter((p) => p.parentId === parentId)
      .sort((a, b) => a.sort - b.sort || a.title.localeCompare(b.title));

  const selected = selectedId != null ? byId.get(selectedId) ?? null : null;

  const crumbs = useMemo(() => {
    const chain: Page[] = [];
    let p = selected;
    while (p) {
      chain.unshift(p);
      p = p.parentId != null ? byId.get(p.parentId) ?? null : null;
    }
    return chain;
  }, [selected, byId]);

  const treeMatches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return null;
    return pages.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        (p.description ?? "").toLowerCase().includes(q) ||
        p.contentMd.toLowerCase().includes(q),
    );
  }, [search, pages]);

  const tagCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of thoughts) for (const tag of t.tags) m.set(tag, (m.get(tag) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [thoughts]);

  const visibleThoughts = useMemo(() => {
    const q = thoughtFilter.trim().toLowerCase();
    return thoughts.filter((t) => {
      if (activeTag && !t.tags.includes(activeTag)) return false;
      if (q && !t.contentMd.toLowerCase().includes(q) && !t.tags.some((x) => x.includes(q))) return false;
      return true;
    });
  }, [thoughts, thoughtFilter, activeTag]);

  function selectPage(id: number | null) {
    setSelectedId(id);
    setEditor(null);
    if (id != null) {
      // deschide strămoșii în arbore
      setExpanded((prev) => {
        const next = new Set(prev);
        let p = byId.get(id);
        while (p?.parentId != null) {
          next.add(p.parentId);
          p = byId.get(p.parentId);
        }
        return next;
      });
    }
  }

  function startNewPage(parentId: number | null) {
    setEditor({ pageId: null, parentId, title: "", description: "", icon: "", contentMd: "" });
  }

  function startEditPage(p: Page) {
    setEditor({
      pageId: p.id,
      parentId: p.parentId,
      title: p.title,
      description: p.description ?? "",
      icon: p.icon ?? "",
      contentMd: p.contentMd,
    });
  }

  async function saveEditor() {
    if (!editor || !editor.title.trim() || busy) return;
    setBusy(true);
    try {
      if (editor.pageId == null) {
        const { page } = await api("pages", "POST", {
          title: editor.title,
          parentId: editor.parentId,
          description: editor.description,
          icon: editor.icon,
          contentMd: editor.contentMd,
        });
        setPages((prev) => [...prev, page]);
        if (editor.parentId != null) setExpanded((prev) => new Set(prev).add(editor.parentId!));
        setSelectedId(page.id);
      } else {
        const { page } = await api(`pages/${editor.pageId}`, "PATCH", {
          title: editor.title,
          description: editor.description,
          icon: editor.icon,
          contentMd: editor.contentMd,
        });
        setPages((prev) => prev.map((p) => (p.id === page.id ? page : p)));
      }
      setEditor(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function deletePage(p: Page) {
    if (!confirm(`Ștergi pagina „${p.title}"?`)) return;
    try {
      await api(`pages/${p.id}`, "DELETE");
      setPages((prev) => prev.filter((x) => x.id !== p.id));
      setSelectedId(p.parentId);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  }

  async function saveThoughtNew() {
    if (!composer.content.trim() || busy) return;
    setBusy(true);
    try {
      const { thought } = await api("thoughts", "POST", {
        contentMd: composer.content,
        tags: parseTags(composer.tags),
      });
      setThoughts((prev) => [thought, ...prev]);
      setComposer({ content: "", tags: "" });
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function saveThoughtEdit() {
    if (!thoughtEdit || busy) return;
    setBusy(true);
    try {
      const { thought } = await api(`thoughts/${thoughtEdit.id}`, "PATCH", {
        contentMd: thoughtEdit.content,
        tags: parseTags(thoughtEdit.tags),
      });
      setThoughts((prev) => prev.map((t) => (t.id === thought.id ? thought : t)));
      setThoughtEdit(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function deleteThought(id: number) {
    if (!confirm("Ștergi gândul?")) return;
    try {
      await api(`thoughts/${id}`, "DELETE");
      setThoughts((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  }

  function renderTree(parentId: number | null, depth: number): React.ReactNode {
    return childrenOf(parentId).map((p) => {
      const kids = childrenOf(p.id);
      const isOpen = expanded.has(p.id);
      return (
        <div key={p.id}>
          <div
            className={`brain-tree-row${selectedId === p.id ? " active" : ""}`}
            style={{ paddingLeft: `${depth * 14 + 6}px` }}
            onClick={() => selectPage(p.id)}
          >
            <button
              className={`brain-tree-chevron${kids.length ? "" : " hidden"}${isOpen ? " open" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                setExpanded((prev) => {
                  const next = new Set(prev);
                  if (next.has(p.id)) next.delete(p.id);
                  else next.add(p.id);
                  return next;
                });
              }}
              aria-label="toggle"
            >
              ›
            </button>
            <PageIcon page={p} />
            <span className="brain-tree-title">{p.title}</span>
          </div>
          {isOpen && kids.length > 0 && renderTree(p.id, depth + 1)}
        </div>
      );
    });
  }

  function renderSubPages(parentId: number | null) {
    const kids = childrenOf(parentId)
      .slice()
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    if (!kids.length) return null;
    return (
      <section className="brain-subpages">
        <div className="brain-subpages-head">
          <span className="brain-label">SUB-PAGES · {kids.length}</span>
          <span className="brain-label muted">Recently updated</span>
        </div>
        {kids.map((p) => (
          <div key={p.id} className="brain-subpage-row" onClick={() => selectPage(p.id)}>
            <div>
              <div className="brain-subpage-title">
                {p.icon ? `${p.icon} ` : ""}
                {p.title}
              </div>
              {p.description && <div className="brain-subpage-desc">{p.description}</div>}
            </div>
            <span className="brain-time">{relTime(p.updatedAt)}</span>
          </div>
        ))}
      </section>
    );
  }

  const pageHeaderActions = selected && !editor && (
    <div className="brain-page-actions">
      <button className="brain-btn" onClick={() => startEditPage(selected)}>Edit</button>
      <button className="brain-btn" onClick={() => startNewPage(selected.id)}>+ Sub-page</button>
      <button className="brain-btn danger" onClick={() => deletePage(selected)}>Delete</button>
    </div>
  );

  return (
    <div className="brain-shell">
      <header className="brain-topbar">
        <a className="brain-brand" href="/brain">
          <span className="brain-brand-dot" />
          Brain
        </a>
        <div className="brain-tabs">
          <button className={view === "pages" ? "active" : ""} onClick={() => setView("pages")}>
            Pages
          </button>
          <button className={view === "thoughts" ? "active" : ""} onClick={() => setView("thoughts")}>
            Thoughts
          </button>
        </div>
        <div className="brain-topbar-right">
          <input
            className="brain-search"
            placeholder="Search..."
            value={view === "pages" ? search : thoughtFilter}
            onChange={(e) => (view === "pages" ? setSearch(e.target.value) : setThoughtFilter(e.target.value))}
          />
        </div>
      </header>

      {view === "pages" ? (
        <div className="brain-body">
          <aside className="brain-sidebar">
            <div className="brain-label">PAGES</div>
            <nav className="brain-tree">
              {treeMatches ? (
                treeMatches.length ? (
                  treeMatches.map((p) => (
                    <div
                      key={p.id}
                      className={`brain-tree-row${selectedId === p.id ? " active" : ""}`}
                      style={{ paddingLeft: "6px" }}
                      onClick={() => selectPage(p.id)}
                    >
                      <span className="brain-tree-chevron hidden">›</span>
                      <PageIcon page={p} />
                      <span className="brain-tree-title">{p.title}</span>
                    </div>
                  ))
                ) : (
                  <div className="brain-empty-side">niciun rezultat</div>
                )
              ) : (
                renderTree(null, 0)
              )}
            </nav>
            <button className="brain-btn brain-newpage" onClick={() => startNewPage(null)}>
              + New page
            </button>
          </aside>

          <main className="brain-main">
            {editor ? (
              <div className="brain-editor">
                <div className="brain-crumbs">
                  <button onClick={() => selectPage(null)}>Brain</button>
                  {editor.parentId != null && byId.get(editor.parentId) && (
                    <>
                      <span>/</span>
                      <button onClick={() => selectPage(editor.parentId)}>{byId.get(editor.parentId)!.title}</button>
                    </>
                  )}
                  <span>/</span>
                  <span className="current">{editor.pageId == null ? "New page" : "Edit"}</span>
                </div>
                <div className="brain-editor-titlerow">
                  <input
                    className="brain-editor-icon"
                    placeholder="🧠"
                    value={editor.icon}
                    onChange={(e) => setEditor({ ...editor, icon: e.target.value })}
                  />
                  <input
                    className="brain-editor-title"
                    placeholder="Title"
                    autoFocus
                    value={editor.title}
                    onChange={(e) => setEditor({ ...editor, title: e.target.value })}
                  />
                </div>
                <input
                  className="brain-editor-desc"
                  placeholder="Short description (italic subtitle)"
                  value={editor.description}
                  onChange={(e) => setEditor({ ...editor, description: e.target.value })}
                />
                <textarea
                  className="brain-editor-content"
                  placeholder="Markdown content..."
                  value={editor.contentMd}
                  onChange={(e) => setEditor({ ...editor, contentMd: e.target.value })}
                />
                <div className="brain-editor-actions">
                  <button className="brain-btn primary" disabled={busy || !editor.title.trim()} onClick={saveEditor}>
                    {busy ? "Saving..." : "Save"}
                  </button>
                  <button className="brain-btn" onClick={() => setEditor(null)}>Cancel</button>
                </div>
              </div>
            ) : selected ? (
              <article className="brain-page">
                <div className="brain-page-top">
                  <div className="brain-crumbs">
                    <button onClick={() => selectPage(null)}>Brain</button>
                    {crumbs.slice(0, -1).map((c) => (
                      <span key={c.id}>
                        <span>/</span>
                        <button onClick={() => selectPage(c.id)}>{c.title}</button>
                      </span>
                    ))}
                  </div>
                  {pageHeaderActions}
                </div>
                <h1 className="brain-h1">
                  {selected.icon ? `${selected.icon} ` : ""}
                  {selected.title}
                </h1>
                {selected.description && <p className="brain-page-desc">{selected.description}</p>}
                <div className="brain-rule" />
                {selected.contentMd.trim() ? (
                  <Md text={selected.contentMd} />
                ) : (
                  <div className="brain-placeholder">Empty page — hit Edit to write.</div>
                )}
                {renderSubPages(selected.id)}
                <div className="brain-updated brain-time">updated {relTime(selected.updatedAt)}</div>
              </article>
            ) : (
              <article className="brain-page">
                <div className="brain-page-top">
                  <div className="brain-crumbs">
                    <span className="current">Brain</span>
                  </div>
                </div>
                <h1 className="brain-h1">Brain</h1>
                <div className="brain-rule" />
                <div className="brain-placeholder">Pick a page from the tree on the left.</div>
                {renderSubPages(null)}
              </article>
            )}
          </main>
        </div>
      ) : (
        <div className="brain-body">
          <aside className="brain-sidebar">
            <div className="brain-label">TAGS</div>
            <nav className="brain-taglist">
              {tagCounts.map(([tag, count]) => (
                <button
                  key={tag}
                  className={`brain-tag-row${activeTag === tag ? " active" : ""}`}
                  onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                >
                  <span>#{tag}</span>
                  <span className="brain-tag-count">{count}</span>
                </button>
              ))}
              {!tagCounts.length && <div className="brain-empty-side">no tags yet</div>}
            </nav>
          </aside>

          <main className="brain-main">
            <article className="brain-page">
              <h1 className="brain-h1">Thoughts</h1>
              <p className="brain-page-desc">
                Everything you&apos;ve thought worth keeping, in the order you thought it.
              </p>
              <div className="brain-rule" />

              <div className="brain-composer">
                <textarea
                  placeholder="What's worth keeping? (markdown)"
                  value={composer.content}
                  onChange={(e) => setComposer({ ...composer, content: e.target.value })}
                />
                <div className="brain-composer-row">
                  <input
                    placeholder="tags: idea, journeyloop..."
                    value={composer.tags}
                    onChange={(e) => setComposer({ ...composer, tags: e.target.value })}
                  />
                  <button
                    className="brain-btn primary"
                    disabled={busy || !composer.content.trim()}
                    onClick={saveThoughtNew}
                  >
                    Save thought
                  </button>
                </div>
              </div>

              <input
                className="brain-thought-filter"
                placeholder="Filter thoughts..."
                value={thoughtFilter}
                onChange={(e) => setThoughtFilter(e.target.value)}
              />

              {visibleThoughts.map((t) => {
                const isOpen = openThoughts.has(t.id);
                const long = t.contentMd.length > 280 || t.contentMd.split("\n").length > 4;
                return (
                  <div key={t.id} className="brain-thought">
                    <div className="brain-thought-head">
                      <span className="brain-time">{thoughtDate(t.createdAt)}</span>
                      <span className="brain-thought-tags">
                        {t.tags.map((tag) => (
                          <button key={tag} className="brain-chip" onClick={() => setActiveTag(tag)}>
                            #{tag}
                          </button>
                        ))}
                      </span>
                      <span className="brain-thought-actions">
                        <button onClick={() => setThoughtEdit({ id: t.id, content: t.contentMd, tags: t.tags.join(", ") })}>
                          edit
                        </button>
                        <button onClick={() => deleteThought(t.id)}>delete</button>
                      </span>
                    </div>
                    {thoughtEdit?.id === t.id ? (
                      <div className="brain-composer inline">
                        <textarea
                          value={thoughtEdit.content}
                          onChange={(e) => setThoughtEdit({ ...thoughtEdit, content: e.target.value })}
                        />
                        <div className="brain-composer-row">
                          <input
                            value={thoughtEdit.tags}
                            onChange={(e) => setThoughtEdit({ ...thoughtEdit, tags: e.target.value })}
                          />
                          <button className="brain-btn primary" disabled={busy} onClick={saveThoughtEdit}>
                            Save
                          </button>
                          <button className="brain-btn" onClick={() => setThoughtEdit(null)}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className={long && !isOpen ? "brain-thought-body clamped" : "brain-thought-body"}>
                          <Md text={t.contentMd} />
                        </div>
                        {long && (
                          <button
                            className="brain-showmore"
                            onClick={() =>
                              setOpenThoughts((prev) => {
                                const next = new Set(prev);
                                if (next.has(t.id)) next.delete(t.id);
                                else next.add(t.id);
                                return next;
                              })
                            }
                          >
                            {isOpen ? "Show less" : "Show more"}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
              {!visibleThoughts.length && <div className="brain-placeholder">No thoughts match.</div>}
            </article>
          </main>
        </div>
      )}
    </div>
  );
}

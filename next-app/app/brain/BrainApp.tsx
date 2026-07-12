"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ChevronRight,
  Command,
  FileText,
  Moon,
  Pencil,
  Plus,
  Search,
  Sun,
  Trash2,
} from "lucide-react";

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

type View = { kind: "home" } | { kind: "thoughts" } | { kind: "page"; id: number };

function relTime(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "acum";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}z`;
  return new Date(iso).toLocaleDateString("ro-RO", { day: "numeric", month: "short" });
}

function thoughtDate(iso: string): string {
  const d = new Date(iso);
  return (
    d.toLocaleDateString("ro-RO", { day: "numeric", month: "short", year: "numeric" }) +
    " · " +
    d.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" })
  );
}

// Extrage #tagurile din text: „idee misto #outglow #pricing" -> { text, tags }
function extractTags(raw: string): { text: string; tags: string[] } {
  const tags = [...new Set([...raw.matchAll(/(^|\s)#([a-zA-Z0-9ăâîșț\-_]+)/g)].map((m) => m[2].toLowerCase()))];
  const text = raw.replace(/(^|\s)#[a-zA-Z0-9ăâîșț\-_]+/g, " ").replace(/[ \t]+/g, " ").trim();
  return { text, tags };
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

function withTransition(fn: () => void) {
  const d = document as Document & { startViewTransition?: (cb: () => void) => void };
  if (d.startViewTransition) d.startViewTransition(fn);
  else fn();
}

function Md({ text }: { text: string }) {
  return (
    <div className="brain-md">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  );
}

function PageIcon({ page, size = 13.5 }: { page: Page; size?: number }) {
  if (page.icon) return <span className="brain-emoji" style={{ fontSize: size }}>{page.icon}</span>;
  return <FileText size={size} className="brain-doc-ico" strokeWidth={1.8} />;
}

type PaletteItem = {
  key: string;
  label: string;
  hint?: string;
  icon?: React.ReactNode;
  action: () => void;
};

export default function BrainApp({
  initialPages,
  initialThoughts,
}: {
  initialPages: Page[];
  initialThoughts: Thought[];
}) {
  const [pages, setPages] = useState<Page[]>(initialPages);
  const [thoughts, setThoughts] = useState<Thought[]>(initialThoughts);
  const [view, setView] = useState<View>({ kind: "home" });
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [dark, setDark] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");

  // Thoughts
  const [capture, setCapture] = useState("");
  const [thoughtFilter, setThoughtFilter] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [openThoughts, setOpenThoughts] = useState<Set<number>>(new Set());
  const [thoughtEdit, setThoughtEdit] = useState<{ id: number; content: string } | null>(null);

  // Palette + toast
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQ, setPaletteQ] = useState("");
  const [paletteIdx, setPaletteIdx] = useState(0);
  const [toast, setToast] = useState<{ msg: string; undo?: () => void } | null>(null);

  const shellRef = useRef<HTMLDivElement>(null);
  const captureRef = useRef<HTMLTextAreaElement>(null);
  const filterRef = useRef<HTMLInputElement>(null);
  const paletteInputRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastKey = useRef<{ k: string; t: number }>({ k: "", t: 0 });

  const byId = useMemo(() => new Map(pages.map((p) => [p.id, p])), [pages]);
  const selected = view.kind === "page" ? byId.get(view.id) ?? null : null;

  // draft pentru inline editing (autosave)
  const [draft, setDraft] = useState<{ title: string; description: string; icon: string; contentMd: string } | null>(null);

  const childrenOf = useCallback(
    (parentId: number | null) =>
      pages
        .filter((p) => p.parentId === parentId)
        .sort((a, b) => a.sort - b.sort || a.title.localeCompare(b.title)),
    [pages],
  );

  /* ── tema ── */
  useEffect(() => {
    setDark(localStorage.getItem("brain-theme") === "dark");
  }, []);
  useEffect(() => {
    const root = shellRef.current?.closest(".brain");
    if (!root) return;
    root.classList.toggle("brain-night", dark);
    localStorage.setItem("brain-theme", dark ? "dark" : "light");
  }, [dark]);

  /* ── navigare ── */
  const go = useCallback((v: View) => {
    withTransition(() => {
      setView(v);
      setEditing(false);
      setDraft(null);
      if (v.kind === "page") {
        setExpanded((prev) => {
          const next = new Set(prev);
          let p = byId.get(v.id);
          while (p?.parentId != null) {
            next.add(p.parentId);
            p = byId.get(p.parentId);
          }
          return next;
        });
      }
    });
  }, [byId]);

  /* ── autosave pagină ── */
  const flushSave = useCallback(async (pageId: number, d: NonNullable<typeof draft>) => {
    setSaveState("saving");
    try {
      const { page } = await api(`pages/${pageId}`, "PATCH", {
        title: d.title || "Untitled",
        description: d.description,
        icon: d.icon,
        contentMd: d.contentMd,
      });
      setPages((prev) => prev.map((p) => (p.id === page.id ? page : p)));
      setSaveState("saved");
    } catch {
      setSaveState("idle");
      setToast({ msg: "Salvarea a eșuat — reîncearcă" });
    }
  }, []);

  const scheduleSave = useCallback(
    (pageId: number, d: NonNullable<typeof draft>) => {
      setDraft(d);
      setSaveState("saving");
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => flushSave(pageId, d), 700);
    },
    [flushSave],
  );

  function startEdit(p: Page) {
    setDraft({ title: p.title, description: p.description ?? "", icon: p.icon ?? "", contentMd: p.contentMd });
    setEditing(true);
  }

  function stopEdit() {
    if (saveTimer.current && draft && selected) {
      clearTimeout(saveTimer.current);
      flushSave(selected.id, draft);
    }
    setEditing(false);
    setDraft(null);
  }

  /* ── acțiuni ── */
  const newPage = useCallback(async (parentId: number | null) => {
    try {
      const { page } = await api("pages", "POST", { title: "Pagină nouă", parentId });
      setPages((prev) => [...prev, page]);
      if (parentId != null) setExpanded((prev) => new Set(prev).add(parentId));
      withTransition(() => setView({ kind: "page", id: page.id }));
      setDraft({ title: page.title, description: "", icon: "", contentMd: "" });
      setEditing(true);
      setTimeout(() => { titleRef.current?.focus(); titleRef.current?.select(); }, 60);
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : String(err) });
    }
  }, []);

  async function deletePage(p: Page) {
    if (!confirm(`Ștergi pagina „${p.title}"?`)) return;
    try {
      await api(`pages/${p.id}`, "DELETE");
      setPages((prev) => prev.filter((x) => x.id !== p.id));
      go(p.parentId != null ? { kind: "page", id: p.parentId } : { kind: "home" });
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : String(err) });
    }
  }

  const saveCapture = useCallback(async () => {
    const { text, tags } = extractTags(capture);
    if (!text) return;
    try {
      const { thought } = await api("thoughts", "POST", { contentMd: text, tags });
      setThoughts((prev) => [thought, ...prev]);
      setCapture("");
      setToast({ msg: tags.length ? `Gând salvat · ${tags.map((t) => `#${t}`).join(" ")}` : "Gând salvat" });
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : String(err) });
    }
  }, [capture]);

  async function saveThoughtEdit() {
    if (!thoughtEdit) return;
    const { text, tags } = extractTags(thoughtEdit.content);
    if (!text) return;
    const orig = thoughts.find((t) => t.id === thoughtEdit.id);
    const mergedTags = [...new Set([...(tags.length ? tags : orig?.tags ?? [])])];
    try {
      const { thought } = await api(`thoughts/${thoughtEdit.id}`, "PATCH", { contentMd: text, tags: mergedTags });
      setThoughts((prev) => prev.map((t) => (t.id === thought.id ? thought : t)));
      setThoughtEdit(null);
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : String(err) });
    }
  }

  function deleteThought(t: Thought) {
    // optimist + undo, fără confirm
    setThoughts((prev) => prev.filter((x) => x.id !== t.id));
    api(`thoughts/${t.id}`, "DELETE").catch(() => {
      setThoughts((prev) => [t, ...prev].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      setToast({ msg: "Ștergerea a eșuat" });
      return;
    });
    setToast({
      msg: "Gând șters",
      undo: async () => {
        try {
          const { thought } = await api("thoughts", "POST", { contentMd: t.contentMd, tags: t.tags });
          setThoughts((prev) => [thought, ...prev]);
        } catch {
          setToast({ msg: "Undo a eșuat" });
        }
      },
    });
  }

  /* ── toast auto-hide ── */
  useEffect(() => {
    if (!toast) return;
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 6000);
    return () => { if (toastTimer.current) clearTimeout(toastTimer.current); };
  }, [toast]);

  /* ── command palette ── */
  const paletteItems = useMemo<PaletteItem[]>(() => {
    const items: PaletteItem[] = [
      { key: "a-home", label: "Du-te la: Azi", hint: "g h", action: () => go({ kind: "home" }) },
      { key: "a-thoughts", label: "Du-te la: Thoughts", hint: "g t", action: () => go({ kind: "thoughts" }) },
      { key: "a-new-thought", label: "Gând nou", hint: "n", action: () => { go({ kind: "home" }); setTimeout(() => captureRef.current?.focus(), 80); } },
      { key: "a-new-page", label: "Pagină nouă", hint: "p", action: () => newPage(null) },
      { key: "a-theme", label: dark ? "Temă: light" : "Temă: dark", action: () => setDark((d) => !d) },
    ];
    for (const p of pages) {
      items.push({
        key: `p-${p.id}`,
        label: `${p.icon ? p.icon + " " : ""}${p.title}`,
        hint: p.description ?? undefined,
        action: () => go({ kind: "page", id: p.id }),
      });
    }
    for (const t of thoughts.slice(0, 100)) {
      items.push({
        key: `t-${t.id}`,
        label: t.contentMd.replace(/\n+/g, " ").slice(0, 80),
        hint: t.tags.map((x) => `#${x}`).join(" ") || thoughtDate(t.createdAt),
        action: () => { setActiveTag(null); setThoughtFilter(t.contentMd.slice(0, 30)); go({ kind: "thoughts" }); },
      });
    }
    return items;
  }, [pages, thoughts, dark, go, newPage]);

  const paletteResults = useMemo(() => {
    const q = paletteQ.trim().toLowerCase();
    if (!q) return paletteItems.slice(0, 9);
    return paletteItems
      .map((it) => {
        const l = it.label.toLowerCase();
        const h = (it.hint ?? "").toLowerCase();
        let score = -1;
        if (l.startsWith(q)) score = 3;
        else if (l.includes(q)) score = 2;
        else if (h.includes(q)) score = 1;
        return { it, score };
      })
      .filter((x) => x.score >= 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 9)
      .map((x) => x.it);
  }, [paletteQ, paletteItems]);

  useEffect(() => setPaletteIdx(0), [paletteQ, paletteOpen]);

  function openPalette() {
    setPaletteQ("");
    setPaletteOpen(true);
    setTimeout(() => paletteInputRef.current?.focus(), 40);
  }

  /* ── shortcuts globale ── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tgt = e.target as HTMLElement;
      const typing = tgt.tagName === "INPUT" || tgt.tagName === "TEXTAREA" || tgt.isContentEditable;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openPalette();
        return;
      }
      if (paletteOpen) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setPaletteIdx((i) => Math.min(i + 1, paletteResults.length - 1));
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setPaletteIdx((i) => Math.max(i - 1, 0));
        } else if (e.key === "Enter") {
          e.preventDefault();
          const it = paletteResults[paletteIdx];
          if (it) {
            setPaletteOpen(false);
            it.action();
          }
        } else if (e.key === "Escape") {
          setPaletteOpen(false);
        }
        return;
      }
      if (e.key === "Escape") {
        if (editing) { stopEdit(); return; }
        if (typing) tgt.blur();
        return;
      }
      if (typing || paletteOpen || e.metaKey || e.ctrlKey || e.altKey) return;

      const now = Date.now();
      const seq = now - lastKey.current.t < 600 ? lastKey.current.k : "";
      lastKey.current = { k: e.key.toLowerCase(), t: now };

      if (seq === "g") {
        if (e.key === "h") { e.preventDefault(); go({ kind: "home" }); }
        if (e.key === "t") { e.preventDefault(); go({ kind: "thoughts" }); }
        return;
      }
      switch (e.key.toLowerCase()) {
        case "n":
          e.preventDefault();
          go({ kind: "home" });
          setTimeout(() => captureRef.current?.focus(), 80);
          break;
        case "p":
          e.preventDefault();
          newPage(view.kind === "page" ? (selected?.id ?? null) : null);
          break;
        case "e":
          if (selected && !editing) { e.preventDefault(); startEdit(selected); }
          break;
        case "/":
          if (view.kind === "thoughts") { e.preventDefault(); filterRef.current?.focus(); }
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paletteOpen, paletteResults, paletteIdx, editing, selected, view, go, newPage]);

  /* ── date derivate ── */
  const crumbs = useMemo(() => {
    const chain: Page[] = [];
    let p = selected;
    while (p) {
      chain.unshift(p);
      p = p.parentId != null ? byId.get(p.parentId) ?? null : null;
    }
    return chain;
  }, [selected, byId]);

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

  const stadiuLive = useMemo(() => pages.find((p) => p.slug === "stadiu-live"), [pages]);
  const dileme = useMemo(() => pages.find((p) => p.slug === "intrebari-deschise"), [pages]);
  const recentPages = useMemo(
    () => [...pages].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 6),
    [pages],
  );

  /* ── componente de view ── */

  function renderTree(parentId: number | null, depth: number): React.ReactNode {
    return childrenOf(parentId).map((p) => {
      const kids = childrenOf(p.id);
      const isOpen = expanded.has(p.id);
      const active = view.kind === "page" && view.id === p.id;
      return (
        <div key={p.id}>
          <div
            className={`brain-tree-row${active ? " active" : ""}`}
            style={{ paddingLeft: `${depth * 14 + 2}px` }}
            onClick={() => go({ kind: "page", id: p.id })}
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
              tabIndex={-1}
              aria-label="toggle"
            >
              <ChevronRight size={11} strokeWidth={2.2} />
            </button>
            <PageIcon page={p} size={13} />
            <span className="brain-tree-title">{p.title}</span>
          </div>
          {isOpen && kids.length > 0 && renderTree(p.id, depth + 1)}
        </div>
      );
    });
  }

  function renderThoughtRow(t: Thought, compact = false) {
    const isOpen = openThoughts.has(t.id);
    const long = !compact && (t.contentMd.length > 280 || t.contentMd.split("\n").length > 4);
    return (
      <div key={t.id} className={`brain-thought${compact ? " compact" : ""}`}>
        <div className="brain-thought-head">
          <span className="brain-time">{compact ? relTime(t.createdAt) : thoughtDate(t.createdAt)}</span>
          <span className="brain-thought-tags">
            {t.tags.map((tag) => (
              <button
                key={tag}
                className="brain-chip"
                onClick={() => { setActiveTag(tag); if (view.kind !== "thoughts") go({ kind: "thoughts" }); }}
              >
                #{tag}
              </button>
            ))}
          </span>
          {!compact && (
            <span className="brain-thought-actions">
              <button onClick={() => setThoughtEdit({ id: t.id, content: t.contentMd })}>
                <Pencil size={11} strokeWidth={2} />
              </button>
              <button onClick={() => deleteThought(t)}>
                <Trash2 size={11} strokeWidth={2} />
              </button>
            </span>
          )}
        </div>
        {thoughtEdit?.id === t.id ? (
          <div className="brain-capture inline">
            <textarea
              autoFocus
              value={thoughtEdit.content}
              onChange={(e) => setThoughtEdit({ ...thoughtEdit, content: e.target.value })}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") saveThoughtEdit();
                if (e.key === "Escape") setThoughtEdit(null);
              }}
            />
            <div className="brain-capture-foot">
              <span className="brain-kbd-hint">⌘↵ salvează · esc anulează</span>
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
                {isOpen ? "restrânge" : "arată tot"}
              </button>
            )}
          </>
        )}
      </div>
    );
  }

  const quickCapture = (
    <div className="brain-capture">
      <textarea
        ref={captureRef}
        placeholder="Capturează un gând… folosește #taguri inline"
        value={capture}
        onChange={(e) => setCapture(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); saveCapture(); }
        }}
        rows={capture.includes("\n") || capture.length > 90 ? 4 : 2}
      />
      <div className="brain-capture-foot">
        <span className="brain-kbd-hint">n focus · #tag inline</span>
        <button className="brain-btn primary sm" disabled={!extractTags(capture).text} onClick={saveCapture}>
          Salvează <kbd>⌘↵</kbd>
        </button>
      </div>
    </div>
  );

  return (
    <div className="brain-shell" ref={shellRef}>
      <header className="brain-topbar">
        <a
          className="brain-brand"
          href="/brain"
          onClick={(e) => { e.preventDefault(); go({ kind: "home" }); }}
        >
          <span className="brain-brand-dot" />
          Brain
        </a>
        <nav className="brain-nav">
          <button className={view.kind === "home" ? "active" : ""} onClick={() => go({ kind: "home" })}>
            Azi
          </button>
          <button className={view.kind === "thoughts" ? "active" : ""} onClick={() => go({ kind: "thoughts" })}>
            Thoughts
          </button>
        </nav>
        <div className="brain-topbar-right">
          <button className="brain-search-btn" onClick={openPalette}>
            <Search size={12.5} strokeWidth={2} />
            <span>Caută sau comandă…</span>
            <kbd>⌘K</kbd>
          </button>
          <button className="brain-theme-btn" title="Temă" onClick={() => setDark(!dark)}>
            {dark ? <Sun size={14} strokeWidth={1.8} /> : <Moon size={14} strokeWidth={1.8} />}
          </button>
        </div>
      </header>

      <div className="brain-body">
        <aside className="brain-sidebar">
          <div className="brain-label">Pages</div>
          <nav className="brain-tree">{renderTree(null, 0)}</nav>
          {view.kind === "thoughts" && tagCounts.length > 0 && (
            <>
              <div className="brain-label" style={{ marginTop: 12 }}>Tags</div>
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
              </nav>
            </>
          )}
          <button className="brain-btn brain-newpage" onClick={() => newPage(null)}>
            <Plus size={12} strokeWidth={2} /> New page <kbd>p</kbd>
          </button>
        </aside>

        <main className="brain-main">
          {view.kind === "home" && (
            <div className="brain-dash">
              <div className="brain-dash-head">
                <h1 className="brain-h1">Azi</h1>
                <span className="brain-time">
                  {new Date().toLocaleDateString("ro-RO", { weekday: "long", day: "numeric", month: "long" })}
                </span>
              </div>
              {quickCapture}
              <div className="brain-dash-grid">
                <section className="brain-card" onClick={() => stadiuLive && go({ kind: "page", id: stadiuLive.id })}>
                  <div className="brain-card-title">📊 Stadiu live</div>
                  {stadiuLive ? <Md text={stadiuLive.contentMd} /> : <p className="brain-muted">—</p>}
                </section>
                <section className="brain-card" onClick={() => dileme && go({ kind: "page", id: dileme.id })}>
                  <div className="brain-card-title">❓ Întrebări deschise</div>
                  {dileme ? <Md text={dileme.contentMd} /> : <p className="brain-muted">—</p>}
                </section>
              </div>
              <div className="brain-dash-grid">
                <section className="brain-dash-list">
                  <div className="brain-label">Gânduri recente</div>
                  {thoughts.slice(0, 5).map((t) => renderThoughtRow(t, true))}
                  {!thoughts.length && <p className="brain-muted">niciun gând încă</p>}
                </section>
                <section className="brain-dash-list">
                  <div className="brain-label">Atinse recent</div>
                  {recentPages.map((p) => (
                    <button key={p.id} className="brain-recent-row" onClick={() => go({ kind: "page", id: p.id })}>
                      <PageIcon page={p} size={13} />
                      <span className="brain-recent-title">{p.title}</span>
                      <span className="brain-time">{relTime(p.updatedAt)}</span>
                    </button>
                  ))}
                </section>
              </div>
            </div>
          )}

          {view.kind === "page" && selected && (
            <article className="brain-page">
              <div className="brain-page-top">
                <div className="brain-crumbs">
                  <button onClick={() => go({ kind: "home" })}>Brain</button>
                  {crumbs.slice(0, -1).map((c) => (
                    <span key={c.id}>
                      <span>/</span>
                      <button onClick={() => go({ kind: "page", id: c.id })}>{c.title}</button>
                    </span>
                  ))}
                </div>
                <div className="brain-page-actions">
                  {editing ? (
                    <span className={`brain-save-state ${saveState}`}>
                      {saveState === "saving" ? "se salvează…" : saveState === "saved" ? "salvat ✓" : ""}
                    </span>
                  ) : (
                    <span className="brain-time">upd {relTime(selected.updatedAt)}</span>
                  )}
                  {!editing && (
                    <>
                      <button className="brain-btn sm" onClick={() => startEdit(selected)}>
                        <Pencil size={11} strokeWidth={2} /> Edit <kbd>e</kbd>
                      </button>
                      <button className="brain-btn sm" onClick={() => newPage(selected.id)}>
                        <Plus size={11.5} strokeWidth={2} /> Sub-page
                      </button>
                      <button className="brain-btn sm danger icon-only" title="Delete" onClick={() => deletePage(selected)}>
                        <Trash2 size={11.5} strokeWidth={2} />
                      </button>
                    </>
                  )}
                  {editing && (
                    <button className="brain-btn sm" onClick={stopEdit}>
                      Done <kbd>esc</kbd>
                    </button>
                  )}
                </div>
              </div>

              {editing && draft ? (
                <div className="brain-inline-editor">
                  <div className="brain-editor-titlerow">
                    <input
                      className="brain-editor-icon"
                      placeholder="🧠"
                      value={draft.icon}
                      onChange={(e) => scheduleSave(selected.id, { ...draft, icon: e.target.value })}
                    />
                    <input
                      ref={titleRef}
                      className="brain-editor-title"
                      placeholder="Titlu"
                      value={draft.title}
                      onChange={(e) => scheduleSave(selected.id, { ...draft, title: e.target.value })}
                    />
                  </div>
                  <input
                    className="brain-editor-desc"
                    placeholder="Descriere scurtă (subtitlu italic)"
                    value={draft.description}
                    onChange={(e) => scheduleSave(selected.id, { ...draft, description: e.target.value })}
                  />
                  <textarea
                    className="brain-editor-content"
                    placeholder="Markdown…"
                    value={draft.contentMd}
                    onChange={(e) => scheduleSave(selected.id, { ...draft, contentMd: e.target.value })}
                  />
                </div>
              ) : (
                <>
                  <h1 className="brain-h1">
                    {selected.icon && <span className="brain-h1-emoji">{selected.icon}</span>}
                    {selected.title}
                  </h1>
                  {selected.description && <p className="brain-page-desc">{selected.description}</p>}
                  <div className="brain-rule" />
                  {selected.contentMd.trim() ? (
                    <div onDoubleClick={() => startEdit(selected)}>
                      <Md text={selected.contentMd} />
                    </div>
                  ) : (
                    <button className="brain-placeholder" onClick={() => startEdit(selected)}>
                      Pagină goală — apasă <kbd>e</kbd> sau click ca să scrii.
                    </button>
                  )}
                  {childrenOf(selected.id).length > 0 && (
                    <section className="brain-subpages">
                      <div className="brain-label">Sub-pages · {childrenOf(selected.id).length}</div>
                      {childrenOf(selected.id)
                        .slice()
                        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
                        .map((p) => (
                          <div key={p.id} className="brain-subpage-row" onClick={() => go({ kind: "page", id: p.id })}>
                            <div>
                              <div className="brain-subpage-title">
                                {p.icon && <span className="brain-subpage-emoji">{p.icon}</span>}
                                {p.title}
                                <ChevronRight size={14} className="brain-subpage-arrow" strokeWidth={2} />
                              </div>
                              {p.description && <div className="brain-subpage-desc">{p.description}</div>}
                            </div>
                            <span className="brain-time">{relTime(p.updatedAt)}</span>
                          </div>
                        ))}
                    </section>
                  )}
                </>
              )}
            </article>
          )}

          {view.kind === "thoughts" && (
            <article className="brain-page thoughts">
              <div className="brain-dash-head">
                <h1 className="brain-h1">Thoughts</h1>
                <span className="brain-time">{thoughts.length} gânduri</span>
              </div>
              {quickCapture}
              <div className="brain-filter-row">
                <input
                  ref={filterRef}
                  className="brain-thought-filter"
                  placeholder="Filtrează…  ( / )"
                  value={thoughtFilter}
                  onChange={(e) => setThoughtFilter(e.target.value)}
                />
                {activeTag && (
                  <button className="brain-chip active" onClick={() => setActiveTag(null)}>
                    #{activeTag} ✕
                  </button>
                )}
              </div>
              {visibleThoughts.map((t) => renderThoughtRow(t))}
              {!visibleThoughts.length && <div className="brain-muted" style={{ padding: "24px 0" }}>Nimic aici.</div>}
            </article>
          )}
        </main>
      </div>

      {paletteOpen && (
        <div className="brain-palette-overlay" onClick={() => setPaletteOpen(false)}>
          <div className="brain-palette" onClick={(e) => e.stopPropagation()}>
            <div className="brain-palette-input">
              <Command size={14} strokeWidth={2} />
              <input
                ref={paletteInputRef}
                placeholder="Caută pagini, gânduri, comenzi…"
                value={paletteQ}
                onChange={(e) => setPaletteQ(e.target.value)}
              />
              <kbd>esc</kbd>
            </div>
            <div className="brain-palette-list">
              {paletteResults.map((it, i) => (
                <button
                  key={it.key}
                  className={`brain-palette-item${i === paletteIdx ? " active" : ""}`}
                  onMouseEnter={() => setPaletteIdx(i)}
                  onClick={() => { setPaletteOpen(false); it.action(); }}
                >
                  <span className="brain-palette-label">{it.label}</span>
                  {it.hint && <span className="brain-palette-hint">{it.hint}</span>}
                </button>
              ))}
              {!paletteResults.length && <div className="brain-muted" style={{ padding: 14 }}>Niciun rezultat.</div>}
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="brain-toast">
          <span>{toast.msg}</span>
          {toast.undo && (
            <button onClick={() => { toast.undo!(); setToast(null); }}>Undo</button>
          )}
        </div>
      )}
    </div>
  );
}

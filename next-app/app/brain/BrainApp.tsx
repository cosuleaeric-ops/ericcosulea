"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Check,
  ChevronRight,
  Command,
  FileText,
  Moon,
  Network,
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
type Thought = { id: number; contentMd: string; tags: string[]; createdAt: string };
type View = { kind: "home" } | { kind: "thoughts" } | { kind: "graph" } | { kind: "page"; id: number };

/* ── helpers ── */
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
function extractTags(raw: string): { text: string; tags: string[] } {
  const tags = [...new Set([...raw.matchAll(/(^|\s)#([a-zA-Z0-9ăâîșț\-_]+)/g)].map((m) => m[2].toLowerCase()))];
  const text = raw.replace(/(^|\s)#[a-zA-Z0-9ăâîșț\-_]+/g, " ").replace(/[ \t]+/g, " ").trim();
  return { text, tags };
}
function wikiNames(text: string): string[] {
  return [...text.matchAll(/\[\[([^\]\n]+)\]\]/g)].map((m) => m[1].trim());
}
function preprocessWiki(text: string): string {
  return text.replace(/\[\[([^\]\n]+)\]\]/g, (_, name) => `[${name}](brain://${encodeURIComponent(name.trim())})`);
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

/* ── markdown cu wikilinks ── */
const MdRich = memo(function MdRich({
  text,
  resolve,
  onNav,
}: {
  text: string;
  resolve: (name: string) => Page | null;
  onNav: (name: string) => void;
}) {
  return (
    <div className="brain-md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => {
            if (href && href.startsWith("brain://")) {
              const name = decodeURIComponent(href.slice(8));
              const exists = !!resolve(name);
              return (
                <button
                  type="button"
                  className={`brain-wikilink${exists ? "" : " missing"}`}
                  onClick={(e) => { e.preventDefault(); onNav(name); }}
                >
                  {children}
                </button>
              );
            }
            return <a href={href} target="_blank" rel="noreferrer">{children}</a>;
          },
        }}
      >
        {preprocessWiki(text)}
      </ReactMarkdown>
    </div>
  );
});

/* ── force layout pentru graph (determinist) ── */
function computeLayout(ids: number[], edges: [number, number][], w: number, h: number) {
  const pos = new Map<number, { x: number; y: number; vx: number; vy: number }>();
  const R = Math.min(w, h) * 0.32;
  ids.forEach((id, i) => {
    const a = (i / Math.max(1, ids.length)) * Math.PI * 2;
    pos.set(id, { x: w / 2 + Math.cos(a) * R, y: h / 2 + Math.sin(a) * R, vx: 0, vy: 0 });
  });
  for (let iter = 0; iter < 320; iter++) {
    for (const a of ids)
      for (const b of ids) {
        if (a === b) continue;
        const pa = pos.get(a)!, pb = pos.get(b)!;
        let dx = pa.x - pb.x, dy = pa.y - pb.y;
        const d2 = dx * dx + dy * dy || 0.01;
        const f = Math.min(0.9, 1900 / d2);
        pa.vx += dx * f; pa.vy += dy * f;
      }
    for (const [s, t] of edges) {
      const ps = pos.get(s), pt = pos.get(t);
      if (!ps || !pt) continue;
      const dx = pt.x - ps.x, dy = pt.y - ps.y;
      const d = Math.hypot(dx, dy) || 0.01;
      const f = (d - 90) * 0.03;
      ps.vx += (dx / d) * f; ps.vy += (dy / d) * f;
      pt.vx -= (dx / d) * f; pt.vy -= (dy / d) * f;
    }
    for (const id of ids) {
      const p = pos.get(id)!;
      p.vx += (w / 2 - p.x) * 0.02; p.vy += (h / 2 - p.y) * 0.02;
      p.x += Math.max(-9, Math.min(9, p.vx)); p.y += Math.max(-9, Math.min(9, p.vy));
      p.vx *= 0.86; p.vy *= 0.86;
    }
  }
  for (const id of ids) {
    const p = pos.get(id)!;
    p.x = Math.max(28, Math.min(w - 28, p.x));
    p.y = Math.max(24, Math.min(h - 24, p.y));
  }
  return pos;
}

type PaletteItem = { key: string; label: string; hint?: string; action: () => void };

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

  const [capture, setCapture] = useState("");
  const [thoughtFilter, setThoughtFilter] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [openThoughts, setOpenThoughts] = useState<Set<number>>(new Set());
  const [thoughtEdit, setThoughtEdit] = useState<{ id: number; content: string } | null>(null);
  const [sel, setSel] = useState<Set<number>>(new Set());

  const [dragId, setDragId] = useState<number | null>(null);
  const [dropT, setDropT] = useState<{ id: number; pos: "before" | "inside" } | null>(null);

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
  const [draft, setDraft] = useState<{ title: string; description: string; icon: string; contentMd: string } | null>(null);

  const childrenOf = useCallback(
    (parentId: number | null) =>
      pages.filter((p) => p.parentId === parentId).sort((a, b) => a.sort - b.sort || a.title.localeCompare(b.title)),
    [pages],
  );
  const resolveByName = useCallback(
    (name: string): Page | null => {
      const l = name.trim().toLowerCase();
      return pages.find((p) => p.title.toLowerCase() === l || p.slug === l) ?? null;
    },
    [pages],
  );

  /* ── temă ── */
  useEffect(() => { setDark(localStorage.getItem("brain-theme") === "dark"); }, []);
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
      setSel(new Set());
      if (v.kind === "page") {
        setExpanded((prev) => {
          const next = new Set(prev);
          let p = byId.get(v.id);
          while (p?.parentId != null) { next.add(p.parentId); p = byId.get(p.parentId); }
          return next;
        });
      }
    });
  }, [byId]);

  const navByName = useCallback((name: string) => {
    const p = resolveByName(name);
    if (p) go({ kind: "page", id: p.id });
    else {
      api("pages", "POST", { title: name }).then(({ page }) => {
        setPages((prev) => [...prev, page]);
        go({ kind: "page", id: page.id });
      }).catch((err) => setToast({ msg: err instanceof Error ? err.message : String(err) }));
    }
  }, [resolveByName, go]);

  /* ── autosave pagină ── */
  const flushSave = useCallback(async (pageId: number, d: NonNullable<typeof draft>) => {
    setSaveState("saving");
    try {
      const { page } = await api(`pages/${pageId}`, "PATCH", {
        title: d.title || "Untitled", description: d.description, icon: d.icon, contentMd: d.contentMd,
      });
      setPages((prev) => prev.map((p) => (p.id === page.id ? page : p)));
      setSaveState("saved");
    } catch {
      setSaveState("idle");
      setToast({ msg: "Salvarea a eșuat — reîncearcă" });
    }
  }, []);
  const scheduleSave = useCallback((pageId: number, d: NonNullable<typeof draft>) => {
    setDraft(d); setSaveState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => flushSave(pageId, d), 700);
  }, [flushSave]);
  function startEdit(p: Page) {
    setDraft({ title: p.title, description: p.description ?? "", icon: p.icon ?? "", contentMd: p.contentMd });
    setEditing(true);
  }
  function stopEdit() {
    if (saveTimer.current && draft && selected) { clearTimeout(saveTimer.current); flushSave(selected.id, draft); }
    setEditing(false); setDraft(null);
  }

  /* ── acțiuni pagini ── */
  const newPage = useCallback(async (parentId: number | null) => {
    try {
      const { page } = await api("pages", "POST", { title: "Pagină nouă", parentId });
      setPages((prev) => [...prev, page]);
      if (parentId != null) setExpanded((prev) => new Set(prev).add(parentId));
      withTransition(() => setView({ kind: "page", id: page.id }));
      setDraft({ title: page.title, description: "", icon: "", contentMd: "" });
      setEditing(true);
      setTimeout(() => { titleRef.current?.focus(); titleRef.current?.select(); }, 60);
    } catch (err) { setToast({ msg: err instanceof Error ? err.message : String(err) }); }
  }, []);
  async function deletePage(p: Page) {
    if (!confirm(`Ștergi pagina „${p.title}"?`)) return;
    try {
      await api(`pages/${p.id}`, "DELETE");
      setPages((prev) => prev.filter((x) => x.id !== p.id));
      go(p.parentId != null ? { kind: "page", id: p.parentId } : { kind: "home" });
    } catch (err) { setToast({ msg: err instanceof Error ? err.message : String(err) }); }
  }

  /* ── drag & drop tree ── */
  function isDescendant(maybeChild: number, ancestor: number): boolean {
    let p = byId.get(maybeChild);
    while (p?.parentId != null) { if (p.parentId === ancestor) return true; p = byId.get(p.parentId); }
    return false;
  }
  async function movePage(drag: number, target: { id: number; pos: "before" | "inside" }) {
    if (drag === target.id) return;
    if (target.pos === "inside" && isDescendant(target.id, drag)) return;
    const dragPage = byId.get(drag);
    if (!dragPage) return;
    const newParent = target.pos === "inside" ? target.id : byId.get(target.id)?.parentId ?? null;
    if (newParent != null && (newParent === drag || isDescendant(newParent, drag))) return;
    const sibs = childrenOf(newParent).filter((p) => p.id !== drag);
    let idx = target.pos === "inside" ? sibs.length : sibs.findIndex((s) => s.id === target.id);
    if (idx < 0) idx = sibs.length;
    sibs.splice(idx, 0, dragPage);
    const updates = sibs.map((s, i) => ({ id: s.id, sort: i }));
    setPages((prev) =>
      prev.map((p) => {
        const u = updates.find((x) => x.id === p.id);
        if (!u) return p;
        return { ...p, sort: u.sort, parentId: p.id === drag ? newParent : p.parentId };
      }),
    );
    if (newParent != null) setExpanded((prev) => new Set(prev).add(newParent));
    for (const u of updates) {
      const orig = byId.get(u.id);
      if (!orig) continue;
      const parentChanged = u.id === drag && orig.parentId !== newParent;
      if (orig.sort !== u.sort || parentChanged) {
        api(`pages/${u.id}`, "PATCH", { sort: u.sort, ...(u.id === drag ? { parentId: newParent } : {}) }).catch(() => {});
      }
    }
  }

  /* ── thoughts ── */
  const saveCapture = useCallback(async () => {
    const { text, tags } = extractTags(capture);
    if (!text) return;
    try {
      const { thought } = await api("thoughts", "POST", { contentMd: text, tags });
      setThoughts((prev) => [thought, ...prev]);
      setCapture("");
      setToast({ msg: tags.length ? `Gând salvat · ${tags.map((t) => `#${t}`).join(" ")}` : "Gând salvat" });
    } catch (err) { setToast({ msg: err instanceof Error ? err.message : String(err) }); }
  }, [capture]);
  async function saveThoughtEdit() {
    if (!thoughtEdit) return;
    const { text, tags } = extractTags(thoughtEdit.content);
    if (!text) return;
    const orig = thoughts.find((t) => t.id === thoughtEdit.id);
    const mergedTags = tags.length ? tags : orig?.tags ?? [];
    try {
      const { thought } = await api(`thoughts/${thoughtEdit.id}`, "PATCH", { contentMd: text, tags: mergedTags });
      setThoughts((prev) => prev.map((t) => (t.id === thought.id ? thought : t)));
      setThoughtEdit(null);
    } catch (err) { setToast({ msg: err instanceof Error ? err.message : String(err) }); }
  }
  function deleteThought(t: Thought) {
    setThoughts((prev) => prev.filter((x) => x.id !== t.id));
    api(`thoughts/${t.id}`, "DELETE").catch(() => {
      setThoughts((prev) => [t, ...prev].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      setToast({ msg: "Ștergerea a eșuat" });
    });
    setToast({
      msg: "Gând șters",
      undo: async () => {
        try {
          const { thought } = await api("thoughts", "POST", { contentMd: t.contentMd, tags: t.tags });
          setThoughts((prev) => [thought, ...prev]);
        } catch { setToast({ msg: "Undo a eșuat" }); }
      },
    });
  }
  function bulkDelete() {
    const victims = thoughts.filter((t) => sel.has(t.id));
    if (!victims.length) return;
    setThoughts((prev) => prev.filter((t) => !sel.has(t.id)));
    setSel(new Set());
    victims.forEach((t) => api(`thoughts/${t.id}`, "DELETE").catch(() => {}));
    setToast({
      msg: `${victims.length} gânduri șterse`,
      undo: async () => {
        for (const t of victims) {
          try {
            const { thought } = await api("thoughts", "POST", { contentMd: t.contentMd, tags: t.tags });
            setThoughts((prev) => [thought, ...prev]);
          } catch { /* ignore */ }
        }
      },
    });
  }

  useEffect(() => {
    if (!toast) return;
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 6000);
    return () => { if (toastTimer.current) clearTimeout(toastTimer.current); };
  }, [toast]);

  /* ── palette ── */
  const paletteItems = useMemo<PaletteItem[]>(() => {
    const items: PaletteItem[] = [
      { key: "a-home", label: "Du-te la: Azi", hint: "g h", action: () => go({ kind: "home" }) },
      { key: "a-thoughts", label: "Du-te la: Thoughts", hint: "g t", action: () => go({ kind: "thoughts" }) },
      { key: "a-graph", label: "Du-te la: Graph", hint: "g g", action: () => go({ kind: "graph" }) },
      { key: "a-nt", label: "Gând nou", hint: "n", action: () => { go({ kind: "home" }); setTimeout(() => captureRef.current?.focus(), 80); } },
      { key: "a-np", label: "Pagină nouă", hint: "p", action: () => newPage(null) },
      { key: "a-theme", label: dark ? "Temă: light" : "Temă: dark", action: () => setDark((d) => !d) },
    ];
    for (const p of pages)
      items.push({ key: `p-${p.id}`, label: `${p.icon ? p.icon + " " : ""}${p.title}`, hint: p.description ?? undefined, action: () => go({ kind: "page", id: p.id }) });
    for (const t of thoughts.slice(0, 100))
      items.push({ key: `t-${t.id}`, label: t.contentMd.replace(/\n+/g, " ").slice(0, 80), hint: t.tags.map((x) => `#${x}`).join(" ") || thoughtDate(t.createdAt), action: () => { setActiveTag(null); setThoughtFilter(t.contentMd.slice(0, 30)); go({ kind: "thoughts" }); } });
    return items;
  }, [pages, thoughts, dark, go, newPage]);

  const paletteResults = useMemo(() => {
    const q = paletteQ.trim().toLowerCase();
    if (!q) return paletteItems.slice(0, 9);
    return paletteItems
      .map((it) => {
        const l = it.label.toLowerCase(), h = (it.hint ?? "").toLowerCase();
        let s = -1;
        if (l.startsWith(q)) s = 3; else if (l.includes(q)) s = 2; else if (h.includes(q)) s = 1;
        return { it, s };
      })
      .filter((x) => x.s >= 0).sort((a, b) => b.s - a.s).slice(0, 9).map((x) => x.it);
  }, [paletteQ, paletteItems]);
  useEffect(() => setPaletteIdx(0), [paletteQ, paletteOpen]);
  function openPalette() { setPaletteQ(""); setPaletteOpen(true); setTimeout(() => paletteInputRef.current?.focus(), 40); }

  /* ── shortcuts ── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tgt = e.target as HTMLElement;
      const typing = tgt.tagName === "INPUT" || tgt.tagName === "TEXTAREA" || tgt.isContentEditable;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); openPalette(); return; }
      if (paletteOpen) {
        if (e.key === "ArrowDown") { e.preventDefault(); setPaletteIdx((i) => Math.min(i + 1, paletteResults.length - 1)); }
        else if (e.key === "ArrowUp") { e.preventDefault(); setPaletteIdx((i) => Math.max(i - 1, 0)); }
        else if (e.key === "Enter") { e.preventDefault(); const it = paletteResults[paletteIdx]; if (it) { setPaletteOpen(false); it.action(); } }
        else if (e.key === "Escape") setPaletteOpen(false);
        return;
      }
      if (e.key === "Escape") {
        if (editing) { stopEdit(); return; }
        if (sel.size) { setSel(new Set()); return; }
        if (typing) tgt.blur();
        return;
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      const now = Date.now();
      const seq = now - lastKey.current.t < 600 ? lastKey.current.k : "";
      lastKey.current = { k: e.key.toLowerCase(), t: now };
      if (seq === "g") {
        if (e.key === "h") { e.preventDefault(); go({ kind: "home" }); }
        if (e.key === "t") { e.preventDefault(); go({ kind: "thoughts" }); }
        if (e.key === "g") { e.preventDefault(); go({ kind: "graph" }); }
        return;
      }
      switch (e.key.toLowerCase()) {
        case "n": e.preventDefault(); go({ kind: "home" }); setTimeout(() => captureRef.current?.focus(), 80); break;
        case "p": e.preventDefault(); newPage(view.kind === "page" ? (selected?.id ?? null) : null); break;
        case "e": if (selected && !editing) { e.preventDefault(); startEdit(selected); } break;
        case "/": if (view.kind === "thoughts") { e.preventDefault(); filterRef.current?.focus(); } break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paletteOpen, paletteResults, paletteIdx, editing, sel, selected, view, go, newPage]);

  /* ── date derivate ── */
  const crumbs = useMemo(() => {
    const chain: Page[] = [];
    let p = selected;
    while (p) { chain.unshift(p); p = p.parentId != null ? byId.get(p.parentId) ?? null : null; }
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

  const backlinks = useMemo(() => {
    if (!selected) return [] as Page[];
    return pages.filter((q) => q.id !== selected.id && wikiNames(q.contentMd).some((n) => resolveByName(n)?.id === selected.id));
  }, [selected, pages, resolveByName]);

  const graphData = useMemo(() => {
    const ids = pages.map((p) => p.id);
    const edges: [number, number][] = [];
    for (const p of pages) if (p.parentId != null && byId.has(p.parentId)) edges.push([p.parentId, p.id]);
    for (const p of pages) for (const n of wikiNames(p.contentMd)) { const t = resolveByName(n); if (t && t.id !== p.id) edges.push([p.id, t.id]); }
    const W = 820, H = 520;
    const pos = computeLayout(ids, edges, W, H);
    const deg = new Map<number, number>();
    for (const [s, t] of edges) { deg.set(s, (deg.get(s) ?? 0) + 1); deg.set(t, (deg.get(t) ?? 0) + 1); }
    return { W, H, edges, pos, deg };
  }, [pages, byId, resolveByName]);

  /* ── tree render (cu drag & drop) ── */
  function renderTree(parentId: number | null, depth: number): React.ReactNode {
    return childrenOf(parentId).map((p) => {
      const kids = childrenOf(p.id);
      const isOpen = expanded.has(p.id);
      const active = view.kind === "page" && view.id === p.id;
      const dropInside = dropT?.id === p.id && dropT.pos === "inside";
      const dropBefore = dropT?.id === p.id && dropT.pos === "before";
      return (
        <div key={p.id}>
          <div
            className={`brain-tree-row${active ? " active" : ""}${dropInside ? " drop-inside" : ""}${dropBefore ? " drop-before" : ""}${dragId === p.id ? " dragging" : ""}`}
            style={{ paddingLeft: `${depth * 14 + 2}px` }}
            onClick={() => go({ kind: "page", id: p.id })}
            draggable
            onDragStart={(e) => { setDragId(p.id); e.dataTransfer.effectAllowed = "move"; }}
            onDragEnd={() => { setDragId(null); setDropT(null); }}
            onDragOver={(e) => {
              if (dragId == null || dragId === p.id) return;
              e.preventDefault();
              const r = e.currentTarget.getBoundingClientRect();
              const pos = e.clientY < r.top + r.height * 0.35 ? "before" : "inside";
              setDropT({ id: p.id, pos });
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (dragId != null && dropT) movePage(dragId, dropT);
              setDragId(null); setDropT(null);
            }}
          >
            <button
              className={`brain-tree-chevron${kids.length ? "" : " hidden"}${isOpen ? " open" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                setExpanded((prev) => { const next = new Set(prev); next.has(p.id) ? next.delete(p.id) : next.add(p.id); return next; });
              }}
              tabIndex={-1}
              aria-label="toggle"
            >
              <ChevronRight size={11} strokeWidth={2.2} />
            </button>
            {p.icon ? <span className="brain-emoji" style={{ fontSize: 13 }}>{p.icon}</span> : <FileText size={13} className="brain-doc-ico" strokeWidth={1.8} />}
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
    const selected = sel.has(t.id);
    return (
      <div key={t.id} className={`brain-thought${compact ? " compact" : ""}${selected ? " selected" : ""}`}>
        <div className="brain-thought-head">
          {!compact && (
            <button
              className={`brain-select${selected ? " on" : ""}`}
              onClick={() => setSel((prev) => { const n = new Set(prev); n.has(t.id) ? n.delete(t.id) : n.add(t.id); return n; })}
              title="Selectează"
            >
              {selected && <Check size={10} strokeWidth={3} />}
            </button>
          )}
          <span className="brain-time">{compact ? relTime(t.createdAt) : thoughtDate(t.createdAt)}</span>
          <span className="brain-thought-tags">
            {t.tags.map((tag) => (
              <button key={tag} className="brain-chip" onClick={() => { setActiveTag(tag); if (view.kind !== "thoughts") go({ kind: "thoughts" }); }}>#{tag}</button>
            ))}
          </span>
          {!compact && (
            <span className="brain-thought-actions">
              <button onClick={() => setThoughtEdit({ id: t.id, content: t.contentMd })}><Pencil size={11} strokeWidth={2} /></button>
              <button onClick={() => deleteThought(t)}><Trash2 size={11} strokeWidth={2} /></button>
            </span>
          )}
        </div>
        {thoughtEdit?.id === t.id ? (
          <div className="brain-capture inline">
            <textarea
              autoFocus
              value={thoughtEdit.content}
              onChange={(e) => setThoughtEdit({ ...thoughtEdit, content: e.target.value })}
              onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") saveThoughtEdit(); if (e.key === "Escape") setThoughtEdit(null); }}
            />
            <div className="brain-capture-foot"><span className="brain-kbd-hint">⌘↵ salvează · esc anulează</span></div>
          </div>
        ) : (
          <>
            <div className={long && !isOpen ? "brain-thought-body clamped" : "brain-thought-body"}>
              <MdRich text={t.contentMd} resolve={resolveByName} onNav={navByName} />
            </div>
            {long && (
              <button className="brain-showmore" onClick={() => setOpenThoughts((prev) => { const n = new Set(prev); n.has(t.id) ? n.delete(t.id) : n.add(t.id); return n; })}>
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
        placeholder="Capturează un gând… #taguri inline"
        value={capture}
        onChange={(e) => setCapture(e.target.value)}
        onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); saveCapture(); } }}
        rows={capture.includes("\n") || capture.length > 90 ? 4 : 2}
      />
      <div className="brain-capture-foot">
        <span className="brain-kbd-hint">n focus · #tag inline · [[pagină]] link</span>
        <button className="brain-btn primary sm" disabled={!extractTags(capture).text} onClick={saveCapture}>Salvează <kbd>⌘↵</kbd></button>
      </div>
    </div>
  );

  return (
    <div className="brain-shell" ref={shellRef}>
      <header className="brain-topbar">
        <a className="brain-brand" href="/brain" onClick={(e) => { e.preventDefault(); go({ kind: "home" }); }}>
          <span className="brain-brand-dot" /> Brain
        </a>
        <nav className="brain-nav">
          <button className={view.kind === "home" ? "active" : ""} onClick={() => go({ kind: "home" })}>Azi</button>
          <button className={view.kind === "thoughts" ? "active" : ""} onClick={() => go({ kind: "thoughts" })}>Thoughts</button>
          <button className={view.kind === "graph" ? "active" : ""} onClick={() => go({ kind: "graph" })}>Graph</button>
        </nav>
        <div className="brain-topbar-right">
          <button className="brain-search-btn" onClick={openPalette}>
            <Search size={12.5} strokeWidth={2} /><span>Caută sau comandă…</span><kbd>⌘K</kbd>
          </button>
          <button className="brain-theme-btn" title="Temă" onClick={() => setDark(!dark)}>
            {dark ? <Sun size={14} strokeWidth={1.8} /> : <Moon size={14} strokeWidth={1.8} />}
          </button>
        </div>
      </header>

      <div className="brain-body">
        <aside className="brain-sidebar">
          <div
            className={`brain-label brain-droproot${dropT?.id === -1 ? " drop-inside" : ""}`}
            onDragOver={(e) => { if (dragId != null) { e.preventDefault(); setDropT({ id: -1, pos: "inside" }); } }}
            onDrop={(e) => { e.preventDefault(); if (dragId != null) movePage(dragId, { id: -1, pos: "inside" }); setDragId(null); setDropT(null); }}
          >
            Pages
          </div>
          <nav className="brain-tree">{renderTree(null, 0)}</nav>
          {view.kind === "thoughts" && tagCounts.length > 0 && (
            <>
              <div className="brain-label" style={{ marginTop: 12 }}>Tags</div>
              <nav className="brain-taglist">
                {tagCounts.map(([tag, count]) => (
                  <button key={tag} className={`brain-tag-row${activeTag === tag ? " active" : ""}`} onClick={() => setActiveTag(activeTag === tag ? null : tag)}>
                    <span>#{tag}</span><span className="brain-tag-count">{count}</span>
                  </button>
                ))}
              </nav>
            </>
          )}
          <button className="brain-btn brain-newpage" onClick={() => newPage(null)}><Plus size={12} strokeWidth={2} /> New page <kbd>p</kbd></button>
        </aside>

        <main className="brain-main">
          {view.kind === "home" && (
            <div className="brain-dash">
              <div className="brain-dash-head">
                <h1 className="brain-h1">Azi</h1>
                <span className="brain-time">{new Date().toLocaleDateString("ro-RO", { weekday: "long", day: "numeric", month: "long" })}</span>
              </div>
              {quickCapture}
              <div className="brain-dash-grid">
                <section className="brain-card" onClick={() => stadiuLive && go({ kind: "page", id: stadiuLive.id })}>
                  <div className="brain-card-title">📊 Stadiu live</div>
                  {stadiuLive ? <MdRich text={stadiuLive.contentMd} resolve={resolveByName} onNav={navByName} /> : <p className="brain-muted">—</p>}
                </section>
                <section className="brain-card" onClick={() => dileme && go({ kind: "page", id: dileme.id })}>
                  <div className="brain-card-title">❓ Întrebări deschise</div>
                  {dileme ? <MdRich text={dileme.contentMd} resolve={resolveByName} onNav={navByName} /> : <p className="brain-muted">—</p>}
                </section>
              </div>
            </div>
          )}

          {view.kind === "graph" && (
            <div className="brain-graph">
              <div className="brain-dash-head">
                <h1 className="brain-h1">Graph</h1>
                <span className="brain-time">{pages.length} pagini · {graphData.edges.length} legături</span>
              </div>
              <p className="brain-muted" style={{ marginBottom: 8 }}>Ierarhia + legăturile <code>[[pagină]]</code>. Click pe un nod ca să navighezi.</p>
              <div className="brain-graph-canvas">
                <svg viewBox={`0 0 ${graphData.W} ${graphData.H}`} width="100%" preserveAspectRatio="xMidYMid meet">
                  {graphData.edges.map(([s, t], i) => {
                    const ps = graphData.pos.get(s), pt = graphData.pos.get(t);
                    if (!ps || !pt) return null;
                    return <line key={i} x1={ps.x} y1={ps.y} x2={pt.x} y2={pt.y} className="brain-graph-edge" />;
                  })}
                  {pages.map((p) => {
                    const pp = graphData.pos.get(p.id);
                    if (!pp) return null;
                    const r = 6 + Math.min(8, (graphData.deg.get(p.id) ?? 0) * 1.6);
                    return (
                      <g key={p.id} className="brain-graph-node" onClick={() => go({ kind: "page", id: p.id })} style={{ cursor: "pointer" }}>
                        <circle cx={pp.x} cy={pp.y} r={r} className="brain-graph-dot" />
                        <text x={pp.x} y={pp.y - r - 5} textAnchor="middle" className="brain-graph-label">
                          {p.icon ? `${p.icon} ` : ""}{p.title.length > 22 ? p.title.slice(0, 21) + "…" : p.title}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>
          )}

          {view.kind === "page" && selected && (
            <article className="brain-page">
              <div className="brain-page-top">
                <div className="brain-crumbs">
                  <button onClick={() => go({ kind: "home" })}>Brain</button>
                  {crumbs.slice(0, -1).map((c) => (<span key={c.id}><span>/</span><button onClick={() => go({ kind: "page", id: c.id })}>{c.title}</button></span>))}
                </div>
                <div className="brain-page-actions">
                  {editing ? (
                    <span className={`brain-save-state ${saveState}`}>{saveState === "saving" ? "se salvează…" : saveState === "saved" ? "salvat ✓" : ""}</span>
                  ) : (<span className="brain-time">upd {relTime(selected.updatedAt)}</span>)}
                  {!editing ? (
                    <>
                      <button className="brain-btn sm" onClick={() => startEdit(selected)}><Pencil size={11} strokeWidth={2} /> Edit <kbd>e</kbd></button>
                      <button className="brain-btn sm" onClick={() => newPage(selected.id)}><Plus size={11.5} strokeWidth={2} /> Sub-page</button>
                      <button className="brain-btn sm danger icon-only" title="Delete" onClick={() => deletePage(selected)}><Trash2 size={11.5} strokeWidth={2} /></button>
                    </>
                  ) : (<button className="brain-btn sm" onClick={stopEdit}>Done <kbd>esc</kbd></button>)}
                </div>
              </div>

              {editing && draft ? (
                <div className="brain-inline-editor">
                  <div className="brain-editor-titlerow">
                    <input className="brain-editor-icon" placeholder="🧠" value={draft.icon} onChange={(e) => scheduleSave(selected.id, { ...draft, icon: e.target.value })} />
                    <input ref={titleRef} className="brain-editor-title" placeholder="Titlu" value={draft.title} onChange={(e) => scheduleSave(selected.id, { ...draft, title: e.target.value })} />
                  </div>
                  <input className="brain-editor-desc" placeholder="Descriere scurtă (subtitlu italic)" value={draft.description} onChange={(e) => scheduleSave(selected.id, { ...draft, description: e.target.value })} />
                  <textarea className="brain-editor-content" placeholder="Markdown…  leagă cu [[Titlu pagină]]" value={draft.contentMd} onChange={(e) => scheduleSave(selected.id, { ...draft, contentMd: e.target.value })} />
                </div>
              ) : (
                <>
                  <h1 className="brain-h1">{selected.icon && <span className="brain-h1-emoji">{selected.icon}</span>}{selected.title}</h1>
                  {selected.description && <p className="brain-page-desc">{selected.description}</p>}
                  <div className="brain-rule" />
                  {selected.contentMd.trim() ? (
                    <div onDoubleClick={() => startEdit(selected)}><MdRich text={selected.contentMd} resolve={resolveByName} onNav={navByName} /></div>
                  ) : (
                    <button className="brain-placeholder" onClick={() => startEdit(selected)}>Pagină goală — apasă <kbd>e</kbd> sau click ca să scrii.</button>
                  )}
                  {childrenOf(selected.id).length > 0 && (
                    <section className="brain-subpages">
                      <div className="brain-label">Sub-pages · {childrenOf(selected.id).length}</div>
                      {childrenOf(selected.id).slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map((p) => (
                        <div key={p.id} className="brain-subpage-row" onClick={() => go({ kind: "page", id: p.id })}>
                          <div>
                            <div className="brain-subpage-title">{p.icon && <span className="brain-subpage-emoji">{p.icon}</span>}{p.title}<ChevronRight size={14} className="brain-subpage-arrow" strokeWidth={2} /></div>
                            {p.description && <div className="brain-subpage-desc">{p.description}</div>}
                          </div>
                          <span className="brain-time">{relTime(p.updatedAt)}</span>
                        </div>
                      ))}
                    </section>
                  )}
                  {backlinks.length > 0 && (
                    <section className="brain-backlinks">
                      <div className="brain-label"><Network size={11} strokeWidth={2} style={{ verticalAlign: "-1px", marginRight: 5 }} />Legături către pagina asta · {backlinks.length}</div>
                      {backlinks.map((p) => (
                        <button key={p.id} className="brain-backlink-row" onClick={() => go({ kind: "page", id: p.id })}>
                          {p.icon ? <span className="brain-emoji" style={{ fontSize: 13 }}>{p.icon}</span> : <FileText size={13} className="brain-doc-ico" strokeWidth={1.8} />}
                          <span>{p.title}</span>
                        </button>
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
                <input ref={filterRef} className="brain-thought-filter" placeholder="Filtrează…  ( / )" value={thoughtFilter} onChange={(e) => setThoughtFilter(e.target.value)} />
                {activeTag && <button className="brain-chip active" onClick={() => setActiveTag(null)}>#{activeTag} ✕</button>}
              </div>
              {visibleThoughts.map((t) => renderThoughtRow(t))}
              {!visibleThoughts.length && <div className="brain-muted" style={{ padding: "24px 0" }}>Nimic aici.</div>}
            </article>
          )}
        </main>
      </div>

      {sel.size > 0 && (
        <div className="brain-bulkbar">
          <span>{sel.size} selectate</span>
          <button onClick={bulkDelete}><Trash2 size={12} strokeWidth={2} /> Șterge</button>
          <button onClick={() => setSel(new Set())}>Deselectează</button>
        </div>
      )}

      {paletteOpen && (
        <div className="brain-palette-overlay" onClick={() => setPaletteOpen(false)}>
          <div className="brain-palette" onClick={(e) => e.stopPropagation()}>
            <div className="brain-palette-input">
              <Command size={14} strokeWidth={2} />
              <input ref={paletteInputRef} placeholder="Caută pagini, gânduri, comenzi…" value={paletteQ} onChange={(e) => setPaletteQ(e.target.value)} />
              <kbd>esc</kbd>
            </div>
            <div className="brain-palette-list">
              {paletteResults.map((it, i) => (
                <button key={it.key} className={`brain-palette-item${i === paletteIdx ? " active" : ""}`} onMouseEnter={() => setPaletteIdx(i)} onClick={() => { setPaletteOpen(false); it.action(); }}>
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
          {toast.undo && <button onClick={() => { toast.undo!(); setToast(null); }}>Undo</button>}
        </div>
      )}
    </div>
  );
}

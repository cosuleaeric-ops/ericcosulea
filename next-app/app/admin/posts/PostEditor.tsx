"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Props = {
  initial?: {
    id?: number;
    slug: string;
    title: string;
    contentHtml: string;
    excerpt: string;
    publishedAt: string;
  };
  saveAction: (formData: FormData) => Promise<{ error?: string; redirectTo?: string }>;
};

const DEFAULT_PUBLISHED_AT = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export default function PostEditor({ initial, saveAction }: Props) {
  const router = useRouter();
  const editorRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (editorRef.current && initial?.contentHtml !== undefined) {
      editorRef.current.innerHTML = initial.contentHtml;
    }
  }, [initial?.contentHtml]);

  const exec = (cmd: string, value?: string) => {
    if (editorRef.current) editorRef.current.focus();
    document.execCommand(cmd, false, value);
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set("content_html", editorRef.current?.innerHTML.trim() ?? "");
    if (initial?.id != null) fd.set("id", String(initial.id));
    setError(null);
    startTransition(async () => {
      const result = await saveAction(fd);
      if (result?.error) {
        setError(result.error);
      } else if (result?.redirectTo) {
        router.push(result.redirectTo);
      }
    });
  };

  return (
    <form className="post-editor" onSubmit={onSubmit}>
      {error && <p className="login-error">{error}</p>}

      <label className="form-label" htmlFor="title">Titlu</label>
      <input
        className="form-input"
        type="text"
        id="title"
        name="title"
        defaultValue={initial?.title ?? ""}
        required
      />

      <div className="form-row">
        <div>
          <label className="form-label" htmlFor="slug">Slug</label>
          <input
            className="form-input"
            type="text"
            id="slug"
            name="slug"
            defaultValue={initial?.slug ?? ""}
            placeholder="titlu-articol"
            pattern="[a-z0-9\-]+"
            required
          />
        </div>
        <div>
          <label className="form-label" htmlFor="published_at">Publicat la</label>
          <input
            className="form-input"
            type="datetime-local"
            id="published_at"
            name="published_at"
            defaultValue={initial?.publishedAt ?? DEFAULT_PUBLISHED_AT()}
            required
          />
        </div>
      </div>

      <label className="form-label" htmlFor="excerpt">Excerpt (opțional)</label>
      <textarea
        className="form-input"
        id="excerpt"
        name="excerpt"
        rows={2}
        defaultValue={initial?.excerpt ?? ""}
      />

      <label className="form-label">Conținut</label>
      <div className="editor-toolbar">
        <select onChange={(e) => exec("formatBlock", e.target.value)} defaultValue="P">
          <option value="P">paragraf</option>
          <option value="H2">heading mare</option>
          <option value="H3">heading mic</option>
        </select>
        <button type="button" onClick={() => exec("bold")}><strong>B</strong></button>
        <button type="button" onClick={() => exec("italic")}><em>I</em></button>
        <button type="button" onClick={() => exec("insertUnorderedList")}>lista</button>
        <button type="button" onClick={() => exec("insertOrderedList")}>1. 2. 3.</button>
        <button type="button" onClick={() => exec("formatBlock", "blockquote")}>quote</button>
        <button type="button" onClick={() => {
          const url = prompt("URL link:");
          if (url) exec("createLink", url);
        }}>link</button>
        <button type="button" onClick={() => exec("unlink")}>unlink</button>
      </div>
      <div
        ref={editorRef}
        className="editor"
        contentEditable
        suppressContentEditableWarning
      />

      <div className="form-actions">
        <button type="submit" className="btn" disabled={pending}>
          {pending ? "..." : "salvează"}
        </button>
      </div>
    </form>
  );
}

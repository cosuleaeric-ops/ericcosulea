"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type ActionState = { error?: string } | undefined;

type Props = {
  initial?: {
    id?: number;
    slug: string;
    title: string;
    contentHtml: string;
    excerpt: string;
    publishedAt: string;
  };
  saveAction: (prev: ActionState, formData: FormData) => Promise<ActionState>;
};

const DEFAULT_PUBLISHED_AT = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "..." : "salvează"}
    </Button>
  );
}

export default function PostEditor({ initial, saveAction }: Props) {
  const [state, formAction] = useActionState(saveAction, undefined);
  const editorRef = useRef<HTMLDivElement>(null);
  const [contentHtml, setContentHtml] = useState(initial?.contentHtml ?? "");

  useEffect(() => {
    if (editorRef.current && initial?.contentHtml) {
      editorRef.current.innerHTML = initial.contentHtml;
    }
  }, [initial?.contentHtml]);

  const exec = (cmd: string, value?: string) => {
    if (editorRef.current) editorRef.current.focus();
    document.execCommand(cmd, false, value);
    if (editorRef.current) setContentHtml(editorRef.current.innerHTML);
  };

  const onEditorInput = () => {
    if (editorRef.current) setContentHtml(editorRef.current.innerHTML);
  };

  return (
    <form className="mt-6 flex flex-col gap-4" action={formAction}>
      {initial?.id != null && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="content_html" value={contentHtml} />

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <div className="grid gap-2">
        <Label htmlFor="title">Titlu</Label>
        <Input type="text" id="title" name="title" defaultValue={initial?.title ?? ""} required />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="slug">Slug</Label>
          <Input
            type="text"
            id="slug"
            name="slug"
            defaultValue={initial?.slug ?? ""}
            placeholder="titlu-articol"
            pattern="[a-z0-9\-]+"
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="published_at">Publicat la</Label>
          <Input
            type="datetime-local"
            id="published_at"
            name="published_at"
            defaultValue={initial?.publishedAt ?? DEFAULT_PUBLISHED_AT()}
            required
          />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="excerpt">Excerpt (opțional)</Label>
        <Textarea id="excerpt" name="excerpt" rows={2} defaultValue={initial?.excerpt ?? ""} />
      </div>

      <div className="grid gap-2">
        <Label>Conținut</Label>
        <div className="flex flex-wrap items-center gap-1.5">
          <select
            onChange={(e) => exec("formatBlock", e.target.value)}
            defaultValue="P"
            className="h-8 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="P">paragraf</option>
            <option value="H2">heading mare</option>
            <option value="H3">heading mic</option>
          </select>
          <Button type="button" variant="outline" size="sm" onClick={() => exec("bold")}>
            <strong>B</strong>
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => exec("italic")}>
            <em>I</em>
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => exec("insertUnorderedList")}>
            lista
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => exec("insertOrderedList")}>
            1. 2. 3.
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => exec("formatBlock", "blockquote")}>
            quote
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const url = prompt("URL link:");
              if (url) exec("createLink", url);
            }}
          >
            link
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => exec("unlink")}>
            unlink
          </Button>
        </div>
        <div
          ref={editorRef}
          className="admin-prose min-h-[280px] rounded-md border border-input bg-card px-3 py-2 outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          contentEditable
          suppressContentEditableWarning
          onInput={onEditorInput}
        />
      </div>

      <div>
        <SubmitButton />
      </div>
    </form>
  );
}

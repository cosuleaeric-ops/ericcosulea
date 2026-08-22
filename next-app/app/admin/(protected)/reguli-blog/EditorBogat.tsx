"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

type Props = {
  valoare: string;
  onChange: (html: string) => void;
  minHeight: number;
};

export default function EditorBogat({ valoare, onChange, minHeight }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  // Pun conținutul o singură dată, la montare. Dacă l-aș scrie la fiecare
  // randare, cursorul ar sări la început după fiecare tastă.
  useEffect(() => {
    if (ref.current) ref.current.innerHTML = valoare;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const citeste = () => onChange(ref.current?.innerHTML ?? "");

  const exec = (comanda: string, valoareComanda?: string) => {
    ref.current?.focus();
    document.execCommand(comanda, false, valoareComanda);
    citeste();
  };

  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-center gap-1">
        <select
          onChange={(e) => {
            exec("formatBlock", e.target.value);
            e.target.value = "P";
          }}
          defaultValue="P"
          className="h-7 rounded-md border border-input bg-background px-1.5 text-xs"
          aria-label="stil de bloc"
        >
          <option value="P">paragraf</option>
          <option value="H1">h1</option>
          <option value="H2">h2</option>
          <option value="H3">h3</option>
        </select>
        <Button type="button" variant="outline" size="sm" className="h-7 px-2" onClick={() => exec("bold")}>
          <strong>B</strong>
        </Button>
        <Button type="button" variant="outline" size="sm" className="h-7 px-2" onClick={() => exec("italic")}>
          <em>I</em>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => exec("insertUnorderedList")}
        >
          listă
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => exec("insertOrderedList")}
        >
          1. 2. 3.
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => exec("insertHorizontalRule")}
        >
          linie
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => exec("removeFormat")}
        >
          curăță
        </Button>
      </div>
      <div
        ref={ref}
        className="reguli-prose overflow-y-auto rounded-md border border-input bg-card px-3 py-2 outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        style={{ minHeight, maxHeight: minHeight * 2 }}
        contentEditable
        suppressContentEditableWarning
        onInput={citeste}
        onBlur={citeste}
      />
    </div>
  );
}

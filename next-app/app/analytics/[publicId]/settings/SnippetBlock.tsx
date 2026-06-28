"use client";
import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function SnippetBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="dfa-snippet">
      <pre>{code}</pre>
      <button
        className="dfa-btn dfa-snippet-copy"
        onClick={() => {
          navigator.clipboard.writeText(code).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          });
        }}
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

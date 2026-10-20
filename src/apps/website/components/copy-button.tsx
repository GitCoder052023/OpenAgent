"use client";

import { useEffect, useState } from "react";

export function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(t);
  }, [copied]);

  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(value).then(
          () => setCopied(true),
          () => undefined,
        );
      }}
      className="-my-2 -mr-2 inline-flex min-h-11 min-w-11 shrink-0 items-center justify-end pl-3 pr-2 font-mono text-caption uppercase text-night-dim transition-colors duration-200 hover:text-eggshell"
    >
      <span className="sr-only">Copy {value}</span>
      <span aria-hidden="true">{copied ? "copied" : "copy"}</span>
    </button>
  );
}

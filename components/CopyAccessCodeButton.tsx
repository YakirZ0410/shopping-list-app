"use client";

import { Copy } from "lucide-react";
import { useEffect, useState } from "react";

type CopyAccessCodeButtonProps = {
  code: string;
  compact?: boolean;
};

export default function CopyAccessCodeButton({
  code,
  compact = false,
}: CopyAccessCodeButtonProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setCopied(false);
    }, 1800);

    return () => window.clearTimeout(timeoutId);
  }, [copied]);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={copyCode}
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#3880ff] text-sm font-black text-white shadow-sm shadow-blue-200 active:scale-[0.98] ${
        compact ? "min-h-8 px-3 py-1" : "min-h-11 px-4 py-2"
      }`}
    >
      {!copied && <Copy size={16} strokeWidth={2.5} />}
      <span>{copied ? "הועתק" : "העתק"}</span>
    </button>
  );
}

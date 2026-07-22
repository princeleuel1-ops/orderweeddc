'use client';

import { useState } from 'react';

type Props = {
  title: string;
};

export default function ShareButton({ title }: Props) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    if (typeof window !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title,
          url: window.location.href,
        });
        return;
      } catch {
        // User cancelled share or failed, fallback to clipboard
      }
    }

    if (typeof window !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      onClick={handleShare}
      className="text-xs font-bold px-3 py-1.5 rounded-md border border-brand-border bg-brand-surface hover:bg-black hover:text-white transition-all cursor-pointer flex items-center gap-1.5 text-slate-700"
    >
      <span>🔗</span>
      <span>{copied ? 'Link Copied!' : 'Share Dispensary'}</span>
    </button>
  );
}

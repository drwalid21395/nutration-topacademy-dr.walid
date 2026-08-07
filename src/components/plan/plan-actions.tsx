'use client';

import { useEffect, useState } from 'react';
import { Printer, Share2, Check, Link2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function PlanActions({ title, path }: { title: string; path: string }) {
  const [copied, setCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  useEffect(() => {
    setShareUrl(`${window.location.origin}${path}`);
  }, [path]);

  async function share() {
    if (!shareUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({ title, url: shareUrl });
        return;
      } catch (err) {
        const name = (err as { name?: string })?.name;
        if (name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('انسخ الرابط:', shareUrl);
    }
  }

  return (
    <>
      <button onClick={() => window.print()} className="btn-secondary">
        <Printer className="h-4 w-4" />
        طباعة
      </button>
      <button
        onClick={share}
        className={cn('btn-secondary', copied && '!bg-emerald-600 !text-white')}
      >
        {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
        {copied ? 'تم نسخ الرابط' : 'مشاركة'}
      </button>
      {shareUrl && (
        <a
          href={`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(shareUrl)}`}
          className="btn-secondary"
        >
          <Link2 className="h-4 w-4" />
          بريد
        </a>
      )}
    </>
  );
}

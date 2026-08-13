'use client';

import { useEffect } from 'react';

/**
 * مزامنة مستمرة صامتة: عند فتح لوحة التحكم تُطلب مزامنة اتصالات الجهاز
 * المستحقة دون إزعاج المستخدم (نتيجة تظهر في سجلات المزامنة فقط).
 */
export function AutoSync() {
  useEffect(() => {
    let cancelled = false;
    fetch('/api/wearables/sync-auto', { method: 'POST' })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d?.results?.some((x: { ok: boolean }) => !x.ok)) {
          console.warn('auto-sync partial failure', d.results);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  return null;
}

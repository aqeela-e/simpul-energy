'use client';
import { useLiveClock, formatWIBDateTime } from '@/lib/liveClock';

/** "Sistem Aktif — <tanggal>, <jam berjalan> WIB", diperbarui tiap detik. */
export default function LiveSystemClock({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  const now = useLiveClock(1000);

  return (
    <div className="flex items-center gap-2">
      <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--accent-teal-light)' }} />
      <span className={className} style={style} suppressHydrationWarning>
        Sistem Aktif — {now ? formatWIBDateTime(now) : '—'}
      </span>
    </div>
  );
}

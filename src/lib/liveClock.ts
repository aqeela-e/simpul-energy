'use client';
import { useEffect, useState } from 'react';

/**
 * Returns the real, continuously-updating current time.
 * Starts as `null` so the server-rendered HTML and the first client render
 * match (no hydration mismatch) — the clock only starts ticking once
 * mounted in the browser.
 */
export function useLiveClock(intervalMs = 1000): Date | null {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    // Setting real time on mount (client-only, avoids SSR/hydration mismatch)
    // is exactly what this effect is for — it can't be a lazy useState
    // initializer because that would also run during server rendering.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}

const WIB_DATE_FORMATTER = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Jakarta',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const WIB_TIME_FORMATTER = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Jakarta',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

/** e.g. "27 Agustus 2026" */
export function formatWIBDate(d: Date): string {
  return WIB_DATE_FORMATTER.format(d);
}

/** e.g. "14:30:07" */
export function formatWIBTime(d: Date): string {
  return WIB_TIME_FORMATTER.format(d);
}

/** e.g. "27 Agustus 2026, 14:30:07 WIB" */
export function formatWIBDateTime(d: Date): string {
  return `${formatWIBDate(d)}, ${formatWIBTime(d)} WIB`;
}

/** Formats a duration in milliseconds as "1 hari 14 jam 22 menit" (or smaller units as it shrinks). */
export function formatDurationID(ms: number): string {
  if (ms <= 0) return 'Tiba';
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) return `${days} hari ${hours} jam ${minutes} menit`;
  if (hours > 0) return `${hours} jam ${minutes} menit`;
  if (minutes > 0) return `${minutes} menit ${seconds} detik`;
  return `${seconds} detik`;
}

/** Given a transit's departure time + duration, compute live progress (0-1, clamped) and remaining ms. */
export function getTransitProgress(info: { departedAt: number; durationHours: number }, now: Date) {
  const durationMs = info.durationHours * 3600 * 1000;
  const elapsedMs = now.getTime() - info.departedAt;
  const progress = Math.min(1, Math.max(0, elapsedMs / durationMs));
  const remainingMs = Math.max(0, durationMs - elapsedMs);
  return { progress, remainingMs };
}

// SIMPUL — Satellite / Night-light observation (M0)
//
// Tidak ada API satelit real-time yang tersedia untuk prototype ini. Modul ini
// membangun time-series SIMULATED SATELLITE OBSERVATION yang deterministic
// (seeded, bukan Math.random()) supaya server & client render angka yang sama
// persis, dan supaya nilainya benar-benar mengalir ke Risk Engine
// (SimpulContext.dynamicMicrogrids) — bukan sekadar angka dekoratif di peta.
//
// Setiap "pass" satelit simulasi terjadi tiap NIGHT_LIGHT_PASS_INTERVAL_MS.
// Interval ini sengaja dipercepat (detik, bukan jam) supaya prototype terasa
// near-real-time saat didemokan, dengan label yang selalu transparan bahwa ini
// adalah observasi simulasi — bukan feed satelit real-time sungguhan.

import { Microgrid } from './data';

/** Kadensi simulasi "pass" satelit — dipercepat untuk keperluan demo prototype. */
export const NIGHT_LIGHT_PASS_INTERVAL_MS = 20_000;

export interface NightLightHistoryPoint {
  epoch: number;
  anomalyPct: number;
  observedAt: string;
}

export type NightLightTrend = 'memburuk' | 'membaik' | 'stabil';

export interface NightLightObservation {
  microgridId: string;
  epoch: number;
  /** Nilai anomaly pass saat ini ("after" / kondisi terkini). */
  anomalyPct: number;
  /** Nilai anomaly pass sebelumnya ("before"), untuk perbandingan before/after. */
  previousAnomalyPct: number;
  /** Baseline historis 30-hari milik microgrid (referensi "normal"). */
  baselineAnomalyPct: number;
  confidence: number;
  quality: number;
  freshnessMinutes: number;
  observedAt: string;
  nextPassAt: string;
  trend: NightLightTrend;
  history: NightLightHistoryPoint[];
  isSimulated: true;
}

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** PRNG deterministic [0,1) dari sebuah integer seed — sama persis dengan pola di lib/data.ts. */
function seededRand(seed: number): number {
  let a = seed >>> 0;
  a |= 0; a = (a + 0x6D2B79F5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/**
 * Sample anomaly night-light pada epoch tertentu — deterministic murni dari
 * (microgridId, epoch), tidak ada state tersembunyi, jadi aman dipanggil ulang
 * kapan saja (mis. untuk menghitung "before" dari epoch-1) tanpa perlu replay.
 * Kombinasi komponen siklus lambat (drift, mensimulasikan tren cuaca/musiman)
 * + noise per-pass, mean-reverting ke baseline microgrid tsb.
 */
function sampleAnomaly(microgridId: string, epoch: number, baseline: number): number {
  const idSeed = hashSeed(microgridId);
  const phase = (idSeed % 97) / 97;
  const drift = Math.sin(epoch / 6 + phase * Math.PI * 2) * 7;
  const noiseSeed = hashSeed(`${microgridId}|nl|${epoch}`);
  const noise = (seededRand(noiseSeed) - 0.5) * 9;
  // Random-walk ringan menuju baseline: makin jauh dari baseline, makin besar tarikan balik.
  const pull = baseline * 0.15;
  const raw = baseline * 0.85 + pull + drift + noise;
  return Math.max(-85, Math.min(25, Math.round(raw)));
}

function confidenceFor(m: Pick<Microgrid, 'sensorCoverage'>, epoch: number, microgridId: string): number {
  const jitterSeed = hashSeed(`${microgridId}|nl-conf|${epoch}`);
  const jitter = seededRand(jitterSeed) * 8;
  const base = m.sensorCoverage === 'terbatas' ? 78 : 90;
  return Math.round(Math.min(99, base + jitter));
}

/**
 * Observasi night-light "live" untuk sebuah microgrid pada waktu `nowMs`.
 * Dipanggil ulang setiap kali passEpoch berubah (lihat SimpulContext) sehingga
 * hasilnya benar-benar mengalir ke Risk → Priority → Recommendation, bukan
 * hanya berubah di tampilan peta.
 */
export function computeNightLightObservation(m: Microgrid, nowMs: number): NightLightObservation {
  const epoch = Math.floor(nowMs / NIGHT_LIGHT_PASS_INTERVAL_MS);
  const baseline = m.nightLightAnomalyPct;
  const HISTORY_LEN = 6;

  const current = sampleAnomaly(m.id, epoch, baseline);
  const previous = sampleAnomaly(m.id, epoch - 1, baseline);
  const confidence = confidenceFor(m, epoch, m.id);
  const quality = Math.max(50, confidence - Math.round(seededRand(hashSeed(`${m.id}|nl-q|${epoch}`)) * 6));

  const history: NightLightHistoryPoint[] = Array.from({ length: HISTORY_LEN }).map((_, i) => {
    const e = epoch - (HISTORY_LEN - 1 - i);
    return {
      epoch: e,
      anomalyPct: sampleAnomaly(m.id, e, baseline),
      observedAt: new Date(e * NIGHT_LIGHT_PASS_INTERVAL_MS).toISOString(),
    };
  });

  const delta = current - previous;
  const trend: NightLightTrend = delta <= -3 ? 'memburuk' : delta >= 3 ? 'membaik' : 'stabil';

  const passStart = epoch * NIGHT_LIGHT_PASS_INTERVAL_MS;
  const freshnessMinutes = Math.max(0, Math.round((nowMs - passStart) / 60000 * 10) / 10);

  return {
    microgridId: m.id,
    epoch,
    anomalyPct: current,
    previousAnomalyPct: previous,
    baselineAnomalyPct: baseline,
    confidence,
    quality,
    freshnessMinutes,
    observedAt: new Date(passStart).toISOString(),
    nextPassAt: new Date(passStart + NIGHT_LIGHT_PASS_INTERVAL_MS).toISOString(),
    trend,
    history,
    isSimulated: true,
  };
}

export function computeAllNightLightObservations(microgrids: Microgrid[], nowMs: number): Record<string, NightLightObservation> {
  return Object.fromEntries(microgrids.map(m => [m.id, computeNightLightObservation(m, nowMs)]));
}

/** Tier warna/severitas anomaly — dipakai konsisten di peta & panel detail. */
export function nightLightSeverity(anomalyPct: number): 'critical' | 'warning' | 'normal' {
  if (anomalyPct <= -25) return 'critical';
  if (anomalyPct <= -10) return 'warning';
  return 'normal';
}

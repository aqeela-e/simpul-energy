// SIMPUL — M3 Mesin Prediksi Risiko: simulasi Monte Carlo nyata.
//
// Sebelumnya halaman /forecast menampilkan label "Monte Carlo (n=10.000)"
// tapi angkanya cuma `deficitProbability` yang diketik manual di data.ts —
// tidak ada simulasi yang benar-benar berjalan. Modul ini menjalankan
// simulasi stokastik sungguhan (generation & demand disampel per hari
// dengan noise, BESS SOC di-drawdown/di-charge, defisit dicek tiap hari
// sepanjang window) dan hasil agregatnya (probabilitas & persentil)
// dipakai balik ke `dynamicMicrogrids` di SimpulContext untuk menghitung
// riskScore & deficitProbability — bukan angka statis lagi.

/** PRNG seeded (mulberry32) — deterministik per microgrid+input, supaya hasil simulasi
 * stabil dalam satu render tapi tetap "sungguhan" dijalankan tiap kali input berubah. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function rand() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Box-Muller — mengubah dua sampel uniform [0,1) jadi sampel normal(0,1). */
function gaussian(rand: () => number): number {
  let u = 0, v = 0;
  while (u === 0) u = rand();
  while (v === 0) v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Hash string kecil → seed integer, supaya tiap microgrid dapat aliran acak berbeda tapi reproducible. */
function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export interface MonteCarloInput {
  /** Kunci unik untuk seeding (biasanya microgrid id + jam simulasi berjalan). */
  seedKey: string;
  meanGenerationMW: number;
  meanDemandMW: number;
  /** SOC saat ini (0-100). */
  bessSOC: number;
  bessCapacityKWh: number;
  /** Ketidakpastian sumber renewable (0-100), dari hybridData.renewableUncertaintyPct — makin tinggi, makin lebar sebaran generation. */
  renewableUncertaintyPct: number;
  /** Berapa hari ke depan disimulasikan (default 21 — sesuai window pre-positioning esai). */
  horizonDays?: number;
  /** Jumlah trial Monte Carlo. */
  trials?: number;
}

export interface MonteCarloResult {
  trials: number;
  horizonDays: number;
  /** % trial yang mengalami setidaknya satu hari defisit (demand > generation + BESS reserve). */
  deficitProbability: number;
  /** Persentil energi tak terlayani (energy-not-served) dalam MWh — p50/p90 dari seluruh trial. */
  energyNotServedP50: number;
  energyNotServedP90: number;
  /** Rata-rata hari-ke-berapa defisit pertama kali terjadi (di antara trial yang defisit); null bila tak ada. */
  meanDaysToFirstDeficit: number | null;
  /** Skor risiko turunan simulasi (0-100), dipakai sebagai salah satu komponen risk gabungan. */
  simulatedRisk: number;
  /** Histogram probabilitas defisit per hari horizon — dipakai untuk risk timeline / early warning. */
  dailyDeficitProbability: number[];
}

/**
 * Menjalankan simulasi Monte Carlo nyata: untuk tiap trial, generation & demand
 * harian disampel dari distribusi normal (mean dari kondisi live, stdev naik
 * seiring uncertainty renewable), BESS SOC displasi maju tiap hari, dan hari
 * pertama SOC menyentuh 0 sambil demand > generation dicatat sebagai defisit.
 */
export function runDeficitMonteCarlo(input: MonteCarloInput): MonteCarloResult {
  const horizonDays = input.horizonDays ?? 21;
  const trials = Math.max(200, input.trials ?? 2000);
  const rand = mulberry32(hashSeed(input.seedKey));

  const genStd = Math.max(0.05, input.meanGenerationMW * (0.08 + input.renewableUncertaintyPct / 220));
  const loadStd = Math.max(0.03, input.meanDemandMW * 0.06);
  const bessMWh = (input.bessCapacityKWh / 1000) * (input.bessSOC / 100);

  let deficitCount = 0;
  const ensSum50: number[] = [];
  const daysToDeficit: number[] = [];
  const dailyDeficitHits = new Array(horizonDays).fill(0);

  for (let tr = 0; tr < trials; tr++) {
    let soc = bessMWh; // MWh tersedia sebagai buffer
    let trialDeficit = false;
    let trialFirstDay: number | null = null;
    let trialENS = 0;
    for (let d = 0; d < horizonDays; d++) {
      const gen = Math.max(0, input.meanGenerationMW + gaussian(rand) * genStd);
      const load = Math.max(0, input.meanDemandMW + gaussian(rand) * loadStd);
      const dailyBalanceMWh = (gen - load) * 24; // MW → MWh/hari (pendekatan rata-rata harian)
      if (dailyBalanceMWh >= 0) {
        soc = Math.min(input.bessCapacityKWh / 1000, soc + dailyBalanceMWh * 0.3); // sebagian surplus dipakai charge BESS
      } else {
        const need = -dailyBalanceMWh;
        if (soc >= need) {
          soc -= need;
        } else {
          const shortfall = need - soc;
          soc = 0;
          trialENS += shortfall;
          dailyDeficitHits[d]++;
          if (!trialDeficit) { trialDeficit = true; trialFirstDay = d + 1; }
        }
      }
    }
    if (trialDeficit) { deficitCount++; if (trialFirstDay !== null) daysToDeficit.push(trialFirstDay); }
    ensSum50.push(Number(trialENS.toFixed(3)));
  }

  ensSum50.sort((a, b) => a - b);
  const pct = (p: number) => ensSum50[Math.min(ensSum50.length - 1, Math.floor((p / 100) * ensSum50.length))] ?? 0;
  const deficitProbability = Math.round((deficitCount / trials) * 100);
  const meanDaysToFirstDeficit = daysToDeficit.length
    ? Number((daysToDeficit.reduce((a, b) => a + b, 0) / daysToDeficit.length).toFixed(1))
    : null;

  // Simulated risk: gabungkan probabilitas defisit dengan seberapa cepat defisit
  // biasanya terjadi (makin cepat, makin berisiko) dan besar energi tak terlayani.
  const urgencyFromSpeed = meanDaysToFirstDeficit ? Math.max(0, 100 - (meanDaysToFirstDeficit / horizonDays) * 100) : 0;
  const ensSeverity = Math.min(100, pct(90) * 6);
  const simulatedRisk = Math.round(Math.min(100, deficitProbability * 0.55 + urgencyFromSpeed * 0.25 + ensSeverity * 0.2));

  return {
    trials,
    horizonDays,
    deficitProbability,
    energyNotServedP50: Number(pct(50).toFixed(2)),
    energyNotServedP90: Number(pct(90).toFixed(2)),
    meanDaysToFirstDeficit,
    simulatedRisk,
    dailyDeficitProbability: dailyDeficitHits.map(h => Math.round((h / trials) * 100)),
  };
}

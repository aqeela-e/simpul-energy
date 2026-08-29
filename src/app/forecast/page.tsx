'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useRoleGuard } from '@/hooks/useRoleGuard';
import { FORECAST_NTT } from '@/lib/data';
import { useSimpul } from '@/context/SimpulContext';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, AreaChart, Area } from 'recharts';
import { AlertTriangle, ShieldAlert } from 'lucide-react';

export default function ForecastPage() {
  const user = useRoleGuard();
  const router = useRouter();
  const [selectedMG, setSelectedMG] = useState('mg-ntt');
  const { operationalMicrogrids } = useSimpul();
  if (!user) return null;

  const mg = operationalMicrogrids.find(m => m.id === selectedMG) ?? operationalMicrogrids[0];
  if (!mg) return null;

  const forecastScaleGen=mg.currentGeneration/Math.max(0.1,FORECAST_NTT[0].generation);
  const forecastScaleLoad=mg.currentDemand/Math.max(0.1,FORECAST_NTT[0].demand);
  const forecastData=FORECAST_NTT.map((p,i)=>({...p,generation:Number((p.generation*forecastScaleGen).toFixed(2)),demand:Number((p.demand*forecastScaleLoad).toFixed(2)),bessSOC:Math.max(0,Math.round(mg.bessSOC-i*(mg.bessSOC/Math.max(1,FORECAST_NTT.length-1))))}));

  // Monte Carlo di sini sekarang benar-benar hasil simulasi (lihat src/lib/monteCarlo.ts,
  // dijalankan per microgrid di SimpulContext.dynamicMicrogrids) — bukan angka statis dari data.ts.
  const monteCarloData = operationalMicrogrids.map(m => ({
    name: m.island.split(' ')[0],
    probability: m.monteCarlo.deficitProbability,
    risk: m.riskScore,
    trials: m.monteCarlo.trials,
    color: m.monteCarlo.deficitProbability > 60 ? '#E11D48' : m.monteCarlo.deficitProbability > 30 ? '#D97706' : '#14B8A6',
  }));
  const activeWarnings = operationalMicrogrids.filter(m => m.earlyWarning.active);

  return (
    <div className="min-h-screen pb-16 px-4 sm:px-6 max-w-screen-xl mx-auto">
      <motion.div initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="pt-6 sm:pt-8 mb-8">
        <span className="eyebrow">M1 · M3 — Kecerdasan EBT & Prediksi Risiko</span>
        <h1 className="font-display font-bold text-2xl md:text-3xl mt-1" style={{ color: 'var(--text-primary)' }}>Mesin Prediksi & Risiko</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Forecast EBT & demand — Simulasi Monte Carlo probabilitas defisit (n={mg.monteCarlo.trials.toLocaleString('id-ID')}, dijalankan nyata per microgrid dari kondisi live)</p>
      </motion.div>

      {/* MG selector */}
      <div className="flex gap-2 flex-wrap mb-6">
        {operationalMicrogrids.map(m => (
          <button key={m.id} onClick={() => setSelectedMG(m.id)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{
              background: selectedMG === m.id ? 'rgba(13,148,136,0.2)' : 'var(--bg-card)',
              color: selectedMG === m.id ? '#14B8A6' : 'var(--text-muted)',
              border: `1px solid ${selectedMG === m.id ? 'rgba(13,148,136,0.4)' : 'var(--bg-border)'}`,
            }}>
            {m.island.split(' ')[0]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Forecast chart */}
        <div className="lg:col-span-2 card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold text-base" style={{ color: 'var(--text-primary)' }}>Prediksi 8 Jam ke Depan — {mg?.name ?? 'Microgrid'}</h2>
            {(mg?.deficitProbability ?? 0) > 60 && (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs" style={{ background: 'rgba(225,29,72,0.1)', color: '#E11D48', border: '1px solid rgba(225,29,72,0.2)' }}>
                <AlertTriangle size={12} /> Risiko Tinggi
              </div>
            )}
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={forecastData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(226,232,232,0.5)" />
              <XAxis dataKey="hour" tick={{ fill: '#5B6472', fontSize: 11 }} />
              <YAxis tick={{ fill: '#5B6472', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#FFFFFF', border: '1px solid #DCE3E3', borderRadius: 8, color: '#111827', fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12, color: '#5B6472' }} />
              <ReferenceLine y={0} stroke="#E11D48" strokeDasharray="4 4" opacity={0.5} />
              <Line type="monotone" dataKey="generation" name="Generasi EBT (MW)" stroke="#14B8A6" strokeWidth={2} dot={{ fill: '#14B8A6', r: 3 }} />
              <Line type="monotone" dataKey="demand" name="Permintaan (MW)" stroke="#E11D48" strokeWidth={2} dot={{ fill: '#E11D48', r: 3 }} />
              <Line type="monotone" dataKey="bessSOC" name="BESS SOC (%)" stroke="#D97706" strokeWidth={1.5} strokeDasharray="5 5" dot={false} />
            </LineChart>
          </ResponsiveContainer>
          <div className="mt-3 p-3 rounded-lg text-xs" style={{ background: 'rgba(225,29,72,0.08)', border: '1px solid rgba(225,29,72,0.15)' }}>
            <p style={{ color: '#E11D48' }}>⚠ Prediksi: Defisit kritis pada 19:00 — BESS SOC mencapai 0%. Beban kritis terancam tanpa intervensi pre-positioning.</p>
          </div>
        </div>

        {/* Risk scores */}
        <div className="card p-5">
          <h2 className="font-display font-semibold text-base mb-4" style={{ color: 'var(--text-primary)' }}>Probabilitas Defisit</h2>
          <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>Monte Carlo (n={mg.monteCarlo.trials.toLocaleString('id-ID')}) · Window {mg.monteCarlo.horizonDays} hari · ENS p90 {mg.monteCarlo.energyNotServedP90} MWh</p>
          <div className="space-y-3">
            {monteCarloData.sort((a, b) => b.probability - a.probability).map((d, i) => (
              <motion.div key={d.name} initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: i * 0.1 }}>
                <div className="flex justify-between text-xs mb-1">
                  <span style={{ color: 'var(--text-primary)' }}>{d.name}</span>
                  <span className="font-mono font-bold" style={{ color: d.color }}>{d.probability}%</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-border)' }}>
                  <motion.div initial={{ width: 0 }} animate={{ width: `${d.probability}%` }} transition={{ delay: 0.3 + i * 0.1, duration: 0.8 }}
                    className="h-full rounded-full" style={{ background: d.color }} />
                </div>
              </motion.div>
            ))}
          </div>

          <div className="mt-6 pt-5" style={{ borderTop: '1px solid var(--bg-border-soft)' }}>
            <h3 className="font-display font-semibold text-sm mb-1" style={{ color: 'var(--text-primary)' }}>Skor Risiko Gabungan — {mg?.name ?? 'Microgrid'}</h3>
            <p className="text-xs mb-3" style={{ color: 'var(--text-dim)' }}>M3 menyatukan dua jenis risiko menjadi satu skor prioritas, bukan menangani keduanya terpisah.</p>
            {[
              { label: 'Risiko Hosting Capacity EBT', value: mg.hostingCapacityRisk, color: '#D97706' },
              { label: 'Risiko Darurat', value: mg.emergencyRisk, color: '#E11D48' },
            ].map(r => (
              <div key={r.label} className="mb-2.5">
                <div className="flex justify-between text-xs mb-1">
                  <span style={{ color: 'var(--text-muted)' }}>{r.label}</span>
                  <span className="font-mono font-bold" style={{ color: r.color }}>{r.value}%</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-border)' }}>
                  <div className="h-full rounded-full" style={{ width: `${r.value}%`, background: r.color }} />
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between mt-3 p-2.5 rounded-lg" style={{ background: 'rgba(13,148,136,0.06)', border: '1px solid rgba(13,148,136,0.15)' }}>
              <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>Skor Prioritas Gabungan</span>
              <span className="font-mono font-bold text-lg" style={{ color: '#14B8A6' }}>{mg.riskScore}/100</span>
            </div>
          </div>

          <div className="mt-6 space-y-2">
            <h3 className="font-display font-semibold text-xs mb-2" style={{ color: 'var(--text-muted)' }}>FAKTOR RISIKO</h3>
            {[
              { label: 'Variabilitas Solar', value: 'Tinggi', color: '#E11D48' },
              { label: 'Tren Demand', value: 'Naik', color: '#D97706' },
              { label: 'Kondisi BESS', value: 'Kritis', color: '#E11D48' },
              { label: 'Cakupan Sensor', value: mg.sensorCoverage === 'terbatas' ? 'Terbatas' : 'Penuh', color: mg.sensorCoverage === 'terbatas' ? '#D97706' : '#14B8A6' },
            ].map(f => (
              <div key={f.label} className="flex justify-between text-xs">
                <span style={{ color: 'var(--text-muted)' }}>{f.label}</span>
                <span className="font-medium" style={{ color: f.color }}>{f.value}</span>
              </div>
            ))}
          </div>

          {mg.sensorCoverage === 'terbatas' && (
            <div className="mt-4 p-3 rounded-lg text-xs" style={{ background: 'rgba(37,99,235,0.06)', border: '1px solid rgba(37,99,235,0.15)' }}>
              <p className="font-medium mb-1" style={{ color: 'var(--accent-blue)' }}>Lapisan Data Hibrida (M1)</p>
              <p style={{ color: 'var(--text-muted)' }}>
                Wilayah bersensor terbatas — risiko darurat turut dihitung dari anomali cahaya malam satelit
                (<span className="font-mono font-bold" style={{ color: 'var(--accent-blue)' }}>{mg.nightLightAnomalyPct}%</span> dibanding baseline)
                dan {mg.citizenReports.count} laporan warga.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Early warning banner — dihasilkan dari trend risk timeline + Monte Carlo, bukan status tetap */}
      {activeWarnings.length > 0 && (
        <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="card p-5 mb-6" style={{ border: '1px solid rgba(225,29,72,0.35)', background: 'rgba(225,29,72,0.06)' }}>
          <div className="flex items-center gap-2 mb-3">
            <ShieldAlert size={18} style={{ color: '#E11D48' }} />
            <h2 className="font-display font-semibold text-base" style={{ color: '#E11D48' }}>Early Warning Aktif ({activeWarnings.length})</h2>
          </div>
          <div className="space-y-2">
            {activeWarnings.map(w => (
              <div key={w.id} className="p-3 rounded-lg text-xs flex flex-wrap items-center gap-2" style={{ background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(225,29,72,0.15)' }}>
                <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{w.name}</span>
                <span style={{ color: 'var(--text-muted)' }}>{w.earlyWarning.message}</span>
                {w.earlyWarning.etaDays && <span className="ml-auto px-2 py-1 rounded-full font-mono font-bold" style={{ background: 'rgba(225,29,72,0.12)', color: '#E11D48' }}>ETA {w.earlyWarning.etaDays}h</span>}
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Risk timeline — dari histori telemetry hybrid (measured + estimated) 24 jam terakhir */}
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 }} className="card p-5 mb-6">
        <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
          <h2 className="font-display font-semibold text-base" style={{ color: 'var(--text-primary)' }}>Risk Timeline — {mg.name}</h2>
          {mg.earlyWarning.active && (
            <span className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs" style={{ background: 'rgba(225,29,72,0.1)', color: '#E11D48', border: '1px solid rgba(225,29,72,0.2)' }}>
              <ShieldAlert size={12} /> Early Warning
            </span>
          )}
        </div>
        <p className="text-xs mb-4" style={{ color: 'var(--text-dim)' }}>Tren skor risiko 24 jam terakhir dari telemetry generation/load/BESS hybrid (measured + estimated).</p>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={mg.riskTimeline} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
            <defs>
              <linearGradient id="riskFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#E11D48" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#E11D48" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(226,232,232,0.5)" />
            <XAxis dataKey="hour" tick={{ fill: '#5B6472', fontSize: 10 }} />
            <YAxis domain={[0, 100]} tick={{ fill: '#5B6472', fontSize: 11 }} />
            <Tooltip contentStyle={{ background: '#FFFFFF', border: '1px solid #DCE3E3', borderRadius: 8, color: '#111827', fontSize: 12 }} />
            <ReferenceLine y={75} stroke="#E11D48" strokeDasharray="4 4" opacity={0.5} label={{ value: 'Kritis', fontSize: 10, fill: '#E11D48' }} />
            <ReferenceLine y={45} stroke="#D97706" strokeDasharray="4 4" opacity={0.5} label={{ value: 'Waspada', fontSize: 10, fill: '#D97706' }} />
            <Area type="monotone" dataKey="risk" name="Risk score" stroke="#E11D48" fill="url(#riskFill)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
        <p className="text-[11px] mt-2" style={{ color: 'var(--text-dim)' }}>
          Titik terkini bersumber {mg.riskTimeline[mg.riskTimeline.length - 1]?.source === 'ESTIMATED' ? 'proksi/estimasi (sensor terbatas)' : 'pengukuran langsung'} · confidence data hybrid {mg.hybridData?.sourceQuality ?? 90}%.
        </p>
      </motion.div>

      {/* Pre-positioning recommendation */}
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }} className="card p-5" style={{ border: '1px solid rgba(225,29,72,0.3)', background: 'rgba(225,29,72,0.04)' }}>
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle size={18} style={{ color: '#E11D48' }} />
          <h2 className="font-display font-semibold text-base" style={{ color: '#E11D48' }}>Rekomendasi Pre-positioning Segera</h2>
        </div>
        <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
          Konteks skenario NTT mengacu gempa Laut Flores M7,7 (15 Agustus 2026) yang memadamkan PLTMG Maumere & Rangko. Angka di bawah dihitung live dari kondisi <strong>{mg.name}</strong> saat ini (shared data → Monte Carlo → risk), bukan nilai tetap.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { label: 'Wilayah Berisiko', value: mg.island.split(' ')[0], color: mg.riskScore >= 75 ? '#E11D48' : mg.riskScore >= 45 ? '#D97706' : '#14B8A6' },
            { label: 'Probabilitas Defisit (Monte Carlo)', value: `${mg.monteCarlo.deficitProbability}%`, color: mg.monteCarlo.deficitProbability >= 60 ? '#E11D48' : '#D97706' },
            { label: 'Jendela Waktu', value: mg.earlyWarning.etaDays ? `${mg.earlyWarning.etaDays} hari ke depan` : `${mg.monteCarlo.horizonDays} hari (window)`, color: '#D97706' },
          ].map(s => (
            <div key={s.label} className="text-center p-3 rounded-lg" style={{ background: 'rgba(226,232,232,0.3)' }}>
              <p className="font-mono font-bold text-xl" style={{ color: s.color }}>{s.value}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 flex gap-3">
          <button onClick={() => router.push('/allocation')} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: 'rgba(13,148,136,0.2)', color: '#14B8A6', border: '1px solid rgba(13,148,136,0.3)' }}>
            Lihat Rekomendasi Alokasi →
          </button>
          <button onClick={() => router.push('/simulation')} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: 'rgba(226,232,232,0.5)', color: 'var(--text-muted)', border: '1px solid var(--bg-border)' }}>
            Jalankan Simulasi
          </button>
        </div>
      </motion.div>
    </div>
  );
}

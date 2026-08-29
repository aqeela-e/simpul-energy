'use client';
import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { useRoleGuard } from '@/hooks/useRoleGuard';
import { TEKNISI_MICROGRID_ID, TEKNISI_DESTINATION_CITY } from '@/lib/permissions';
import { useSimpul } from '@/context/SimpulContext';
import { ArrowLeft, Zap, Battery, AlertTriangle, Sun, Wind, Droplets, Flame, Leaf, ShieldAlert, Activity, type LucideIcon } from 'lucide-react';
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from 'recharts';

function NodeBox({ label, value, color, icon: Icon }: { label: string; value: string; color: string; icon: LucideIcon }) {
  return (
    <div className="flex flex-col items-center p-3 rounded-xl text-center" style={{ background: `${color}10`, border: `1px solid ${color}30`, minWidth: 80 }}>
      <Icon size={18} style={{ color }} />
      <p className="font-mono font-bold text-sm mt-1" style={{ color }}>{value}</p>
      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{label}</p>
    </div>
  );
}

export default function MicrogridDetailPage() {
  const user = useRoleGuard();
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const { operationalMicrogrids, operationalBess, shipments, incidents, observations, confirmArrival, confirmIntegration, integrateShipment } = useSimpul();

  // Teknisi lokal hanya boleh melihat microgrid di wilayah tugasnya sendiri.
  const isTeknisi = user?.role === 'teknisi-lokal';
  useEffect(() => {
    if (isTeknisi && id !== TEKNISI_MICROGRID_ID) {
      router.push('/microgrids');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTeknisi, id]);

  const mg = operationalMicrogrids.find(m => m.id === id);
  if (!user || !mg) return null;
  if (isTeknisi && id !== TEKNISI_MICROGRID_ID) return null;

  const bessUnits = operationalBess.filter(b => mg.connectedBESS.includes(b.id));
  const statusColor = mg.status === 'critical' ? '#E11D48' : mg.status === 'warning' ? '#D97706' : '#14B8A6';
  const gridModeLabel: Record<string, string> = { 'grid-connected': 'Terhubung Grid', 'islanded': 'Mode Islanding', 'emergency': 'Mode Darurat' };
  const gridModeColor: Record<string, string> = { 'grid-connected': '#14B8A6', 'islanded': '#D97706', 'emergency': '#E11D48' };

  const reItems = [
    { key: 'solar', label: 'Surya', icon: Sun, color: '#D97706' },
    { key: 'wind', label: 'Angin', icon: Wind, color: '#2563EB' },
    { key: 'hydro', label: 'Air', icon: Droplets, color: '#0891B2' },
    { key: 'geothermal', label: 'Panas Bumi', icon: Flame, color: '#7C3AED' },
    { key: 'biomass', label: 'Bioenergi', icon: Leaf, color: '#059669' },
  ].filter(r => mg.renewableCapacity[r.key as keyof typeof mg.renewableCapacity] > 0);

  return (
    <div className="min-h-screen pb-16 px-4 sm:px-6 max-w-screen-xl mx-auto">
      <motion.div initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="pt-6 sm:pt-8">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-sm mb-6 hover:opacity-70 transition-opacity" style={{ color: 'var(--text-muted)' }}>
          <ArrowLeft size={16} /> Kembali ke Daftar
        </button>

        <div className="flex flex-wrap items-start gap-4 mb-8">
          <div className="flex-1 min-w-0">
            <span className="eyebrow">M2 — Kembaran Digital Sistem</span>
            <div className="flex items-center gap-3 mb-1 mt-1">
              <h1 className="font-display font-bold text-2xl md:text-3xl" style={{ color: 'var(--text-primary)' }}>{mg.name}</h1>
              <span className="px-3 py-1 rounded-full text-xs font-medium" style={{ background: `${statusColor}15`, color: statusColor, border: `1px solid ${statusColor}30` }}>
                {mg.status === 'critical' ? '🔴 Kritis' : mg.status === 'warning' ? '🟡 Waspada' : '🟢 Normal'}
              </span>
            </div>
            <p style={{ color: 'var(--text-muted)' }} className="text-sm">{mg.island}</p>
          </div>
          <div className="px-3 py-2 rounded-lg text-sm font-medium" style={{ background: `${gridModeColor[mg.gridMode]}15`, color: gridModeColor[mg.gridMode], border: `1px solid ${gridModeColor[mg.gridMode]}30` }}>
            {gridModeLabel[mg.gridMode]}
          </div>
        </div>
      </motion.div>

      {/* Digital Twin Diagram */}
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="card p-6 mb-6">
        <h2 className="font-display font-semibold text-base mb-6" style={{ color: 'var(--text-primary)' }}>Digital Twin — Diagram Sistem</h2>

        <div className="overflow-x-auto">
          <div className="min-w-[600px]">
            {/* EBT Sources */}
            <div className="flex justify-center gap-3 mb-4 flex-wrap">
              {reItems.map(r => (
                <NodeBox key={r.key} label={r.label} value={`${mg.renewableCapacity[r.key as keyof typeof mg.renewableCapacity]} MW`} color={r.color} icon={r.icon} />
              ))}
            </div>

            {/* Arrow down to inverter */}
            <div className="flex justify-center mb-2">
              <div className="flex flex-col items-center">
                <div className="w-px h-6" style={{ background: 'var(--bg-border)' }} />
                <div className="w-2 h-2 rotate-45 border-r border-b" style={{ borderColor: 'var(--bg-border)' }} />
              </div>
            </div>

            {/* Inverter */}
            <div className="flex justify-center mb-2">
              <div className="px-6 py-2 rounded-lg text-xs font-mono font-bold" style={{ background: 'var(--bg-card)', border: '1px solid var(--bg-border)', color: 'var(--text-muted)' }}>
                INVERTER / KONVERTER
              </div>
            </div>

            {/* Arrow to bus */}
            <div className="flex justify-center mb-2">
              <div className="flex flex-col items-center">
                <div className="w-px h-6" style={{ background: 'var(--bg-border)' }} />
                <div className="w-2 h-2 rotate-45 border-r border-b" style={{ borderColor: 'var(--bg-border)' }} />
              </div>
            </div>

            {/* Microgrid Bus */}
            <div className="flex justify-center mb-4">
              <div className="w-full max-w-lg px-6 py-3 rounded-xl text-center font-display font-bold text-sm" style={{ background: `linear-gradient(90deg, ${statusColor}20, ${statusColor}10)`, border: `2px solid ${statusColor}40`, color: statusColor }}>
                ⚡ BUS UTAMA MICROGRID — {mg.currentGeneration} MW aktif
              </div>
            </div>

            {/* Bottom row: BESS, Critical, Loads */}
            <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto">
              {/* BESS */}
              <div className="flex flex-col items-center">
                <div className="w-px h-4" style={{ background: 'var(--bg-border)' }} />
                {bessUnits.map(b => {
                  const bc = b.status === 'discharging' ? '#E11D48' : b.status === 'charging' ? '#D97706' : '#14B8A6';
                  return (
                    <div key={b.id} className="w-full p-3 rounded-xl text-center" style={{ background: `${bc}10`, border: `1px solid ${bc}30` }}>
                      <Battery size={20} style={{ color: bc, margin: '0 auto' }} />
                      <p className="font-mono font-bold text-sm mt-1" style={{ color: bc }}>{b.soc}%</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{b.name}</p>
                      <p className="text-xs" style={{ color: bc }}>{b.status === 'discharging' ? 'Menyalurkan' : b.status === 'charging' ? 'Mengisi' : 'Siap'}</p>
                    </div>
                  );
                })}
              </div>

              {/* Critical Load */}
              <div className="flex flex-col items-center">
                <div className="w-px h-4" style={{ background: 'var(--bg-border)' }} />
                <div className="w-full p-3 rounded-xl" style={{ background: 'rgba(225,29,72,0.08)', border: '1px solid rgba(225,29,72,0.2)' }}>
                  <AlertTriangle size={18} style={{ color: '#E11D48', margin: '0 auto' }} />
                  <p className="font-mono font-bold text-sm text-center mt-1" style={{ color: '#E11D48' }}>{mg.criticalLoad} MW</p>
                  <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>Beban Kritis</p>
                  <div className="mt-2 space-y-0.5">
                    {mg.criticalFacilities.slice(0, 3).map(f => (
                      <p key={f} className="text-xs text-center" style={{ color: '#E11D48' }}>🏥 {f}</p>
                    ))}
                  </div>
                </div>
              </div>

              {/* General Load */}
              <div className="flex flex-col items-center">
                <div className="w-px h-4" style={{ background: 'var(--bg-border)' }} />
                <div className="w-full p-3 rounded-xl text-center" style={{ background: 'rgba(226,232,232,0.3)', border: '1px solid var(--bg-border)' }}>
                  <Zap size={18} style={{ color: 'var(--text-muted)', margin: '0 auto' }} />
                  <p className="font-mono font-bold text-sm mt-1" style={{ color: 'var(--text-primary)' }}>{(mg.currentDemand - mg.criticalLoad).toFixed(1)} MW</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Beban Umum</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>🏠 Perumahan</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>🏪 Komersial</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Pemanfaatan EBT', value: `${mg.renewableUtilization}%`, color: '#14B8A6' },
          { label: 'Ketergantungan Diesel', value: `${mg.dieselDependency}%`, color: mg.dieselDependency > 20 ? '#E11D48' : '#14B8A6' },
          { label: 'Probabilitas Defisit', value: `${mg.deficitProbability}%`, color: mg.deficitProbability > 60 ? '#E11D48' : mg.deficitProbability > 30 ? '#D97706' : '#14B8A6' },
          { label: 'Skor Risiko', value: `${mg.riskScore}/100`, color: mg.riskScore > 70 ? '#E11D48' : mg.riskScore > 40 ? '#D97706' : '#14B8A6' },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.2 + i * 0.05 }} className="card p-4 text-center">
            <p className="font-mono font-bold text-2xl" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Lapisan Data Hibrida M1 */}
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.25 }} className="card p-5 mb-6">
        <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
          <h2 className="font-display font-semibold text-base" style={{ color: 'var(--text-primary)' }}>M1 — Lapisan Data Hibrida</h2>
          <span className="px-2.5 py-1 rounded-full text-xs font-medium" style={{
            background: mg.sensorCoverage === 'terbatas' ? 'rgba(217,119,6,0.1)' : 'rgba(13,148,136,0.1)',
            color: mg.sensorCoverage === 'terbatas' ? '#B45309' : '#0D9488',
            border: `1px solid ${mg.sensorCoverage === 'terbatas' ? 'rgba(217,119,6,0.25)' : 'rgba(13,148,136,0.25)'}`,
          }}>
            Cakupan sensor: {mg.sensorCoverage === 'terbatas' ? 'Terbatas' : 'Penuh'}
          </span>
        </div>
        <p className="text-xs mb-4" style={{ color: 'var(--text-dim)' }}>
          Pada wilayah dengan keterbatasan sensor, pelaporan warga dan perubahan intensitas cahaya malam satelit dipakai sebagai variabel proksi tambahan untuk mendeteksi gangguan (M1).
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-3 rounded-lg" style={{ background: mg.nightLightAnomalyPct < -10 ? 'rgba(225,29,72,0.06)' : 'rgba(226,232,232,0.3)', border: `1px solid ${mg.nightLightAnomalyPct < -10 ? 'rgba(225,29,72,0.2)' : 'var(--bg-border)'}` }}>
            <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Anomali Cahaya Malam (proksi satelit)</p>
            <p className="font-mono font-bold text-xl" style={{ color: mg.nightLightAnomalyPct < -10 ? '#E11D48' : '#14B8A6' }}>
              {mg.nightLightAnomalyPct > 0 ? '+' : ''}{mg.nightLightAnomalyPct}%
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-dim)' }}>dibanding baseline 30 hari</p>
          </div>
          <div className="p-3 rounded-lg" style={{ background: 'rgba(226,232,232,0.3)', border: '1px solid var(--bg-border)' }}>
            <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Pelaporan Warga (24 jam terakhir)</p>
            <p className="font-mono font-bold text-xl" style={{ color: 'var(--text-primary)' }}>{mg.citizenReports.count} laporan</p>
            {mg.citizenReports.recent.length > 0 && (
              <ul className="mt-1.5 space-y-0.5">
                {mg.citizenReports.recent.map((r, i) => (
                  <li key={i} className="text-xs" style={{ color: 'var(--text-dim)' }}>· {r}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </motion.div>

      {/* Telemetry generation/load/BESS — Hybrid Data Intelligence (M1) */}
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.28 }} className="card p-5 mb-6">
        <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
          <h2 className="font-display font-semibold text-base" style={{ color: 'var(--text-primary)' }}>Telemetry Generation / Load / BESS (24 jam)</h2>
          <span className="text-xs px-2 py-1 rounded-full" style={{ background: 'rgba(37,99,235,0.08)', color: 'var(--accent-blue)' }}>
            {mg.telemetry.filter(t => t.source === 'ESTIMATED').length}/{mg.telemetry.length} titik estimasi
          </span>
        </div>
        <p className="text-xs mb-4" style={{ color: 'var(--text-dim)' }}>
          Titik <strong>MEASURED</strong> berasal dari sensor/SCADA langsung; titik <strong>ESTIMATED</strong> diisi dari model proksi (rerata historis + anomali cahaya malam + laporan warga) untuk wilayah bersensor terbatas — keduanya digabung sebagai satu hybrid data stream yang jadi input simulasi Monte Carlo.
        </p>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={mg.telemetry} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(226,232,232,0.5)" />
            <XAxis dataKey="hour" tick={{ fill: '#5B6472', fontSize: 10 }} />
            <YAxis yAxisId="mw" tick={{ fill: '#5B6472', fontSize: 11 }} />
            <YAxis yAxisId="soc" orientation="right" domain={[0, 100]} tick={{ fill: '#5B6472', fontSize: 11 }} />
            <Tooltip contentStyle={{ background: '#FFFFFF', border: '1px solid #DCE3E3', borderRadius: 8, color: '#111827', fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 11, color: '#5B6472' }} />
            <Line yAxisId="mw" type="monotone" dataKey="generationMW" name="Generasi (MW)" stroke="#14B8A6" strokeWidth={2} dot={false} />
            <Line yAxisId="mw" type="monotone" dataKey="loadMW" name="Beban (MW)" stroke="#E11D48" strokeWidth={2} dot={false} />
            <Line yAxisId="soc" type="monotone" dataKey="bessSOC" name="BESS SOC (%)" stroke="#D97706" strokeWidth={1.5} strokeDasharray="5 5" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Hybrid data quality — sumber, freshness, confidence, dan status telemetry */}
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.29 }} className="card p-5 mb-6">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div>
            <h2 className="font-display font-semibold text-base" style={{ color: 'var(--text-primary)' }}>Hybrid Data Intelligence</h2>
            <p className="text-xs mt-1" style={{ color: 'var(--text-dim)' }}>Shared telemetry & observations yang menjadi input Digital Twin → Risk → Recommendation.</p>
          </div>
          <span className="text-xs px-2 py-1 rounded-full" style={{ background: 'rgba(20,184,166,0.08)', color: '#0F766E' }}>Live shared data</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
          {observations.filter(o => o.microgridId === mg.id && ['GENERATION','LOAD','BESS_SOC','BESS_SOH','BESS_STATUS'].includes(o.source)).map(o => {
            const fresh = o.freshnessMinutes <= 15;
            const label = o.source === 'GENERATION' ? 'EBT Generation' : o.source === 'LOAD' ? 'Load' : o.source === 'BESS_SOC' ? 'BESS SOC' : o.source === 'BESS_SOH' ? 'BESS SOH' : 'BESS Availability';
            const value = o.source === 'BESS_STATUS' ? (o.value > 0 ? 'AVAILABLE' : 'UNAVAILABLE') : `${o.value}${o.unit === '%' ? '%' : ` ${o.unit}`}`;
            return (
              <div key={o.id} className="rounded-xl p-3" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)' }}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{label}</p>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: fresh ? 'rgba(20,184,166,0.1)' : 'rgba(217,119,6,0.1)', color: fresh ? '#0F766E' : '#B45309' }}>{fresh ? 'FRESH' : 'STALE'}</span>
                </div>
                <p className="font-mono font-bold text-base mt-1" style={{ color: 'var(--text-primary)' }}>{value}</p>
                <p className="text-[10px] mt-1" style={{ color: 'var(--text-dim)' }}>{o.source} · {o.confidence}% confidence · Q{o.quality} · {o.timestamp.slice(11,16)}Z</p>
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[10px]" style={{ color: 'var(--text-dim)' }}>
          {observations.filter(o => o.microgridId === mg.id && ['WEATHER','SATELLITE','NIGHT_LIGHT','CITIZEN'].includes(o.source)).map(o => <span key={o.id}>• {o.source}: {o.freshnessMinutes}m old · {o.confidence}% confidence · Q{o.quality}</span>)}
        </div>
      </motion.div>

      {/* Risk timeline & early warning untuk microgrid ini */}
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }} className="card p-5 mb-6">
        <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
          <h2 className="font-display font-semibold text-base" style={{ color: 'var(--text-primary)' }}>Risk Timeline & Early Warning</h2>
          {mg.earlyWarning.active && <span className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs" style={{ background: 'rgba(225,29,72,0.1)', color: '#E11D48', border: '1px solid rgba(225,29,72,0.2)' }}><ShieldAlert size={12} /> Aktif</span>}
        </div>
        <p className="text-xs mb-3" style={{ color: 'var(--text-dim)' }}>{mg.earlyWarning.message}</p>
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={mg.riskTimeline} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
            <defs>
              <linearGradient id="mgRiskFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#E11D48" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#E11D48" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(226,232,232,0.5)" />
            <XAxis dataKey="hour" tick={{ fill: '#5B6472', fontSize: 10 }} />
            <YAxis domain={[0, 100]} tick={{ fill: '#5B6472', fontSize: 11 }} />
            <Tooltip contentStyle={{ background: '#FFFFFF', border: '1px solid #DCE3E3', borderRadius: 8, color: '#111827', fontSize: 12 }} />
            <ReferenceLine y={75} stroke="#E11D48" strokeDasharray="4 4" opacity={0.5} />
            <ReferenceLine y={45} stroke="#D97706" strokeDasharray="4 4" opacity={0.5} />
            <Area type="monotone" dataKey="risk" stroke="#E11D48" fill="url(#mgRiskFill)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
        <div className="grid grid-cols-3 gap-3 mt-3">
          <div className="text-center p-2 rounded-lg" style={{ background: 'rgba(226,232,232,0.3)' }}>
            <p className="font-mono font-bold text-sm">{mg.monteCarlo.deficitProbability}%</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Deficit prob. (MC)</p>
          </div>
          <div className="text-center p-2 rounded-lg" style={{ background: 'rgba(226,232,232,0.3)' }}>
            <p className="font-mono font-bold text-sm">{mg.monteCarlo.meanDaysToFirstDeficit ?? '—'}</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Rata² hari ke defisit</p>
          </div>
          <div className="text-center p-2 rounded-lg" style={{ background: 'rgba(226,232,232,0.3)' }}>
            <p className="font-mono font-bold text-sm">{mg.monteCarlo.energyNotServedP90} MWh</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>ENS p90</p>
          </div>
        </div>
      </motion.div>

      {/* Incident yang terhubung ke microgrid ini */}
      {incidents.filter(i => i.microgridId === mg.id).length > 0 && (
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.32 }} className="card p-5 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Activity size={16} style={{ color: '#D97706' }} />
            <h2 className="font-display font-semibold text-base" style={{ color: 'var(--text-primary)' }}>Incident terhubung ke microgrid ini</h2>
          </div>
          <div className="space-y-2">
            {incidents.filter(i => i.microgridId === mg.id).map(i => (
              <div key={i.id} className="p-3 rounded-lg text-xs flex flex-wrap items-center gap-2" style={{ background: 'rgba(226,232,232,0.3)', border: '1px solid var(--bg-border)' }}>
                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{i.title}</span>
                <span className="px-2 py-0.5 rounded-full" style={{ background: i.status === 'RESOLVED' ? 'rgba(13,148,136,.1)' : 'rgba(217,119,6,.12)', color: i.status === 'RESOLVED' ? '#0D9488' : '#B45309' }}>{i.status}</span>
                {i.linkedRecommendationId && <span style={{ color: '#0D9488' }}>↳ {i.linkedRecommendationId}</span>}
                <span className="ml-auto" style={{ color: 'var(--text-dim)' }}>{i.id}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Aksi khusus Teknisi Microgrid — shared shipment state */}
      {isTeknisi && (
        <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.35 }} className="card p-5">
          <h2 className="font-display font-semibold text-base mb-1" style={{ color: 'var(--text-primary)' }}>Tugas Teknisi Lokal</h2>
          <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>Konfirmasi arrival, integrasi, lalu operasional BESS melalui shared shipment state.</p>
          {shipments.filter(s => s.destination === TEKNISI_DESTINATION_CITY && ['ARRIVED','INTEGRATED'].includes(s.status)).map(sh => (
            <div key={sh.id} className="p-3 rounded-lg border mb-3" style={{ borderColor: 'var(--bg-border)' }}>
              <div className="flex justify-between gap-3"><b className="text-sm">{sh.bessId} · {sh.id}</b><span className="text-xs font-mono">{sh.status}</span></div>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{sh.origin} → {sh.destination} · {sh.vessel}</p>
              <div className="flex flex-wrap gap-2 mt-3">
                {sh.status === 'ARRIVED' && <button onClick={() => confirmIntegration(sh.id)} className="btn-small">Confirm Integration</button>}
                {sh.status === 'INTEGRATED' && <button onClick={() => integrateShipment(sh.id)} className="btn-small">Set Operational</button>}
              </div>
            </div>
          ))}
          {shipments.filter(s => s.destination === TEKNISI_DESTINATION_CITY && ['IN_TRANSIT','DELAYED'].includes(s.status)).map(sh => (
            <div key={sh.id} className="p-3 rounded-lg border" style={{ borderColor: 'var(--bg-border)' }}>
              <b className="text-sm">{sh.bessId} · {sh.id}</b><p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Shipment menuju Kupang · {sh.status}</p>
              <button onClick={() => confirmArrival(sh.id)} className="btn-small mt-3">Confirm Arrival</button>
            </div>
          ))}
          {shipments.filter(s => s.destination === TEKNISI_DESTINATION_CITY && ['ARRIVED','INTEGRATED','IN_TRANSIT','DELAYED'].includes(s.status)).length === 0 && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Belum ada shipment yang perlu ditangani.</p>}
        </motion.div>
      )}
    </div>
  );
}

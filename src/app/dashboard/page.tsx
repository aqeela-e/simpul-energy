'use client';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useRoleGuard } from '@/hooks/useRoleGuard';
import LiveSystemClock from '@/components/LiveSystemClock';
import { useSimpul, calculateScenario } from '@/context/SimpulContext';
import { AlertTriangle, Zap, Battery, TrendingDown, TrendingUp, Activity, Ship, Info, ShieldAlert } from 'lucide-react';

const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, { label: string; cls: string }> = {
    normal: { label: 'Normal', cls: 'badge-normal' },
    warning: { label: 'Peringatan', cls: 'badge-warning' },
    critical: { label: 'Kritis', cls: 'badge-critical' },
  };
  const s = map[status] || map.normal;
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>{s.label}</span>;
};

export default function Dashboard() {
  const user = useRoleGuard();
  const router = useRouter();
  const { operationalMicrogrids, operationalBess, simulationRuns } = useSimpul();
  if (!user) return null;
  const isPublic = user.role === 'publik';

  const earlyWarnings = operationalMicrogrids.filter(m => m.earlyWarning.active);
  const critical = operationalMicrogrids.filter(m => m.status === 'critical').length;
  const warning = operationalMicrogrids.filter(m => m.status === 'warning').length;
  const inTransit = operationalBess.filter(b => b.status === 'in-transit').length;
  const avgRE = Math.round(operationalMicrogrids.reduce((a, m) => a + m.renewableUtilization, 0) / Math.max(1, operationalMicrogrids.length));

  const KPI_CARDS = [
    { label: 'Microgrid Kritis', value: critical.toString(), unit: 'lokasi', icon: AlertTriangle, color: '#E11D48', bg: 'rgba(225,29,72,0.1)', border: 'rgba(225,29,72,0.2)' },
    { label: 'Microgrid Waspada', value: warning.toString(), unit: 'lokasi', icon: Activity, color: '#D97706', bg: 'rgba(217,119,6,0.1)', border: 'rgba(217,119,6,0.2)' },
    { label: 'BESS dalam Transit', value: inTransit.toString(), unit: 'unit', icon: Ship, color: '#D97706', bg: 'rgba(217,119,6,0.1)', border: 'rgba(217,119,6,0.2)' },
    { label: 'Rata-rata EBT', value: `${avgRE}%`, unit: 'utilisasi', icon: Zap, color: '#14B8A6', bg: 'rgba(13,148,136,0.1)', border: 'rgba(13,148,136,0.2)' },
    { label: 'BESS Aktif', value: operationalBess.length.toString(), unit: 'unit', icon: Battery, color: '#2563EB', bg: 'rgba(37,99,235,0.1)', border: 'rgba(37,99,235,0.2)' },
  ];

  // Dampak sistem: kalau operator sudah pernah menjalankan simulation,
  // pakai hasil run terbaru (data nyata dari M6). Kalau belum, hitung live
  // dari kondisi microgrid saat ini (static = tanpa BESS tersedia, adaptive
  // = dengan BESS tersedia) supaya angka tetap berubah mengikuti state
  // aktual (reports/incidents/shipments), bukan angka dekoratif tetap.
  const latestRun = simulationRuns[0];
  const impactSource = latestRun
    ? { before: latestRun.before, after: latestRun.after }
    : (() => {
        const n = Math.max(1, operationalMicrogrids.length);
        const pick = (avail: boolean) => {
          const scenarios = operationalMicrogrids.map(m => calculateScenario(m, 'baseline', avail));
          return {
            renewableUtilization: Math.round(scenarios.reduce((a, s) => a + s.renewableUtilization, 0) / n),
            dieselDependency: Math.round(scenarios.reduce((a, s) => a + s.dieselDependency, 0) / n),
            criticalLoadCoverage: Number((scenarios.reduce((a, s) => a + s.criticalCoverage, 0) / n / 10).toFixed(1)),
            bessUtilization: Math.round(scenarios.reduce((a, s) => a + s.bessUtilization, 0) / n),
          };
        };
        return { before: pick(false), after: pick(true) };
      })();

  const IMPACT = [
    { label: 'Pemanfaatan EBT', before: impactSource.before.renewableUtilization, after: impactSource.after.renewableUtilization, unit: '%', better: 'up' },
    { label: 'Ketergantungan Diesel', before: impactSource.before.dieselDependency, after: impactSource.after.dieselDependency, unit: '%', better: 'down' },
    { label: 'Cakupan Beban Kritis', before: impactSource.before.criticalLoadCoverage, after: impactSource.after.criticalLoadCoverage, unit: ' jam', better: 'up' },
    { label: 'Utilisasi BESS', before: impactSource.before.bessUtilization, after: impactSource.after.bessUtilization, unit: '%', better: 'up' },
  ];

  return (
    <div className="min-h-screen pb-16 px-4 sm:px-6 max-w-screen-xl mx-auto">
      {/* Header */}
      <motion.div initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="pt-6 sm:pt-8 mb-8">
        <div className="flex items-center gap-2 mb-1">
          <LiveSystemClock className="text-xs font-medium" style={{ color: 'var(--accent-teal)' }} />
        </div>
        <h1 className="font-display font-bold text-2xl md:text-3xl" style={{ color: 'var(--text-primary)' }}>Dashboard Nasional</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Overview status energi & BESS seluruh wilayah Indonesia Timur</p>
        {isPublic && (
          <div className="mt-3 flex items-start gap-2 text-xs p-2.5 rounded-lg" style={{ background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.2)', color: 'var(--text-muted)' }}>
            <Info size={13} className="mt-0.5 shrink-0" style={{ color: 'var(--accent-blue)' }} />
            <span>Anda melihat ringkasan agregat untuk transparansi publik. Data granular per-lokasi dan alat pengambilan keputusan hanya tersedia untuk Admin PLN.</span>
          </div>
        )}
      </motion.div>

      {/* Early warning strip — dari risk timeline + Monte Carlo per microgrid, dihitung live dari shared state */}
      {earlyWarnings.length > 0 && (
        <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="mb-6 p-3 rounded-lg flex flex-wrap items-center gap-3" style={{ background: 'rgba(225,29,72,0.08)', border: '1px solid rgba(225,29,72,0.2)' }}>
          <ShieldAlert size={16} style={{ color: '#E11D48' }} />
          <span className="text-xs font-semibold" style={{ color: '#E11D48' }}>{earlyWarnings.length} early warning aktif:</span>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{earlyWarnings.map(m => m.name).join(', ')}</span>
          {!isPublic && <button onClick={() => router.push('/forecast')} className="ml-auto text-xs font-medium underline" style={{ color: '#E11D48' }}>Lihat detail →</button>}
        </motion.div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {KPI_CARDS.map((k, i) => (
          <motion.div key={k.label} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: i * 0.1 }} className="card p-4" style={{ borderColor: k.border, background: k.bg }}>
            <div className="flex items-center justify-between mb-2">
              <k.icon size={18} style={{ color: k.color }} />
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{k.unit}</span>
            </div>
            <p className="font-mono font-bold text-3xl" style={{ color: k.color }}>{k.value}</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{k.label}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Microgrid list */}
        <div className="lg:col-span-2 card p-5">
          <h2 className="font-display font-semibold text-base mb-4" style={{ color: 'var(--text-primary)' }}>Status Microgrid</h2>
          <div className="space-y-3">
            {operationalMicrogrids.map((mg, i) => (
              <motion.div key={mg.id} initial={{ x: -10, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.2 + i * 0.08 }}
                onClick={isPublic ? undefined : () => router.push(`/microgrids/${mg.id}`)}
                className={`flex flex-wrap sm:flex-nowrap items-start sm:items-center gap-x-3 gap-y-2 p-3 rounded-lg transition-all ${isPublic ? '' : 'cursor-pointer hover:opacity-80'}`}
                style={{ background: 'rgba(226,232,232,0.3)', border: '1px solid var(--bg-border)' }}>
                <div className="w-2 h-10 rounded-full flex-shrink-0 self-stretch sm:self-auto" style={{ background: mg.status === 'critical' ? '#E11D48' : mg.status === 'warning' ? '#D97706' : '#14B8A6' }} />
                <div className="flex-1 min-w-0 basis-full sm:basis-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-1">
                    <span className="font-medium text-sm truncate max-w-full" style={{ color: 'var(--text-primary)' }}>{mg.name}</span>
                    <StatusBadge status={mg.status} />
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                    <span>Gen: <span className="font-mono" style={{ color: 'var(--text-primary)' }}>{mg.currentGeneration} MW</span></span>
                    <span>Demand: <span className="font-mono" style={{ color: 'var(--text-primary)' }}>{mg.currentDemand} MW</span></span>
                    <span>SOC: <span className="font-mono" style={{ color: mg.bessSOC < 40 ? '#E11D48' : '#14B8A6' }}>{mg.bessSOC}%</span></span>
                  </div>
                </div>
                <div className="text-left sm:text-right flex-shrink-0 ml-auto sm:ml-0">
                  <p className="font-mono text-sm font-bold" style={{ color: mg.energyBalance < 0 ? '#E11D48' : '#14B8A6' }}>
                    {mg.energyBalance > 0 ? '+' : ''}{mg.energyBalance} MW
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Risiko: {mg.deficitProbability}%</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Impact vs baseline */}
        <div className="card p-5">
          <h2 className="font-display font-semibold text-base mb-1" style={{ color: 'var(--text-primary)' }}>Dampak Sistem</h2>
          <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>SIMPUL vs. Alokasi Statis</p>
          <div className="space-y-4">
            {IMPACT.map(item => {
              const diff = item.after - item.before;
              const positive = item.better === 'up' ? diff > 0 : diff < 0;
              return (
                <div key={item.label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span style={{ color: 'var(--text-muted)' }}>{item.label}</span>
                    <div className="flex items-center gap-1">
                      {positive ? <TrendingUp size={11} style={{ color: '#14B8A6' }} /> : <TrendingDown size={11} style={{ color: '#E11D48' }} />}
                      <span className="font-mono font-bold" style={{ color: positive ? '#14B8A6' : '#E11D48' }}>
                        {diff > 0 ? '+' : ''}{diff.toFixed(1)}{item.unit}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1 h-2">
                    <div className="rounded-full flex-1 relative overflow-hidden" style={{ background: 'var(--bg-border)' }}>
                      <div className="absolute left-0 top-0 h-full rounded-full" style={{ width: `${Math.min(item.before, 100)}%`, background: 'var(--bg-border)' }} />
                      <div className="absolute left-0 top-0 h-full rounded-full transition-all" style={{ width: `${Math.min(item.after, 100)}%`, background: positive ? '#14B8A6' : '#E11D48' }} />
                    </div>
                  </div>
                  <div className="flex justify-between text-xs mt-0.5">
                    <span className="font-mono" style={{ color: 'var(--text-dim)' }}>{item.before}{item.unit}</span>
                    <span className="font-mono font-bold" style={{ color: positive ? '#14B8A6' : '#E11D48' }}>{item.after}{item.unit}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 p-3 rounded-lg text-xs" style={{ background: 'rgba(13,148,136,0.1)', border: '1px solid rgba(13,148,136,0.2)' }}>
            <p style={{ color: 'var(--accent-teal)' }}>⚡ Data berdasarkan simulasi skenario NTT (Agustus 2026)</p>
          </div>
        </div>
      </div>

      {/* BESS Fleet */}
      <div className="card p-5">
        <h2 className="font-display font-semibold text-base mb-4" style={{ color: 'var(--text-primary)' }}>Armada BESS</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {operationalBess.map((bess, i) => {
            const statusColor: Record<string, string> = { charging: '#D97706', discharging: '#E11D48', idle: '#14B8A6', 'in-transit': '#2563EB' };
            const statusLabel: Record<string, string> = { charging: 'Mengisi', discharging: 'Menyalurkan', idle: 'Siap', 'in-transit': 'Transit' };
            return (
              <motion.div key={bess.id} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.3 + i * 0.05 }} className="card p-3 text-center">
                <div className="relative inline-flex items-center justify-center w-12 h-12 mb-2">
                  <svg viewBox="0 0 44 44" className="w-12 h-12 -rotate-90">
                    <circle cx="22" cy="22" r="18" fill="none" stroke="var(--bg-border)" strokeWidth="4" />
                    <circle cx="22" cy="22" r="18" fill="none" stroke={statusColor[bess.status]} strokeWidth="4" strokeDasharray={`${2 * Math.PI * 18}`} strokeDashoffset={`${2 * Math.PI * 18 * (1 - bess.soc / 100)}`} strokeLinecap="round" />
                  </svg>
                  <span className="absolute font-mono font-bold text-xs" style={{ color: statusColor[bess.status] }}>{bess.soc}%</span>
                </div>
                <p className="font-display font-bold text-xs" style={{ color: 'var(--text-primary)' }}>{bess.name}</p>
                <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{bess.currentLocation}</p>
                <span className="mt-1 inline-block px-1.5 py-0.5 rounded text-xs" style={{ background: `${statusColor[bess.status]}20`, color: statusColor[bess.status] }}>{statusLabel[bess.status]}</span>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

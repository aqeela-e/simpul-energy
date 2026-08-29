'use client';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useRoleGuard } from '@/hooks/useRoleGuard';
import { TEKNISI_MICROGRID_ID } from '@/lib/permissions';
import { useSimpul } from '@/context/SimpulContext';
import { AlertTriangle, CheckCircle, AlertCircle, ChevronRight, Info } from 'lucide-react';

export default function MicrogridsPage() {
  const user = useRoleGuard();
  const router = useRouter();
  const { operationalMicrogrids } = useSimpul();
  if (!user) return null;

  const isTeknisi = user.role === 'teknisi-lokal';
  const visibleMicrogrids = isTeknisi ? operationalMicrogrids.filter(m => m.id === TEKNISI_MICROGRID_ID) : operationalMicrogrids;

  return (
    <div className="min-h-screen pb-16 px-4 sm:px-6 max-w-screen-xl mx-auto">
      <motion.div initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="pt-6 sm:pt-8 mb-8">
        <span className="eyebrow">M2 — Kembaran Digital Sistem</span>
        <h1 className="font-display font-bold text-2xl md:text-3xl mt-1" style={{ color: 'var(--text-primary)' }}>Daftar Microgrid</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          {isTeknisi ? '1 microgrid — wilayah tugas Anda' : '5 sistem kelistrikan terpantau — Indonesia Timur'}
        </p>
        {isTeknisi && (
          <div className="mt-3 flex items-start gap-2 text-xs p-2.5 rounded-lg max-w-xl" style={{ background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.2)', color: 'var(--text-muted)' }}>
            <Info size={13} className="mt-0.5 shrink-0" style={{ color: 'var(--accent-blue)' }} />
            <span>Anda hanya melihat microgrid di wilayah penugasan Anda (NTT). Microgrid wilayah lain dikelola teknisi setempat masing-masing.</span>
          </div>
        )}
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {visibleMicrogrids.map((mg, i) => {
          const Icon = mg.status === 'critical' ? AlertTriangle : mg.status === 'warning' ? AlertCircle : CheckCircle;
          const color = mg.status === 'critical' ? '#E11D48' : mg.status === 'warning' ? '#D97706' : '#14B8A6';
          const reTotal = Object.values(mg.renewableCapacity).reduce((a, b) => a + b, 0);
          return (
            <motion.div key={mg.id} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: i * 0.1 }}
              onClick={() => router.push(`/microgrids/${mg.id}`)}
              className="card p-5 cursor-pointer transition-all hover:scale-[1.01]" style={{ borderColor: `${color}40` }}>
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-display font-bold text-base" style={{ color: 'var(--text-primary)' }}>{mg.name}</h3>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{mg.island}</p>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium" style={{ background: `${color}15`, color, border: `1px solid ${color}30` }}>
                  <Icon size={12} />
                  {mg.status === 'critical' ? 'Kritis' : mg.status === 'warning' ? 'Waspada' : 'Normal'}
                </div>
              </div>

              {/* Energy balance */}
              <div className="p-3 rounded-lg mb-4" style={{ background: 'rgba(226,232,232,0.3)' }}>
                <div className="flex justify-between text-xs mb-1">
                  <span style={{ color: 'var(--text-muted)' }}>Generasi EBT</span>
                  <span className="font-mono font-bold" style={{ color: '#14B8A6' }}>{mg.currentGeneration} MW</span>
                </div>
                <div className="flex justify-between text-xs mb-1">
                  <span style={{ color: 'var(--text-muted)' }}>Permintaan</span>
                  <span className="font-mono font-bold" style={{ color: 'var(--text-primary)' }}>{mg.currentDemand} MW</span>
                </div>
                <div className="border-t pt-1 mt-1 flex justify-between text-xs" style={{ borderColor: 'var(--bg-border)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Neraca Energi</span>
                  <span className="font-mono font-bold" style={{ color: mg.energyBalance < 0 ? '#E11D48' : '#14B8A6' }}>
                    {mg.energyBalance > 0 ? '+' : ''}{mg.energyBalance} MW
                  </span>
                </div>
              </div>

              {/* RE mix bars */}
              <div className="mb-4">
                <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>Komposisi EBT ({reTotal.toFixed(1)} MW terpasang)</p>
                <div className="flex gap-1 h-2 rounded-full overflow-hidden">
                  {[
                    { key: 'solar', color: '#D97706', label: 'Surya' },
                    { key: 'wind', color: '#2563EB', label: 'Angin' },
                    { key: 'hydro', color: '#0891B2', label: 'Air' },
                    { key: 'geothermal', color: '#7C3AED', label: 'Panas Bumi' },
                    { key: 'biomass', color: '#059669', label: 'Bioenergi' },
                  ].map(s => {
                    const val = mg.renewableCapacity[s.key as keyof typeof mg.renewableCapacity];
                    if (val === 0) return null;
                    return <div key={s.key} style={{ flex: val, background: s.color }} title={`${s.label}: ${val} MW`} />;
                  })}
                </div>
                <div className="flex gap-3 mt-1 flex-wrap">
                  {[
                    { key: 'solar', color: '#D97706', label: 'Surya' },
                    { key: 'wind', color: '#2563EB', label: 'Angin' },
                    { key: 'hydro', color: '#0891B2', label: 'Air' },
                    { key: 'geothermal', color: '#7C3AED', label: 'Panas Bumi' },
                    { key: 'biomass', color: '#059669', label: 'Bio' },
                  ].filter(s => mg.renewableCapacity[s.key as keyof typeof mg.renewableCapacity] > 0).map(s => (
                    <div key={s.key} className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                {[
                  { label: 'BESS SOC', value: `${mg.bessSOC}%`, color: mg.bessSOC < 40 ? '#E11D48' : '#14B8A6' },
                  { label: 'Diesel', value: `${mg.dieselDependency}%`, color: mg.dieselDependency > 20 ? '#E11D48' : '#14B8A6' },
                  { label: 'Risiko', value: `${mg.deficitProbability}%`, color: mg.deficitProbability > 60 ? '#E11D48' : mg.deficitProbability > 30 ? '#D97706' : '#14B8A6' },
                ].map(s => (
                  <div key={s.label} className="text-center p-2 rounded-lg" style={{ background: 'rgba(226,232,232,0.3)' }}>
                    <p className="font-mono font-bold text-sm" style={{ color: s.color }}>{s.value}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-end gap-1 text-xs" style={{ color: 'var(--accent-teal)' }}>
                Lihat Digital Twin <ChevronRight size={14} />
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

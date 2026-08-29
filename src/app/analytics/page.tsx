'use client';
import { useRoleGuard } from '@/hooks/useRoleGuard';
import { useSimpul } from '@/context/SimpulContext';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { TrendingUp, TrendingDown, Ship, Battery, AlertTriangle, CheckCircle, Clock3, Scale } from 'lucide-react';

export default function AnalyticsPage() {
  const user = useRoleGuard();
  const { operationalMicrogrids, operationalBess, shipments, incidents, recommendations, simulationRuns, audits } = useSimpul();
  if (!user) return null;

  // Risk snapshot — risiko komposit real-time tiap microgrid (M3), diurutkan.
  const riskData = [...operationalMicrogrids]
    .sort((a, b) => b.riskScore - a.riskScore)
    .map(m => ({ name: m.island.split(' ')[0], risk: m.riskScore, color: m.riskScore >= 75 ? '#E11D48' : m.riskScore >= 45 ? '#D97706' : '#14B8A6' }));

  // BESS utilization — breakdown status armada saat ini.
  const bessStatusCounts: Record<string, number> = { idle: 0, charging: 0, discharging: 0, 'in-transit': 0 };
  operationalBess.forEach(b => { bessStatusCounts[b.status] = (bessStatusCounts[b.status] ?? 0) + 1; });
  const avgSOC = Math.round(operationalBess.reduce((a, b) => a + b.soc, 0) / Math.max(1, operationalBess.length));
  const avgSOH = Math.round(operationalBess.reduce((a, b) => a + b.soh, 0) / Math.max(1, operationalBess.length));

  // Shipment performance — delay & status breakdown dari shipment nyata.
  const delayed = shipments.filter(s => s.delayHours > 0);
  const onTimeRate = shipments.length ? Math.round(((shipments.length - delayed.length) / shipments.length) * 100) : 0;
  const avgDelay = delayed.length ? Number((delayed.reduce((a, s) => a + s.delayHours, 0) / delayed.length).toFixed(1)) : 0;
  const shipmentStatusCounts: Record<string, number> = {};
  shipments.forEach(s => { shipmentStatusCounts[s.status] = (shipmentStatusCounts[s.status] ?? 0) + 1; });

  // Incident trend — breakdown status & severity insiden nyata (M1/incident lifecycle).
  const incidentStatusCounts: Record<string, number> = { DETECTED: 0, VERIFICATION: 0, CONFIRMED: 0, ACTIVE: 0, RESOLVED: 0 };
  incidents.forEach(i => { incidentStatusCounts[i.status] = (incidentStatusCounts[i.status] ?? 0) + 1; });
  const criticalIncidents = incidents.filter(i => i.severity === 'critical').length;
  const resolvedIncidents = incidents.filter(i => i.status === 'RESOLVED').length;
  const incidentResolutionRate = incidents.length ? Math.round((resolvedIncidents / incidents.length) * 100) : 0;

  // Response time — waktu nyata dari recommendation dibuat sampai shipment untuk
  // BESS yang sama dibuat (dicocokkan lewat bessId + urutan waktu, bukan angka tetap),
  // dan dari dispatch ke arrival dikonfirmasi teknisi (bila sudah tiba).
  const recToShipmentHours: number[] = [];
  recommendations.forEach(r => {
    const recTime = new Date(r.createdAt).getTime();
    const sh = shipments.find(s => s.bessId === r.bessId && new Date(s.events[0]?.at ?? s.departure).getTime() >= recTime);
    if (sh) {
      const shCreatedAt = new Date(sh.events[0]?.at ?? sh.departure).getTime();
      const hrs = (shCreatedAt - recTime) / 3600000;
      if (hrs >= 0) recToShipmentHours.push(hrs);
    }
  });
  const avgDecisionHours = recToShipmentHours.length ? Number((recToShipmentHours.reduce((a, b) => a + b, 0) / recToShipmentHours.length).toFixed(1)) : null;
  const arrivedShipments = shipments.filter(s => s.arrivalConfirmedAt);
  const avgTransitHours = arrivedShipments.length
    ? Number((arrivedShipments.reduce((a, s) => a + (new Date(s.arrivalConfirmedAt!).getTime() - new Date(s.departure).getTime()) / 3600000, 0) / arrivedShipments.length).toFixed(1))
    : null;

  // Allocation performance — approval breakdown & rata-rata score rekomendasi.
  const approvalCounts: Record<string, number> = { PENDING: 0, APPROVED: 0, REJECTED: 0, MODIFIED: 0 };
  recommendations.forEach(r => { approvalCounts[r.approval] = (approvalCounts[r.approval] ?? 0) + 1; });
  const avgScore = recommendations.length ? Math.round(recommendations.reduce((a, r) => a + r.score, 0) / recommendations.length) : 0;
  const decidedCount = approvalCounts.APPROVED + approvalCounts.REJECTED + approvalCounts.MODIFIED;
  const approvalRate = decidedCount ? Math.round(((approvalCounts.APPROVED + approvalCounts.MODIFIED) / decidedCount) * 100) : 0;

  return (
    <div className="min-h-screen pb-16 px-4 sm:px-6 max-w-screen-xl mx-auto">
      <motion.div initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="pt-6 sm:pt-8 mb-8">
        <span className="eyebrow">M8 · Analytics</span>
        <h1 className="font-display font-bold text-2xl md:text-3xl mt-1" style={{ color: 'var(--text-primary)' }}>Analytics Operasional</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Seluruh angka di halaman ini dihitung langsung dari state aplikasi (reports, incidents, shipments, recommendations, audits) — berubah mengikuti aktivitas nyata, bukan angka tetap.</p>
      </motion.div>

      {/* Top KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Decision tercatat', value: audits.length.toString(), icon: Scale, color: '#0D9488' },
          { label: 'Shipment on-time', value: `${onTimeRate}%`, icon: Ship, color: '#2563EB' },
          { label: 'Resolusi incident', value: `${incidentResolutionRate}%`, icon: AlertTriangle, color: '#E11D48' },
          { label: 'Approval rate alokasi', value: `${approvalRate}%`, icon: CheckCircle, color: '#7C3AED' },
        ].map(k => (
          <div key={k.label} className="card p-4">
            <div className="flex items-center justify-between mb-2">
              <k.icon size={16} style={{ color: k.color }} />
            </div>
            <p className="font-mono font-bold text-2xl" style={{ color: k.color }}>{k.value}</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{k.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Risk trend per microgrid */}
        <div className="card p-5">
          <h2 className="font-display font-semibold text-base mb-1" style={{ color: 'var(--text-primary)' }}>Risk Snapshot per Microgrid</h2>
          <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>Composite risk saat ini (M3) — naik/turun mengikuti reports, incidents, dan observasi hibrida terbaru.</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={riskData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(226,232,232,0.5)" />
              <XAxis dataKey="name" tick={{ fill: '#5B6472', fontSize: 11 }} />
              <YAxis tick={{ fill: '#5B6472', fontSize: 11 }} domain={[0, 100]} />
              <Tooltip contentStyle={{ background: '#FFFFFF', border: '1px solid #DCE3E3', borderRadius: 8, color: '#111827', fontSize: 12 }} />
              <Bar dataKey="risk" radius={[6, 6, 0, 0]}>
                {riskData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* BESS utilization */}
        <div className="card p-5">
          <h2 className="font-display font-semibold text-base mb-1" style={{ color: 'var(--text-primary)' }}>Utilisasi Armada BESS</h2>
          <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>Rata-rata SOC {avgSOC}% · rata-rata SOH {avgSOH}% dari {operationalBess.length} unit.</p>
          <div className="space-y-3">
            {Object.entries(bessStatusCounts).map(([status, count]) => {
              const pct = operationalBess.length ? Math.round((count / operationalBess.length) * 100) : 0;
              const color: Record<string, string> = { idle: '#14B8A6', charging: '#D97706', discharging: '#E11D48', 'in-transit': '#2563EB' };
              const label: Record<string, string> = { idle: 'Siap', charging: 'Mengisi', discharging: 'Menyalurkan', 'in-transit': 'Transit' };
              return (
                <div key={status}>
                  <div className="flex justify-between text-xs mb-1">
                    <span style={{ color: 'var(--text-muted)' }}>{label[status]}</span>
                    <span className="font-mono font-bold" style={{ color: color[status] }}>{count} unit · {pct}%</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-border)' }}>
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color[status] }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Shipment performance */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-1"><Ship size={16} style={{ color: '#2563EB' }} /><h2 className="font-display font-semibold text-base" style={{ color: 'var(--text-primary)' }}>Kinerja Shipment</h2></div>
          <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>{shipments.length} shipment tercatat · rata-rata delay {avgDelay} jam pada shipment yang delay.</p>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {Object.entries(shipmentStatusCounts).map(([status, count]) => (
              <div key={status} className="p-2.5 rounded-lg text-center" style={{ background: 'rgba(226,232,232,0.3)' }}>
                <p className="font-mono font-bold text-lg" style={{ color: 'var(--text-primary)' }}>{count}</p>
                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{status}</p>
              </div>
            ))}
            {shipments.length === 0 && <p className="text-xs col-span-2" style={{ color: 'var(--text-muted)' }}>Belum ada shipment.</p>}
          </div>
          {avgTransitHours !== null && (
            <div className="flex items-center justify-between p-2.5 rounded-lg text-xs" style={{ background: 'rgba(37,99,235,0.06)', border: '1px solid rgba(37,99,235,0.15)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Rata-rata waktu transit aktual (dispatch → arrival dikonfirmasi)</span>
              <span className="font-mono font-bold" style={{ color: '#2563EB' }}>{avgTransitHours} jam</span>
            </div>
          )}
        </div>

        {/* Incident trend */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-1"><AlertTriangle size={16} style={{ color: '#E11D48' }} /><h2 className="font-display font-semibold text-base" style={{ color: 'var(--text-primary)' }}>Tren Insiden</h2></div>
          <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>{incidents.length} insiden tercatat · {criticalIncidents} berseverity critical.</p>
          <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
            {Object.entries(incidentStatusCounts).map(([status, count]) => (
              <div key={status} className="p-2 rounded-lg text-center" style={{ background: 'rgba(226,232,232,0.3)' }}>
                <p className="font-mono font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{count}</p>
                <p className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{status}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Response time */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-1"><Clock3 size={16} style={{ color: '#D97706' }} /><h2 className="font-display font-semibold text-base" style={{ color: 'var(--text-primary)' }}>Response Time</h2></div>
          <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>Dihitung dari audit trail nyata — bukan estimasi tetap.</p>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-2.5 rounded-lg text-xs" style={{ background: 'rgba(226,232,232,0.3)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Recommendation → Shipment dibuat</span>
              <span className="font-mono font-bold" style={{ color: 'var(--text-primary)' }}>{avgDecisionHours !== null ? `${avgDecisionHours} jam` : '—'}</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-lg text-xs" style={{ background: 'rgba(226,232,232,0.3)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Dispatch → Arrival dikonfirmasi</span>
              <span className="font-mono font-bold" style={{ color: 'var(--text-primary)' }}>{avgTransitHours !== null ? `${avgTransitHours} jam` : '—'}</span>
            </div>
            {avgDecisionHours === null && avgTransitHours === null && (
              <p className="text-xs" style={{ color: 'var(--text-dim)' }}>Belum ada shipment yang selesai penuh (recommendation → shipment → arrival) untuk dihitung.</p>
            )}
          </div>
        </div>

        {/* Allocation performance */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-1"><Battery size={16} style={{ color: '#0D9488' }} /><h2 className="font-display font-semibold text-base" style={{ color: 'var(--text-primary)' }}>Kinerja Alokasi</h2></div>
          <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>{recommendations.length} recommendation dibuat · rata-rata score {avgScore}/100.</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {Object.entries(approvalCounts).map(([status, count]) => (
              <div key={status} className="p-2 rounded-lg text-center" style={{ background: 'rgba(226,232,232,0.3)' }}>
                <p className="font-mono font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{count}</p>
                <p className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{status}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Static vs Adaptive comparison — dari histori simulation runs nyata */}
      <div className="card p-5">
        <h2 className="font-display font-semibold text-base mb-1" style={{ color: 'var(--text-primary)' }}>Static Allocation vs SIMPUL Adaptive</h2>
        <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>Diambil dari histori simulation run (M6) — jalankan skenario baru di halaman Simulasi untuk menambah data.</p>
        {simulationRuns.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Belum ada simulation run.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[640px]">
              <thead>
                <tr className="text-left" style={{ color: 'var(--text-muted)' }}>
                  <th className="pb-2 pr-3">Skenario</th>
                  <th className="pb-2 pr-3">Microgrid</th>
                  <th className="pb-2 pr-3">Risk (static → adaptive)</th>
                  <th className="pb-2 pr-3">Unmet energy (static → adaptive)</th>
                  <th className="pb-2">Response (static → adaptive)</th>
                </tr>
              </thead>
              <tbody>
                {simulationRuns.slice(0, 10).map(r => {
                  const riskBetter = r.after.risk < r.before.risk;
                  const enBetter = r.after.energyNotServed < r.before.energyNotServed;
                  return (
                    <tr key={r.id} className="border-t" style={{ borderColor: 'var(--bg-border-soft)' }}>
                      <td className="py-2 pr-3 font-medium">{r.scenario}</td>
                      <td className="py-2 pr-3" style={{ color: 'var(--text-muted)' }}>{r.microgridId}</td>
                      <td className="py-2 pr-3 font-mono flex items-center gap-1">{r.before.risk} → {r.after.risk}{riskBetter ? <TrendingDown size={12} style={{ color: '#0D9488' }} /> : <TrendingUp size={12} style={{ color: '#E11D48' }} />}</td>
                      <td className="py-2 pr-3 font-mono flex items-center gap-1">{r.before.energyNotServed} → {r.after.energyNotServed} MW{enBetter ? <TrendingDown size={12} style={{ color: '#0D9488' }} /> : <TrendingUp size={12} style={{ color: '#E11D48' }} />}</td>
                      <td className="py-2 font-mono">{r.before.responseHours} → {r.after.responseHours} jam</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

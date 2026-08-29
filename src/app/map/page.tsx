'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useRoleGuard } from '@/hooks/useRoleGuard';
import { routeKeyFor, SEA_ROUTES, formatSailingDays, getShipmentLiveState } from '@/lib/seaTransport';
import { useSimpul } from '@/context/SimpulContext';
import { useLiveClock, formatWIBDateTime, formatDurationID } from '@/lib/liveClock';
import IndonesiaMap, { MapMarker, MapRoute, PortMapMarker, BessMapMarker, IncidentMapMarker, SeaLaneMapLine, NetworkLinkMapLine, NightLightMapPoint } from '@/components/IndonesiaMap';
import { MapPin, Navigation, Radio, ArrowRight, CheckCircle2, Satellite, Play, Pause, SunMedium, Anchor, Battery, AlertTriangle, Waves, Activity, LayoutGrid, TrendingDown, TrendingUp, Minus, ShieldAlert } from 'lucide-react';
import type { ShipmentStatus } from '@/context/SimpulContext';

/** M0 — Maritime Map: definisi layer/filter yang bisa dinyalakan/dimatikan operator. Semua data di belakangnya bersumber dari shared state (useSimpul), jadi toggle ini murni visibility — bukan sumber data baru. */
type MapLayerKey = 'microgrid' | 'bess' | 'port' | 'seaRoute' | 'shipment' | 'incident' | 'network';
const LAYER_DEFS: { key: MapLayerKey; label: string; icon: typeof MapPin }[] = [
  { key: 'microgrid', label: 'Microgrid', icon: MapPin },
  { key: 'bess', label: 'BESS', icon: Battery },
  { key: 'port', label: 'Port', icon: Anchor },
  { key: 'seaRoute', label: 'Sea Route', icon: Waves },
  { key: 'shipment', label: 'Shipment/Vessel', icon: Navigation },
  { key: 'incident', label: 'Incident', icon: AlertTriangle },
  { key: 'network', label: 'Network status', icon: Activity },
];

/** "X detik/menit lalu" untuk freshness indicator — dibulatkan ke satuan paling pas. */
function timeAgoID(fromMs: number, nowMs: number): string {
  const diffSec = Math.max(0, Math.round((nowMs - fromMs) / 1000));
  if (diffSec < 5) return 'baru saja';
  if (diffSec < 60) return `${diffSec} detik lalu`;
  const min = Math.floor(diffSec / 60);
  return `${min} menit ${diffSec % 60}s lalu`;
}

/** "dalam Xs" untuk countdown pass satelit berikutnya. */
function inSecondsID(toMs: number, nowMs: number): string {
  const diffSec = Math.max(0, Math.round((toMs - nowMs) / 1000));
  return `${diffSec}s`;
}

const TREND_ICON = { memburuk: TrendingDown, membaik: TrendingUp, stabil: Minus } as const;
const TREND_LABEL = { memburuk: 'Memburuk', membaik: 'Membaik', stabil: 'Stabil' } as const;
const TREND_COLOR = { memburuk: '#E11D48', membaik: '#0D9488', stabil: 'var(--text-muted)' } as const;

const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  Kupang: { lat: -10.17, lng: 123.61 },
  Ambon: { lat: -3.69, lng: 128.18 },
  Jayapura: { lat: -2.53, lng: 140.72 },
  Makassar: { lat: -5.14, lng: 119.41 },
  Balikpapan: { lat: -1.27, lng: 116.83 },
  Surabaya: { lat: -7.25, lng: 112.75 },
};

export default function MapPage() {
  const user = useRoleGuard();
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>('mg-ntt');
  const [satelliteMode, setSatelliteMode] = useState(false);
  const [nightLightMode, setNightLightMode] = useState(true);
  const [demoPlaying, setDemoPlaying] = useState(false);
  const [demoProgress, setDemoProgress] = useState(0.12);
  const [activeLayers, setActiveLayers] = useState<Record<MapLayerKey, boolean>>({
    microgrid: true, bess: true, port: true, seaRoute: true, shipment: true, incident: true, network: true,
  });
  const toggleLayer = (key: MapLayerKey) => setActiveLayers(prev => ({ ...prev, [key]: !prev[key] }));
  const clockNow = useLiveClock();
  const { recommendations, operationalMicrogrids, operationalBess, shipments, updateShipment, incidents, ports } = useSimpul();

  // Transisi status berikutnya yang boleh dikonfirmasi operator langsung dari peta —
  // sama dengan mesin status di /shipments, supaya klik di sini benar-benar
  // mengubah shared shipment state (bukan cuma badge lokal).
  const NEXT_STATUS: Partial<Record<ShipmentStatus, { next: ShipmentStatus; label: string; note: string }>> = {
    PLANNED: { next: 'DISPATCHED', label: 'Konfirmasi Dispatch', note: 'Dispatch dikonfirmasi operator dari peta.' },
    DISPATCHED: { next: 'IN_TRANSIT', label: 'Konfirmasi Keberangkatan', note: 'Kapal berangkat — dikonfirmasi operator dari peta.' },
    DELAYED: { next: 'IN_TRANSIT', label: 'Konfirmasi Lanjut Transit', note: 'Transit dilanjutkan setelah delay — dikonfirmasi operator dari peta.' },
  };

  useEffect(() => {
    if (!demoPlaying) return;
    const id = window.setInterval(() => {
      setDemoProgress(p => p >= 1 ? 0 : Math.min(1, p + 0.0125));
    }, 500);
    return () => window.clearInterval(id);
  }, [demoPlaying]);

  const criticalMG = useMemo(() => [...operationalMicrogrids].sort((a, b) => b.riskScore - a.riskScore)[0], [operationalMicrogrids]);
  const recommended = useMemo(() => {
    if (!criticalMG) return null;
    const latest = recommendations.find(r => r.microgridId === criticalMG.id && r.approval !== 'REJECTED');
    if (latest) return latest;
    const candidates = operationalBess
      .filter(b => b.status === 'idle' || b.status === 'charging')
      .map(b => {
        const routeId = routeKeyFor(b.currentLocation, criticalMG.name.replace('Microgrid ', ''));
        const health = b.soc * 0.55 + b.soh * 0.45;
        const logistics = routeId ? 70 : 35;
        const score = Math.round(0.35 * health + 0.25 * criticalMG.riskScore + 0.20 * Math.min(100, b.capacityKWh / Math.max(1, criticalMG.criticalLoad * 1000) * 100) + 0.20 * logistics);
        return { b, routeId, score };
      }).sort((a, b) => b.score - a.score)[0];
    return candidates ? { bessId: candidates.b.id, routeId: candidates.routeId, score: candidates.score } : null;
  }, [recommendations, criticalMG, operationalBess]);

  if (!user) return null;
  const isOperator = user.role === 'operator-kapal';
  const canOpenDetail = user.role === 'admin-pln' || user.role === 'teknisi-lokal';

  const selectedMG = operationalMicrogrids.find(m => m.id === selected);
  const transitBESS = operationalBess.filter(b => b.status === 'in-transit');

  // Satellite/Night-light layer — dibangun dari OperationalMicrogrid.nightLight, yaitu observasi
  // simulated near-real-time yang sama persis dengan yang dipakai Risk Engine (SimpulContext), jadi
  // apa yang terlihat di peta selalu konsisten dengan apa yang benar-benar mendorong Risk → Priority.
  const nightLightPoints: NightLightMapPoint[] = operationalMicrogrids
    .filter(mg => !!mg.nightLight)
    .map(mg => ({
      lat: mg.lat,
      lng: mg.lng,
      label: mg.id,
      anomaly: mg.nightLight.anomalyPct,
      previousAnomaly: mg.nightLight.previousAnomalyPct,
      baseline: mg.nightLight.baselineAnomalyPct,
      confidence: mg.nightLight.confidence,
      freshnessMinutes: mg.nightLight.freshnessMinutes,
      epoch: mg.nightLight.epoch,
      trend: mg.nightLight.trend,
    }));

  const markers: MapMarker[] = operationalMicrogrids.map(mg => ({
    id: mg.id,
    lat: mg.lat,
    lng: mg.lng,
    label: mg.island.split(' ')[0],
    sublabel: `SOC ${mg.bessSOC}%`,
    status: mg.status,
    selected: selected === mg.id,
    onClick: () => setSelected(selected === mg.id ? null : mg.id),
  }));

  const recommendedBESS = recommended ? operationalBess.find(b => b.id === recommended.bessId) : undefined;
  const recommendedRoute = recommended?.routeId ? SEA_ROUTES[recommended.routeId] : undefined;

  const routes: MapRoute[] = [
    ...shipments
      .filter(sh => ['DISPATCHED','IN_TRANSIT','DELAYED','ARRIVED','INTEGRATED'].includes(sh.status) && CITY_COORDS[sh.origin] && CITY_COORDS[sh.destination])
      .map(sh => {
        const progress = sh.status === 'ARRIVED' || sh.status === 'INTEGRATED' || sh.status === 'OPERATIONAL' ? 1 : clockNow ? getShipmentLiveState(sh, clockNow).progress : 0;
        return { id: `shipment-${sh.id}`, from: CITY_COORDS[sh.origin], to: CITY_COORDS[sh.destination], color: '#2563EB', progress, showVessel: sh.status !== 'ARRIVED' && sh.status !== 'INTEGRATED' };
      }),
    ...(recommendedBESS && recommendedRoute && CITY_COORDS[recommendedBESS.currentLocation] && CITY_COORDS[criticalMG.name.replace('Microgrid ', '')] ? (() => {
      const operationalShipment = shipments.find(sh => sh.bessId === recommendedBESS.id && ['DISPATCHED','IN_TRANSIT','DELAYED','ARRIVED','INTEGRATED'].includes(sh.status));
      const p = operationalShipment && clockNow ? getShipmentLiveState(operationalShipment, clockNow).progress : demoProgress;
      return [{ id: `recommended-${criticalMG.id}`, from: CITY_COORDS[recommendedBESS.currentLocation], to: CITY_COORDS[criticalMG.name.replace('Microgrid ', '')], color: '#E11D48', progress: p, showVessel: p < 1 }];
    })() : []),
  ];

  // --- Maritime Map layers (M0 gap) — semua turunan dari shared state (useSimpul), murni presentational. ---

  // Port layer: status pelabuhan (OPEN/CONGESTED/CLOSED) langsung dari shared state; ikut berubah otomatis saat operator mengubah status di /allocation atau tempat lain yang memanggil updatePortStatus.
  const portMarkers: PortMapMarker[] = ports.map(p => ({ id: p.id, lat: p.lat, lng: p.lng, name: p.name, status: p.status }));

  // BESS layer: hanya unit yang sedang TIDAK berlayar (idle/charging/discharging) ditampilkan sebagai node statis di lokasinya —
  // unit in-transit sudah tercermin sebagai kapal bergerak di sepanjang jalur shipment (routes di atas), jadi tidak diduplikasi.
  const bessMarkers: BessMapMarker[] = operationalBess
    .filter(b => b.status !== 'in-transit')
    .map(b => ({ id: b.id, lat: b.lat, lng: b.lng, name: b.name, status: b.status, soc: b.soc }));

  // Incident layer: seluruh incident yang belum RESOLVED, diplot di lokasi microgrid terkait — otomatis muncul/hilang
  // begitu incident dibuat, diverifikasi, dikonfirmasi, diaktifkan, atau di-resolve dari halaman lain (shared state).
  const incidentMarkers: IncidentMapMarker[] = incidents
    .filter(i => i.status !== 'RESOLVED')
    .map((i): IncidentMapMarker | null => {
      const mg = operationalMicrogrids.find(m => m.id === i.microgridId);
      if (!mg) return null;
      return { id: i.id, lat: mg.lat, lng: mg.lng, title: i.title, severity: i.severity, status: i.status };
    })
    .filter((x): x is IncidentMapMarker => x !== null);

  // Sea Route layer: backbone seluruh jalur Tol Laut yang terdaftar (SEA_ROUTES), digambar tipis sebagai jaringan
  // statis — terpisah dari `routes` di atas yang hanya menggambar shipment yang sedang berjalan.
  const seaLanes: SeaLaneMapLine[] = Object.values(SEA_ROUTES)
    .map(route => {
      const [fromCity, toCity] = route.label.split(' → ');
      const fromPort = ports.find(p => p.id === route.originPortId);
      const toPort = ports.find(p => p.id === route.destinationPortId);
      const from = fromPort ?? CITY_COORDS[fromCity];
      const to = toPort ?? CITY_COORDS[toCity];
      if (!from || !to) return null;
      return { id: route.id, from: { lat: from.lat, lng: from.lng }, to: { lat: to.lat, lng: to.lng }, label: route.label };
    })
    .filter((x): x is SeaLaneMapLine => x !== null);

  // Network status layer: garis koneksi microgrid ⇄ BESS yang sudah tersambung (connectedBESS) — array ini sendiri
  // sudah dihitung ulang secara live di SimpulContext setiap ada shipment OPERATIONAL baru, jadi garis ini otomatis
  // bertambah begitu integrasi BESS selesai, tanpa logic tambahan di halaman ini.
  const networkLinks: NetworkLinkMapLine[] = operationalMicrogrids.flatMap(mg =>
    mg.connectedBESS
      .map(bessId => operationalBess.find(b => b.id === bessId))
      .filter((b): b is NonNullable<typeof b> => !!b)
      .map(b => ({ id: `${mg.id}-${b.id}`, from: { lat: mg.lat, lng: mg.lng }, to: { lat: b.lat, lng: b.lng } }))
  );

  return (
    <div className="min-h-screen pb-16 px-4 sm:px-6 max-w-screen-xl mx-auto">
      <motion.div initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="pt-8 mb-6">
        <span className="eyebrow">M0 — Peta Jaringan Nasional</span>
        <h1 className="font-display font-bold text-2xl md:text-3xl mt-1" style={{ color: 'var(--text-primary)' }}>Peta Microgrid Nasional</h1>
        <p className="text-sm mt-1.5 max-w-xl" style={{ color: 'var(--text-muted)' }}>
          Posisi microgrid dan jalur distribusi BESS lintas Tol Laut secara langsung — ketuk sebuah lokasi untuk melihat detail.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        {/* Map */}
        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="lg:col-span-3 card card-glow p-3 sm:p-4 overflow-hidden">
          <div className="flex items-center justify-between mb-3 px-1 flex-wrap gap-y-1">
            <div className="flex items-center gap-2">
              <Radio size={14} className="animate-pulse" style={{ color: 'var(--accent-teal-light)' }} />
              <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Live tracking</span>
              <span className="text-xs font-mono hidden sm:inline" style={{ color: 'var(--text-dim)' }} suppressHydrationWarning>
                {clockNow ? `· ${formatWIBDateTime(clockNow)}` : ''}
              </span>
            </div>
            <span className="text-xs font-mono" style={{ color: 'var(--text-dim)' }}>{markers.length} node · {routes.length} jalur aktif</span>
          </div>

          <div className="flex flex-wrap items-center gap-2 mb-3 px-1">
            <button onClick={() => setSatelliteMode(v => !v)} className="px-2.5 py-1.5 rounded-md text-[11px] font-medium flex items-center gap-1.5" style={{ background: satelliteMode ? 'rgba(13,148,136,.16)' : 'var(--bg-card-soft)', color: satelliteMode ? 'var(--accent-teal-light)' : 'var(--text-muted)', border: '1px solid var(--bg-border-soft)' }}>
              <Satellite size={13} /> {satelliteMode ? 'Citra Satelit Aktif' : 'Peta Jalan'}
            </button>
            <button onClick={() => setNightLightMode(v => !v)} className="px-2.5 py-1.5 rounded-md text-[11px] font-medium flex items-center gap-1.5" style={{ background: nightLightMode ? 'rgba(217,119,6,.12)' : 'var(--bg-card-soft)', color: nightLightMode ? '#D97706' : 'var(--text-muted)', border: '1px solid var(--bg-border-soft)' }}>
              {nightLightMode && <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#D97706' }} />}
              <SunMedium size={13} /> Night-light observation
            </button>
            <button onClick={() => setDemoPlaying(v => !v)} className="px-2.5 py-1.5 rounded-md text-[11px] font-medium flex items-center gap-1.5 ml-auto" style={{ background: 'rgba(225,29,72,.10)', color: '#E11D48', border: '1px solid rgba(225,29,72,.2)' }}>
              {demoPlaying ? <Pause size={13} /> : <Play size={13} />} {demoPlaying ? 'Pause kapal demo' : 'Gerakkan kapal demo'}
            </button>
          </div>

          {/* Layer/filter toolbar — semua entity maritime map (M0): Microgrid, BESS, Port, Sea Route, Shipment/Vessel, Incident, Network status */}
          <div className="flex flex-wrap items-center gap-1.5 mb-3 px-1 pb-3 border-b" style={{ borderColor: 'var(--bg-border-soft)' }}>
            <span className="text-[10px] font-semibold uppercase tracking-wide flex items-center gap-1 mr-0.5" style={{ color: 'var(--text-dim)' }}>
              <LayoutGrid size={11} /> Layer
            </span>
            {LAYER_DEFS.map(({ key, label, icon: Icon }) => {
              const on = activeLayers[key];
              return (
                <button
                  key={key}
                  onClick={() => toggleLayer(key)}
                  aria-pressed={on}
                  className="px-2 py-1 rounded-md text-[11px] font-medium flex items-center gap-1 transition-colors"
                  style={{
                    background: on ? 'rgba(13,148,136,.14)' : 'var(--bg-card-soft)',
                    color: on ? 'var(--accent-teal-light)' : 'var(--text-dim)',
                    border: `1px solid ${on ? 'rgba(13,148,136,.3)' : 'var(--bg-border-soft)'}`,
                  }}
                >
                  <Icon size={12} /> {label}
                </button>
              );
            })}
          </div>

          <IndonesiaMap
            markers={activeLayers.microgrid ? markers : []}
            routes={activeLayers.shipment ? routes : []}
            satelliteMode={satelliteMode}
            demoProgress={{ [`recommended-${criticalMG.id}`]: demoProgress }}
            nightLightPoints={nightLightMode ? nightLightPoints : []}
            ports={activeLayers.port ? portMarkers : []}
            bessMarkers={activeLayers.bess ? bessMarkers : []}
            incidentMarkers={activeLayers.incident ? incidentMarkers : []}
            seaLanes={activeLayers.seaRoute ? seaLanes : []}
            networkLinks={activeLayers.network ? networkLinks : []}
          />
          <p className="text-[11px] mt-2 px-1" style={{ color: 'var(--text-dim)' }}>
            Perbesar/perkecil peta lewat tombol <span className="font-mono font-semibold">+ / -</span> di pojok kiri atas peta, atau cubit layar (pinch-to-zoom) di perangkat sentuh.
          </p>

          {nightLightMode && (
            <div className="mt-3 p-3 rounded-lg" style={{ background: 'rgba(217,119,6,.06)', border: '1px solid rgba(217,119,6,.16)' }}>
              <div className="flex items-center justify-between flex-wrap gap-y-1.5">
                <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: '#D97706' }}>
                  <Satellite size={13} /> Satellite / Night-light observation
                </div>
                <span className="px-1.5 py-0.5 rounded text-[9.5px] font-semibold uppercase tracking-wide" style={{ background: 'rgba(217,119,6,.15)', color: '#D97706', border: '1px solid rgba(217,119,6,.3)' }}>
                  Near Real-Time · Simulated Satellite Observation
                </span>
              </div>
              <p className="text-[10.5px] mt-1.5" style={{ color: 'var(--text-dim)' }}>
                Tidak ada feed satelit real-time tersedia untuk prototype ini — nilai di bawah adalah simulasi time-series (bukan citra satelit sungguhan), namun tetap mendorong perhitungan Risk → Priority → Recommendation secara nyata.
              </p>

              {selectedMG?.nightLight ? (() => {
                const nl = selectedMG.nightLight;
                const TrendIcon = TREND_ICON[nl.trend];
                const sev = nl.anomalyPct <= -25 ? '#E11D48' : nl.anomalyPct <= -10 ? '#D97706' : '#0D9488';
                return (
                  <div className="mt-2.5">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{selectedMG.name}</span>
                      <span className="text-[10px] font-mono flex items-center gap-1" style={{ color: 'var(--text-dim)' }} suppressHydrationWarning>
                        <Radio size={9} className="animate-pulse" /> {clockNow ? timeAgoID(new Date(nl.observedAt).getTime(), clockNow.getTime()) : '—'} · pass berikutnya {clockNow ? inSecondsID(new Date(nl.nextPassAt).getTime(), clockNow.getTime()) : '—'}
                      </span>
                    </div>
                    {/* Before / After — perbandingan langsung supaya perubahan anomaly terlihat jelas */}
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <div className="p-2 rounded-md" style={{ background: 'var(--bg-card-soft)', border: '1px solid var(--bg-border-soft)' }}>
                        <p className="text-[9.5px] uppercase tracking-wide font-semibold" style={{ color: 'var(--text-dim)' }}>Sebelum (pass lalu)</p>
                        <p className="font-mono font-bold text-base" style={{ color: 'var(--text-muted)' }}>{nl.previousAnomalyPct > 0 ? '+' : ''}{nl.previousAnomalyPct}%</p>
                      </div>
                      <AnimatePresence mode="wait">
                        <motion.div key={nl.epoch} initial={{ opacity: 0.3, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.25 }} className="p-2 rounded-md" style={{ background: `${sev}14`, border: `1px solid ${sev}40` }}>
                          <p className="text-[9.5px] uppercase tracking-wide font-semibold" style={{ color: sev }}>Saat ini (anomaly)</p>
                          <p className="font-mono font-bold text-base" style={{ color: sev }}>{nl.anomalyPct > 0 ? '+' : ''}{nl.anomalyPct}%</p>
                        </motion.div>
                      </AnimatePresence>
                    </div>
                    <div className="flex items-center justify-between flex-wrap gap-1.5 text-[10.5px]">
                      <span className="flex items-center gap-1" style={{ color: TREND_COLOR[nl.trend] }}>
                        <TrendIcon size={11} /> {TREND_LABEL[nl.trend]} vs baseline {nl.baselineAnomalyPct > 0 ? '+' : ''}{nl.baselineAnomalyPct}%
                      </span>
                      <span style={{ color: 'var(--text-muted)' }}>Confidence <strong className="font-mono">{nl.confidence}%</strong></span>
                      <span style={{ color: 'var(--text-muted)' }}>Freshness <strong className="font-mono">{nl.freshnessMinutes}m</strong></span>
                    </div>
                    {nl.anomalyPct <= -10 && (
                      <div className="flex items-start gap-1.5 mt-2 p-2 rounded-md text-[10.5px]" style={{ background: 'rgba(225,29,72,.08)', color: '#E11D48' }}>
                        <ShieldAlert size={12} className="shrink-0 mt-0.5" /> Anomaly ini menambah komponen risk di Risk Engine microgrid ini — ikut mendorong urgency pada Priority &amp; Recommendation.
                      </div>
                    )}
                  </div>
                );
              })() : (
                <p className="text-[11px] mt-2" style={{ color: 'var(--text-muted)' }}>Ketuk sebuah microgrid di peta untuk melihat detail observasi night-light-nya.</p>
              )}
            </div>
          )}

          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
            <div className="p-3 rounded-lg" style={{ background: 'rgba(37,99,235,.06)', border: '1px solid rgba(37,99,235,.14)' }}>
              <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: 'var(--accent-blue)' }}><Satellite size={13} /> Hybrid satellite observation</div>
              <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>{criticalMG.name.replace('Microgrid ', '')}: night-light anomaly <strong>{criticalMG.nightLightAnomalyPct}%</strong> terhadap baseline. Digunakan sebagai sinyal tambahan pada wilayah dengan sensor terbatas.</p>
            </div>
            <div className="p-3 rounded-lg" style={{ background: 'rgba(13,148,136,.06)', border: '1px solid rgba(13,148,136,.14)' }}>
              <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: 'var(--accent-teal-light)' }}><Navigation size={13} /> Demo movement</div>
              <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>Kapal pada shipment operasional bergerak berdasarkan departure/ETA aktual. Jika belum ada shipment untuk kandidat, tombol demo menjalankan playback pra-visualisasi tanpa mengubah operational state.</p>
            </div>
          </div>

          <div className="mt-3 p-3 rounded-lg" style={{ background: 'rgba(225,29,72,0.07)', border: '1px solid rgba(225,29,72,0.18)' }}>
            <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: '#E11D48' }}>
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#E11D48' }} />
              Koridor prioritas SIMPUL
            </div>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              {recommendedBESS ? `${recommendedBESS.name} · ${recommendedBESS.currentLocation} → ${criticalMG.name.replace('Microgrid ', '')}` : 'Belum ada kandidat BESS yang feasible'} · tujuan: <strong style={{ color: '#E11D48' }}>{criticalMG.name}</strong> · risk {criticalMG.riskScore}/100
            </p>
            {recommendedRoute && <p className="text-[11px] mt-1 font-mono" style={{ color: 'var(--text-dim)' }}>Jadwal: {formatSailingDays(recommendedRoute)} · transit {Math.round(recommendedRoute.transitHours / 24)} hari · next sailing dihitung dari waktu sistem.</p>}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-x-4 gap-y-2 mt-4 pt-3 border-t text-xs" style={{ borderColor: 'var(--bg-border-soft)' }}>
            {[
              { color: '#14B8A6', label: 'Normal' },
              { color: '#D97706', label: 'Peringatan' },
              { color: '#E11D48', label: 'Kritis' },
              { color: '#2563EB', label: 'BESS Transit' },
              { color: '#E11D48', label: 'Koridor menuju microgrid kritis' },
              { color: '#64748B', label: 'BESS idle/charging (persegi belah ketupat)' },
              { color: '#0D9488', label: 'Port OPEN (persegi)' },
              { color: '#D97706', label: 'Port CONGESTED / Incident warning' },
              { color: '#E11D48', label: 'Port CLOSED / Incident critical' },
              { color: '#64748B', label: 'Sea Route (jalur Tol Laut)' },
              { color: '#0D9488', label: 'Network status (microgrid ⇄ BESS)' },
              { color: '#D97706', label: 'Night-light: anomaly sedang (dashed = before, terisi = after)' },
              { color: '#E11D48', label: 'Night-light: anomaly kritis (≤ -25%)' },
            ].map(l => (
              <div key={l.label} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: l.color, boxShadow: `0 0 8px ${l.color}` }} />
                <span style={{ color: 'var(--text-muted)' }}>{l.label}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Side panel */}
        <div className="space-y-4">
          <AnimatePresence mode="wait">
            {selectedMG ? (
              <motion.div key={selectedMG.id} initial={{ x: 16, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 16, opacity: 0 }} transition={{ duration: 0.2 }} className="card p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-display font-semibold text-sm flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                    <MapPin size={14} style={{ color: 'var(--accent-teal-light)' }} />{selectedMG.name}
                  </h3>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${selectedMG.status === 'critical' ? 'badge-critical' : selectedMG.status === 'warning' ? 'badge-warning' : 'badge-normal'}`}>
                    {selectedMG.status === 'critical' ? 'Kritis' : selectedMG.status === 'warning' ? 'Peringatan' : 'Normal'}
                  </span>
                </div>
                <div className="space-y-2 text-xs">
                  {[
                    ['Generasi EBT', `${selectedMG.currentGeneration} MW`],
                    ['Permintaan', `${selectedMG.currentDemand} MW`],
                    ['Neraca Energi', `${selectedMG.energyBalance} MW`],
                    ['SOC BESS', `${selectedMG.bessSOC}%`],
                    ['Beban Kritis', `${selectedMG.criticalLoad} MW`],
                    ['Risiko Defisit', `${selectedMG.deficitProbability}%`],
                  ].map(([l, v]) => (
                    <div key={l as string} className="flex justify-between items-center py-1 border-b" style={{ borderColor: 'var(--bg-border-soft)' }}>
                      <span style={{ color: 'var(--text-muted)' }}>{l}</span>
                      <span className="font-mono font-bold" style={{ color: 'var(--text-primary)' }}>{v}</span>
                    </div>
                  ))}
                </div>
                {canOpenDetail && (
                  <button onClick={() => router.push(`/microgrids/${selectedMG.id}`)} className="w-full mt-4 py-2.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-transform hover:-translate-y-0.5" style={{ background: 'rgba(13,148,136,0.15)', color: 'var(--accent-teal-light)', border: '1px solid rgba(13,148,136,0.25)' }}>
                    Lihat Digital Twin <ArrowRight size={13} />
                  </button>
                )}
              </motion.div>
            ) : (
              <div className="card p-6 text-center">
                <MapPin size={20} className="mx-auto mb-2" style={{ color: 'var(--text-dim)' }} />
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Ketuk sebuah microgrid di peta untuk melihat detail</p>
              </div>
            )}
          </AnimatePresence>

          {/* BESS in transit */}
          <div className="card p-4">
            <h3 className="font-display font-semibold text-sm mb-3 flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
              <Navigation size={14} style={{ color: 'var(--accent-blue)' }} />BESS dalam Transit
            </h3>
            {transitBESS.length === 0 ? (
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Tidak ada unit dalam perjalanan saat ini.</p>
            ) : (
              <div className="space-y-2">
                {transitBESS.map(bess => {
                  const shipment = shipments.find(sh => sh.bessId === bess.id && ['PLANNED','DISPATCHED','IN_TRANSIT','DELAYED','ARRIVED','INTEGRATED'].includes(sh.status));
                  const remainingMs = shipment && clockNow ? Math.max(0,new Date(shipment.eta).getTime()-clockNow.getTime()) : null;
                  const action = shipment ? NEXT_STATUS[shipment.status] : undefined;
                  return (
                    <div key={bess.id} className="p-2.5 rounded-lg text-xs" style={{ background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.2)' }}>
                      <div className="flex justify-between mb-1">
                        <span className="font-mono font-bold" style={{ color: 'var(--accent-blue)' }}>{bess.name}</span>
                        <span className="font-mono" style={{ color: 'var(--text-muted)' }}>SOC {bess.soc}%</span>
                      </div>
                      <p className="flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>{bess.currentLocation} <ArrowRight size={10} /> {bess.destinationLocation}</p>
                      <p className="mt-0.5 font-mono" style={{ color: 'var(--accent-blue)' }} suppressHydrationWarning>
                        {remainingMs !== null ? `Tiba dalam ${formatDurationID(remainingMs)}` : `ETA: ${bess.estimatedTransitDays} hari`}
                      </p>
                      {isOperator && shipment && (
                        action ? (
                          <button
                            onClick={() => updateShipment(shipment.id, action.next, action.note)}
                            className="mt-2 w-full py-1.5 rounded-md text-xs font-medium transition-transform hover:-translate-y-0.5"
                            style={{ background: 'rgba(37,99,235,0.15)', color: 'var(--accent-blue)', border: '1px solid rgba(37,99,235,0.3)' }}
                          >
                            {action.label}
                          </button>
                        ) : (
                          <div className="mt-2 flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--accent-teal-light)' }}>
                            <CheckCircle2 size={13} /> {shipment.status} · kelola lebih lanjut di Shipment
                          </div>
                        )
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

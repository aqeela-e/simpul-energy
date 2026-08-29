'use client';
import { Fragment, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  MapMarker, MapRoute, STATUS_COLOR,
  PortMapMarker, BessMapMarker, IncidentMapMarker, SeaLaneMapLine, NetworkLinkMapLine,
  PORT_STATUS_COLOR, BESS_STATUS_COLOR, NightLightMapPoint,
} from './mapTypes';

type LatLng = { lat: number; lng: number };

function bezierPoint(p0: LatLng, p1: LatLng, p2: LatLng, t: number): LatLng {
  const lat = (1 - t) * (1 - t) * p0.lat + 2 * (1 - t) * t * p1.lat + t * t * p2.lat;
  const lng = (1 - t) * (1 - t) * p0.lng + 2 * (1 - t) * t * p1.lng + t * t * p2.lng;
  return { lat, lng };
}

function controlPoint(p0: LatLng, p2: LatLng, bow = 0.18): LatLng {
  const mlat = (p0.lat + p2.lat) / 2;
  const mlng = (p0.lng + p2.lng) / 2;
  const dlat = p2.lat - p0.lat;
  const dlng = p2.lng - p0.lng;
  const len = Math.sqrt(dlat * dlat + dlng * dlng) || 1;
  // perpendicular offset, arcing consistently "northward" so lanes read as shipping arcs
  const nlat = -dlng / len;
  const nlng = dlat / len;
  const dir = nlat < 0 ? 1 : -1;
  return { lat: mlat + nlat * len * bow * dir, lng: mlng + nlng * len * bow * dir };
}

function bezierPolylinePoints(p0: LatLng, p1: LatLng, p2: LatLng, steps = 48): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const pt = bezierPoint(p0, p1, p2, i / steps);
    pts.push([pt.lat, pt.lng]);
  }
  return pts;
}

function statusDivIcon(color: string, selected: boolean, pulse: boolean) {
  const size = selected ? 26 : 20;
  return L.divIcon({
    className: '',
    html: `
      <div style="position:relative;width:${size}px;height:${size}px;">
        ${pulse ? `<span style="position:absolute;inset:-6px;border-radius:9999px;border:2px solid ${color};opacity:0.55;animation:simpul-pulse 1.8s ease-out infinite;"></span>` : ''}
        <div style="position:absolute;inset:0;border-radius:9999px;background:${selected ? color : color + '2e'};border:${selected ? 3 : 2}px solid ${color};box-shadow:0 1px 4px rgba(15,23,42,0.25);"></div>
        <div style="position:absolute;top:50%;left:50%;width:5px;height:5px;margin:-2.5px 0 0 -2.5px;border-radius:9999px;background:${selected ? '#fff' : color};"></div>
      </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

/** Label rendered below a marker; `offsetY` lets callers push overlapping labels further apart. */
function labelDivIcon(text: string, sub: string | undefined, color: string, offsetY = -8) {
  return L.divIcon({
    className: '',
    html: `
      <div style="white-space:nowrap;text-align:center;transform:translateY(4px);pointer-events:none;">
        <div style="font-family:'Space Grotesk',sans-serif;font-weight:600;font-size:11px;color:#1E293B;text-shadow:0 1px 2px #fff, 0 -1px 2px #fff, 1px 0 2px #fff, -1px 0 2px #fff;">${text}</div>
        ${sub ? `<div style="font-family:'JetBrains Mono',monospace;font-size:9.5px;color:${color};text-shadow:0 1px 2px #fff, 0 -1px 2px #fff;">${sub}</div>` : ''}
      </div>`,
    iconSize: [130, 28],
    iconAnchor: [65, offsetY],
  });
}

function shipDivIcon(color: string) {
  return L.divIcon({
    className: '',
    html: `
      <div style="position:relative;width:16px;height:16px;">
        <span style="position:absolute;inset:-8px;border-radius:9999px;background:${color};opacity:0.16;"></span>
        <div style="position:absolute;inset:2px;border-radius:9999px;background:#fff;border:2.5px solid ${color};box-shadow:0 1px 4px rgba(15,23,42,0.3);"></div>
        <div style="position:absolute;top:50%;left:50%;width:4px;height:4px;margin:-2px 0 0 -2px;border-radius:9999px;background:${color};"></div>
      </div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

function trailDivIcon(color: string, r: number, opacity: number) {
  return L.divIcon({
    className: '',
    html: `<div style="width:${r * 2}px;height:${r * 2}px;border-radius:9999px;background:${color};opacity:${opacity};"></div>`,
    iconSize: [r * 2, r * 2],
    iconAnchor: [r, r],
  });
}

/** Ikon persegi untuk pelabuhan — beda bentuk dari node microgrid (bulat) & BESS (belah ketupat) supaya layer mudah dibedakan sekilas. */
function portDivIcon(color: string) {
  return L.divIcon({
    className: '',
    html: `
      <div style="position:relative;width:14px;height:14px;">
        <div style="position:absolute;inset:0;background:${color};border:2px solid #fff;box-shadow:0 1px 4px rgba(15,23,42,0.35);"></div>
      </div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

/** Ikon belah ketupat untuk unit BESS yang sedang tidak berlayar. */
function bessDivIcon(color: string) {
  return L.divIcon({
    className: '',
    html: `
      <div style="width:13px;height:13px;background:${color};border:2px solid #fff;transform:rotate(45deg);box-shadow:0 1px 4px rgba(15,23,42,0.35);"></div>`,
    iconSize: [13, 13],
    iconAnchor: [6.5, 6.5],
  });
}

/** Ikon segitiga peringatan untuk incident aktif, dengan pulse untuk severity critical. */
function incidentDivIcon(color: string, pulse: boolean) {
  return L.divIcon({
    className: '',
    html: `
      <div style="position:relative;width:20px;height:20px;">
        ${pulse ? `<span style="position:absolute;inset:-5px;border-radius:9999px;border:2px solid ${color};opacity:0.5;animation:simpul-pulse 1.6s ease-out infinite;"></span>` : ''}
        <div style="position:absolute;inset:2px;width:0;height:0;border-left:8px solid transparent;border-right:8px solid transparent;border-bottom:14px solid ${color};filter:drop-shadow(0 1px 3px rgba(15,23,42,0.4));"></div>
        <div style="position:absolute;top:11px;left:50%;width:2px;height:2px;margin-left:-1px;border-radius:9999px;background:#fff;"></div>
      </div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 14],
  });
}

/** Tier warna anomaly night-light — konsisten dengan nightLightSeverity() di lib/nightLight.ts. */
function nightLightColor(anomaly: number): string {
  if (anomaly <= -25) return '#E11D48';
  if (anomaly <= -10) return '#D97706';
  return '#0D9488';
}

/**
 * Indikator "live pass" satelit — cincin yang terus berdenyut di tengah titik
 * night-light supaya operator melihat data ini benar-benar diperbarui terus
 * (bukan cuma dihitung sekali). Reuse keyframe simpul-pulse yang sudah ada
 * secara global, jadi tidak perlu keyframe CSS baru.
 */
function nightLightPingDivIcon(color: string) {
  return L.divIcon({
    className: '',
    html: `
      <div style="position:relative;width:10px;height:10px;">
        <span style="position:absolute;inset:-5px;border-radius:9999px;border:1.5px solid ${color};opacity:0.7;animation:simpul-pulse 2.2s ease-out infinite;"></span>
        <div style="position:absolute;inset:2px;border-radius:9999px;background:${color};box-shadow:0 0 6px ${color};"></div>
      </div>`,
    iconSize: [10, 10],
    iconAnchor: [5, 5],
  });
}

/** Label kecil di bawah node non-microgrid (port/BESS), lebih ringkas dari labelDivIcon utama. */
function smallLabelDivIcon(text: string, color: string) {
  return L.divIcon({
    className: '',
    html: `
      <div style="white-space:nowrap;text-align:center;transform:translateY(2px);pointer-events:none;">
        <div style="font-family:'JetBrains Mono',monospace;font-weight:600;font-size:9px;color:${color};text-shadow:0 1px 2px #fff, 0 -1px 2px #fff, 1px 0 2px #fff, -1px 0 2px #fff;">${text}</div>
      </div>`,
    iconSize: [110, 14],
    iconAnchor: [55, -6],
  });
}

/**
 * Fits the map to the marker set once the container has a real, measured
 * size. Leaflet computes zoom from the container's pixel dimensions — if
 * that's called before the CSS `aspect-ratio` box has settled, it fits
 * against a near-zero size and over-zooms, which is what made markers look
 * bunched together. invalidateSize() + a short delay fixes that reliably,
 * and capping maxZoom keeps a nation-wide view even if points cluster.
 */
function FitToMarkers({ markers }: { markers: MapMarker[] }) {
  const map = useMap();
  const key = markers.map(m => m.id).join(',');
  useEffect(() => {
    if (markers.length === 0) return;
    const bounds = L.latLngBounds(markers.map(m => [m.lat, m.lng] as [number, number]));
    const fit = () => {
      map.invalidateSize();
      map.fitBounds(bounds.pad(0.2), { animate: false, maxZoom: 7 });
    };
    fit();
    const t1 = setTimeout(fit, 150);
    const t2 = setTimeout(fit, 500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return null;
}

export default function LeafletMap({
  markers = [],
  routes = [],
  className = '',
  showRadar = true,
  satelliteMode = false,
  nightLightPoints = [],
  demoProgress = {},
  ports = [],
  bessMarkers = [],
  incidentMarkers = [],
  seaLanes = [],
  networkLinks = [],
}: {
  markers?: MapMarker[];
  routes?: MapRoute[];
  className?: string;
  showRadar?: boolean;
  satelliteMode?: boolean;
  /** Layer Satellite/Night-light — simulated near-real-time observation, dengan before/after per titik. */
  nightLightPoints?: NightLightMapPoint[];
  demoProgress?: Record<string, number>;
  /** Layer Port — pelabuhan Tol Laut dengan status OPEN/CONGESTED/CLOSED. */
  ports?: PortMapMarker[];
  /** Layer BESS — unit yang sedang tidak berlayar (BESS in-transit tetap tercermin lewat `routes`). */
  bessMarkers?: BessMapMarker[];
  /** Layer Incident — incident aktif (belum RESOLVED). */
  incidentMarkers?: IncidentMapMarker[];
  /** Layer Sea Route — backbone jalur Tol Laut statis, terpisah dari `routes` (shipment aktif). */
  seaLanes?: SeaLaneMapLine[];
  /** Layer Network status — garis koneksi microgrid ⇄ BESS yang sudah operational. */
  networkLinks?: NetworkLinkMapLine[];
}) {
  const routeGeoms = useMemo(() => {
    return routes.map(r => {
      const cp = controlPoint(r.from, r.to);
      return { ...r, cp, color: r.color || '#2563EB', line: bezierPolylinePoints(r.from, cp, r.to) };
    });
  }, [routes]);

  const center: [number, number] = markers.length
    ? [markers.reduce((s, m) => s + m.lat, 0) / markers.length, markers.reduce((s, m) => s + m.lng, 0) / markers.length]
    : [-2.5, 118];

  return (
    <div className={`leaflet-map-isolation relative w-full overflow-hidden rounded-xl ${className}`} style={{ aspectRatio: '16 / 9', minHeight: 220 }}>
      <MapContainer
        center={center}
        zoom={5}
        scrollWheelZoom={false}
        doubleClickZoom={true}
        touchZoom={true}
        className="w-full h-full"
        style={{ background: '#EAF2F0' }}
        zoomControl={true}
      >
        {satelliteMode ? (
          <TileLayer
            attribution='Imagery &copy; Esri, Maxar, Earthstar Geographics'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            maxZoom={18}
          />
        ) : (
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            subdomains={['a', 'b', 'c']}
            maxZoom={19}
          />
        )}
        <FitToMarkers markers={markers} />

        {/* Sea Route layer — backbone jalur Tol Laut statis, digambar tipis di bawah shipment aktif. */}
        {seaLanes.map(lane => (
          <Polyline
            key={`lane-${lane.id}`}
            positions={[[lane.from.lat, lane.from.lng], [lane.to.lat, lane.to.lng]]}
            pathOptions={{ color: '#64748B', weight: 1.25, opacity: 0.35, dashArray: '2 6', lineCap: 'round' }}
          />
        ))}

        {/* Network status layer — koneksi microgrid ⇄ BESS yang sudah terhubung/operational. */}
        {networkLinks.map(link => (
          <Polyline
            key={`net-${link.id}`}
            positions={[[link.from.lat, link.from.lng], [link.to.lat, link.to.lng]]}
            pathOptions={{ color: '#0D9488', weight: 1.5, opacity: 0.5, dashArray: '1 5', lineCap: 'round' }}
          />
        ))}

        {routeGeoms.map(r => {
          // Progress is normally driven by elapsed transit time. Demo playback can
          // override it so the competition demo visibly shows the vessel moving.
          const t = demoProgress[r.id] ?? r.progress ?? 0.5;
          const head = bezierPoint(r.from, r.cp, r.to, t);
          // Short, fixed comet tail just behind the real position — conveys
          // direction of travel without implying a fast fake animation loop.
          const trail = Array.from({ length: 5 }).map((_, i) => {
            const tt = t - (i + 1) * 0.015;
            if (tt < 0) return null;
            return { pt: bezierPoint(r.from, r.cp, r.to, tt), opacity: 0.4 * (1 - i / 5), r: 3.6 - i * 0.3 };
          });
          return (
            <Fragment key={r.id}>
              <Polyline positions={r.line} pathOptions={{ color: r.color, weight: r.color === '#E11D48' ? 3 : 2, opacity: 0.6, dashArray: r.color === '#E11D48' ? '8 8' : '1 7', lineCap: 'round' }} />
              {r.showVessel !== false && trail.map((tr, i) => tr && (
                <Marker key={i} position={[tr.pt.lat, tr.pt.lng]} icon={trailDivIcon(r.color!, tr.r, tr.opacity)} interactive={false} />
              ))}
              {r.showVessel !== false && <Marker position={[head.lat, head.lng]} icon={shipDivIcon(r.color!)} interactive={false} />}
            </Fragment>
          );
        })}

        {/* Satellite/Night-light layer — before/after: cincin putus-putus tipis = kondisi normal/pass
            sebelumnya, lingkaran terisi = anomaly pass saat ini, sehingga perbedaannya langsung terlihat.
            Titik tengah berdenyut terus (simpul-pulse) sebagai indikator "data terus diperbarui". */}
        {nightLightPoints.map(p => {
          const color = nightLightColor(p.anomaly);
          const beforeColor = nightLightColor(p.previousAnomaly);
          const afterRadius = Math.max(14000, Math.min(80000, Math.abs(p.anomaly) * 1100 + 8000));
          const beforeRadius = Math.max(14000, Math.min(80000, Math.abs(p.previousAnomaly) * 1100 + 8000));
          return (
            <Fragment key={`night-${p.label}`}>
              {/* Before / pass sebelumnya — cincin tipis putus-putus, tanpa isi */}
              <Circle
                center={[p.lat, p.lng]}
                radius={beforeRadius}
                pathOptions={{ color: beforeColor, fillOpacity: 0, weight: 1, opacity: 0.45, dashArray: '3 7' }}
              />
              {/* After / kondisi saat ini — lingkaran terisi, ini yang mendorong Risk Engine */}
              <Circle
                key={`night-after-${p.label}-${p.epoch}`}
                center={[p.lat, p.lng]}
                radius={afterRadius}
                pathOptions={{ color, fillColor: color, fillOpacity: 0.16, weight: 2, dashArray: undefined }}
              />
              <Marker position={[p.lat, p.lng]} icon={nightLightPingDivIcon(color)} interactive={false} />
            </Fragment>
          );
        })}

        {markers.map(mg => {
          const color = STATUS_COLOR[mg.status];
          return (
            <Fragment key={mg.id}>
              <Marker
                position={[mg.lat, mg.lng]}
                icon={statusDivIcon(color, !!mg.selected, mg.status === 'critical')}
                eventHandlers={mg.onClick ? { click: mg.onClick } : undefined}
              />
              <Marker position={[mg.lat, mg.lng]} icon={labelDivIcon(mg.label, mg.sublabel, color)} interactive={false} />
            </Fragment>
          );
        })}

        {/* Port layer */}
        {ports.map(p => {
          const color = PORT_STATUS_COLOR[p.status];
          return (
            <Fragment key={`port-${p.id}`}>
              <Marker position={[p.lat, p.lng]} icon={portDivIcon(color)} interactive={false} />
              <Marker position={[p.lat, p.lng]} icon={smallLabelDivIcon(p.name, color)} interactive={false} />
            </Fragment>
          );
        })}

        {/* BESS layer — hanya unit yang sedang tidak berlayar; BESS in-transit sudah tampil sebagai kapal di jalur shipment. */}
        {bessMarkers.map(b => {
          const color = BESS_STATUS_COLOR[b.status];
          return (
            <Fragment key={`bess-${b.id}`}>
              <Marker position={[b.lat, b.lng]} icon={bessDivIcon(color)} interactive={false} />
              <Marker position={[b.lat, b.lng]} icon={smallLabelDivIcon(`${b.name} · ${b.soc}%`, color)} interactive={false} />
            </Fragment>
          );
        })}

        {/* Incident layer — hanya incident yang belum RESOLVED. */}
        {incidentMarkers.map(i => (
          <Marker
            key={`incident-${i.id}`}
            position={[i.lat, i.lng]}
            icon={incidentDivIcon(i.severity === 'critical' ? '#E11D48' : '#D97706', i.severity === 'critical')}
            interactive={false}
          />
        ))}
      </MapContainer>

      {showRadar && (
        <div
          className="absolute rounded-full overflow-hidden pointer-events-none"
          style={{ width: 100, height: 100, right: 12, bottom: 12, zIndex: 400, border: '1px solid rgba(13,148,136,0.25)', background: 'rgba(255,255,255,0.4)' }}
        >
          <div
            className="absolute inset-0 animate-spin-slow"
            style={{ background: 'conic-gradient(from 0deg, rgba(13,148,136,0.35), transparent 30%)' }}
          />
          <div className="absolute inset-0 rounded-full" style={{ boxShadow: 'inset 0 0 0 1px rgba(13,148,136,0.2)' }} />
        </div>
      )}
    </div>
  );
}

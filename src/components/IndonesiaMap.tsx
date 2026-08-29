'use client';
import dynamic from 'next/dynamic';
import { MapMarker, MapRoute, PortMapMarker, BessMapMarker, IncidentMapMarker, SeaLaneMapLine, NetworkLinkMapLine, NightLightMapPoint } from './mapTypes';

export type { MapMarker, MapRoute, PortMapMarker, BessMapMarker, IncidentMapMarker, SeaLaneMapLine, NetworkLinkMapLine, NightLightMapPoint };

const LeafletMap = dynamic(() => import('./LeafletMap'), {
  ssr: false,
  loading: () => (
    <div className="leaflet-map-isolation relative w-full rounded-xl flex items-center justify-center" style={{ aspectRatio: '16 / 9', minHeight: 220, background: 'var(--bg-card-soft)', border: '1px solid var(--bg-border-soft)' }}>
      <span className="text-sm" style={{ color: 'var(--text-dim)' }}>Memuat peta…</span>
    </div>
  ),
});

export default function IndonesiaMap(props: {
  markers?: MapMarker[];
  routes?: MapRoute[];
  className?: string;
  showRadar?: boolean;
  satelliteMode?: boolean;
  nightLightPoints?: NightLightMapPoint[];
  demoProgress?: Record<string, number>;
  ports?: PortMapMarker[];
  bessMarkers?: BessMapMarker[];
  incidentMarkers?: IncidentMapMarker[];
  seaLanes?: SeaLaneMapLine[];
  networkLinks?: NetworkLinkMapLine[];
}) {
  return <LeafletMap {...props} />;
}

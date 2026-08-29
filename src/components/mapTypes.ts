/** Satellite/Night-light layer — titik observasi simulated near-real-time per microgrid. */
export interface NightLightMapPoint {
  lat: number;
  lng: number;
  label: string;
  /** Anomaly pass saat ini ("after"). */
  anomaly: number;
  /** Anomaly pass sebelumnya ("before") — dipakai untuk render normal vs anomaly. */
  previousAnomaly: number;
  baseline: number;
  confidence: number;
  freshnessMinutes: number;
  epoch: number;
  trend: 'memburuk' | 'membaik' | 'stabil';
}

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  label: string;
  sublabel?: string;
  status: 'normal' | 'warning' | 'critical' | 'neutral';
  selected?: boolean;
  onClick?: () => void;
}

export interface MapRoute {
  id: string;
  from: { lat: number; lng: number };
  to: { lat: number; lng: number };
  color?: string;
  label?: string;
  /**
   * Progres nyata perjalanan (0-1), dihitung dari waktu keberangkatan asli
   * vs waktu sekarang. Kalau tidak diisi, marker ditempatkan di tengah jalur.
   */
  progress?: number;
  showVessel?: boolean;
}

export const STATUS_COLOR: Record<MapMarker['status'], string> = {
  normal: '#0D9488',
  warning: '#D97706',
  critical: '#E11D48',
  neutral: '#2563EB',
};

/** M0 — Maritime layer: pelabuhan Tol Laut, dipakai untuk layer "Port". */
export interface PortMapMarker {
  id: string;
  lat: number;
  lng: number;
  name: string;
  status: 'OPEN' | 'CONGESTED' | 'CLOSED';
}

/** M0 — Maritime layer: unit BESS yang sedang tidak berlayar (idle/charging/discharging). BESS in-transit sudah tercermin lewat MapRoute + vessel marker, jadi tidak diduplikasi di sini. */
export interface BessMapMarker {
  id: string;
  lat: number;
  lng: number;
  name: string;
  status: 'charging' | 'discharging' | 'idle' | 'in-transit';
  soc: number;
}

/** M0 — Maritime layer: incident aktif (belum RESOLVED) yang diplot di lokasi microgrid terkait. */
export interface IncidentMapMarker {
  id: string;
  lat: number;
  lng: number;
  title: string;
  severity: 'warning' | 'critical';
  status: string;
}

/** M0 — Maritime layer: jalur pelayaran Tol Laut statis (backbone jaringan), terpisah dari MapRoute yang hanya menggambar shipment yang sedang aktif. */
export interface SeaLaneMapLine {
  id: string;
  from: { lat: number; lng: number };
  to: { lat: number; lng: number };
  label: string;
}

/** M0 — Maritime layer: garis status jaringan (microgrid ⇄ BESS yang sudah terhubung/operational). */
export interface NetworkLinkMapLine {
  id: string;
  from: { lat: number; lng: number };
  to: { lat: number; lng: number };
}

export const PORT_STATUS_COLOR: Record<PortMapMarker['status'], string> = {
  OPEN: '#0D9488',
  CONGESTED: '#D97706',
  CLOSED: '#E11D48',
};

export const BESS_STATUS_COLOR: Record<BessMapMarker['status'], string> = {
  idle: '#64748B',
  charging: '#0D9488',
  discharging: '#D97706',
  'in-transit': '#2563EB',
};

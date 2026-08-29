// SIMPUL — Dummy data simulasi karakteristik energi wilayah Indonesia Timur

export type MicrogridStatus = 'normal' | 'warning' | 'critical';
export type BESSStatus = 'charging' | 'discharging' | 'idle' | 'in-transit';
export type GridMode = 'grid-connected' | 'islanded' | 'emergency';

export interface Microgrid {
  id: string;
  name: string;
  island: string;
  lat: number;
  lng: number;
  status: MicrogridStatus;
  gridMode: GridMode;
  renewableCapacity: { solar: number; wind: number; hydro: number; geothermal: number; biomass: number };
  currentGeneration: number;
  currentDemand: number;
  energyBalance: number;
  bessSOC: number;
  bessCapacity: number;
  criticalLoad: number;
  dieselDependency: number;
  renewableUtilization: number;
  deficitProbability: number;
  /** Risiko keterbatasan penyerapan EBT (hosting capacity) — M3 */
  hostingCapacityRisk: number;
  /** Risiko darurat (bencana, gangguan jaringan) — M3 */
  emergencyRisk: number;
  /** Skor risiko gabungan = rata-rata tertimbang hostingCapacityRisk & emergencyRisk — M3 */
  riskScore: number;
  connectedBESS: string[];
  criticalFacilities: string[];
  /** Lapisan data hibrida M1 — untuk wilayah dengan keterbatasan sensor */
  sensorCoverage: 'penuh' | 'terbatas';
  nightLightAnomalyPct: number;
  citizenReports: { count: number; recent: string[] };
  /** Hybrid Data Intelligence: source quality + uncertainty signals used by M3. */
  hybridData?: { weatherRisk: number; renewableUncertaintyPct: number; nightLightConfidence: number; sourceQuality: number; freshnessMinutes: number; lastObservedAt: string };
}

export interface BESSUnit {
  id: string;
  name: string;
  currentLocation: string;
  destinationLocation: string | null;
  status: BESSStatus;
  soc: number;
  soh: number;
  capacityKWh: number;
  maxPowerKW: number;
  cycleCount: number;
  allocationScore: number;
  estimatedTransitDays: number | null;
  lat: number;
  lng: number;
}

export interface ForecastPoint {
  hour: string;
  generation: number;
  demand: number;
  bessSOC: number;
}

/**
 * Titik telemetry generation/load/BESS per microgrid — Hybrid Data Intelligence (M1).
 * Wilayah bersensor penuh mayoritas 'MEASURED' (langsung dari smart meter/SCADA),
 * wilayah bersensor terbatas punya proporsi 'ESTIMATED' lebih besar (diisi dari
 * model proksi: rerata historis + anomali cahaya malam + pelaporan warga), dengan
 * `confidence` yang lebih rendah — dipakai M3 sebagai salah satu input uncertainty
 * simulasi Monte Carlo, bukan sekadar dekorasi.
 */
export interface HybridTelemetryPoint {
  hour: string;
  generationMW: number;
  loadMW: number;
  bessSOC: number;
  source: 'MEASURED' | 'ESTIMATED';
  confidence: number;
}

// Seeded PRNG kecil khusus untuk membangun histori telemetry secara deterministik
// (server & client harus render angka yang sama persis — tidak boleh Math.random()).
function telemetrySeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function telemetryRand(seed: number) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Membangun 24 titik telemetry jam-jaman terakhir untuk sebuah microgrid dari kondisi saat ini. */
function buildTelemetryHistory(m: Pick<Microgrid, 'id' | 'currentGeneration' | 'currentDemand' | 'bessSOC' | 'sensorCoverage'>): HybridTelemetryPoint[] {
  const rand = telemetryRand(telemetrySeed(m.id));
  const estimatedRatio = m.sensorCoverage === 'terbatas' ? 0.55 : 0.08;
  const points: HybridTelemetryPoint[] = [];
  let soc = m.bessSOC;
  for (let i = 23; i >= 0; i--) {
    const diurnal = Math.sin(((24 - i) / 24) * Math.PI * 2 - Math.PI / 2); // pola siang/malam kasar
    const genNoise = (rand() - 0.5) * m.currentGeneration * 0.3;
    const loadNoise = (rand() - 0.5) * m.currentDemand * 0.18;
    const generationMW = Number(Math.max(0, m.currentGeneration * (0.75 + diurnal * 0.35) + genNoise).toFixed(2));
    const loadMW = Number(Math.max(0.1, m.currentDemand * (0.9 + diurnal * 0.12) + loadNoise).toFixed(2));
    const balance = generationMW - loadMW;
    soc = Math.min(100, Math.max(0, soc - balance * 1.6 + (rand() - 0.5) * 3));
    const isEstimated = rand() < estimatedRatio;
    points.push({
      hour: `H-${i}`,
      generationMW,
      loadMW,
      bessSOC: Math.round(soc),
      source: isEstimated ? 'ESTIMATED' : 'MEASURED',
      confidence: isEstimated ? Math.round(60 + rand() * 18) : Math.round(90 + rand() * 9),
    });
  }
  // Titik terakhir disamakan dengan kondisi live saat ini supaya chart menyambung mulus ke real-time data.
  points[points.length - 1] = { ...points[points.length - 1], generationMW: m.currentGeneration, loadMW: m.currentDemand, bessSOC: m.bessSOC, source: m.sensorCoverage === 'terbatas' ? 'ESTIMATED' : 'MEASURED', confidence: m.sensorCoverage === 'terbatas' ? 78 : 97 };
  return points;
}

export const MICROGRIDS: Microgrid[] = [
  {
    id: 'mg-ntt',
    name: 'Microgrid Kupang',
    island: 'Nusa Tenggara Timur',
    lat: -10.17, lng: 123.61,
    status: 'critical',
    gridMode: 'islanded',
    renewableCapacity: { solar: 3.2, wind: 1.8, hydro: 0.0, geothermal: 0.5, biomass: 0.3 },
    currentGeneration: 2.1, currentDemand: 5.8, energyBalance: -3.7,
    bessSOC: 34, bessCapacity: 800, criticalLoad: 1.8,
    dieselDependency: 28, renewableUtilization: 72,
    deficitProbability: 78, hostingCapacityRisk: 78, emergencyRisk: 96, riskScore: 87,
    connectedBESS: ['bess-003'],
    criticalFacilities: ['RS Umum Kupang', 'Telekomunikasi NTT', 'PDAM Kupang', 'Posko Darurat'],
    sensorCoverage: 'terbatas',
    nightLightAnomalyPct: -42,
    citizenReports: {
      count: 27,
      recent: [
        'Pemadaman total sejak siang — Kelurahan Oesapa',
        'Genset RS Umum Kupang menyala, listrik utama masih padam',
        'Sinyal telekomunikasi terputus-putus di area Alak',
      ],
    },
  },
  {
    id: 'mg-maluku',
    name: 'Microgrid Ambon',
    island: 'Maluku',
    lat: -3.69, lng: 128.18,
    status: 'warning',
    gridMode: 'grid-connected',
    renewableCapacity: { solar: 2.8, wind: 0.9, hydro: 1.5, geothermal: 0.0, biomass: 0.4 },
    currentGeneration: 4.2, currentDemand: 5.1, energyBalance: -0.9,
    bessSOC: 58, bessCapacity: 600, criticalLoad: 1.2,
    dieselDependency: 18, renewableUtilization: 81,
    deficitProbability: 42, hostingCapacityRisk: 68, emergencyRisk: 40, riskScore: 54,
    connectedBESS: ['bess-005'],
    criticalFacilities: ['RS Haulussy', 'Pelabuhan Ambon', 'BMKG Ambon'],
    sensorCoverage: 'penuh',
    nightLightAnomalyPct: -6,
    citizenReports: { count: 4, recent: ['Tegangan turun malam hari di area Batu Merah'] },
  },
  {
    id: 'mg-papua',
    name: 'Microgrid Jayapura',
    island: 'Papua',
    lat: -2.53, lng: 140.72,
    status: 'normal',
    gridMode: 'grid-connected',
    renewableCapacity: { solar: 1.5, wind: 0.4, hydro: 4.2, geothermal: 0.0, biomass: 0.8 },
    currentGeneration: 6.8, currentDemand: 4.3, energyBalance: 2.5,
    bessSOC: 87, bessCapacity: 1000, criticalLoad: 1.5,
    dieselDependency: 8, renewableUtilization: 94,
    deficitProbability: 21, hostingCapacityRisk: 15, emergencyRisk: 29, riskScore: 22,
    connectedBESS: ['bess-007'],
    criticalFacilities: ['RSUD Jayapura', 'Bandara Sentani', 'PLN Papua'],
    sensorCoverage: 'penuh',
    nightLightAnomalyPct: 1,
    citizenReports: { count: 1, recent: ['Kondisi normal, tidak ada laporan gangguan'] },
  },
  {
    id: 'mg-sulawesi',
    name: 'Microgrid Makassar',
    island: 'Sulawesi',
    lat: -5.14, lng: 119.41,
    status: 'warning',
    gridMode: 'grid-connected',
    renewableCapacity: { solar: 4.1, wind: 1.2, hydro: 2.0, geothermal: 1.5, biomass: 0.5 },
    currentGeneration: 7.2, currentDemand: 8.4, energyBalance: -1.2,
    bessSOC: 72, bessCapacity: 1200, criticalLoad: 2.1,
    dieselDependency: 14, renewableUtilization: 85,
    deficitProbability: 38, hostingCapacityRisk: 52, emergencyRisk: 38, riskScore: 45,
    connectedBESS: ['bess-002', 'bess-004'],
    criticalFacilities: ['RS Wahidin Sudirohusodo', 'Pelabuhan Makassar', 'Bandara Sultan Hasanuddin'],
    sensorCoverage: 'penuh',
    nightLightAnomalyPct: -3,
    citizenReports: { count: 6, recent: ['Beban puncak malam terasa lebih lama dari biasanya'] },
  },
  {
    id: 'mg-kalimantan',
    name: 'Microgrid Balikpapan',
    island: 'Kalimantan',
    lat: -1.27, lng: 116.83,
    status: 'normal',
    gridMode: 'grid-connected',
    renewableCapacity: { solar: 2.9, wind: 0.6, hydro: 1.8, geothermal: 0.0, biomass: 2.1 },
    currentGeneration: 7.1, currentDemand: 6.2, energyBalance: 0.9,
    bessSOC: 79, bessCapacity: 900, criticalLoad: 1.9,
    dieselDependency: 11, renewableUtilization: 88,
    deficitProbability: 15, hostingCapacityRisk: 20, emergencyRisk: 16, riskScore: 18,
    connectedBESS: ['bess-001'],
    criticalFacilities: ['RS Kanujoso', 'Pelabuhan Semayang', 'Kilang Pertamina'],
    sensorCoverage: 'penuh',
    nightLightAnomalyPct: 0,
    citizenReports: { count: 0, recent: [] },
  }
];

/** Histori telemetry generation/load/BESS 24-jam per microgrid — hybrid (measured + estimated). */
export const TELEMETRY_HISTORY: Record<string, HybridTelemetryPoint[]> = Object.fromEntries(
  MICROGRIDS.map(m => [m.id, buildTelemetryHistory(m)])
);

export const BESS_UNITS: BESSUnit[] = [
  { id: 'bess-007', name: 'BESS-007', currentLocation: 'Jayapura', destinationLocation: 'Kupang', status: 'idle', soc: 87, soh: 94, capacityKWh: 500, maxPowerKW: 250, cycleCount: 312, allocationScore: 92, estimatedTransitDays: 4, lat: -2.53, lng: 140.72 },
  { id: 'bess-003', name: 'BESS-003', currentLocation: 'Kupang', destinationLocation: null, status: 'discharging', soc: 34, soh: 81, capacityKWh: 300, maxPowerKW: 150, cycleCount: 687, allocationScore: 41, estimatedTransitDays: null, lat: -10.17, lng: 123.61 },
  { id: 'bess-005', name: 'BESS-005', currentLocation: 'Ambon', destinationLocation: null, status: 'charging', soc: 58, soh: 88, capacityKWh: 400, maxPowerKW: 200, cycleCount: 445, allocationScore: 67, estimatedTransitDays: null, lat: -3.69, lng: 128.18 },
  { id: 'bess-002', name: 'BESS-002', currentLocation: 'Makassar', destinationLocation: null, status: 'idle', soc: 72, soh: 91, capacityKWh: 500, maxPowerKW: 250, cycleCount: 523, allocationScore: 76, estimatedTransitDays: null, lat: -5.14, lng: 119.41 },
  { id: 'bess-004', name: 'BESS-004', currentLocation: 'Makassar', destinationLocation: 'Ambon', status: 'in-transit', soc: 91, soh: 96, capacityKWh: 500, maxPowerKW: 250, cycleCount: 198, allocationScore: 88, estimatedTransitDays: 2, lat: -4.8, lng: 125.9 },
  { id: 'bess-001', name: 'BESS-001', currentLocation: 'Balikpapan', destinationLocation: null, status: 'charging', soc: 79, soh: 89, capacityKWh: 400, maxPowerKW: 200, cycleCount: 601, allocationScore: 58, estimatedTransitDays: null, lat: -1.27, lng: 116.83 }
];

export const FORECAST_NTT: ForecastPoint[] = [
  { hour: '12:00', generation: 3.8, demand: 5.1, bessSOC: 52 },
  { hour: '13:00', generation: 3.6, demand: 5.3, bessSOC: 47 },
  { hour: '14:00', generation: 3.2, demand: 5.5, bessSOC: 42 },
  { hour: '15:00', generation: 2.8, demand: 5.6, bessSOC: 38 },
  { hour: '16:00', generation: 2.1, demand: 5.8, bessSOC: 34 },
  { hour: '17:00', generation: 1.4, demand: 6.1, bessSOC: 27 },
  { hour: '18:00', generation: 0.3, demand: 6.8, bessSOC: 18 },
  { hour: '19:00', generation: 0.1, demand: 7.2, bessSOC: 8 },
  { hour: '20:00', generation: 0.0, demand: 7.0, bessSOC: 0 },
];



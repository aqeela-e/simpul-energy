import type { UserRole } from '@/context/AuthContext';
import { MICROGRIDS } from '@/lib/data';

/**
 * Matriks akses: rute mana saja yang boleh diakses tiap peran.
 * Kunci adalah base path (segmen pertama setelah "/"), jadi
 * "/microgrids/mg-ntt" otomatis dicek lewat kunci "/microgrids".
 */
export const ROUTE_ACCESS: Record<string, UserRole[]> = {
  '/dashboard': ['admin-pln', 'publik'],
  '/map': ['admin-pln', 'operator-kapal', 'teknisi-lokal'],
  '/microgrids': ['admin-pln', 'operator-kapal', 'teknisi-lokal'],
  '/forecast': ['admin-pln'],
  '/allocation': ['admin-pln'],
  '/simulation': ['admin-pln'],
  '/analytics': ['admin-pln'],
  '/audit': ['admin-pln', 'publik'],
  '/reports': ['admin-pln', 'operator-kapal', 'teknisi-lokal', 'publik'],
  '/shipments': ['admin-pln', 'operator-kapal', 'teknisi-lokal'],
  '/public': ['admin-pln', 'publik'],
};

/** Halaman pertama yang dilihat tiap peran setelah login / saat ditolak akses. */
export const HOME_ROUTE: Record<UserRole, string> = {
  'admin-pln': '/dashboard',
  'operator-kapal': '/map',
  'teknisi-lokal': '/microgrids',
  'publik': '/dashboard',
};

/** Microgrid yang menjadi tanggung jawab teknisi lokal (data simulasi: NTT). */
export const TEKNISI_MICROGRID_ID = 'mg-ntt';

/**
 * Nama kota tujuan shipment untuk microgrid yang menjadi tanggung jawab
 * teknisi lokal, diturunkan dari data microgrid (bukan string hardcoded)
 * supaya konsisten dipakai di seluruh halaman (shipments, microgrid detail).
 */
export const TEKNISI_DESTINATION_CITY =
  MICROGRIDS.find(m => m.id === TEKNISI_MICROGRID_ID)?.name.replace('Microgrid ', '') ?? '';

export function basePath(pathname: string): string {
  const seg = pathname.split('/').filter(Boolean)[0];
  return seg ? `/${seg}` : '/';
}

export function canAccess(role: UserRole, pathname: string): boolean {
  const base = basePath(pathname);
  const allowed = ROUTE_ACCESS[base];
  if (!allowed) return false; // default-deny: route baru wajib didefinisikan di RBAC matrix
  return allowed.includes(role);
}

export const ROLE_LABEL: Record<UserRole, string> = {
  'admin-pln': 'Admin PLN',
  'operator-kapal': 'Operator Tol Laut',
  'teknisi-lokal': 'Teknisi Microgrid',
  'publik': 'Portal Publik',
};

export const ROLE_SCOPE_NOTE: Record<UserRole, string> = {
  'admin-pln': 'Akses penuh ke seluruh modul operasional dan pengambilan keputusan.',
  'operator-kapal': 'Anda melihat peta jalur distribusi & status pengiriman BESS. Modul prediksi dan alokasi hanya untuk Admin PLN.',
  'teknisi-lokal': 'Anda hanya melihat microgrid wilayah tugas Anda (NTT) dan peta kedatangan BESS.',
  'publik': 'Anda melihat ringkasan agregat & audit trail publik. Detail operasional per-lokasi tidak ditampilkan.',
};


export function canAccessMicrogridEntity(role: UserRole, microgridId: string): boolean {
  if (role === 'admin-pln') return true;
  if (role === 'teknisi-lokal') return microgridId === TEKNISI_MICROGRID_ID;
  return role === 'operator-kapal';
}

export function canAccessShipmentEntity(role: UserRole, destination: string): boolean {
  if (role === 'admin-pln' || role === 'operator-kapal') return true;
  if (role === 'teknisi-lokal') return destination === TEKNISI_DESTINATION_CITY;
  return false;
}

export function canActOnShipment(
  role: UserRole,
  action: 'approve' | 'reject' | 'arrival' | 'integration' | 'operational',
  destination?: string,
): boolean {
  if (action === 'approve' || action === 'reject') return role === 'admin-pln';
  if (role === 'admin-pln') return true;
  if (role === 'teknisi-lokal') return !!destination && destination === TEKNISI_DESTINATION_CITY;
  return false;
}

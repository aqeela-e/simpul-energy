'use client';
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth, User } from '@/context/AuthContext';
import { canAccess, HOME_ROUTE } from '@/lib/permissions';

/**
 * Menjaga sebuah halaman: redirect ke landing kalau belum login,
 * dan redirect ke halaman utama peran tsb kalau peran tidak berhak
 * mengakses rute saat ini. Mengembalikan `user` hanya jika berhak,
 * jadi halaman cukup menulis `const user = useRoleGuard(); if (!user) return null;`
 */
export function useRoleGuard(): User | null {
  const { user, ready } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const authorized = !!user && canAccess(user.role, pathname);

  useEffect(() => {
    if (!ready) return; // still checking sessionStorage — don't redirect yet
    if (!user) {
      router.push('/');
      return;
    }
    if (!canAccess(user.role, pathname)) {
      router.push(HOME_ROUTE[user.role]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, ready, pathname]);

  return authorized ? user : null;
}

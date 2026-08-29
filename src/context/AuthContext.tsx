'use client';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type UserRole = 'admin-pln' | 'operator-kapal' | 'teknisi-lokal' | 'publik';

export interface User {
  role: UserRole;
  name: string;
  region: string;
  avatar: string;
}

const USERS: Record<UserRole, User> = {
  'admin-pln': { role: 'admin-pln', name: 'Admin PLN Wilayah', region: 'Indonesia Timur', avatar: 'AP' },
  'operator-kapal': { role: 'operator-kapal', name: 'Operator Tol Laut', region: 'Armada Nasional', avatar: 'OK' },
  'teknisi-lokal': { role: 'teknisi-lokal', name: 'Teknisi Microgrid', region: 'NTT', avatar: 'TL' },
  'publik': { role: 'publik', name: 'Portal Publik', region: 'Akses Terbuka', avatar: 'PB' },
};

const SESSION_KEY = 'simpul-session-role';

interface AuthContextType {
  user: User | null;
  login: (role: UserRole) => void;
  logout: () => void;
  ready: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, login: () => {}, logout: () => {}, ready: false });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  // Whether we've finished checking sessionStorage for a saved session.
  // Pages/guards should wait for this before deciding to redirect,
  // otherwise a page refresh would briefly look "logged out" and bounce
  // the user back to the landing page before the session is restored.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(SESSION_KEY) as UserRole | null;
      // Hydrating client state from sessionStorage on mount is exactly what this
      // effect is for — it can't run during SSR/static generation, so it can't
      // be done as a lazy useState initializer without crashing the build.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved && USERS[saved]) setUser(USERS[saved]);
    } catch {
      // sessionStorage unavailable (e.g. privacy mode) — just start logged out.
    }
    setReady(true);
  }, []);

  const login = (role: UserRole) => {
    setUser(USERS[role]);
    try { sessionStorage.setItem(SESSION_KEY, role); } catch {}
  };

  const logout = () => {
    setUser(null);
    try { sessionStorage.removeItem(SESSION_KEY); } catch {}
  };

  return <AuthContext.Provider value={{ user, login, logout, ready }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
export { USERS };


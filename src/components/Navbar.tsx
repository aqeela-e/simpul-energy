'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { useSimpul } from '@/context/SimpulContext';
import Image from 'next/image';
import { HOME_ROUTE, ROLE_LABEL, ROLE_SCOPE_NOTE, ROUTE_ACCESS } from '@/lib/permissions';
import { Zap, Map, Grid, TrendingUp, Settings, FileText, BarChart2, LogOut, Menu, X, Info, Ship, LineChart } from 'lucide-react';

const ALL_NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: BarChart2 },
  { href: '/map', label: 'Peta Nasional', icon: Map },
  { href: '/microgrids', label: 'Microgrid', icon: Grid },
  { href: '/forecast', label: 'Prediksi', icon: TrendingUp },
  { href: '/allocation', label: 'Alokasi BESS', icon: Settings },
  { href: '/simulation', label: 'Simulasi', icon: Zap },
  { href: '/analytics', label: 'Analytics', icon: LineChart },
  { href: '/audit', label: 'Audit Trail', icon: FileText },
  { href: '/reports', label: 'Laporan', icon: Info },
  { href: '/shipments', label: 'Shipment', icon: Ship },
  { href: '/public', label: 'Transparansi', icon: BarChart2 },
];

export default function Navbar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { notifications, unread, markRead } = useSimpul();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  if (!user) return null;

  // Hanya tampilkan menu yang memang boleh diakses peran ini.
  const navItems = ALL_NAV_ITEMS.filter(({ href }) => ROUTE_ACCESS[href]?.includes(user.role));
  const homeHref = HOME_ROUTE[user.role];

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 border-b glass" style={{ borderColor: 'var(--bg-border-soft)' }}>
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          {/* Logo */}
          <Link href={homeHref} onClick={() => setMobileOpen(false)} className="flex items-center gap-2 shrink-0">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-white p-1" style={{ boxShadow: '0 2px 8px rgba(20,184,166,0.2)' }}>
              <Image src="/logo-icon.png" alt="SIMPUL" width={28} height={28} className="w-full h-full object-contain" priority />
            </div>
            <span className="font-display font-bold text-lg tracking-tight" style={{ color: 'var(--text-primary)' }}>
              SIMP<span style={{ color: 'var(--accent-teal-light)' }}>UL</span>
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center gap-0.5 overflow-x-auto">
            {navItems.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + '/');
              return (
                <Link key={href} href={href} className="relative flex items-center gap-1.5 px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors" style={{ color: active ? 'var(--accent-teal-light)' : 'var(--text-muted)' }}>
                  {active && <motion.div layoutId="nav-active" className="absolute inset-x-1.5 bottom-0.5 h-[2px] rounded-full" style={{ background: 'var(--accent-teal-light)', boxShadow: '0 1px 4px rgba(20,184,166,0.4)' }} />}
                  <Icon size={14} />
                  <span className="relative">{label}</span>
                </Link>
              );
            })}
          </div>

          {/* User info */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="hidden md:flex items-center gap-2 pl-1 pr-3 py-1 rounded-full" style={{ background: 'var(--bg-card)', border: '1px solid var(--bg-border-soft)' }}>
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: 'linear-gradient(135deg, #0D9488, #14B8A6)', color: '#FFFFFF' }}>{user.avatar}</div>
              <div className="leading-tight min-w-0 max-w-[9rem]">
                <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>{user.name}</p>
                <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>{ROLE_LABEL[user.role]}</p>
              </div>
            </div>
            <div className="relative">
              <button onClick={() => setNotificationsOpen(v => !v)} aria-label="Notifikasi" className="relative p-2 rounded-lg" style={{color:'var(--text-muted)',background:'var(--bg-card)',border:'1px solid var(--bg-border-soft)'}}>
                <Info size={15}/>
                {unread > 0 && <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full text-[9px] flex items-center justify-center" style={{background:'#E11D48',color:'white'}}>{unread}</span>}
              </button>
              {notificationsOpen && <div className="fixed sm:absolute left-3 right-3 sm:left-auto sm:right-0 top-16 sm:top-11 w-auto sm:w-80 max-w-none sm:max-w-[90vw] card p-2 shadow-xl z-50">
                <div className="px-2 py-1.5 text-xs font-semibold">Notification Center</div>
                <div className="max-h-80 overflow-auto">{notifications.slice(0,8).map(n=><button key={n.id} onClick={()=>markRead(n.id)} className="w-full text-left p-2 rounded-lg mb-1" style={{background:n.read?'transparent':'rgba(13,148,136,.06)'}}>
                  <div className="flex justify-between gap-2"><span className="text-xs font-semibold">{n.title}</span><span className="text-[10px]" style={{color:'var(--text-dim)'}}>{new Date(n.createdAt).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})}</span></div>
                  <p className="text-[11px] mt-0.5" style={{color:'var(--text-muted)'}}>{n.message}</p>
                </button>)}</div>
              </div>}
            </div>
            <button onClick={logout} aria-label="Keluar" className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors hover:brightness-125" style={{ background: 'rgba(225,29,72,0.1)', color: 'var(--accent-red)', border: '1px solid rgba(225,29,72,0.2)' }}>
              <LogOut size={14} />
              <span className="hidden md:inline">Keluar</span>
            </button>
            <button className="lg:hidden p-1.5 -mr-1.5" aria-label="Menu" onClick={() => setMobileOpen(o => !o)} style={{ color: 'var(--text-muted)' }}>
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }} className="lg:hidden border-t" style={{ borderColor: 'var(--bg-border-soft)', background: 'var(--bg-deep-2)', maxHeight: 'calc(100vh - 4rem)', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <div className="px-3 py-3 flex items-center gap-2 border-b mb-1 sticky top-0" style={{ borderColor: 'var(--bg-border-soft)', background: 'var(--bg-deep-2)' }}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: 'linear-gradient(135deg, #0D9488, #14B8A6)', color: '#FFFFFF' }}>{user.avatar}</div>
                <div className="leading-tight min-w-0">
                  <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>{user.name}</p>
                  <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>{ROLE_LABEL[user.role]}</p>
                </div>
              </div>
              <div className="px-3 pb-3 safe-bottom flex flex-col gap-1">
                {navItems.map(({ href, label, icon: Icon }) => {
                  const active = pathname === href || pathname.startsWith(href + '/');
                  return (
                    <Link key={href} href={href} onClick={() => setMobileOpen(false)} className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium" style={{ color: active ? 'var(--accent-teal-light)' : 'var(--text-muted)', background: active ? 'rgba(13,148,136,0.12)' : 'transparent' }}>
                      <Icon size={16} />{label}
                    </Link>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>
      {/* Spacer so fixed nav never overlaps page content */}
      <div className="h-16" />

      {/* Role scope banner — makes the access-control boundary visible, not hidden */}
      {user.role !== 'admin-pln' && (
        <div className="border-b px-4 sm:px-6 py-2" style={{ background: 'rgba(37,99,235,0.06)', borderColor: 'var(--bg-border-soft)' }}>
          <div className="max-w-screen-xl mx-auto flex items-start gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
            <Info size={13} className="mt-0.5 shrink-0" style={{ color: 'var(--accent-blue)' }} />
            <span><span className="font-medium" style={{ color: 'var(--text-primary)' }}>Mode {ROLE_LABEL[user.role]}.</span> {ROLE_SCOPE_NOTE[user.role]}</span>
          </div>
        </div>
      )}
    </>
  );
}

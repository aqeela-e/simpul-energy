'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useAuth, UserRole } from '@/context/AuthContext';
import { HOME_ROUTE } from '@/lib/permissions';
import Image from 'next/image';
import { Shield, BarChart2, Map as MapIcon, ArrowRight, Activity, Check } from 'lucide-react';

const ROLE_OPTIONS = [
  { role: 'admin-pln' as UserRole, label: 'Admin PLN', desc: 'Akses penuh — monitor, approve alokasi, kelola darurat', color: '#0D9488', rgb: '13,148,136', icon: Shield },
  { role: 'operator-kapal' as UserRole, label: 'Operator Tol Laut', desc: 'Jadwal pengiriman, status kontainer BESS', color: '#D97706', rgb: '217,119,6', icon: MapIcon },
  { role: 'teknisi-lokal' as UserRole, label: 'Teknisi Microgrid', desc: 'Konfirmasi kedatangan, status integrasi grid lokal', color: '#2563EB', rgb: '37,99,235', icon: Activity },
  { role: 'publik' as UserRole, label: 'Portal Publik', desc: 'Ringkasan alokasi, transparansi audit trail', color: '#7C3AED', rgb: '124,58,237', icon: BarChart2 },
];

export default function LandingPage() {
  const [selected, setSelected] = useState<UserRole | null>(null);
  const { login } = useAuth();
  const router = useRouter();

  const handleLogin = () => {
    if (!selected) return;
    login(selected);
    router.push(HOME_ROUTE[selected]);
  };

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Soft ambient backdrop — no map tiles here, this is just the login screen */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 900px 500px at 50% -10%, rgba(13,148,136,0.08), transparent 60%)' }} />

      {/* Hero */}
      <div className="relative flex-1 flex flex-col items-center justify-center px-4 py-16 sm:py-24">
        {/* Ambient glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full opacity-10 blur-3xl pointer-events-none animate-float-slow" style={{ background: 'radial-gradient(circle, #0D9488 0%, transparent 70%)' }} />

        {/* Logo mark */}
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.6 }} className="mb-7 flex items-center gap-3">
          <div className="w-16 h-16 sm:w-[4.5rem] sm:h-[4.5rem] rounded-2xl flex items-center justify-center shrink-0 bg-white p-2" style={{ boxShadow: '0 4px 20px rgba(20,184,166,0.25)' }}>
            <Image src="/logo-icon.png" alt="SIMPUL" width={56} height={56} className="w-full h-full object-contain" priority />
          </div>
          <div>
            <h1 className="font-display font-bold text-3xl sm:text-4xl tracking-tight" style={{ color: 'var(--text-primary)' }}>
              SIMP<span style={{ color: 'var(--accent-teal-light)' }}>UL</span>
            </h1>
            <p className="eyebrow">v1.0 — Prototype</p>
          </div>
        </motion.div>

        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 }} className="text-center mb-5 px-2">
          <h2 className="font-display font-semibold text-[1.6rem] leading-tight sm:text-3xl md:text-4xl mb-1" style={{ color: 'var(--text-primary)' }}>
            Sistem Inteligensi Mobilisasi
          </h2>
          <h2 className="font-display font-semibold text-[1.6rem] leading-tight sm:text-3xl md:text-4xl mb-4" style={{ color: 'var(--text-primary)' }}>
            Penyimpanan Energi <span className="text-gradient">Lintas-Pulau</span>
          </h2>
          <p className="eyebrow mb-5">Predict · Allocate · Pre-position</p>
          <p className="max-w-xl mx-auto text-sm sm:text-[15px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            Platform kecerdasan energi nasional untuk memprediksi kebutuhan penyimpanan antar-microgrid kepulauan Indonesia dan menentukan pre-positioning BESS secara adaptif sebelum defisit terjadi.
          </p>
        </motion.div>

        {/* Stats bar */}
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.28 }} className="grid grid-cols-2 sm:flex sm:gap-8 gap-4 mb-10 w-full max-w-md sm:max-w-none sm:w-auto sm:justify-center">
          {[
            { label: 'Microgrid Aktif', value: '5' },
            { label: 'Unit BESS', value: '6' },
            { label: 'Pulau Terpantau', value: '5' },
            { label: 'Moda Transport', value: 'Tol Laut' },
          ].map(s => (
            <div key={s.label} className="text-center">
              <p className="font-display font-bold text-2xl" style={{ color: 'var(--accent-teal)' }}>{s.value}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
            </div>
          ))}
        </motion.div>

        {/* Role selector */}
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4 }} className="w-full max-w-2xl">
          <p className="text-sm font-medium text-center mb-4" style={{ color: 'var(--text-muted)' }}>Masuk sebagai:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            {ROLE_OPTIONS.map(({ role, label, desc, color, rgb, icon: Icon }) => {
              const isSel = selected === role;
              return (
                <button key={role} onClick={() => setSelected(role)} aria-pressed={isSel} className="relative text-left p-4 rounded-xl border transition-all duration-200 card-hover" style={{
                  background: isSel ? `rgba(${rgb},0.12)` : 'var(--bg-card)',
                  borderColor: isSel ? color : 'var(--bg-border-soft)',
                  boxShadow: isSel ? `0 4px 14px rgba(${rgb},0.16)` : 'none',
                }}>
                  {isSel && (
                    <span className="absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: color }}>
                      <Check size={12} className="text-white" strokeWidth={3} />
                    </span>
                  )}
                  <div className="flex items-center gap-2 mb-1">
                    <Icon size={16} style={{ color }} />
                    <span className="font-display font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{label}</span>
                  </div>
                  <p className="text-xs leading-relaxed pr-5" style={{ color: 'var(--text-muted)' }}>{desc}</p>
                </button>
              );
            })}
          </div>
          <button onClick={handleLogin} disabled={!selected} className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-display font-semibold text-sm transition-all duration-200" style={{
            background: selected ? 'linear-gradient(135deg, #0D9488, #14B8A6)' : 'var(--bg-card)',
            color: selected ? '#FFFFFF' : 'var(--text-dim)',
            cursor: selected ? 'pointer' : 'not-allowed',
            boxShadow: selected ? '0 6px 18px -6px rgba(20,184,166,0.4)' : 'none',
          }}>
            Masuk ke Platform <ArrowRight size={16} />
          </button>
        </motion.div>

        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} className="mt-8 text-xs text-center max-w-md px-4" style={{ color: 'var(--text-dim)' }}>
          ⚠ Data yang ditampilkan merupakan data simulasi.
        </motion.p>
      </div>
    </div>
  );
}

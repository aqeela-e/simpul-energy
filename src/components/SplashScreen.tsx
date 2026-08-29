'use client';
import { useEffect, useState } from 'react';
import Image from 'next/image';

/**
 * SIMPUL opening screen.
 *
 * Renders `children` immediately (so nothing about routing, data fetching or
 * app state is delayed/blocked) and layers a full-screen splash on top of it
 * for the very first load of a browser tab/session only. Once dismissed
 * (either after the animation, or immediately if this session has already
 * seen it), it never reappears until the tab is closed — client-side route
 * changes never re-trigger it because this component lives in the root
 * layout and is not remounted between pages.
 */
export default function SplashScreen({ children }: { children: React.ReactNode }) {
  // Default to visible so server-render and first client-render agree
  // (sessionStorage isn't available on the server) — this avoids a
  // hydration mismatch. If this session already saw the splash, the effect
  // below closes it immediately, before the fade-out is even noticeable.
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    let alreadyShown = false;
    try {
      alreadyShown = sessionStorage.getItem('simpul_splash_shown') === '1';
    } catch {
      /* sessionStorage unavailable (e.g. privacy mode) — just show it once and move on */
    }

    if (alreadyShown) {
      const skipTimer = window.setTimeout(() => setVisible(false), 0);
      return () => window.clearTimeout(skipTimer);
    }

    // Give people enough time to actually read the name + tagline before it
    // fades — 1.5s/1.9s felt rushed, especially since the logo pop + text
    // rise animations alone already take ~0.65s to finish.
    const fadeTimer = window.setTimeout(() => setFading(true), 2400);
    const hideTimer = window.setTimeout(() => {
      setVisible(false);
      try {
        sessionStorage.setItem('simpul_splash_shown', '1');
      } catch {
        /* ignore */
      }
    }, 2900);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(hideTimer);
    };
  }, []);

  return (
    <>
      {children}
      {visible && (
        <div
          role="presentation"
          aria-hidden="true"
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-5 px-6 transition-opacity duration-[400ms] ease-out"
          style={{
            background: 'radial-gradient(ellipse 900px 600px at 50% 30%, rgba(20,184,166,0.16), transparent 60%), #0B1120',
            opacity: fading ? 0 : 1,
            pointerEvents: fading ? 'none' : 'auto',
          }}
        >
          <div
            className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl flex items-center justify-center bg-white p-3 opening-logo-pop"
            style={{ boxShadow: '0 8px 40px rgba(20,184,166,0.35)' }}
          >
            <Image src="/logo-icon.png" alt="SIMPUL" width={80} height={80} className="w-full h-full object-contain" priority />
          </div>

          <div className="text-center opening-text-rise">
            <h1 className="font-display font-bold text-3xl sm:text-4xl tracking-tight text-white">
              SIMP<span style={{ color: '#14B8A6' }}>UL</span>
            </h1>
            <p className="mt-2 text-xs sm:text-sm max-w-xs sm:max-w-sm mx-auto leading-relaxed" style={{ color: 'rgba(255,255,255,0.62)' }}>
              Sistem Intelijen Mobilisasi Penyimpanan untuk Listrik Kepulauan
            </p>
          </div>

          <div className="mt-2 h-1 w-40 sm:w-48 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.12)' }}>
            <div className="h-full w-1/3 rounded-full opening-loading-bar" style={{ background: 'linear-gradient(90deg,#0D9488,#14B8A6)' }} />
          </div>

          <style>{`
            @keyframes opening-logo-pop {
              0% { transform: scale(0.8); opacity: 0; }
              100% { transform: scale(1); opacity: 1; }
            }
            .opening-logo-pop { animation: opening-logo-pop 0.5s cubic-bezier(0.16,1,0.3,1) both; }

            @keyframes opening-text-rise {
              0% { transform: translateY(8px); opacity: 0; }
              100% { transform: translateY(0); opacity: 1; }
            }
            .opening-text-rise { animation: opening-text-rise 0.5s ease-out 0.15s both; }

            @keyframes opening-loading-bar {
              0% { transform: translateX(-110%); }
              100% { transform: translateX(320%); }
            }
            .opening-loading-bar { animation: opening-loading-bar 1.1s ease-in-out infinite; }

            @media (prefers-reduced-motion: reduce) {
              .opening-logo-pop, .opening-text-rise, .opening-loading-bar { animation: none; }
            }
          `}</style>
        </div>
      )}
    </>
  );
}

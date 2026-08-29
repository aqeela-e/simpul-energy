import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { SimpulProvider } from '@/context/SimpulContext';
import Navbar from '@/components/Navbar';
import SplashScreen from '@/components/SplashScreen';

export const metadata: Metadata = {
  title: 'SIMPUL',
  description: 'Intelligent Storage for a Resilient Archipelago. Predict. Allocate. Pre-position.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" data-scroll-behavior="smooth">
      <body>
        <AuthProvider>
          <SimpulProvider>
            <SplashScreen>
              <Navbar />
              <main>{children}</main>
            </SplashScreen>
          </SimpulProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

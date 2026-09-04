import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'Rebuscándome',
  description: 'Aprende, promociona y genera con productos digitales.',
  icons: { icon: '/brand/rebuscandome-isotipo.png' },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="es"><body>{children}</body></html>;
}

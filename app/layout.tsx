import type { Metadata } from 'next';
import { SessionProvider } from 'next-auth/react';
import '../src/index.css';
import { TopNav } from '../src/components/layout/TopNav';

export const metadata: Metadata = {
  metadataBase: new URL('https://investment-planner.dailyquest.ca'),
  title: 'Finpath',
  description:
    'Plan your financial path — see how housing, investments, and tax choices play out over your lifetime.',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '32x32' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    title: 'Finpath',
    description:
      'Plan your financial path — see how housing, investments, and tax choices play out over your lifetime.',
    images: [{ url: '/icon-512.png', width: 512, height: 512 }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 flex flex-col">
        <SessionProvider>
          <TopNav />
          <div className="flex-1 flex flex-col">{children}</div>
          <footer className="border-t border-slate-800 py-4">
            <p className="text-center text-xs text-slate-500">
              &copy; {new Date().getFullYear()} Daily Quest Inc. All rights reserved.
            </p>
          </footer>
        </SessionProvider>
      </body>
    </html>
  );
}

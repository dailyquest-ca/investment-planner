import type { Metadata } from 'next';
import '../src/index.css';

export const metadata: Metadata = {
  title: 'Investment Planner',
  description: 'See how housing, investments, and tax choices play out over your lifetime.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

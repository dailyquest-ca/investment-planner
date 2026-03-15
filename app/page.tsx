'use client';

import dynamic from 'next/dynamic';

const DashboardPage = dynamic(() => import('../src/components/dashboard/DashboardPage'), { ssr: false });

export default function Home() {
  return <DashboardPage />;
}

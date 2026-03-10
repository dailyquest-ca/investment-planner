'use client';

import dynamic from 'next/dynamic';

const Planner = dynamic(() => import('../src/components/Planner'), { ssr: false });

export default function Home() {
  return <Planner />;
}

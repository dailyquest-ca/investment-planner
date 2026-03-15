'use client';

import dynamic from 'next/dynamic';

const TrackPage = dynamic(() => import('../../src/components/track/TrackPage'), { ssr: false });

export default function Track() {
  return <TrackPage />;
}

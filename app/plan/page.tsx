'use client';

import dynamic from 'next/dynamic';

const PlannerWorkspace = dynamic(() => import('../../src/components/planner/PlannerWorkspace'), { ssr: false });

export default function PlanPage() {
  return <PlannerWorkspace />;
}

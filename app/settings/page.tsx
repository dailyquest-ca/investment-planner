'use client';

import dynamic from 'next/dynamic';

const SettingsPage = dynamic(() => import('../../src/components/settings/SettingsPage'), { ssr: false });

export default function Settings() {
  return <SettingsPage />;
}

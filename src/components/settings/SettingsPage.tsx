'use client';

import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { clearAllLocalData } from '../../lib/storage';

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const isAuthenticated = status === 'authenticated' && !!session?.user;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12 space-y-8">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-white tracking-tight">
          Settings
        </h1>
        <p className="mt-1 text-slate-400 text-sm">
          Manage your account, preferences, and defaults.
        </p>
      </div>

      {/* Account */}
      <div className="rounded-xl border border-slate-700/80 bg-slate-800/40 p-5 space-y-3">
        <h2 className="font-display text-sm font-semibold text-slate-300">Account</h2>
        {isAuthenticated ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-lg font-bold text-emerald-400">
                {(session.user?.email?.[0] ?? '?').toUpperCase()}
              </div>
              <div>
                <p className="text-sm text-slate-200 font-medium">{session.user?.email}</p>
                <p className="text-[11px] text-slate-500">Signed in &middot; data syncs automatically</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: '/' })}
              className="px-4 py-2 rounded-md border border-slate-600 text-slate-300 text-xs font-medium hover:bg-slate-700/60 transition"
            >
              Sign out
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-slate-400">
              Sign in to sync your plan across devices and keep your data safe.
            </p>
            <Link
              href="/auth/signin"
              className="inline-block px-4 py-2 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition"
            >
              Sign in
            </Link>
          </div>
        )}
      </div>

      {/* Region */}
      <div className="rounded-xl border border-slate-700/80 bg-slate-800/40 p-5 space-y-3">
        <h2 className="font-display text-sm font-semibold text-slate-300">Tax region</h2>
        <p className="text-xs text-slate-400">
          Tax calculations currently use Canadian Federal + British Columbia rates. Additional provinces
          and regions may be supported in the future.
        </p>
        <div className="inline-flex items-center gap-2 rounded-md bg-slate-800 border border-slate-600 px-3 py-2 text-xs text-slate-300">
          <span>&#x1F1E8;&#x1F1E6;</span>
          <span>Canada &mdash; British Columbia</span>
        </div>
      </div>

      {/* Display preferences */}
      <div className="rounded-xl border border-slate-700/80 bg-slate-800/40 p-5 space-y-3">
        <h2 className="font-display text-sm font-semibold text-slate-300">Display</h2>
        <p className="text-xs text-slate-400">
          Display and chart preferences will be available here in a future update.
        </p>
      </div>

      {/* Strategy management */}
      <div className="rounded-xl border border-slate-700/80 bg-slate-800/40 p-5 space-y-3">
        <h2 className="font-display text-sm font-semibold text-slate-300">Strategies</h2>
        <p className="text-xs text-slate-400">
          Strategy management &mdash; save, name, compare, and adopt different financial strategies &mdash; is coming soon.
        </p>
      </div>

      {/* Reset */}
      <div className="rounded-xl border border-dashed border-rose-500/30 bg-rose-500/5 p-5 space-y-3">
        <h2 className="font-display text-sm font-semibold text-rose-400">Danger zone</h2>
        <p className="text-xs text-slate-400">
          Reset all local data (assumptions, actuals, and setup state) to defaults. This cannot be undone.
        </p>
        <button
          type="button"
          onClick={() => {
            if (window.confirm('Reset all data to defaults? This cannot be undone.')) {
              clearAllLocalData();
              window.location.href = '/';
            }
          }}
          className="px-4 py-2 rounded-md border border-rose-500/40 text-rose-400 text-xs font-medium hover:bg-rose-500/10 transition"
        >
          Reset to defaults
        </button>
      </div>

    </div>
  );
}

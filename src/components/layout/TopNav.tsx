'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { useState } from 'react';

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard' },
  { href: '/plan', label: 'Plan' },
  { href: '/track', label: 'Track' },
];

export function TopNav() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);

  const isLoading = status === 'loading';

  return (
    <nav className="sticky top-0 z-50 flex items-center gap-1 sm:gap-4 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md px-3 sm:px-5 h-12">
      <Link
        href="/"
        className="flex items-center gap-1.5 font-display font-bold text-white text-sm tracking-tight shrink-0 mr-2 sm:mr-4"
      >
        <Image src="/icon-192.png" alt="" width={24} height={24} className="rounded-md" />
        Finpath
      </Link>

      <div className="flex items-center gap-0.5">
        {NAV_ITEMS.map(({ href, label }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`px-2.5 py-1.5 rounded-md text-xs sm:text-sm transition ${
                active
                  ? 'bg-emerald-500/10 text-emerald-400 font-medium'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              {label}
            </Link>
          );
        })}
      </div>

      <div className="ml-auto flex items-center gap-2">
        <Link
          href="/settings"
          className={`p-2 rounded-md transition ${
            pathname === '/settings'
              ? 'text-emerald-400 bg-emerald-500/10'
              : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/60'
          }`}
          aria-label="Settings"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
          </svg>
        </Link>

        {/* Auth state */}
        {isLoading ? (
          <div className="w-16 h-5 rounded bg-slate-800 animate-pulse" />
        ) : session?.user ? (
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs text-slate-300 hover:bg-slate-800/60 transition"
            >
              <span className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-[10px] font-bold text-emerald-400">
                {(session.user.email?.[0] ?? '?').toUpperCase()}
              </span>
              <span className="hidden sm:inline truncate max-w-[120px]">{session.user.email}</span>
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-8 z-50 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-1">
                  <p className="px-3 py-1.5 text-[10px] text-slate-500 truncate">{session.user.email}</p>
                  <div className="border-t border-slate-700 my-1" />
                  <button
                    type="button"
                    onClick={() => signOut({ callbackUrl: '/' })}
                    className="w-full text-left px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700/60 transition"
                  >
                    Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <Link
            href="/auth/signin"
            className="px-3 py-1.5 rounded-md text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition"
          >
            Sign in
          </Link>
        )}
      </div>
    </nav>
  );
}

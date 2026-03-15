'use client';

import { signIn } from 'next-auth/react';
import { useState } from 'react';
import Link from 'next/link';

export default function SignInPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setError(null);
    setEmailLoading(true);
    try {
      await signIn('resend', { email, redirect: false });
      setSent(true);
    } catch {
      setError('Unable to send email sign-in link. Please try again.');
    } finally {
      setEmailLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setGoogleLoading(true);
    try {
      await signIn('google', { callbackUrl: '/' });
    } catch {
      setError('Google sign-in is not available yet. Check your Google auth environment variables.');
      setGoogleLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="flex items-center justify-center min-h-[70vh] px-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto">
            <span className="text-2xl" aria-hidden>&#x2709;</span>
          </div>
          <h1 className="font-display text-xl font-bold text-white">Check your email</h1>
          <p className="text-sm text-slate-400">
            We sent a sign-in link to <span className="text-slate-200 font-medium">{email}</span>.
            Click the link in the email to continue.
          </p>
          <button
            type="button"
            onClick={() => { setSent(false); setEmail(''); }}
            className="text-xs text-slate-500 hover:text-slate-300 underline transition"
          >
            Use a different email
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[70vh] px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="font-display text-2xl font-bold text-white">Sign in</h1>
          <p className="mt-1 text-sm text-slate-400">
            Enter your email to receive a sign-in link.
            No password needed.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading || emailLoading}
            className="w-full rounded-lg bg-slate-800 border border-slate-600 text-slate-100 hover:bg-slate-700 disabled:bg-slate-800/60 disabled:text-slate-500 font-medium py-2.5 text-sm transition"
          >
            {googleLoading ? 'Redirecting to Google...' : 'Continue with Google'}
          </button>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-800" />
            <span className="text-[11px] uppercase tracking-wide text-slate-500">or</span>
            <div className="h-px flex-1 bg-slate-800" />
          </div>

          <div>
            <label htmlFor="email" className="block text-xs text-slate-400 mb-1">
              Email address
            </label>
            <input
              id="email"
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-lg bg-slate-800 border border-slate-600 text-slate-100 px-3 py-2.5 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 outline-none transition placeholder-slate-500"
            />
          </div>
          <button
            type="submit"
            disabled={emailLoading || googleLoading || !email.trim()}
            className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-medium py-2.5 text-sm transition"
          >
            {emailLoading ? 'Sending...' : 'Send sign-in link'}
          </button>
        </form>

        {error && (
          <p className="text-xs text-rose-400 text-center">
            {error}
          </p>
        )}

        <p className="text-center text-xs text-slate-500">
          New here? Entering your email will create an account automatically.
        </p>

        <div className="pt-2 border-t border-slate-800 text-center">
          <Link href="/" className="text-xs text-slate-500 hover:text-slate-300 transition">
            &larr; Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

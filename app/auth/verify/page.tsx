import Link from 'next/link';

export default function VerifyPage() {
  return (
    <div className="flex items-center justify-center min-h-[70vh] px-4">
      <div className="w-full max-w-sm text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto">
          <span className="text-2xl" aria-hidden>&#x2709;</span>
        </div>
        <h1 className="font-display text-xl font-bold text-white">Check your email</h1>
        <p className="text-sm text-slate-400">
          A sign-in link has been sent to your email address.
          Click the link to continue.
        </p>
        <Link
          href="/auth/signin"
          className="inline-block text-xs text-slate-500 hover:text-slate-300 underline transition"
        >
          Try a different email
        </Link>
      </div>
    </div>
  );
}

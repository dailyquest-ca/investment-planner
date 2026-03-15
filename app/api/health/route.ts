import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

export const runtime = 'edge';

export async function GET() {
  const checks: Record<string, string> = {
    status: 'ok',
    env: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'unknown',
    region: process.env.VERCEL_REGION ?? 'unknown',
    auth_secret: process.env.AUTH_SECRET ? 'set' : 'MISSING',
    database_url: process.env.DATABASE_URL ? 'set' : 'MISSING',
    auth_resend_key: process.env.AUTH_RESEND_KEY ? 'set' : 'unset',
    auth_google_id: process.env.AUTH_GOOGLE_ID ? 'set' : 'unset',
    auth_google_secret: process.env.AUTH_GOOGLE_SECRET ? 'set' : 'unset',
    auth_email_from: process.env.AUTH_EMAIL_FROM ? 'set' : 'unset',
  };

  if (process.env.DATABASE_URL) {
    try {
      const sql = neon(process.env.DATABASE_URL);
      const [row] = await sql`SELECT 1 AS ok`;
      checks.db_ping = row?.ok === 1 ? 'ok' : 'fail';
    } catch (err) {
      checks.db_ping = 'error';
      checks.db_error = err instanceof Error ? err.message.slice(0, 120) : 'unknown';
    }
  } else {
    checks.db_ping = 'skipped';
  }

  const hasCriticalIssue = checks.auth_secret === 'MISSING' || checks.database_url === 'MISSING' || checks.db_ping === 'error';

  return NextResponse.json(checks, { status: hasCriticalIssue ? 503 : 200 });
}

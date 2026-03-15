import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../../src/lib/auth';

const MAX_PAYLOAD_BYTES = 64 * 1024;
const MAX_ACTUALS_PER_USER = 600; // ~50 years of monthly data

function getDb() {
  return neon(process.env.DATABASE_URL!);
}

async function getAuthUserId(): Promise<string | null> {
  const session = await auth();
  if (session?.user?.id) return String(session.user.id);
  return null;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

const YEAR_MONTH_RE = /^\d{4}-(?:0[1-9]|1[0-2])$/;

export async function GET() {
  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const sql = getDb();
  try {
    const rows = await sql`
      SELECT id, year_month, data, created_at, updated_at
      FROM finpath_monthly_actuals
      WHERE user_id = ${userId}
      ORDER BY year_month DESC
      LIMIT ${MAX_ACTUALS_PER_USER}
    `;
    return NextResponse.json(rows);
  } catch (err) {
    console.error('GET /api/actuals error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > MAX_PAYLOAD_BYTES) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
  }

  const sql = getDb();
  try {
    const body = await request.json();
    const { year_month, data } = body;

    if (typeof year_month !== 'string' || !YEAR_MONTH_RE.test(year_month)) {
      return NextResponse.json({ error: 'Invalid year_month format (expected YYYY-MM)' }, { status: 400 });
    }

    if (!data || !isPlainObject(data)) {
      return NextResponse.json({ error: 'Missing or invalid data field' }, { status: 400 });
    }

    const dataJson = JSON.stringify(data);
    if (dataJson.length > MAX_PAYLOAD_BYTES) {
      return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
    }

    const rows = await sql`
      INSERT INTO finpath_monthly_actuals (user_id, year_month, data)
      VALUES (${userId}, ${year_month}, ${dataJson})
      ON CONFLICT (user_id, year_month) DO UPDATE
        SET data = ${dataJson},
            updated_at = now()
      RETURNING id, year_month, data, created_at, updated_at
    `;
    return NextResponse.json(rows[0]);
  } catch (err) {
    console.error('POST /api/actuals error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

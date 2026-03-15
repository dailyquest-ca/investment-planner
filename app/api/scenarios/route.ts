import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../../src/lib/auth';

const MAX_PAYLOAD_BYTES = 256 * 1024; // 256 KB
const MAX_SCENARIOS_PER_USER = 20;

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

export async function GET() {
  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const sql = getDb();
  try {
    const rows = await sql`
      SELECT id, name, inputs, is_default, created_at, updated_at
      FROM ip_scenarios
      WHERE user_id = ${userId}
      ORDER BY updated_at DESC
      LIMIT ${MAX_SCENARIOS_PER_USER}
    `;
    return NextResponse.json(rows);
  } catch (err) {
    console.error('GET /api/scenarios error:', err);
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
    const { id, name, inputs, is_default } = body;

    if (!inputs || !isPlainObject(inputs)) {
      return NextResponse.json({ error: 'Missing or invalid inputs field' }, { status: 400 });
    }

    const inputsJson = JSON.stringify(inputs);
    if (inputsJson.length > MAX_PAYLOAD_BYTES) {
      return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
    }

    const safeName = typeof name === 'string' ? name.slice(0, 100) : 'My Scenario';

    if (id) {
      if (typeof id !== 'string' || id.length > 64) {
        return NextResponse.json({ error: 'Invalid scenario id' }, { status: 400 });
      }
      const rows = await sql`
        UPDATE ip_scenarios
        SET name = ${safeName},
            inputs = ${inputsJson},
            is_default = ${is_default ?? false},
            updated_at = now()
        WHERE id = ${id} AND user_id = ${userId}
        RETURNING id, name, is_default, updated_at
      `;
      if (rows.length === 0) {
        return NextResponse.json({ error: 'Scenario not found' }, { status: 404 });
      }
      return NextResponse.json(rows[0]);
    }

    const countResult = await sql`
      SELECT count(*)::int AS cnt FROM ip_scenarios WHERE user_id = ${userId}
    `;
    if (countResult[0]?.cnt >= MAX_SCENARIOS_PER_USER) {
      return NextResponse.json({ error: 'Scenario limit reached' }, { status: 409 });
    }

    if (is_default) {
      await sql`
        UPDATE ip_scenarios SET is_default = false
        WHERE user_id = ${userId} AND is_default = true
      `;
    }

    const rows = await sql`
      INSERT INTO ip_scenarios (user_id, name, inputs, is_default)
      VALUES (${userId}, ${safeName}, ${inputsJson}, ${is_default ?? false})
      RETURNING id, name, is_default, created_at, updated_at
    `;
    return NextResponse.json(rows[0]);
  } catch (err) {
    console.error('POST /api/scenarios error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const sql = getDb();
  try {
    const { searchParams } = new URL(request.url);
    const scenarioId = searchParams.get('id');
    if (!scenarioId || scenarioId.length > 64) {
      return NextResponse.json({ error: 'Missing or invalid id query param' }, { status: 400 });
    }

    await sql`
      DELETE FROM ip_scenarios
      WHERE id = ${scenarioId} AND user_id = ${userId}
    `;
    return NextResponse.json({ deleted: true });
  } catch (err) {
    console.error('DELETE /api/scenarios error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

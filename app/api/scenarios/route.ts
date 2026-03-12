import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';

function getDb() {
  return neon(process.env.DATABASE_URL!);
}

async function ensureSchema(sql: ReturnType<typeof getDb>) {
  await sql`
    CREATE TABLE IF NOT EXISTS ip_scenarios (
      id TEXT PRIMARY KEY DEFAULT ('scn_' || substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
      user_id TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT 'My Scenario',
      inputs JSONB NOT NULL,
      is_default BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS ip_scenarios_user_id_updated_at_idx
    ON ip_scenarios (user_id, updated_at DESC)
  `;
}

function getUserId(request: NextRequest): string | null {
  return request.headers.get('x-user-id');
}

export async function GET(request: NextRequest) {
  const userId = getUserId(request);
  if (!userId) return NextResponse.json({ error: 'Missing x-user-id header' }, { status: 400 });

  const sql = getDb();
  try {
    await ensureSchema(sql);
    const rows = await sql`
      SELECT id, name, inputs, is_default, created_at, updated_at
      FROM ip_scenarios
      WHERE user_id = ${userId}
      ORDER BY updated_at DESC
    `;
    return NextResponse.json(rows);
  } catch (err) {
    console.error('GET /api/scenarios error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const userId = getUserId(request);
  if (!userId) return NextResponse.json({ error: 'Missing x-user-id header' }, { status: 400 });

  const sql = getDb();
  try {
    await ensureSchema(sql);
    const body = await request.json();
    const { id, name, inputs, is_default } = body;

    if (!inputs) {
      return NextResponse.json({ error: 'Missing inputs field' }, { status: 400 });
    }

    if (id) {
      const rows = await sql`
        UPDATE ip_scenarios
        SET name = ${name ?? 'My Scenario'},
            inputs = ${JSON.stringify(inputs)},
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

    if (is_default) {
      await sql`
        UPDATE ip_scenarios SET is_default = false
        WHERE user_id = ${userId} AND is_default = true
      `;
    }

    const rows = await sql`
      INSERT INTO ip_scenarios (user_id, name, inputs, is_default)
      VALUES (${userId}, ${name ?? 'My Scenario'}, ${JSON.stringify(inputs)}, ${is_default ?? false})
      RETURNING id, name, is_default, created_at, updated_at
    `;
    return NextResponse.json(rows[0]);
  } catch (err) {
    console.error('POST /api/scenarios error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const userId = getUserId(request);
  if (!userId) return NextResponse.json({ error: 'Missing x-user-id header' }, { status: 400 });

  const sql = getDb();
  try {
    await ensureSchema(sql);
    const { searchParams } = new URL(request.url);
    const scenarioId = searchParams.get('id');
    if (!scenarioId) {
      return NextResponse.json({ error: 'Missing id query param' }, { status: 400 });
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

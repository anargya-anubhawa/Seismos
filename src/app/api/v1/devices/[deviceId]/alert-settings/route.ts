import { NextResponse } from 'next/server';
import { publicErrorMessage } from '@/lib/public-error';
import { rateLimit } from '@/lib/rate-limit';
import { validateQuakeRule } from '@/lib/quake/rule';
import { findDevice, updateDevice } from '@/lib/quake/store';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' };

/** `HH:MM` 24 jam, 00:00–23:59. */
const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;

interface QuietHoursInput {
  enabled?: unknown;
  startLocal?: unknown;
  endLocal?: unknown;
}

/**
 * Memperbarui pengaturan alert satu perangkat.
 *
 * Aturan yang tidak dapat diubah dari klien: ambang magnitudo. Web memakai konstanta
 * `ALERT_MIN_MAGNITUDE = 5` (`src/lib/alerts.ts`); menjadikannya bisa diatur akan membuat
 * Android menyimpang dari web tanpa keputusan produk.
 *
 * `quietHours` adalah fitur baru (D-021): hanya membungkam suara/getar di perangkat,
 * tidak pernah menahan notifikasi, sehingga gempa penting tetap tercatat dan terlihat.
 */
export async function PATCH(
  request: Request,
  context: { params: { deviceId: string } },
) {
  const limited = rateLimit(request, { name: 'v1-alert-settings', limit: 60, windowMs: 600_000 });
  if (limited) return limited;

  const deviceId = context.params.deviceId;
  const device = await findDevice(deviceId);
  if (!device) {
    return NextResponse.json({ error: 'Perangkat tidak terdaftar' }, { status: 404, headers: NO_STORE });
  }

  const declaredLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > 4000) {
    return NextResponse.json({ error: 'Body permintaan terlalu besar' }, { status: 413, headers: NO_STORE });
  }

  let body: { quake?: unknown; quietHours?: QuietHoursInput };
  try {
    body = await request.json() as typeof body;
  } catch {
    return NextResponse.json({ error: 'Body JSON tidak valid' }, { status: 400, headers: NO_STORE });
  }

  const parsed = body.quake === undefined
    ? { rule: { ...device.quake }, error: null as string | null }
    : validateQuakeRule(body.quake);
  if (!parsed.rule) {
    return NextResponse.json({ error: parsed.error ?? 'Pengaturan gempa tidak valid' }, { status: 400, headers: NO_STORE });
  }

  const enabled = body.quake && typeof body.quake === 'object'
    ? (body.quake as { enabled?: unknown }).enabled
    : undefined;
  if (enabled !== undefined && typeof enabled !== 'boolean') {
    return NextResponse.json({ error: 'Nilai enabled harus boolean' }, { status: 400, headers: NO_STORE });
  }

  const quiet = body.quietHours;
  if (quiet !== undefined) {
    if (!quiet || typeof quiet !== 'object') {
      return NextResponse.json({ error: 'Pengaturan jam tenang tidak valid' }, { status: 400, headers: NO_STORE });
    }
    if (quiet.enabled !== undefined && typeof quiet.enabled !== 'boolean') {
      return NextResponse.json({ error: 'Nilai jam tenang harus boolean' }, { status: 400, headers: NO_STORE });
    }
    for (const key of ['startLocal', 'endLocal'] as const) {
      const value = quiet[key];
      if (value !== undefined && (typeof value !== 'string' || !CLOCK.test(value))) {
        return NextResponse.json({ error: 'Format jam harus HH:MM' }, { status: 400, headers: NO_STORE });
      }
    }
  }

  try {
    const updated = await updateDevice(deviceId, (current) => ({
      ...current,
      quakeEnabled: typeof enabled === 'boolean' ? enabled : current.quakeEnabled,
      quake: parsed.rule!,
      quietHours: quiet
        ? {
          enabled: quiet.enabled === true ? true : quiet.enabled === false ? false : current.quietHours.enabled,
          startLocal: typeof quiet.startLocal === 'string' ? quiet.startLocal : current.quietHours.startLocal,
          endLocal: typeof quiet.endLocal === 'string' ? quiet.endLocal : current.quietHours.endLocal,
        }
        : current.quietHours,
    }));
    if (!updated) {
      return NextResponse.json({ error: 'Perangkat tidak terdaftar' }, { status: 404, headers: NO_STORE });
    }
    return NextResponse.json(
      {
        ok: true,
        alertSettings: {
          quake: { enabled: updated.quakeEnabled, ...updated.quake },
          quietHours: updated.quietHours,
        },
      },
      { headers: NO_STORE },
    );
  } catch (error) {
    return NextResponse.json(
      { error: publicErrorMessage(error, 'Pengaturan gagal disimpan (kesalahan tidak dikenal).') },
      { status: 500, headers: NO_STORE },
    );
  }
}

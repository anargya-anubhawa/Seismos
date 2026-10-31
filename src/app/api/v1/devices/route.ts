import { NextResponse } from 'next/server';
import { publicErrorMessage } from '@/lib/public-error';
import { rateLimit } from '@/lib/rate-limit';
import { fcmConfigured } from '@/lib/quake/fcm';
import { upsertDevice } from '@/lib/quake/store';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' };

/** UUID v4 yang dibuat klien. Dibatasi bentuknya agar tidak bisa dipakai menulis path. */
const DEVICE_ID = /^[A-Za-z0-9-]{16,64}$/;

interface Body {
  deviceId?: unknown;
  fcmToken?: unknown;
  platform?: unknown;
  appVersion?: unknown;
  locale?: unknown;
}

/**
 * Mendaftarkan atau memperbarui token FCM satu perangkat (idempoten).
 *
 * Web tidak punya padanannya: notifikasi web memakai Web Push (VAPID) dengan
 * `endpoint`, bukan token. Kontrak lengkap ada di docs/STAGE_5_PUSH_CONTRACT.md §4.1.
 *
 * Bila kredensial FCM server belum diisi, endpoint tetap menerima pendaftaran (sehingga
 * pengguna tidak melihat galat yang membingungkan) tetapi menjawab `fcmConfigured: false`
 * agar aplikasi dapat menyampaikan status sebenarnya.
 */
export async function POST(request: Request) {
  const limited = rateLimit(request, { name: 'v1-devices', limit: 30, windowMs: 600_000 });
  if (limited) return limited;

  const declaredLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > 4000) {
    return NextResponse.json({ error: 'Body permintaan terlalu besar' }, { status: 413, headers: NO_STORE });
  }

  let body: Body;
  try {
    body = await request.json() as Body;
  } catch {
    return NextResponse.json({ error: 'Body JSON tidak valid' }, { status: 400, headers: NO_STORE });
  }

  const deviceId = typeof body.deviceId === 'string' ? body.deviceId.trim() : '';
  if (!DEVICE_ID.test(deviceId)) {
    return NextResponse.json({ error: 'deviceId tidak valid' }, { status: 400, headers: NO_STORE });
  }

  const fcmToken = typeof body.fcmToken === 'string' ? body.fcmToken.trim() : '';
  // Token FCM panjangnya ~150–250 karakter; batas longgar agar tidak rapuh.
  if (fcmToken.length < 20 || fcmToken.length > 4096 || /[\s]/.test(fcmToken)) {
    return NextResponse.json({ error: 'Token FCM tidak valid' }, { status: 400, headers: NO_STORE });
  }

  if (body.platform !== undefined && body.platform !== 'android') {
    return NextResponse.json({ error: 'Platform tidak didukung' }, { status: 400, headers: NO_STORE });
  }

  try {
    const device = await upsertDevice({
      deviceId,
      fcmToken,
      appVersion: typeof body.appVersion === 'string' ? body.appVersion.slice(0, 40) : null,
      locale: typeof body.locale === 'string' ? body.locale.slice(0, 20) : null,
    });

    return NextResponse.json(
      {
        ok: true,
        deviceId: device.deviceId,
        fcmConfigured: fcmConfigured(),
        alertSettings: {
          quake: { enabled: device.quakeEnabled, ...device.quake },
          quietHours: device.quietHours,
        },
      },
      { headers: NO_STORE },
    );
  } catch (error) {
    return NextResponse.json(
      { error: publicErrorMessage(error, 'Pendaftaran perangkat gagal (kesalahan tidak dikenal).') },
      { status: 500, headers: NO_STORE },
    );
  }
}

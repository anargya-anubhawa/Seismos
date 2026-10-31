import { NextResponse } from 'next/server';
import { publicErrorMessage } from '@/lib/public-error';
import { rateLimit } from '@/lib/rate-limit';
import { readFcmCredentials, sendToDevice } from '@/lib/quake/fcm';
import { findDevice, updateDevice } from '@/lib/quake/store';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' };
const TEST_COOLDOWN_MS = 30_000;
const testTimes = new Map<string, number>();

/**
 * Mengirim satu notifikasi uji ke perangkat. Pola sama dengan
 * `POST /api/tsunami/push/test` (batas 5 per 10 menit, cooldown 30 detik per perangkat).
 *
 * Ini satu-satunya jalan bagi pengguna untuk memverifikasi bahwa push benar-benar sampai
 * saat aplikasi tertutup — tanpa ini, "notifikasi berfungsi" hanya klaim.
 */
export async function POST(
  request: Request,
  context: { params: { deviceId: string } },
) {
  const limited = rateLimit(request, { name: 'v1-device-test', limit: 5, windowMs: 600_000 });
  if (limited) return limited;

  const deviceId = context.params.deviceId;
  const device = await findDevice(deviceId);
  if (!device || device.revokedAt || !device.fcmToken) {
    return NextResponse.json({ error: 'Perangkat tidak terdaftar' }, { status: 404, headers: NO_STORE });
  }

  const last = testTimes.get(deviceId) ?? 0;
  if (Date.now() - last < TEST_COOLDOWN_MS) {
    return NextResponse.json(
      { error: 'Tunggu sebentar sebelum mengirim tes lagi' },
      { status: 429, headers: { ...NO_STORE, 'Retry-After': '30' } },
    );
  }

  const credentials = readFcmCredentials();
  if (!credentials) {
    return NextResponse.json(
      { error: 'Notifikasi push server belum dikonfigurasi' },
      { status: 503, headers: NO_STORE },
    );
  }

  testTimes.set(deviceId, Date.now());
  try {
    const sent = await sendToDevice(credentials, {
      token: device.fcmToken,
      data: {
        kind: 'earthquake-test',
        // EventId kosong: aplikasi menampilkan pesan uji, bukan membuka detail.
        eventId: '',
        channelId: 'seismos_earthquake_info',
        severity: 'minor',
      },
      priority: 'normal',
      ttlSeconds: 300,
      collapseKey: 'seismos-quake-test',
    });

    if (sent.unregistered) {
      await updateDevice(deviceId, (current) => ({
        ...current,
        revokedAt: new Date().toISOString(),
      }));
      return NextResponse.json(
        { error: 'Token perangkat sudah tidak berlaku; aktifkan ulang notifikasi' },
        { status: 404, headers: NO_STORE },
      );
    }
    if (!sent.ok) {
      return NextResponse.json(
        { error: publicErrorMessage(sent.error, 'Notifikasi uji gagal dikirim') },
        { status: 502, headers: NO_STORE },
      );
    }
    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  } catch (error) {
    return NextResponse.json(
      { error: publicErrorMessage(error, 'Notifikasi uji gagal dikirim') },
      { status: 502, headers: NO_STORE },
    );
  }
}

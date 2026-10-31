/**
 * Pengirim FCM HTTP v1 — tanpa dependensi tambahan.
 *
 * `package.json` web tidak memuat `google-auth-library`/`firebase-admin`, dan
 * menambahkannya hanya untuk menandatangani satu JWT tidak sepadan. FCM HTTP v1
 * membutuhkan OAuth2 service account dengan grant `urn:ietf:params:oauth:grant-type:jwt-bearer`,
 * dan itu dapat dibuat dengan `node:crypto` (RS256) dalam ~30 baris.
 *
 * ## Keamanan kredensial
 * Kunci privat HANYA dibaca dari environment oleh proses server. Berkas ini tidak pernah
 * menuliskan nilainya ke log, ke respons, atau ke berkas data. Pesan galat yang keluar
 * disaring lewat `publicErrorMessage` di lapisan route, dan di sini pun tidak pernah
 * menyertakan kunci.
 *
 * ## Batasan yang disengaja
 * Tidak ada retry otomatis di sini: pemanggil (monitor) yang menyimpan status percobaan.
 * Mengulang di dua lapisan membuat notifikasi ganda saat jaringan tidak stabil.
 */

import { createSign } from 'node:crypto';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
const TOKEN_LIFETIME_SEC = 3600;

export interface FcmCredentials {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

function base64url(input: Buffer | string): string {
  const buffer = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Membaca kredensial dari environment. `FCM_PRIVATE_KEY` sering diisi dengan `\n`
 * literal (satu baris), jadi diubah menjadi baris baru sungguhan.
 *
 * Mengembalikan `null` bila belum dikonfigurasi — pemanggil WAJIB memperlakukan ini
 * sebagai "fitur nonaktif", bukan sebagai galat yang membuat seluruh server gagal.
 */
export function readFcmCredentials(): FcmCredentials | null {
  const projectId = (process.env.FCM_PROJECT_ID ?? '').trim();
  const clientEmail = (process.env.FCM_CLIENT_EMAIL ?? '').trim();
  const rawKey = process.env.FCM_PRIVATE_KEY ?? '';
  if (!projectId || !clientEmail || !rawKey.trim()) return null;
  return {
    projectId,
    clientEmail,
    privateKey: rawKey.replace(/\\n/g, '\n'),
  };
}

export function fcmConfigured(): boolean {
  return readFcmCredentials() !== null;
}

/** Klaim JWT untuk penukaran token OAuth2. Diekspor agar dapat diuji tanpa jaringan. */
export function buildJwtClaims(
  credentials: FcmCredentials,
  issuedAtSec: number,
): Record<string, unknown> {
  return {
    iss: credentials.clientEmail,
    scope: FCM_SCOPE,
    aud: TOKEN_URL,
    iat: issuedAtSec,
    exp: issuedAtSec + TOKEN_LIFETIME_SEC,
  };
}

/**
 * Menandatangani assertion JWT RS256.
 * `node:crypto` menandatangani dengan SHA-256; header/kepala klaim memakai base64url.
 */
export function signJwt(
  credentials: FcmCredentials,
  issuedAtSec: number,
): string {
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64url(JSON.stringify(buildJwtClaims(credentials, issuedAtSec)));
  const signingInput = `${header}.${payload}`;
  const signer = createSign('RSA-SHA256');
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign(credentials.privateKey);
  return `${signingInput}.${base64url(signature)}`;
}

interface CachedToken {
  accessToken: string;
  expiresAtMs: number;
}

let cached: CachedToken | null = null;

/**
 * Menukar assertion dengan access token. Di-cache sampai 60 detik sebelum kedaluwarsa
 * supaya satu siklus monitor mengirim banyak pesan dengan satu token.
 */
export async function getAccessToken(
  credentials: FcmCredentials,
  fetchImpl: typeof fetch = fetch,
  nowMs: number = Date.now(),
): Promise<string> {
  if (cached && cached.expiresAtMs - 60_000 > nowMs) return cached.accessToken;

  const assertion = signJwt(credentials, Math.floor(nowMs / 1000));
  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion,
  });

  const response = await fetchImpl(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!response.ok) {
    // Jangan sertakan body respons: bisa memuat detail akun.
    throw new Error(`Penukaran token FCM gagal (HTTP ${response.status})`);
  }
  const json = await response.json() as { access_token?: unknown; expires_in?: unknown };
  if (typeof json.access_token !== 'string' || !json.access_token) {
    throw new Error('Token FCM tidak diterima');
  }
  const ttl = typeof json.expires_in === 'number' && Number.isFinite(json.expires_in)
    ? json.expires_in
    : TOKEN_LIFETIME_SEC;
  cached = { accessToken: json.access_token, expiresAtMs: nowMs + ttl * 1000 };
  return cached.accessToken;
}

/** Hanya untuk tes. */
export function resetTokenCache(): void {
  cached = null;
}

export interface FcmMessage {
  token: string;
  data: Record<string, string>;
  /** `high` untuk alert penting; `normal` selebihnya. */
  priority: 'high' | 'normal';
  /** Detik; pesan kedaluwarsa setelah ini agar notifikasi lama tidak muncul belakangan. */
  ttlSeconds: number;
  collapseKey: string;
}

export function buildFcmRequestBody(message: FcmMessage): Record<string, unknown> {
  return {
    message: {
      token: message.token,
      data: message.data,
      android: {
        priority: message.priority,
        ttl: `${message.ttlSeconds}s`,
        collapse_key: message.collapseKey,
        // Payload data-only: aplikasi yang memutuskan channel, deep link, dan suara.
        // Tanpa blok `notification`, FirebaseMessagingService selalu menerima pesan
        // bahkan saat aplikasi di latar belakang.
      },
    },
  };
}

export interface SendResult {
  ok: boolean;
  /** Kode HTTP FCM, atau `null` bila gagal sebelum jaringan. */
  status: number | null;
  /**
   * True bila token pasti tidak berlaku lagi (`UNREGISTERED`/`INVALID_ARGUMENT`), sehingga
   * perangkat harus dihapus dari penyimpanan.
   */
  unregistered: boolean;
  error: string | null;
}

/**
 * Mengirim satu pesan. Tidak melempar: hasil selalu dikembalikan agar pemanggil dapat
 * mencatat kegagalan per perangkat tanpa menghentikan pengiriman ke perangkat lain.
 */
export async function sendToDevice(
  credentials: FcmCredentials,
  message: FcmMessage,
  fetchImpl: typeof fetch = fetch,
): Promise<SendResult> {
  let accessToken: string;
  try {
    accessToken = await getAccessToken(credentials, fetchImpl);
  } catch (error) {
    return {
      ok: false,
      status: null,
      unregistered: false,
      error: error instanceof Error ? error.message : 'Token FCM tidak dapat diperoleh',
    };
  }

  const url = `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(credentials.projectId)}/messages:send`;
  try {
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(buildFcmRequestBody(message)),
    });
    if (response.ok) return { ok: true, status: response.status, unregistered: false, error: null };

    const text = await response.text().catch(() => '');
    // FCM menandai token mati dengan 404/`UNREGISTERED` atau 400/`INVALID_ARGUMENT`.
    const unregistered = response.status === 404
      || (response.status === 400 && /UNREGISTERED|INVALID_ARGUMENT/.test(text));
    return {
      ok: false,
      status: response.status,
      unregistered,
      // Pesan FCM dipakai untuk log server, tidak pernah dikirim ke pengguna.
      error: `FCM membalas HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      ok: false,
      status: null,
      unregistered: false,
      error: error instanceof Error ? error.message : 'Pengiriman FCM gagal',
    };
  }
}

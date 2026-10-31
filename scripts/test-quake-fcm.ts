import './test-alias';
import assert from 'node:assert/strict';
import test from 'node:test';
import { generateKeyPairSync, createVerify, randomBytes } from 'node:crypto';
import {
  buildJwtClaims, signJwt, buildFcmRequestBody, sendToDevice, resetTokenCache,
  readFcmCredentials, fcmConfigured, type FcmCredentials,
} from '../src/lib/quake/fcm';

/**
 * Kunci uji dibuat di memori pada setiap proses.
 * TIDAK ADA kredensial nyata di berkas ini, dan tidak ada yang ditulis ke disk.
 */
function testCredentials(): FcmCredentials {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  return {
    projectId: 'uji-proyek',
    clientEmail: 'uji@uji-proyek.iam.gserviceaccount.com',
    privateKey: pem,
  };
}

test('klaim JWT sesuai kontrak OAuth2 service account', () => {
  const credentials = testCredentials();
  const claims = buildJwtClaims(credentials, 1_700_000_000);
  assert.equal(claims.iss, credentials.clientEmail);
  assert.equal(claims.scope, 'https://www.googleapis.com/auth/firebase.messaging');
  assert.equal(claims.aud, 'https://oauth2.googleapis.com/token');
  assert.equal(claims.iat, 1_700_000_000);
  assert.equal(claims.exp, 1_700_000_000 + 3600);
});

test('JWT bertanda tangan RS256 dan dapat diverifikasi kunci publiknya', () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const credentials: FcmCredentials = {
    projectId: 'p',
    clientEmail: 'e@x.iam.gserviceaccount.com',
    privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
  };
  const jwt = signJwt(credentials, 1_700_000_000);
  const parts = jwt.split('.');
  assert.equal(parts.length, 3);

  const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
  assert.equal(header.alg, 'RS256');
  assert.equal(header.typ, 'JWT');

  const verifier = createVerify('RSA-SHA256');
  verifier.update(`${parts[0]}.${parts[1]}`);
  verifier.end();
  assert.equal(
    verifier.verify(publicKey, Buffer.from(parts[2], 'base64url')),
    true,
    'tanda tangan harus valid',
  );

  // Klaim di dalam token harus sama dengan yang dibangun.
  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
  assert.equal(payload.iss, credentials.clientEmail);
});

test('JWT tidak memuat kunci privat', () => {
  const credentials = testCredentials();
  const jwt = signJwt(credentials, 1_700_000_000);
  assert.equal(jwt.includes('PRIVATE KEY'), false);
  assert.equal(jwt.includes(credentials.privateKey.slice(30, 60)), false);
});

test('tanpa env, kredensial dianggap belum ada (bukan galat)', () => {
  const saved = {
    project: process.env.FCM_PROJECT_ID,
    email: process.env.FCM_CLIENT_EMAIL,
    key: process.env.FCM_PRIVATE_KEY,
  };
  delete process.env.FCM_PROJECT_ID;
  delete process.env.FCM_CLIENT_EMAIL;
  delete process.env.FCM_PRIVATE_KEY;
  assert.equal(readFcmCredentials(), null);
  assert.equal(fcmConfigured(), false);

  process.env.FCM_PROJECT_ID = 'p';
  process.env.FCM_CLIENT_EMAIL = 'e@x';
  process.env.FCM_PRIVATE_KEY = 'a\\nb';
  const parsed = readFcmCredentials();
  assert.equal(parsed?.privateKey, 'a\nb', '\\n literal diubah menjadi baris baru');
  assert.equal(fcmConfigured(), true);

  // Pulihkan environment agar tes lain tidak terpengaruh.
  for (const [key, value] of Object.entries({'FCM_PROJECT_ID': saved.project, 'FCM_CLIENT_EMAIL': saved.email, 'FCM_PRIVATE_KEY': saved.key})) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test('body pesan FCM data-only tanpa blok notification', () => {
  const body = buildFcmRequestBody({
    token: 'tok',
    data: { kind: 'earthquake', eventId: 'k' },
    priority: 'high',
    ttlSeconds: 3600,
    collapseKey: 'quake-k',
  }) as { message: Record<string, unknown> };
  assert.equal(body.message.token, 'tok');
  assert.deepEqual(body.message.data, { kind: 'earthquake', eventId: 'k' });
  assert.equal('notification' in body.message, false, 'data-only: aplikasi yang menentukan tampilan');
  const android = body.message.android as Record<string, unknown>;
  assert.equal(android.priority, 'high');
  assert.equal(android.ttl, '3600s');
  assert.equal(android.collapse_key, 'quake-k');
});

test('pengiriman gagal dilaporkan, tidak melempar', async () => {
  resetTokenCache();
  const credentials = testCredentials();
  const fakeFetch = (async () => new Response('{}', { status: 500 })) as unknown as typeof fetch;
  const result = await sendToDevice(credentials, {
    token: 't', data: {}, priority: 'normal', ttlSeconds: 60, collapseKey: 'c',
  }, fakeFetch);
  assert.equal(result.ok, false);
  assert.equal(result.unregistered, false);
  assert.match(result.error ?? '', /Penukaran token|HTTP/);
});

test('token mati ditandai unregistered agar perangkat dihapus', async () => {
  resetTokenCache();
  const credentials = testCredentials();
  let call = 0;
  const fakeFetch = (async (url: string) => {
    call++;
    if (String(url).includes('oauth2')) {
      return new Response(JSON.stringify({ access_token: 'a', expires_in: 3600 }), { status: 200 });
    }
    return new Response(JSON.stringify({
      error: { status: 'NOT_FOUND', details: [{ errorCode: 'UNREGISTERED' }] },
    }), { status: 404 });
  }) as unknown as typeof fetch;

  const result = await sendToDevice(credentials, {
    token: 't', data: {}, priority: 'high', ttlSeconds: 60, collapseKey: 'c',
  }, fakeFetch);
  assert.equal(result.ok, false);
  assert.equal(result.unregistered, true);
  assert.equal(call, 2, 'satu penukaran token + satu kirim');
});

test('pesan diterima saat FCM membalas 200', async () => {
  resetTokenCache();
  const credentials = testCredentials();
  const fakeFetch = (async (url: string) => {
    if (String(url).includes('oauth2')) {
      return new Response(JSON.stringify({ access_token: 'a', expires_in: 3600 }), { status: 200 });
    }
    return new Response(JSON.stringify({ name: 'projects/p/messages/1' }), { status: 200 });
  }) as unknown as typeof fetch;
  const result = await sendToDevice(credentials, {
    token: 't', data: { kind: 'earthquake' }, priority: 'high', ttlSeconds: 60, collapseKey: 'c',
  }, fakeFetch);
  assert.equal(result.ok, true);
  assert.equal(result.error, null);
});

test('galat penukaran token tidak membocorkan isi respons', async () => {
  resetTokenCache();
  const credentials = testCredentials();
  const secret = randomBytes(8).toString('hex');
  const fakeFetch = (async () => new Response(`{"error":"invalid_grant","detail":"${secret}"}`, { status: 400 })) as unknown as typeof fetch;
  const result = await sendToDevice(credentials, {
    token: 't', data: {}, priority: 'normal', ttlSeconds: 60, collapseKey: 'c',
  }, fakeFetch);
  assert.equal(result.ok, false);
  assert.equal((result.error ?? '').includes(secret), false, 'isi respons tidak boleh bocor ke pesan');
});

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  describeRejectedPushEndpoint,
  isAllowedPushHost,
  isLoopbackHostname,
  validateVapidKeys,
} from '../src/lib/push-endpoint';

/* ------------------------------------------------------- host allowlist --- */
// OI-02 / F-10: endpoint langganan hanya boleh menunjuk layanan push sah.

test('host layanan push yang sah diterima', () => {
  for (const host of [
    'fcm.googleapis.com',
    'updates.push.services.mozilla.com',
    'web.push.apple.com',
    'wns2-abc123.notify.windows.com',
    'FCM.GOOGLEAPIS.COM',
  ]) {
    assert.equal(isAllowedPushHost(host), true, `${host} seharusnya diizinkan`);
  }
});

test('host sembarang ditolak', () => {
  for (const host of [
    'evil.example',
    'fcm.googleapis.com.evil.example',
    'evil-fcm.googleapis.com',
    'notify.windows.com.evil.example',
    'localhost',
    '127.0.0.1',
  ]) {
    assert.equal(isAllowedPushHost(host), false, `${host} seharusnya ditolak`);
  }
});

test('loopback dikenali terpisah dari allowlist', () => {
  for (const host of ['localhost', '127.0.0.1', '::1', '[::1]', 'LOCALHOST']) {
    assert.equal(isLoopbackHostname(host), true, `${host} seharusnya loopback`);
  }
  assert.equal(isLoopbackHostname('fcm.googleapis.com'), false);
});

test('endpoint sah lolos tanpa alasan penolakan', () => {
  assert.equal(describeRejectedPushEndpoint('https://fcm.googleapis.com/fcm/send/abc'), null);
  assert.equal(
    describeRejectedPushEndpoint('https://updates.push.services.mozilla.com/wpush/v2/xyz'),
    null,
  );
  // Loopback diizinkan untuk pengembangan, termasuk http.
  assert.equal(describeRejectedPushEndpoint('http://localhost:3000/push'), null);
  assert.equal(describeRejectedPushEndpoint('http://127.0.0.1/push'), null);
});

test('endpoint yang ditolak memberi alasan yang berguna', () => {
  assert.match(String(describeRejectedPushEndpoint('https://evil.example/x')), /allowlist/);
  assert.match(String(describeRejectedPushEndpoint('http://fcm.googleapis.com/x')), /protokol/);
  assert.match(String(describeRejectedPushEndpoint('bukan-url')), /URL/);
  // Subdomain palsu tidak boleh lolos hanya karena mengandung nama sah.
  assert.match(
    String(describeRejectedPushEndpoint('https://fcm.googleapis.com.evil.example/x')),
    /allowlist/,
  );
});

/* ------------------------------------------------------------ VAPID keys - */
// OI-13 / F-14: pemeriksaan panjang saja tidak cukup.

// Kunci uji tetap, dibuat dengan web-push.generateVAPIDKeys(). Bukan rahasia
// produksi dan tidak pernah dipakai server; hanya untuk menguji validasi.
const VALID_PUBLIC =
  'BJIk4v3ojw1sMkSUqJcx1VcnzsFSFGQVSnfKYlzXFEMrEJ09Jxm6-Z7sg-xBkaPrhrj2cfwuJRMehwoU9Tlk_mQ';
const VALID_PRIVATE = 'siQ63bHggpRxeqDJsfwTtKWeVChq-6Ml34FYEALh7SE';

test('pasangan kunci VAPID yang sah diterima', () => {
  const result = validateVapidKeys(VALID_PUBLIC, VALID_PRIVATE);
  assert.ok('publicKey' in result, 'kunci sah seharusnya diterima');
  if ('publicKey' in result) {
    assert.equal(result.publicKey, VALID_PUBLIC);
    assert.equal(result.privateKey, VALID_PRIVATE);
  }
});

test('kunci kosong ditolak', () => {
  assert.match(String((validateVapidKeys(undefined, undefined) as { error: string }).error), /kosong/);
  assert.match(String((validateVapidKeys('  ', VALID_PRIVATE) as { error: string }).error), /kosong/);
});

test('kunci sepanjang wajar tetapi tidak sah ditolak (regresi F-14)', () => {
  // Inilah kasus yang lolos sebelum OI-13: 87 & 43 karakter, panjang benar,
  // tetapi bukan titik P-256 dan bukan kunci privat 32 byte.
  const pseudoPublic = 'A'.repeat(87);
  const pseudoPrivate = 'B'.repeat(43);

  const result = validateVapidKeys(pseudoPublic, pseudoPrivate);
  assert.ok('error' in result, 'kunci palsu seharusnya ditolak');
  if ('error' in result) assert.match(result.error, /P-256|65 byte|32 byte/);
});

test('kunci publik yang bukan titik tanpa kompresi ditolak', () => {
  // 65 byte, base64url sah, tetapi byte pertama bukan 0x04.
  const wrongPrefix = Buffer.alloc(65, 0x01).toString('base64url');
  const result = validateVapidKeys(wrongPrefix, VALID_PRIVATE);
  assert.match(String((result as { error: string }).error), /P-256/);
});

test('panjang kunci yang salah ditolak dengan menyebut jumlah byte', () => {
  const shortPublic = Buffer.alloc(64, 0x04).toString('base64url');
  const result = validateVapidKeys(shortPublic, VALID_PRIVATE);
  assert.match(String((result as { error: string }).error), /65 byte/);

  const shortPrivate = Buffer.alloc(16, 0x02).toString('base64url');
  const result2 = validateVapidKeys(VALID_PUBLIC, shortPrivate);
  assert.match(String((result2 as { error: string }).error), /32 byte/);
});

test('kunci yang bukan base64url ditolak', () => {
  const result = validateVapidKeys('bukan base64 url!', VALID_PRIVATE);
  assert.match(String((result as { error: string }).error), /base64url/);
});

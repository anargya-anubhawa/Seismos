import './test-alias';
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  mkdtempSync, rmSync, readFileSync, statSync, existsSync, readdirSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

/**
 * Direktori data HARUS diset sebelum modul store diimpor, karena `QUAKE_DATA_DIR` dibaca
 * saat modul dimuat. Setiap proses tes memakai direktori sendiri agar tidak saling ganggu.
 */
const DATA_DIR = mkdtempSync(path.join(tmpdir(), 'seismos-quake-test-'));
process.env.QUAKE_DATA_DIR = DATA_DIR;

import {
  loadDevices, upsertDevice, updateDevice, removeDevice, revokeDevices, findDevice,
  loadMonitorState, saveMonitorState, emptyMonitorState, storageWarning,
} from '../src/lib/quake/store';
import { runQuakeCheck, buildQuakePayload, devicesFor } from '../src/lib/quake/monitor';

test.after(() => {
  rmSync(DATA_DIR, { recursive: true, force: true });
});

const TOKEN = 'tok-abcdefghijklmnopqrstuvwxyz012345';

test('penyimpanan tersedia di direktori sementara', () => {
  assert.equal(storageWarning(), null);
});

test('pendaftaran perangkat idempoten', async () => {
  const a = await upsertDevice({ deviceId: 'dev-aaaaaaaaaaaaaaaa', fcmToken: TOKEN, appVersion: '1.0.0', locale: 'id-ID' });
  const b = await upsertDevice({ deviceId: 'dev-aaaaaaaaaaaaaaaa', fcmToken: TOKEN, appVersion: '1.0.1', locale: 'id-ID' });
  assert.equal(a.deviceId, b.deviceId);
  const devices = await loadDevices();
  assert.equal(devices.filter((d) => d.deviceId === 'dev-aaaaaaaaaaaaaaaa').length, 1);
  assert.equal(devices[0].appVersion, '1.0.1');
});

test('default pengaturan = penting + seluruh Indonesia, sama seperti web', async () => {
  const device = await findDevice('dev-aaaaaaaaaaaaaaaa');
  assert.ok(device);
  assert.equal(device!.quakeEnabled, true);
  assert.equal(device!.quake.scope, 'important');
  assert.equal(device!.quake.area, 'indonesia');
  assert.equal(device!.quietHours.enabled, false);
});

test('token yang sama pada perangkat lain dipindahkan ke pemilik terbaru', async () => {
  const SHARED = 'tok-shared00000000000000000000000';
  // Dua deviceId berbeda melaporkan token yang SAMA. Ini terjadi sungguhan: pengguna
  // memasang ulang aplikasi (deviceId baru) tanpa Firebase sempat mencabut token lama.
  // FCM hanya boleh mengirim ke satu pemilik token, kalau tidak satu ponsel menerima
  // notifikasi ganda untuk setiap gempa.
  await upsertDevice({ deviceId: 'dev-bbbbbbbbbbbbbbbb', fcmToken: SHARED, appVersion: '1.0.0', locale: null });
  await upsertDevice({ deviceId: 'dev-cccccccccccccccc', fcmToken: SHARED, appVersion: '1.0.0', locale: null });

  const devices = await loadDevices();
  const withToken = devices.filter((d) => d.fcmToken === SHARED);
  assert.equal(withToken.length, 1, 'satu token hanya boleh milik satu perangkat');
  assert.equal(withToken[0].deviceId, 'dev-cccccccccccccccc', 'pemilik terbaru yang menyimpan token');

  // Perangkat lama tidak dihapus, hanya dicabut — jejaknya tetap ada untuk audit.
  const old = await findDevice('dev-bbbbbbbbbbbbbbbb');
  assert.ok(old, 'catatan perangkat lama tetap ada');
  assert.ok(old!.revokedAt, 'perangkat lama harus dicabut');
});

test('berkas perangkat ditulis dengan izin 0600', async () => {
  const file = path.join(DATA_DIR, 'devices.json');
  assert.ok(existsSync(file));
  const mode = statSync(file).mode & 0o777;
  assert.equal(mode, 0o600, `izin berkas harus 0600, dapat ${mode.toString(8)}`);
});

test('berkas perangkat memuat semua perangkat terdaftar', async () => {
  const raw = JSON.parse(readFileSync(path.join(DATA_DIR, 'devices.json'), 'utf8'));
  assert.ok(Array.isArray(raw));
  assert.ok(raw.some((d: { deviceId: string }) => d.deviceId === 'dev-aaaaaaaaaaaaaaaa'));
});

test('pengaturan alert dapat diubah dan disimpan', async () => {
  const updated = await updateDevice('dev-aaaaaaaaaaaaaaaa', (d) => ({
    ...d,
    quake: { ...d.quake, area: 'radius', radiusKm: 100, centerLat: -6.2, centerLon: 106.85 },
    quietHours: { enabled: true, startLocal: '22:00', endLocal: '06:00' },
  }));
  assert.ok(updated);
  const reloaded = await findDevice('dev-aaaaaaaaaaaaaaaa');
  assert.equal(reloaded!.quake.area, 'radius');
  assert.equal(reloaded!.quake.radiusKm, 100);
  assert.equal(reloaded!.quietHours.enabled, true);
});

test('perangkat tak dikenal mengembalikan null, bukan membuat baru', async () => {
  assert.equal(await updateDevice('tidak-ada', (d) => d), null);
  assert.equal(await findDevice('tidak-ada'), null);
});

test('penghapusan idempoten', async () => {
  assert.equal(await removeDevice('dev-cccccccccccccccc'), true);
  assert.equal(await removeDevice('dev-cccccccccccccccc'), false);
});

test('pencabutan menandai, tidak menghapus', async () => {
  // Perangkat tersendiri: `dev-bbbbbbbbbbbbbbbb` sudah dicabut oleh uji token-duplikat di
  // atas, sehingga memakainya di sini hanya akan menguji "sudah dicabut" dua kali.
  await upsertDevice({
    deviceId: 'dev-dddddddddddddddd',
    fcmToken: 'tok-dddddddddddddddddddddddddddddd',
    appVersion: '1.0.0',
    locale: null,
  });

  const count = await revokeDevices(['dev-dddddddddddddddd']);
  assert.equal(count, 1);
  const device = await findDevice('dev-dddddddddddddddd');
  assert.ok(device, 'catatan tetap ada untuk audit');
  assert.ok(device!.revokedAt);
  // Pencabutan kedua tidak dihitung lagi.
  assert.equal(await revokeDevices(['dev-dddddddddddddddd']), 0);
});

test('perangkat tercabut bertahan saat dibaca ulang DAN tidak pernah jadi target', async () => {
  // Regresi: `normalizeDevice` dahulu menolak perangkat bertoken kosong, sehingga perangkat
  // yang dicabut HILANG pada pembacaan berikutnya. Jejak audit lenyap dan `revokeDevices`
  // tampak tidak pernah berhasil. Setelah diperbaiki, catatan harus bertahan.
  await upsertDevice({
    deviceId: 'dev-eeeeeeeeeeeeeeee',
    fcmToken: 'tok-eeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    appVersion: '1.0.0',
    locale: null,
  });
  await revokeDevices(['dev-eeeeeeeeeeeeeeee']);

  const survivors = (await loadDevices()).filter((d) => d.deviceId === 'dev-eeeeeeeeeeeeeeee');
  assert.equal(survivors.length, 1, 'perangkat tercabut harus tetap tersimpan');
  assert.equal(survivors[0].fcmToken, '', 'token dikosongkan agar tidak dipakai mengirim');
  assert.ok(survivors[0].revokedAt);

  // Yang paling penting: meski catatannya ada, ia tidak boleh menerima notifikasi.
  const targets = devicesFor(survivors, {
    id: 'e1',
    originTime: '2026-10-29T03:26:49Z',
    latitude: 0,
    longitude: 100,
    magnitude: 6,
    depthKm: 10,
    region: 'X',
    sources: ['terbaru'],
  });
  assert.equal(targets.length, 0, 'perangkat tercabut tidak boleh dikirimi');
});

test('berkas rusak disalin, bukan dihapus', async () => {
  const file = path.join(DATA_DIR, 'state.json');
  await saveMonitorState(emptyMonitorState());
  writeFileSync(file, '{ ini bukan json', 'utf8');
  const state = await loadMonitorState();
  assert.equal(state.known.length, 0, 'jatuh ke nilai bawaan');
  const backups = readdirSync(DATA_DIR).filter((f) => f.startsWith('state.corrupt-'));
  assert.equal(backups.length, 1, 'berkas rusak harus disalin untuk investigasi');
});

test('status monitor menyimpan known dan memangkasnya', async () => {
  const state = emptyMonitorState();
  state.known = Array.from({ length: 10 }, (_, i) => ({
    key: `k${i}`,
    originTime: '2026-10-29T03:26:49Z',
    latitude: 0,
    longitude: 100,
    magnitude: 5,
    fingerprint: `f${i}`,
    decidedAt: '2026-10-29T03:27:00Z',
  }));
  await saveMonitorState(state);
  const loaded = await loadMonitorState();
  assert.equal(loaded.known.length, 10);
  assert.equal(loaded.known[0].key, 'k0');
});

// ---------- runQuakeCheck: perilaku tanpa jaringan/kredensial ----------

test('siklus tanpa kredensial tidak mengklaim terkirim', async () => {
  const devices = await loadDevices();
  // Tidak ada kredensial → credentials null.
  const result = await runQuakeCheck('test', { force: true, credentials: null });
  assert.equal(result.ok, true);
  assert.equal(result.deliveries.length, 0);
  assert.ok(Array.isArray(result.candidates));
  // devices hanya dihitung bila ada kandidat; tidak boleh negatif.
  assert.ok(result.devices >= 0);
  void devices;
});

test('buildQuakePayload tidak menyertakan kredensial/token', () => {
  const payload = buildQuakePayload({
    id: 'e1',
    originTime: '2026-10-29T03:26:49Z',
    latitude: -5.45,
    longitude: 141.9,
    magnitude: 6,
    depthKm: 120,
    region: 'X',
    sources: ['terbaru'],
  }, true);
  const text = JSON.stringify(payload);
  assert.equal(text.includes('token'), false);
  assert.equal(text.includes('PRIVATE'), false);
});

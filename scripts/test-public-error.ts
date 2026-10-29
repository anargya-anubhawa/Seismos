import assert from 'node:assert/strict';
import test from 'node:test';
import { publicErrorMessage } from '../src/lib/public-error';

/* ---------------------------------------------------------- public-error -- */

test('pesan kesalahan layanan tetap diteruskan apa adanya', () => {
  const fallback = 'Data tidak dapat dimuat';
  for (const message of [
    'Sumber data membalas HTTP 503',
    'Waktu tunggu 8000 ms habis',
    'Respons sumber bukan JSON yang valid',
    'Daftar status gunung api MAGMA kosong atau bentuk respons tidak dikenali',
    'Alamat citra satelit tidak diizinkan',
  ]) {
    assert.equal(publicErrorMessage(new Error(message), fallback), message);
  }
});

test('pesan teknis runtime diganti kalimat umum', () => {
  const fallback = 'Data tidak dapat dimuat';
  const leaked = [
    'fetch failed',
    'getaddrinfo ENOTFOUND vsi.esdm.go.id',
    'connect ECONNREFUSED 10.1.2.3:443',
    "ENOENT: no such file or directory, open '/srv/seismos/.data/volcano/subscriptions.json'",
    'Cannot find module /app/node_modules/web-push/src/index.js',
    'Error: gagal\n    at loadState (/srv/seismos/.next/server/app.js:10:5)',
    'Gagal menghubungi http://127.0.0.1:3000/internal',
    'Kesalahan pada C:\\seismos\\data\\state.json',
  ];
  for (const message of leaked) {
    assert.equal(publicErrorMessage(new Error(message), fallback), fallback, `bocor: ${message}`);
  }
});

test('nilai non-Error dan pesan kosong memakai kalimat umum', () => {
  const fallback = 'Data tidak dapat dimuat';
  assert.equal(publicErrorMessage('string mentah', fallback), fallback);
  assert.equal(publicErrorMessage(null, fallback), fallback);
  assert.equal(publicErrorMessage(undefined, fallback), fallback);
  assert.equal(publicErrorMessage({ message: 'objek biasa' }, fallback), fallback);
  assert.equal(publicErrorMessage(new Error('   '), fallback), fallback);
});

test('pesan sangat panjang dipotong ke kalimat umum', () => {
  const fallback = 'Data tidak dapat dimuat';
  const long = `Sumber membalas isi tak terduga: ${'x'.repeat(500)}`;
  assert.equal(publicErrorMessage(new Error(long), fallback), fallback);
});

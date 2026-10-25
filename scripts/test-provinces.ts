import assert from 'node:assert/strict';
import test from 'node:test';
import { distanceKm, formatDistanceKm } from '../src/lib/geo';
import { PROVINCES, nearestProvince, provinceForPoint } from '../src/lib/provinces';

test('jarak Jakarta–Bandung berada di kisaran yang wajar', () => {
  const distance = distanceKm(
    { latitude: -6.2, longitude: 106.85 },
    { latitude: -6.917, longitude: 107.619 },
  );
  assert.ok(distance > 100 && distance < 140, `jarak ${distance} km`);
});

test('format jarak memakai satuan meter atau kilometer', () => {
  assert.equal(formatDistanceKm(0.45), '450 m');
  assert.equal(formatDistanceKm(4.25), '4,3 km');
  assert.equal(formatDistanceKm(123.4), '123 km');
});

test('provinsi terdekat dikenali dari koordinat kota', () => {
  assert.equal(provinceForPoint(-6.2, 106.85).name, 'DKI Jakarta');
  assert.equal(provinceForPoint(-6.917, 107.619).name, 'Jawa Barat');
  assert.equal(provinceForPoint(-8.65, 115.216).name, 'Bali');
  assert.equal(provinceForPoint(3.595, 98.672).name, 'Sumatera Utara');
});

test('daftar provinsi memuat 38 entri dengan ID unik', () => {
  assert.equal(PROVINCES.length, 38);
  assert.equal(new Set(PROVINCES.map((province) => province.id)).size, 38);
});

test('nearestProvince mengembalikan jarak ke titik pusat provinsi', () => {
  const nearest = nearestProvince({ latitude: -6.2, longitude: 106.85 });
  assert.equal(nearest.province.id, 'dki-jakarta');
  assert.ok(nearest.distanceKm >= 0 && nearest.distanceKm < 100);
});

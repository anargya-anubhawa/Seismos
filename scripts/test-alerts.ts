import assert from 'node:assert/strict';
import test from 'node:test';
import { ALERT_MIN_MAGNITUDE, isSignificantEarthquake } from '../src/lib/alerts';

test('gempa dengan magnitudo ambang dianggap penting', () => {
  assert.equal(isSignificantEarthquake({
    magnitude: ALERT_MIN_MAGNITUDE,
    feltReports: [],
    maxMmi: undefined,
  }), true);
});

test('gempa kecil yang dirasakan tetap dianggap penting', () => {
  assert.equal(isSignificantEarthquake({
    magnitude: 4.2,
    feltReports: [{ place: 'Kota Bengkulu', mmiMin: 3, mmiMax: 3, mmiLabel: 'III' }],
    maxMmi: 3,
  }), true);
});

test('getaran kecil tanpa laporan tidak dianggap penting', () => {
  assert.equal(isSignificantEarthquake({
    magnitude: 2.3,
    feltReports: [],
    maxMmi: undefined,
  }), false);
});

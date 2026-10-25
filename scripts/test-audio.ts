import assert from 'node:assert/strict';
import test from 'node:test';
import { RingBuffer } from '../src/lib/seismograph/buffer';
import {
  AUDIO_MAX_INTERVAL_MS, AUDIO_MIN_INTERVAL_MS, intervalFor, levelFor, peakGainFor, recentAmplitude,
} from '../src/lib/seismograph/audio';

test('amplitudo diambil dari jendela waktu terakhir', () => {
  const buffer = new RingBuffer(16);
  buffer.push(0, 0, 0, 0);
  buffer.push(100, 0.1, 0, 0);
  buffer.push(200, 0, 1, 0);
  buffer.push(300, 0.2, 0, 0);
  assert.equal(recentAmplitude(buffer, 150), 1);
  assert.equal(recentAmplitude(buffer, 50), 0.2);
});

test('getaran lebih kuat menghasilkan level lebih tinggi', () => {
  assert.equal(levelFor(0), 0);
  assert.ok(levelFor(0.5) > levelFor(0.1));
  assert.equal(levelFor(2), 1);
  assert.equal(levelFor(10), 1);
});

test('level tinggi mempercepat interval dan memperbesar gain', () => {
  assert.equal(intervalFor(0), AUDIO_MAX_INTERVAL_MS);
  assert.equal(intervalFor(1), AUDIO_MIN_INTERVAL_MS);
  assert.ok(intervalFor(1) < intervalFor(0.5));
  assert.ok(peakGainFor(1, 55) > peakGainFor(0.5, 55));
  assert.ok(peakGainFor(0.5, 100) > peakGainFor(0.5, 55));
});

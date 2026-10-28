import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LIVE_STREAMS, findLiveStream, liveStreamEmbedUrl, liveStreamThumbnail, liveStreamUrl,
} from '../src/lib/volcano/live';

/* ------------------------------------------------------------------- live -- */

test('katalog siaran langsung berisi video unik dengan ID YouTube yang sah', () => {
  const ids = new Set(LIVE_STREAMS.map((stream) => stream.videoId));
  assert.equal(ids.size, LIVE_STREAMS.length, 'ID video harus unik');
  for (const stream of LIVE_STREAMS) {
    // ID video YouTube 11 karakter; bentuk lain menandakan salah salin.
    assert.match(stream.videoId, /^[A-Za-z0-9_-]{11}$/, `ID tidak sah: ${stream.videoId}`);
    assert.ok(stream.volcano.length > 0);
    assert.ok(stream.channel.length > 0);
    assert.ok(stream.description.length > 80, `deskripsi terlalu pendek: ${stream.volcano}`);
    assert.ok(stream.watchingTips.length > 20);
    assert.match(stream.statusUrl, /^https:\/\/magma\.esdm\.go\.id\//);
  }
});

test('liveStreamUrl, embed, dan thumbnail menunjuk video yang sama', () => {
  const stream = LIVE_STREAMS[0];
  assert.equal(liveStreamUrl(stream.videoId), `https://www.youtube.com/live/${stream.videoId}`);
  // Embed memakai youtube-nocookie agar tidak memasang cookie pelacak sebelum
  // pengguna menekan putar.
  assert.ok(liveStreamEmbedUrl(stream.videoId).startsWith('https://www.youtube-nocookie.com/embed/'));
  assert.ok(liveStreamEmbedUrl(stream.videoId).includes(stream.videoId));
  assert.equal(liveStreamThumbnail(stream.videoId), `https://i.ytimg.com/vi/${stream.videoId}/maxresdefault.jpg`);
  assert.equal(liveStreamThumbnail(stream.videoId, false), `https://i.ytimg.com/vi/${stream.videoId}/hqdefault.jpg`);
});

test('findLiveStream mengembalikan entri yang cocok atau null', () => {
  const stream = LIVE_STREAMS[0];
  assert.equal(findLiveStream(stream.videoId)?.volcano, stream.volcano);
  assert.equal(findLiveStream('tidak-ada-xx'), null);
});

test('katalog memuat gunung api yang diminta pengguna', () => {
  const volcanoes = new Set(LIVE_STREAMS.map((stream) => stream.volcano));
  for (const name of ['Merapi', 'Bromo', 'Sinabung', 'Tangkuban Parahu']) {
    assert.ok(volcanoes.has(name), `siaran untuk ${name} belum ada`);
  }
});

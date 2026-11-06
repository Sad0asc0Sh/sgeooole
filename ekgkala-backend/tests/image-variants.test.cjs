// Dual-tier image variants (lib/parspackS3): card key derivation + WebP
// sniffing for client-supplied card buffers. No DB / network needed.
const assert = require('node:assert/strict');
const test = require('node:test');

const { cardKeyFor, isWebpBuffer } = require('../lib/parspackS3');

test('cardKeyFor derives -card.webp for every raster main image', () => {
  assert.equal(cardKeyFor('uploads/abc.webp'), 'uploads/abc-card.webp');
  assert.equal(cardKeyFor('uploads/abc.jpg'), 'uploads/abc-card.webp');
  assert.equal(cardKeyFor('uploads/abc.jpeg'), 'uploads/abc-card.webp');
  assert.equal(cardKeyFor('uploads/abc.PNG'), 'uploads/abc-card.webp');
});

test('cardKeyFor never derives a card of a card (or of non-raster keys)', () => {
  assert.equal(cardKeyFor('uploads/abc-card.webp'), null);
  assert.equal(cardKeyFor('uploads/abc.gif'), null);
  assert.equal(cardKeyFor('uploads/abc'), null);
});

test('isWebpBuffer accepts only real RIFF/WEBP bytes', () => {
  const webp = Buffer.concat([
    Buffer.from('RIFF', 'ascii'),
    Buffer.from([0x24, 0x00, 0x00, 0x00]),
    Buffer.from('WEBPVP8 ', 'ascii'),
  ]);
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01]);
  assert.equal(isWebpBuffer(webp), true);
  assert.equal(isWebpBuffer(jpeg), false);
  assert.equal(isWebpBuffer(null), false);
  assert.equal(isWebpBuffer('RIFF....WEBP'), false);
  assert.equal(isWebpBuffer(Buffer.from('RIFF', 'ascii')), false);
});

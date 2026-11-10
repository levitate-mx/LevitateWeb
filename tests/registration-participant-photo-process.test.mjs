import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import { processParticipantPhoto } from '../worker/participant-photo-process.js';
import { validatePreparedParticipantPhoto } from '../shared/participant-photo-watermark.js';

// Exercise the real orchestration and real raster compositing locally. Sharp
// implements the small documented Images binding subset used by this module;
// the production Images binding itself is verified in the private live pilot.
function rasterImages() {
  const calls = [];
  class Handle {
    constructor(stream) { this.source = new Response(stream).arrayBuffer().then(value => Buffer.from(value)); this.transforms = []; this.overlays = []; }
    transform(options) { calls.push({ transform: options }); this.transforms.push(options); return this; }
    draw(handle, options) { calls.push({ draw: options }); this.overlays.push({ handle, options }); return this; }
    async pixels() {
      let image = sharp(await this.source).rotate();
      for (const options of this.transforms) {
        if (options.width || options.height) image = image.resize({ width: options.width, height: options.height,
          fit: 'inside', withoutEnlargement: options.fit === 'scale-down' });
        if (options.blur) image = image.blur(options.blur);
      }
      return image.png().toBuffer();
    }
    async output(options) {
      calls.push({ output: options });
      const base = await this.pixels();
      const overlays = await Promise.all(this.overlays.map(async ({ handle, options }) => ({
        input: await handle.pixels(), tile: options.repeat === true, blend: 'over',
      })));
      const bytes = await sharp(base).composite(overlays).jpeg({ quality: options.quality }).toBuffer();
      return { response: () => new Response(bytes, { headers: { 'content-type': options.format } }) };
    }
  }
  return { calls,
    input(stream) { calls.push({ input: true }); return new Handle(stream); },
    async info(stream) {
      calls.push({ info: true });
      const bytes = Buffer.from(await new Response(stream).arrayBuffer());
      const metadata = await sharp(bytes).metadata();
      return { width: metadata.width, height: metadata.height, format: metadata.format, fileSize: bytes.length };
    },
  };
}

const greySource = async (width = 512, height = 320) => new Uint8Array(await sharp({ create: {
  width, height, channels: 3, background: '#606060',
} }).png().toBuffer());

test('server photo processing burns a repeated watermark into JPEG pixels and returns a valid immutable preview', async () => {
  const images = rasterImages(), source = await greySource();
  const copy = source.slice();
  const result = await processParticipantPhoto({ images, bytes: source, contentType: 'image/png' });
  assert.equal(result.width, 512); assert.equal(result.height, 320);
  assert.equal(result.contentType, 'image/jpeg'); assert.equal(result.watermarkVersion, 'levitate-preview-v2');
  assert.ok(result.bytes.length < 1024 * 1024);
  const verified = await validatePreparedParticipantPhoto(result.bytes);
  assert.equal(verified.sha256, result.sha256);
  assert.deepEqual(source, copy, 'the source bytes must remain unchanged');
  const { data } = await sharp(result.bytes).raw().toBuffer({ resolveWithObject: true });
  const minimum = data.reduce((value, pixel) => Math.min(value, pixel), 255);
  const maximum = data.reduce((value, pixel) => Math.max(value, pixel), 0);
  assert.ok(maximum - minimum > 35, 'the flat photograph must contain visible rasterized watermark text');
  assert.ok(data.filter(pixel => pixel > 120).length > 500, 'the watermark must affect visible image pixels');
  assert.deepEqual(images.calls.find(call => call.draw)?.draw, { repeat: true, opacity: 1 });
  assert.equal(images.calls.filter(call => call.output).length, 1);
  assert.equal(images.calls.find(call => call.output)?.output.format, 'image/jpeg');
});

test('server previews use actual auto-oriented output dimensions and remove private EXIF metadata', async () => {
  const source = new Uint8Array(await sharp({ create: { width: 1000, height: 1500, channels: 3, background: '#606060' } })
    .withMetadata({ orientation: 6 }).withExifMerge({ IFD0: { Artist: 'PRIVATE SOURCE ARTIST' } }).jpeg().toBuffer());
  const images = rasterImages();
  const preview = await processParticipantPhoto({ images, bytes: source, contentType: 'image/jpeg' });
  assert.equal(preview.width, 800); assert.equal(preview.height, 533);
  assert.equal((await sharp(preview.bytes).metadata()).exif, undefined);
  assert.ok(!Buffer.from(preview.bytes).includes(Buffer.from('PRIVATE SOURCE ARTIST')));
  assert.ok(images.calls.some(call => call.transform?.metadata === 'none'));
});

test('blur is applied before drawing the crisp watermark and animation is flattened', async () => {
  const images = rasterImages();
  const preview = await processParticipantPhoto({ images, bytes: await greySource(), contentType: 'image/png', blur: true });
  assert.equal(preview.width, 512);
  const firstTransform = images.calls.findIndex(call => call.transform?.blur === 18);
  const draw = images.calls.findIndex(call => call.draw);
  assert.ok(firstTransform >= 0 && firstTransform < draw);
  assert.equal(images.calls.find(call => call.output)?.output.anim, false);
});

test('unsupported, empty, oversized and deceptive sources are rejected before any Images request', async () => {
  let touched = 0;
  const images = { input() { touched++; }, info() { touched++; } };
  for (const value of [
    { bytes: new Uint8Array(), contentType: 'image/jpeg' },
    { bytes: new Uint8Array(8 * 1024 * 1024 + 1), contentType: 'image/jpeg' },
    { bytes: new TextEncoder().encode('<svg>private</svg>'), contentType: 'image/svg+xml' },
    { bytes: await greySource(), contentType: 'image/jpeg' },
    { bytes: await greySource(), contentType: 'image/png', blur: 'yes' },
  ]) await assert.rejects(processParticipantPhoto({ images, ...value }), cause => [400, 413].includes(cause.statusCode));
  assert.equal(touched, 0);
});

test('missing bindings, exhausted quota and invalid provider metadata fail closed without returning the original', async () => {
  const bytes = await greySource();
  await assert.rejects(processParticipantPhoto({ bytes, contentType: 'image/png' }), { code: 'portal_photo_processing_unavailable' });
  for (const info of [
    async () => { throw new Error('9422 private-source-file.jpg bearer-secret'); },
    async () => ({ format: 'png', width: 10000, height: 10000 }),
    async () => ({ format: 'gif', width: 512, height: 320 }),
  ]) {
    const images = { info, input() { throw new Error('must not transform invalid input'); } };
    await assert.rejects(processParticipantPhoto({ images, bytes, contentType: 'image/png' }), cause => {
      assert.equal(cause.statusCode, 503);
      assert.doesNotMatch(cause.message, /bearer|private-source|9422/);
      assert.equal(cause.bytes, undefined);
      return true;
    });
  }
});

test('oversized or wrong-type transformation responses are never accepted as marked previews', async () => {
  const bytes = await greySource();
  for (const response of [
    new Response(bytes, { headers: { 'content-type': 'image/png' } }),
    new Response(new Uint8Array(1024 * 1024 + 1), { headers: { 'content-type': 'image/jpeg' } }),
    new Response('quota unavailable', { status: 503, headers: { 'content-type': 'text/plain' } }),
  ]) {
    const images = rasterImages();
    const originalInput = images.input;
    let count = 0;
    images.input = stream => {
      const handle = originalInput(stream);
      if (++count === 1) handle.output = async () => ({ response: () => response });
      return handle;
    };
    await assert.rejects(processParticipantPhoto({ images, bytes, contentType: 'image/png' }), { code: 'portal_photo_processing_unavailable' });
  }
});

import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import sharp from 'sharp';
import ts from 'typescript';
import * as watermark from '../shared/participant-photo-watermark.js';

const source = await readFile(new URL('../src/components/participant-admin/prepareParticipantPhoto.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;

// Exercise the browser preparation pipeline with actual JPEG/PNG pixels. This
// small Canvas2D adapter implements only the operations used by the preparer.
function browserRaster() {
  const canvases = [], draws = [];
  let decoded = 0, closed = 0, loadedStamps = 0;
  class Image {
    set src(value) {
      this.bytes = Buffer.from(value.split(',')[1], 'base64');
      loadedStamps++;
      sharp(this.bytes).metadata().then(info => {
        this.naturalWidth = info.width; this.naturalHeight = info.height; this.onload();
      }, () => this.onerror());
    }
  }
  const context = { exports: {}, Blob, Uint8Array, TextDecoder, Error, Image,
    require(path) { assert.equal(path, '../../../shared/participant-photo-watermark.js'); return watermark; },
    async createImageBitmap(blob) {
      decoded++;
      const bytes = await sharp(Buffer.from(await blob.arrayBuffer())).rotate().png().toBuffer();
      const info = await sharp(bytes).metadata();
      return { bytes, width: info.width, height: info.height, close() { closed++; } };
    },
    document: { createElement(tag) {
      assert.equal(tag, 'canvas');
      const canvas = { width: 0, height: 0 };
      const layers = [], states = [];
      const drawing = { globalAlpha: 1, fillRect() {}, imageSmoothingEnabled: false, imageSmoothingQuality: 'low',
        save() { states.push({ globalAlpha: this.globalAlpha }); },
        restore() { Object.assign(this, states.pop()); },
        drawImage(image, x, y, width, height) {
          const draw = { image, x, y, width, height, alpha: this.globalAlpha };
          layers.push(draw); draws.push(draw);
        } };
      canvas.getContext = () => drawing;
      canvas.toBlob = (callback, type, quality) => {
        const width = canvas.width, height = canvas.height;
        (async () => {
          let bytes = await sharp(layers[0].image.bytes).resize(width, height).png().toBuffer();
          for (const layer of layers.slice(1)) {
            const resized = await sharp(layer.image.bytes).resize(Math.round(layer.width), Math.round(layer.height)).ensureAlpha()
              .raw().toBuffer({ resolveWithObject: true });
            for (let i = 3; i < resized.data.length; i += 4) resized.data[i] = Math.round(resized.data[i] * layer.alpha);
            const left = Math.round(layer.x), top = Math.round(layer.y);
            const cropped = await sharp(resized.data, { raw: resized.info }).extract({ left: Math.max(0, -left), top: Math.max(0, -top),
              width: Math.min(width, resized.info.width + Math.min(0, left)),
              height: Math.min(height, resized.info.height + Math.min(0, top)) }).png().toBuffer();
            bytes = await sharp(bytes).composite([{ input: cropped, left: Math.max(0, left), top: Math.max(0, top) }]).png().toBuffer();
          }
          callback(new Blob([await sharp(bytes).jpeg({ quality: Math.round(quality * 100) }).toBuffer()], { type }));
        })().catch(() => callback(null));
      };
      canvases.push({ canvas, drawing });
      return canvas;
    } },
  };
  vm.runInNewContext(compiled, context);
  return { prepare: context.exports.prepareParticipantPhoto, draws, canvases, counts: () => ({ decoded, closed, loadedStamps }) };
}

for (const [width, height, outputWidth, outputHeight] of [[2560, 1440, 1600, 900], [900, 1600, 900, 1600]]) {
  test(`manual photo preparation burns the corporate PNG once with proportional centered coverage for ${width}x${height}`, async () => {
    const browser = browserRaster();
    const original = await sharp({ create: { width, height, channels: 3, background: '#606060' } }).png().toBuffer();
    const before = Buffer.from(original);
    const prepared = await browser.prepare(new Blob([original], { type: 'image/png' }), 'Retrato.png');
    assert.equal(prepared.width, outputWidth); assert.equal(prepared.height, outputHeight);
    assert.equal(prepared.fileName, 'Retrato.jpg'); assert.equal(prepared.watermarkVersion, 'levitate-preview-v2');
    assert.equal(prepared.blob.type, 'image/jpeg'); assert.ok(prepared.blob.size <= 1024 * 1024);
    const bytes = new Uint8Array(await prepared.blob.arrayBuffer());
    assert.equal((await watermark.validatePreparedParticipantPhoto(bytes)).width, outputWidth);
    assert.equal((await sharp(bytes).metadata()).exif, undefined);
    assert.deepEqual(original, before);
    assert.equal(browser.draws.length, 2, 'one original draw and one unrotated watermark draw');
    const stamp = browser.draws[1];
    assert.equal(stamp.alpha, 0.22);
    assert.equal(stamp.width / stamp.height, 1, 'the supplied square artwork keeps its aspect ratio');
    assert.equal(stamp.width, Math.max(outputWidth, outputHeight));
    assert.equal(stamp.x, (outputWidth - stamp.width) / 2); assert.equal(stamp.y, (outputHeight - stamp.height) / 2);
    assert.equal(browser.canvases[0].drawing.globalAlpha, 1, 'the watermark does not leak alpha into later canvas work');
    assert.deepEqual(browser.counts(), { decoded: 1, closed: 1, loadedStamps: 1 });
    const pixels = await sharp(bytes).raw().toBuffer();
    assert.ok(pixels.some(pixel => Math.abs(pixel - 96) > 10), 'the watermark is burned into the delivered JPEG pixels');
    if (process.env.LEVITATE_PHOTO_QA_DIR) {
      await mkdir(process.env.LEVITATE_PHOTO_QA_DIR, { recursive: true });
      await writeFile(`${process.env.LEVITATE_PHOTO_QA_DIR}/manual-${outputWidth}x${outputHeight}.jpg`, bytes);
    }
  });
}

test('valid already-prepared photos retain their pixels without a second watermark or image decode', async () => {
  const browser = browserRaster();
  const bytes = new Uint8Array(await readFile(new URL('./fixtures/participant-photo-prepared.jpg', import.meta.url)));
  const result = await browser.prepare(new Blob([bytes], { type: 'image/jpeg' }), 'Anterior.jpg');
  assert.deepEqual(new Uint8Array(await result.blob.arrayBuffer()), bytes);
  assert.equal(browser.draws.length, 0); assert.deepEqual(browser.counts(), { decoded: 0, closed: 0, loadedStamps: 0 });
});

test('unsupported manual sources are rejected before decoding or loading the stamp', async () => {
  const browser = browserRaster();
  await assert.rejects(browser.prepare(new Blob(['private'], { type: 'image/svg+xml' }), 'Foto.svg'), /JPEG, PNG o WebP/);
  assert.deepEqual(browser.counts(), { decoded: 0, closed: 0, loadedStamps: 0 });
});

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { addPreparedPhotoMarker, validatePreparedParticipantPhoto, PHOTO_WATERMARK_VERSION } from '../shared/participant-photo-watermark.js';
import { validatePreparedParticipantPhoto as validateInWorker } from '../worker/participant-photo.js';

// Actual JPEG fixture; tests do not decode images, load WASM, or contact services.
const source = new Uint8Array(Buffer.from("/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAGAAgADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD89KKKK9M88KKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigD/9k=", 'base64'));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const prefix = Buffer.from('LEVITATE_PREVIEW\n');
const meta = (raw = source, overrides = {}) => ({ version: PHOTO_WATERMARK_VERSION, width: 512, height: 384, sha256: digest(raw), ...overrides });
function packet(raw, metadata = meta(raw), label = prefix) {
  const payload = Buffer.concat([label, Buffer.from(JSON.stringify(metadata))]);
  const marker = Buffer.from([255,239,(payload.length+2)>>8,(payload.length+2)&255]);
  return new Uint8Array(Buffer.concat([raw.subarray(0,2),marker,payload,raw.subarray(2)]));
}
function segment(kind, payload) {
  const length = payload.length+2;
  return Buffer.concat([Buffer.from([255,kind,length>>8,length&255]),payload]);
}
function addRawSegment(raw, kind, payload) {
  return new Uint8Array(Buffer.concat([raw.subarray(0,2),segment(kind,payload),raw.subarray(2)]));
}
function markerRange(bytes) {
  const length=(bytes[4]<<8)|bytes[5];
  return {start:2,end:4+length};
}

test('prepared JPEG marker has exact independent checksum convention and preserves source bytes',async()=>{
  const before=new Uint8Array(source);
  const prepared=await addPreparedPhotoMarker(source,512,384);
  assert.deepEqual(source,before);
  assert.deepEqual([...prepared.subarray(0,4)],[255,216,255,239]);
  const range=markerRange(prepared);
  const payload=Buffer.from(prepared.subarray(6,range.end));
  assert.equal(payload.subarray(0,prefix.length).toString(),prefix.toString());
  assert.deepEqual(JSON.parse(payload.subarray(prefix.length)),meta());
  const validated=await validateInWorker(prepared);
  assert.equal(validated.bytes,prepared);
  assert.equal(validated.width,512);assert.equal(validated.height,384);
  assert.equal(validated.contentType,'image/jpeg');
  assert.equal(validated.watermarkVersion,PHOTO_WATERMARK_VERSION);
  assert.equal(validated.sha256,digest(prepared),'storage integrity uses the complete marked file hash');
});

test('independently created packets validate, including JSON property ordering',async()=>{
  const prepared=packet(source,{sha256:digest(source),height:384,width:512,version:PHOTO_WATERMARK_VERSION});
  assert.equal((await validatePreparedParticipantPhoto(prepared)).sha256,digest(prepared));
});

test('raw JPEGs and other file formats require the preparation workflow',async()=>{
  for(const bytes of [source,new Uint8Array(),new Uint8Array([255,216,255]),new Uint8Array(Buffer.from('not an image'))]) {
    await assert.rejects(validatePreparedParticipantPhoto(bytes),error=>error.statusCode===400);
  }
  await assert.rejects(addPreparedPhotoMarker(await addPreparedPhotoMarker(source,512,384),512,384),error=>error.statusCode===400,'never mark twice');
});

test('changed pixels or checksum are rejected instead of serving a changed preview',async()=>{
  const prepared=await addPreparedPhotoMarker(source,512,384);
  const changed=new Uint8Array(prepared);changed[changed.length-3]^=1;
  for(const bytes of [changed,packet(source,meta(source,{sha256:'0'.repeat(64)}))]) {
    await assert.rejects(validatePreparedParticipantPhoto(bytes),error=>error.code==='portal_photo_preparation_invalid'&&error.statusCode===400);
  }
});

test('unknown versions, mismatched dimensions, extra keys and wrong label are rejected',async()=>{
  const cases=[
    packet(source,meta(source,{version:'levitate-preview-v1'})),
    packet(source,meta(source,{width:513})),
    packet(source,meta(source,{height:'384'})),
    packet(source,meta(source,{sha256:digest(source).toUpperCase()})),
    packet(source,meta(source,{extra:true})),
    packet(source,meta(),Buffer.from('WRONG_PREVIEW\n')),
  ];
  for(const bytes of cases)await assert.rejects(validatePreparedParticipantPhoto(bytes),error=>error.statusCode===400);
  await assert.rejects(addPreparedPhotoMarker(source,1,1),error=>error.statusCode===400);
});

test('the marker must occur exactly once immediately after SOI, including later scan segments',async()=>{
  const prepared=await addPreparedPhotoMarker(source,512,384);
  const range=markerRange(prepared);
  const duplicate=Buffer.from(prepared.subarray(range.start,range.end));
  const twice=new Uint8Array(Buffer.concat([prepared.subarray(0,range.end),duplicate,prepared.subarray(range.end)]));
  const moved=new Uint8Array(Buffer.concat([source.subarray(0,20),duplicate,source.subarray(20)]));
  const afterScanRaw=new Uint8Array(Buffer.concat([source.subarray(0,-2),duplicate,source.subarray(-2)]));
  for(const bytes of [twice,moved,packet(afterScanRaw)])await assert.rejects(validatePreparedParticipantPhoto(bytes),error=>error.statusCode===400);
});

test('EXIF and freeform comments must be stripped before a file can be prepared',async()=>{
  const exif=addRawSegment(source,225,Buffer.from('Exif\0\0metadata'));
  const comment=addRawSegment(source,254,Buffer.from('private original metadata'));
  for(const raw of [exif,comment]){
    await assert.rejects(addPreparedPhotoMarker(raw,512,384),error=>error.code==='portal_photo_metadata');
    await assert.rejects(validatePreparedParticipantPhoto(packet(raw)),error=>error.code==='portal_photo_metadata');
  }
});

test('real SOF dimensions, prepared dimensions and final encoded byte size have strict caps',async()=>{
  const wide=Buffer.from(source);const frame=wide.indexOf(Buffer.from([255,192]));
  assert.ok(frame>0);wide.writeUInt16BE(1601,frame+7);
  await assert.rejects(addPreparedPhotoMarker(new Uint8Array(wide),1601,384),error=>error.statusCode===413);
  await assert.rejects(validatePreparedParticipantPhoto(packet(new Uint8Array(wide),meta(wide,{width:1601}))),error=>error.statusCode===413);
  const large=Buffer.alloc(1024*1024,1);Buffer.from(source.subarray(0,-2)).copy(large);large[large.length-2]=255;large[large.length-1]=217;
  await assert.rejects(addPreparedPhotoMarker(new Uint8Array(large),512,384),error=>error.statusCode===413,'marker bytes count towards the final upload cap');
  await assert.rejects(validatePreparedParticipantPhoto(new Uint8Array(Buffer.concat([large,Buffer.from([0])]))),error=>error.statusCode===413);
});

test('truncated segments, missing EOI, oversized headers and malformed marker JSON are bounded failures',async()=>{
  const prepared=await addPreparedPhotoMarker(source,512,384);
  const badLength=new Uint8Array(prepared);badLength[4]=255;badLength[5]=255;
  const malformed=segment(239,Buffer.concat([prefix,Buffer.from('{broken')]));
  const malformedPacket=new Uint8Array(Buffer.concat([source.subarray(0,2),malformed,source.subarray(2)]));
  const largeHeaderRaw=addRawSegment(source,226,Buffer.alloc(65_533));
  for(const bytes of [prepared.subarray(0,-2),badLength,malformedPacket,packet(largeHeaderRaw)]) {
    await assert.rejects(validatePreparedParticipantPhoto(bytes),error=>error.statusCode===400);
  }
  assert.equal((await validatePreparedParticipantPhoto(prepared)).watermarkVersion,PHOTO_WATERMARK_VERSION,'a bad file does not affect the next valid file');
});

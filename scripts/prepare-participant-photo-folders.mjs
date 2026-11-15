import { readFile, writeFile, chmod } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { createWranglerDatabase } from './prepare-registration-db.mjs';
import { getParticipantPhotoDriveConfig } from '../worker/participant-photo-drive-config.js';
import { getParticipantDriveHierarchy, PARTICIPANT_PHOTO_ACCOUNT } from '../worker/participant-drive-hierarchy.js';
import { getParticipantDriveStorage } from '../worker/participant-drive-storage.js';
import { getJudgingRoutineDirectory, judgingConnection } from '../worker/judging-reader.js';
import { prepareParticipantDemoPhoto, serveParticipantDemoPhoto } from '../worker/participant-demo-media.js';
import { participantDemoMediaDefinitions } from '../shared/participant-demo-media.js';

const eventPattern = /^[A-Za-z0-9_-]{1,100}$/;
const photoNames = ['PARTICIPANT_PHOTO_DRIVE_OAUTH_CLIENT_ID', 'PARTICIPANT_PHOTO_DRIVE_OAUTH_CLIENT_SECRET',
  'PARTICIPANT_PHOTO_DRIVE_OAUTH_REFRESH_TOKEN', 'PARTICIPANT_PHOTO_DRIVE_ACCOUNT_EMAIL'];
const judgingNames = ['JUDGING_SUPABASE_URL', 'JUDGING_SUPABASE_PUBLISHABLE_KEY'];

export function parsePhotoFolderArguments(argv) {
  const {values} = parseArgs({args:argv,options:{remote:{type:'boolean'},'credentials-file':{type:'string'},
    'judging-credentials-file':{type:'string'},'event-id':{type:'string'},'root-name':{type:'string'},
    'output-file':{type:'string'},'current-program-only':{type:'boolean'},help:{type:'boolean',short:'h'}}});
  if (!values.help && (!values.remote || !values['credentials-file'] || !values['judging-credentials-file'] || !values['event-id'])) {
    throw new Error('Choose the remote event, a private photo credentials file, and a separate judging credentials file.');
  }
  return values;
}

async function readCredentialsFile(file, names, label) {
  let value;
  try { value = JSON.parse(await readFile(resolve(file),'utf8')); }
  catch { throw new Error(`Could not read the ${label} credentials file.`); }
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== names.length
    || Object.keys(value).some(key => !names.includes(key))
    || names.some(key => typeof value[key] !== 'string' || !value[key].trim())) {
    throw new Error(`Use a ${label} credentials file containing only its ${names.length} dedicated variables.`);
  }
  return value;
}

export async function loadPhotoFolderCredentials(photoFile, judgingFile) {
  const env = await readCredentialsFile(photoFile, photoNames, 'photo');
  const config = getParticipantPhotoDriveConfig(env);
  if (config?.expectedEmail !== PARTICIPANT_PHOTO_ACCOUNT) throw new Error('Use the dedicated Ati photo connection only.');
  const judgingEnv = await readCredentialsFile(judgingFile, judgingNames, 'judging');
  // Reuse the GET-only reader's URL/key validation; privileged keys remain forbidden.
  judgingConnection(judgingEnv);
  return {env,judgingEnv};
}

/** Only DB identities are used to associate folders. This command never reads
 * music files or writes to D1, and never receives existing music credentials.
 */
export async function loadPhotoFolderManifest(db, eventId, getJudgingDirectory, {currentProgramOnly = false} = {}) {
  if (!eventPattern.test(eventId || '')) throw new Error('Choose a valid Mi Levitate event ID.');
  if (typeof getJudgingDirectory !== 'function') throw new Error('The presentation-number directory is required.');
  const [events] = await db.read([`SELECT id,title,season,venue FROM participant_portal_events WHERE id='${eventId}'`]);
  if (events.length !== 1 || !['edomex','cdmx','puebla','veracruz'].includes(events[0].venue)) throw new Error('Mi Levitate event not found.');
  const event = events[0];
  const [rows] = await db.read([`SELECT d.id AS dance_id,d.title,r.source_event_id,r.source_routine_id
    FROM registration_dances d LEFT JOIN participant_portal_routines r ON r.event_id='${eventId}' AND r.dance_id=d.id
    WHERE d.venue='${event.venue}' ORDER BY d.id`]);
  if (!rows.length || (!currentProgramOnly && rows.some(row => !row.source_event_id || !row.source_routine_id))) {
    throw new Error('Every presentation must be linked to the imported judging programme before preparing Drive folders.');
  }
  const danceIds = new Set(), sourceRoutineIds = new Set();
  for (const row of rows) {
    if (!eventPattern.test(row.dance_id || '') || danceIds.has(row.dance_id)) throw new Error('Registration presentation identities must be present and unique.');
    danceIds.add(row.dance_id);
    if (row.source_event_id && row.source_routine_id) {
      if (sourceRoutineIds.has(row.source_routine_id)) throw new Error('A judging presentation must have exactly one registration association.');
      sourceRoutineIds.add(row.source_routine_id);
    }
  }
  const linkedRows = rows.filter(row => row.source_event_id && row.source_routine_id);
  if (!linkedRows.length) throw new Error('No linked presentations were found for this edition.');
  const sourceEvents = new Set(rows.map(row => row.source_event_id).filter(Boolean));
  if (sourceEvents.size !== 1) throw new Error('The presentations must belong to one judging programme.');
  const sourceEventId = [...sourceEvents][0];
  const directory = await getJudgingDirectory(sourceEventId);
  if (directory?.event?.id !== sourceEventId || !Array.isArray(directory.rows)) throw new Error('Could not verify the presentation-number directory.');
  if (!directory.rows.length) throw new Error('The current judging programme is empty; no Drive folders were prepared.');
  const expectedIds = new Set(linkedRows.map(row => row.source_routine_id)), byId = new Map(), directoryIds = new Set();
  for (const routine of directory.rows) {
    const id = typeof routine?.id === 'string' ? routine.id.trim() : '';
    if (!id || directoryIds.has(id)) throw new Error('Judging presentation identities must be present and unique.');
    directoryIds.add(id);
    if (!expectedIds.has(id)) continue;
    const number = typeof routine?.programNumber === 'string' ? routine.programNumber.trim() : '';
    if (!id || byId.has(id) || !/^[A-Za-z0-9][A-Za-z0-9 ._/-]{0,31}$/.test(number)) {
      throw new Error('Every imported presentation must have one valid presentation number.');
    }
    byId.set(id, number);
  }
  const numbers = new Set(), presentations = [], omitted = [];
  for (const row of rows) {
    const reason = !row.source_event_id || !row.source_routine_id ? 'unlinked' : !byId.has(row.source_routine_id) ? 'source_routine_missing' : null;
    if (reason && currentProgramOnly) {
      omitted.push({reason,danceId:row.dance_id,title:typeof row.title === 'string' ? row.title.trim() : '',
        sourceEventId:row.source_event_id || null,sourceRoutineId:row.source_routine_id || null});
      continue;
    }
    const number = byId.get(row.source_routine_id);
    if (!number || numbers.has(number.toUpperCase())) throw new Error('Presentation numbers must be present and unique.');
    numbers.add(number.toUpperCase());
    presentations.push({id:row.dance_id,number});
  }
  return {event,eventId:event.id,sourceEventId,presentations,omitted,currentProgramOnly,
    counts:{registered:rows.length,eligible:presentations.length,omitted:omitted.length}};
}

export function photoFolderBatches(presentations) {
  const batches = [];
  for (let offset = 0; offset < presentations.length; offset += 8) batches.push(presentations.slice(offset, offset + 8));
  return batches;
}

export async function preparePhotoFolders({ db, env, judgingEnv = {}, eventId, rootName, outputFile, currentProgramOnly = false, fetchImpl = fetch, getJudgingDirectory, log = console.log }) {
  const config = getParticipantPhotoDriveConfig(env);
  if (!config || config.expectedEmail !== PARTICIPANT_PHOTO_ACCOUNT) throw new Error('Use the dedicated Ati photo connection only.');
  const judgingDirectory = getJudgingDirectory || ((sourceEventId) => getJudgingRoutineDirectory(judgingEnv, sourceEventId,
    { fetcher: fetchImpl, trustedEventId: sourceEventId }));
  const manifest = await loadPhotoFolderManifest(db, eventId, judgingDirectory,{currentProgramOnly});
  if (!manifest.presentations.length) throw new Error('No numbered presentations were found for this edition.');
  log(`Photo folders: ${manifest.counts.eligible} eligible of ${manifest.counts.registered} registered; ${manifest.counts.omitted} omitted.`);
  for (const omission of manifest.omitted) log(`Omitted presentation: ${JSON.stringify(omission)}`);
  let tokenPromise;
  const getAccessToken = () => tokenPromise ||= (async () => {
    const response = await fetchImpl('https://oauth2.googleapis.com/token', {
      method:'POST',redirect:'manual',signal:AbortSignal.timeout(15000),
      headers:{'content-type':'application/x-www-form-urlencoded'},
      body:new URLSearchParams({grant_type:'refresh_token',client_id:config.clientId,client_secret:config.clientSecret,refresh_token:config.refreshToken}),
    });
    if (!response.ok) throw new Error('Could not authorize the dedicated photo account.');
    const result = await response.json();
    if (typeof result.access_token !== 'string' || !result.access_token) throw new Error('The photo authorization response was invalid.');
    return result.access_token;
  })();
  const hierarchy = await getParticipantDriveHierarchy({getConfig:()=>config,getAccessToken,expectedEmail:config.expectedEmail,fetchImpl});
  const allPresentations = new Map(), batches = photoFolderBatches(manifest.presentations);
  let created = 0, root;
  for (const [index,presentations] of batches.entries()) {
    const result = await hierarchy.ensure({eventId,rootName,presentations});
    if (root && root.rootFolderId !== result.rootFolderId) throw new Error('The root folder changed during setup. Stop and review the association.');
    root ||= result; created += result.created;
    for (const presentation of result.presentations) {
      const previous = allPresentations.get(presentation.danceId);
      if (previous && previous.folderId !== presentation.folderId) throw new Error('A presentation folder changed during setup. Stop and review the association.');
      allPresentations.set(presentation.danceId,presentation);
    }
    log(`Photo folders: batch ${index+1}/${batches.length} verified.`);
  }
  const response = await fetchImpl(`https://www.googleapis.com/drive/v3/files/${root.rootFolderId}?fields=id,webViewLink`, {
    method:'GET',redirect:'manual',signal:AbortSignal.timeout(15000),headers:{authorization:`Bearer ${await getAccessToken()}`},
  });
  if (!response.ok) throw new Error('Could not read back the final photo folder.');
  const metadata = await response.json();
  if (metadata.id !== root.rootFolderId || typeof metadata.webViewLink !== 'string') throw new Error('Invalid final folder response.');
  const url = new URL(metadata.webViewLink);
  if (url.origin !== 'https://drive.google.com' || url.pathname !== `/drive/folders/${root.rootFolderId}` || url.username || url.password) throw new Error('Invalid final folder link.');
  const result = {eventId,accountEmail:config.expectedEmail,rootFolderId:root.rootFolderId,rootFolderName:root.rootFolderName,
    rootFolderUrl:metadata.webViewLink,created,presentations:[...allPresentations.values()],verifiedAt:new Date().toISOString(),
    currentProgramOnly:manifest.currentProgramOnly,counts:manifest.counts,omitted:manifest.omitted};
  // Prepare the new private cache and the two approved archival demo images
  // before activating Ati in production. No historical Drive file is read or
  // moved, and the public demo retains its already-watermarked exact bytes.
  const storage = await getParticipantDriveStorage({getConfig:()=>config,getAccessToken,expectedEmail:config.expectedEmail,create:true,fetchImpl});
  const sourceEnvironment = {ASSETS:{async fetch(request) {
    const photo = participantDemoMediaDefinitions.find(item=>item.sourcePath===new URL(request.url).pathname);
    if (!photo) return new Response(null,{status:404});
    const bytes = await readFile(new URL(`../public${photo.sourcePath}`,import.meta.url));
    return new Response(bytes,{headers:{'content-type':'image/jpeg','content-length':String(bytes.length)}});
  }}};
  for (const photo of participantDemoMediaDefinitions) {
    await prepareParticipantDemoPhoto(sourceEnvironment,{slot:photo.slot,getMediaStore:()=>storage});
    const check = await serveParticipantDemoPhoto(new Request(`https://levitate.mx${photo.publicPath}`),{getMediaStore:()=>storage});
    if (check.status!==200) throw new Error('Could not verify the demo preview in the Ati account.');
    await check.arrayBuffer();
  }
  result.previewStorage = storage.info;
  result.demoPreviewsVerified = participantDemoMediaDefinitions.length;
  if (outputFile) {
    // Existing reports may be refreshed; Drive itself remains idempotent.
    await writeFile(resolve(outputFile),JSON.stringify(result,null,2)+'\n',{mode:0o600});
    await chmod(resolve(outputFile),0o600);
  }
  return result;
}

export async function main(argv = process.argv.slice(2)) {
  const values = parsePhotoFolderArguments(argv);
  if (values.help) { console.log('Usage: node scripts/prepare-participant-photo-folders.mjs --remote --credentials-file private-ati-photo.json --judging-credentials-file private-judging-read.json --event-id edition [--current-program-only] [--root-name name] [--output-file private-report.json]'); return; }
  const {env,judgingEnv} = await loadPhotoFolderCredentials(values['credentials-file'],values['judging-credentials-file']);
  const result = await preparePhotoFolders({db:createWranglerDatabase({remote:true}),env,judgingEnv,eventId:values['event-id'],rootName:values['root-name'],outputFile:values['output-file'],currentProgramOnly:values['current-program-only'] === true});
  console.log(`Verified ${result.presentations.length} presentation-number folders in Ati; ${result.omitted.length} omitted. Music was not accessed.`);
  console.log(result.rootFolderUrl);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(()=>{console.error('Photo folder preparation stopped. Existing folders were preserved; check the dedicated authorization and retry the idempotent setup.');process.exitCode=1;});
}

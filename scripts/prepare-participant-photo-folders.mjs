import { readFile, writeFile, chmod } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { createWranglerDatabase } from './prepare-registration-db.mjs';
import { getParticipantPhotoDriveConfig } from '../worker/participant-photo-drive-config.js';
import { getParticipantDriveHierarchy, PARTICIPANT_PHOTO_ACCOUNT } from '../worker/participant-drive-hierarchy.js';
import { getParticipantDriveStorage } from '../worker/participant-drive-storage.js';
import { prepareParticipantDemoPhoto, serveParticipantDemoPhoto } from '../worker/participant-demo-media.js';
import { participantDemoMediaDefinitions } from '../shared/participant-demo-media.js';

const eventPattern = /^[A-Za-z0-9_-]{1,100}$/;
const photoNames = ['PARTICIPANT_PHOTO_DRIVE_OAUTH_CLIENT_ID', 'PARTICIPANT_PHOTO_DRIVE_OAUTH_CLIENT_SECRET',
  'PARTICIPANT_PHOTO_DRIVE_OAUTH_REFRESH_TOKEN', 'PARTICIPANT_PHOTO_DRIVE_ACCOUNT_EMAIL'];

/** Only DB identities are used to associate folders. This command never reads
 * music files or writes to D1, and never receives existing music credentials.
 */
export async function loadPhotoFolderManifest(db, eventId) {
  if (!eventPattern.test(eventId || '')) throw new Error('Choose a valid Mi Levitate event ID.');
  const [events] = await db.read([`SELECT id,title,season,venue FROM participant_portal_events WHERE id='${eventId}'`]);
  if (events.length !== 1 || !['edomex','cdmx','puebla','veracruz'].includes(events[0].venue)) throw new Error('Mi Levitate event not found.');
  const event = events[0];
  const [rows] = await db.read([`SELECT a.id AS academy_id,a.name AS academy_name,d.id AS dance_id,d.title
    FROM registration_dances d JOIN registration_academies a ON a.id=d.academy_id
    WHERE d.venue='${event.venue}' ORDER BY a.name,a.id,d.title,d.id`]);
  const academies = new Map();
  for (const row of rows) {
    if (!academies.has(row.academy_id)) academies.set(row.academy_id, {id:row.academy_id,name:row.academy_name,dances:[]});
    academies.get(row.academy_id).dances.push({id:row.dance_id,title:row.title});
  }
  return {event,eventId:event.id,academies:[...academies.values()]};
}

export function photoFolderBatches(academies) {
  const batches = []; let batch = [], count = 0;
  for (const academy of academies) for (const dance of academy.dances) {
    if (count === 8) { batches.push(batch); batch = []; count = 0; }
    let entry = batch.find(item => item.id === academy.id);
    if (!entry) { entry = {id:academy.id,name:academy.name,dances:[]}; batch.push(entry); }
    entry.dances.push(dance); count++;
  }
  if (count) batches.push(batch);
  return batches;
}

export async function preparePhotoFolders({ db, env, eventId, rootName, outputFile, fetchImpl = fetch, log = console.log }) {
  const config = getParticipantPhotoDriveConfig(env);
  if (!config || config.expectedEmail !== PARTICIPANT_PHOTO_ACCOUNT) throw new Error('Use the dedicated Ati photo connection only.');
  const manifest = await loadPhotoFolderManifest(db, eventId);
  if (!manifest.academies.length) throw new Error('No registered choreographies were found for this edition.');
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
  const allAcademies = new Map(), batches = photoFolderBatches(manifest.academies);
  let created = 0, root;
  for (const [index,academies] of batches.entries()) {
    const result = await hierarchy.ensure({eventId,rootName,academies});
    if (root && root.rootFolderId !== result.rootFolderId) throw new Error('The root folder changed during setup. Stop and review the association.');
    root ||= result; created += result.created;
    for (const academy of result.academies) {
      let entry = allAcademies.get(academy.academyId);
      if (!entry) { entry = {...academy,dances:[]}; allAcademies.set(academy.academyId,entry); }
      if (entry.folderId !== academy.folderId) throw new Error('An academy folder changed during setup. Stop and review the association.');
      entry.dances.push(...academy.dances);
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
    rootFolderUrl:metadata.webViewLink,created,academies:[...allAcademies.values()],verifiedAt:new Date().toISOString()};
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
  const {values} = parseArgs({args:argv,options:{remote:{type:'boolean'},'credentials-file':{type:'string'},'event-id':{type:'string'},
    'root-name':{type:'string'},'output-file':{type:'string'},help:{type:'boolean',short:'h'}}});
  if (values.help) { console.log('Usage: node scripts/prepare-participant-photo-folders.mjs --remote --credentials-file private-ati-photo.json --event-id edition [--root-name name] [--output-file private-report.json]'); return; }
  if (!values.remote || !values['credentials-file'] || !values['event-id']) throw new Error('Choose the remote event and a private Ati photo credentials file.');
  const env = JSON.parse(await readFile(resolve(values['credentials-file']),'utf8'));
  if (!env || typeof env!=='object' || Array.isArray(env) || Object.keys(env).some(key=>!photoNames.includes(key))) throw new Error('Use a file containing only the four dedicated photo variables.');
  const result = await preparePhotoFolders({db:createWranglerDatabase({remote:true}),env,eventId:values['event-id'],rootName:values['root-name'],outputFile:values['output-file']});
  console.log(`Verified ${result.academies.length} academies and ${result.academies.reduce((total,academy)=>total+academy.dances.length,0)} choreography folders in Ati. Music was not accessed.`);
  console.log(result.rootFolderUrl);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(()=>{console.error('Photo folder preparation stopped. Existing folders were preserved; check the dedicated authorization and retry the idempotent setup.');process.exitCode=1;});
}

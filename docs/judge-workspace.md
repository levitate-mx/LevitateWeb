# Judge workspace

The web workspace uses the Android Flutter screens, templates and outbox. Build
it from JueceoLevitateAndroid with `node scripts/build-judge-web.mjs <website>`
before building/deploying this website. The generated browser app lives at
`public/jueceo/app/`; the browser entry is `/jueceo/app/` (or `/jueceo`).

## Access

The normal `/login` username/password flow and HttpOnly registration cookie are
reused. `registration_users.is_judge=1` projects the effective `judge` role. The
legacy `role` CHECK remains untouched, so no user table rebuild is necessary.
Public registration cannot set this flag. Existing academy and admin guards
reject judge accounts. Judges are redirected straight to the workspace.

`registration_judge_assignments` binds a web user to exact Core `(event_id,
judge_id)` identities. Empty `block_ids_json` means all Core-assigned blocks;
otherwise both restrictions are intersected. Assignments must also belong to the
existing `JUDGING_LEVITATE_EVENT_IDS` allowlist. An admin profile, revoked grant
or archived event cannot use judge endpoints. This is not a new Supabase login.

Run the idempotent `db:prepare:registration` process before deploying the new
worker. It adds the flag with default zero and creates the assignment table.
The standalone SQL file is for databases that do not yet have the new column;
do not apply its ALTER a second time.

`node scripts/create-judge-user.mjs --remote <event-uuid>` creates the initial
`juezweb` account with a random password. It refuses a username/email collision
rather than resetting a user's password. The reserved `.invalid` email is an
internal placeholder, not a deliverable address; use the username to sign in.
Do not use the password-reset email flow until a real address is configured.
Only provision this account in an isolated test event, never in a real panel.

## Data and compatibility

All browser reads/writes go to same-origin `/api/registration/judge/*` endpoints,
which verify the existing session and assignment on every request. Mutations
require same-origin JSON, validate routine/block/criterion/maximum and write
only allowlisted columns. Only the caller's scores, feedback, penalties and
favorites are returned. Favorites retain the native multi-selection and legacy
category compatibility. Admin judging reads remain GET-only.

The worker uses the existing app publishable key server-side, never a service
key or a browser-supplied identity. No existing Core RLS policies are broadened
or changed. This does not remediate the native app's pre-existing anonymous
Core access model; that requires a coordinated native/backend migration.

Pending changes and drafts are committed to IndexedDB before synchronization,
in a separate database per website user. While an open session loses network,
it keeps the native queue/retry/error dialog behavior. Refreshing a page requires
validating the normal website session online; this build does not promise cold
offline login or install an API-caching service worker. Do not clear browser
site data with unsynchronized sheets. Sign-out first attempts synchronization
and stays in the session while anything is pending.

Web Locks prevents two tabs for the same account from overwriting a local
snapshot. Browsers without IndexedDB or Web Locks fail explicitly instead of
silently claiming a durable save in memory. The web packaging step also removes
the native bundled programme from the publicly served assets.

The test event is inactive and separate from existing competitions. No old
scores, real jury membership or scoring rules are changed by this integration.

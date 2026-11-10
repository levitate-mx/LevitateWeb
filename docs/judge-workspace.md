# Judge workspace

The web workspace uses the Android Flutter screens, templates and outbox. Build
it from JueceoLevitateAndroid with `node scripts/build-judge-web.mjs <website>`
before building/deploying this website. The generated browser app lives at
`public/jueceo/app/`; the browser entry is `/jueceo/app/` (or `/jueceo`).

## Website appearance

The web entry supplies `levitateWebTheme` from
`JueceoLevitateAndroid/lib/levitate_web_theme.dart`. Its paper (`#f4f1eb`),
ink (`#2a2928`), pink (`#d94c8c`) and dark (`#101013`) palette follows the
public website. Smaller text uses deeper or lighter rose for contrast. The
Inter font and its OFL license are bundled in the Flutter assets so typography
does not depend on an external font service. Native app entry points keep their
existing theme by default. The judging web app uses dark mode independently of
the device preference, including the administrative sheet editor and loading
screen.

The web theme also installs a `LevitateWebPresentation` theme extension. It selects
the web-specific workspace and judging-sheet composition, while native themes
continue through the original layouts. Navigation, programme/judge selection,
score fields, validation, drafts and save callbacks still use the existing store.
The judging action bar stays outside the scrolling criteria so routine selection
and saving remain reachable on desktop and mobile. Desktop feedback, penalties
and favorites use a separate scrolling side panel; mobile keeps those controls
after the criteria. The visual score summary is omitted without changing score
calculation or validation. While a judging sheet is
open, sidebar and mobile navigation are hidden; its Back action returns to the
workspace and restores navigation without clearing the draft.

The React administration workspace scopes the corresponding light/dark tokens
under `.ja-app` in `JudgingAdminWorkspace.css`. It starts in dark mode and keeps
an explicit light/dark choice when the administrator changes the toggle.
These appearance changes do not
change score calculations, sessions, assignments, APIs or the IndexedDB outbox.
When rebuilding, keep the web packaging step above: it strips the native seed
programme from the public assets and includes the local fonts and CanvasKit.

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

### Android-style event and judge selection

The user explicitly requested that `juezweb` select existing programmes and
judges as in Android. `JUDGING_SELECTABLE_JUDGE_USER_IDS` grants this capability
to exact website user IDs on the server; ordinary judge accounts remain bound
to their assignments. It does not confer admin access. The catalogue remains
limited to verified Levitate events and excludes archived events/admin profiles.

This mode reads existing Core judge profiles and their saved sheets. It never
creates a jury member, copies grades or changes scoring rules. Event menus
include each programme's blocks and routine counts before it is selected.
Refreshing the catalogue retrieves current events from the server.

Each mutation identifies the selected judge separately and is validated against
that event's existing judge and block assignment. Pending uploads are grouped
by their original event/judge, even after changing selections; one profile's
notes or favorites cannot be sent under the subsequently selected judge.
Removing the server grant restores assignment-only access on the next request.

## Data and compatibility

All browser reads/writes go to same-origin `/api/registration/judge/*` endpoints,
which verify the existing session and assignment on every request. Mutations
require same-origin JSON, validate routine/block/criterion/maximum and write
only allowlisted columns. Ordinary accounts receive only their assigned judge's
scores, feedback, penalties and favorites; explicitly enabled selector accounts
receive the existing regular judges of authorized events. Favorites retain the native multi-selection and legacy
category compatibility. The legacy `/admin/puntuaciones` reader remains GET-only;
the separately authorized admin workspace is documented in
`judging-admin-workspace.md`.

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

# Judge workspace

The web workspace uses the Android Flutter screens, templates and outbox. Build
it from JueceoLevitateAndroid with `node scripts/build-judge-web.mjs <website>`
before building/deploying this website. The generated browser app lives at
`public/jueceo/app/`; the browser entry is `/jueceo/app/` (or `/jueceo`).

Use the build script after restoring every published source patch listed below.
The script requires the layout, assigned-block, Relevé, save-notice and presence
regressions to exist and pass before compiling. Its layout contract checks that
feedback follows the final criterion on desktop and mobile. A shared Flutter
checkout without those regressions must not replace the published browser app.
The required build check and its geometry contract are preserved in
`docs/patches/judge-web-rebuild-validation.patch`; apply it after the four client
patches when restoring a shared Flutter checkout.

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
The save action stays outside the scrolling criteria. Choreography selection
and saving remain reachable on desktop and mobile. Desktop feedback appears
below the criteria in the main scrolling column.
The right panel holds a fixed choreography selector, penalties and favorites.
Mobile places feedback, penalties and favorites after the criteria and retains
the choreography selector with the save button at the bottom. The visual score
summary is omitted without changing score calculation or validation. While a
judging sheet is open, sidebar and mobile navigation are hidden; its Back action returns to the
workspace and restores navigation without clearing the draft.

Judge portraits reuse the public jury files under `/assets/`, with exact
normalized names so Daniel Herrera and Daniel Montalvo remain distinct. The web
Flutter `webJudgePortraitCatalog` and React `judging/judgePortraits.ts` share
those paths. Eva Carrillo uses the supplied portrait at `/assets/eva-carrillo.jpg`;
incomplete identities and failed image requests show a placeholder. Native hero
assets are unchanged. The incremental Flutter change is preserved in
`docs/patches/judge-web-eva-portrait.patch` and must be retained when rebuilding.

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

### Estado de México · Otoño 2026 tablet accounts

The event has three explicitly authorized shared tablet logins: `juez1`,
`juez2`, and `juez3`. Each has a distinct generated password, stored only in
the private operational delivery file. They use the existing judge-selection
mode to choose among the six real Motion and Aerial judges. Select the person
who is actually evaluating before opening a sheet; scores remain attached to
that Core judge, rather than to the tablet's generic login name.

All three are judge-only accounts, not administrators. Their fallback database
assignments reference the definitive event and its existing Motion judges;
the explicit server selector grants allow using either discipline. No extra
Core judge profiles, test routines or access codes are created.

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

### Assigned blocks when changing the selected judge

The web client retains `assigned_block_ids` in judge profiles and its durable
programme cache. A judge change keeps the current block only when the new judge
is assigned to it; otherwise it selects an assigned block and its first routine.
The block menu and sheet selection use the same restriction. Pending notes and
drafts retain their original event/judge, including after an offline restore.
Server-side write authorization remains the final check.

The source workspace had existing uncommitted Android/web changes when this fix
was built, so the build used an isolated copy. The incremental source and regression
test are preserved in `docs/patches/judge-web-assigned-blocks.patch`. Apply it to
the Android web source used by this checkout before running the build command
above. Do not apply it twice or overwrite unrelated local changes.

### Mixed block publication with Relevé

Automatic publication still requires every jury sheet and source association in
the block to be complete and valid. An unresolved audience result then holds only
the Relevé results: the other 42 routines in the definitive event's block 7 may
publish normally. Closing the poll releases the five Relevé results when its
outcome is ready; a tie or reopened poll keeps those five pending. Manual block
closure retains its whole-block completion rule.

### Browser fullscreen

The judge workspace header and the administrative sheet editor include a
fullscreen toggle, also available while grading. The administrator dashboard
has the same control in its top bar. The control follows the browser's
`fullscreenchange` event, so its label updates when fullscreen ends externally
(for example with Escape). Changing display mode does not navigate, reload the
programme, submit scores or clear drafts. Unsupported browsers omit the toggle.

The Flutter source change is recorded in
`docs/patches/judge-web-fullscreen.patch`. Apply it after the assigned-block patch
above to the same Android/web source before rebuilding this checkout. Installed
Android/iPad apps are outside this change; native builds retain a no-op control.
The API follows the [Fullscreen Standard](https://fullscreen.spec.whatwg.org/).

### Final-report accounts

The `judging_viewer` role opens `/jueceo/dictamen` directly, with the final-report
filters, refresh, logout and browser fullscreen controls. It has no grading,
administration, export or individual-sheet controls. Its API returns only final
results and the metadata needed by those filters, without individual notes,
feedback, participant records or judge account bindings.

Apply the registration schema preparer before deploying the worker. Accounts
retain the legacy `academy` database role and use `is_judging_viewer=1`, with
`is_judge=0` and `is_judging_admin=0`. Each permitted event must have an enabled
row in `registration_judging_report_access`; no assignment means no access.
The server checks the session and event grant for every report request and
rejects other authenticated registration endpoints for this role. Provision
password hashes privately using the existing PBKDF2 format; never commit
credentials or reset an existing identity to provision a new account.

Group results include a participant-count column in both the administrator and
report-only views. Counts come from registration membership through the exact,
enabled edition/event/routine association; participant identities are never
returned. Unlinked, empty or ambiguous associations display “Por confirmar”.
Solo, duo and trio results retain their existing columns and scoring rules.

### Judging sheet columns

On desktop, feedback follows the last scoring criterion in the left column,
with the save button fixed below that column. The right column contains only
the fixed choreography selector and independently scrolling penalties/favorites.
Drafts, penalties, favorites, validation and save callbacks are unchanged. Mobile
retains one scrolling column and the fixed choreography/save controls.

Apply `docs/patches/judge-web-sheet-layout.patch` after the assigned-block and
fullscreen patches above when rebuilding from the shared Flutter source. The
existing appearance and draft-persistence tests cover both column arrangements.

### Relevé evaluation rubric

The definitive event has its own `releve` template: Técnica y control,
Composición coreográfica, Musicalidad, Interpretación artística and Presencia
escénica, each scored as an integer from 1 to 3 (15 points per judge). The
rubric applies by division and apparatus; it does not replace the ordinary Tela,
Aro or Trapecio sheets. The same template selection rules are used by the web
client, score validation and result/PDF readers. Applicability is retained in
the offline programme cache.

The final web report and PDF use the real sum of the jury totals. Three complete
Relevé sheets contribute up to 45 points, plus the five-point audience bonus
when the poll result is ready. General competition uses the sum of its assigned
jury maxima, normally 210 points for three 70-point sheets.
The targeted data update is in `db/judging/edomex-2026-releve-rubric.sql`; it
refuses to run once any of the five Relevé routines has saved scores. It does
not update or delete existing scores or apparatus rubrics. Deploy the new web
client and validator before applying it, then reload judging browser tabs.

For a rebuild from the shared Flutter source, apply
`docs/patches/judge-web-releve-rubric.patch` after the sheet-layout patch above.

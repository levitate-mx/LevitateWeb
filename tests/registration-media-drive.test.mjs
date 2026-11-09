import assert from "node:assert/strict";
import test from "node:test";
import { getMediaDriveDiagnostic, parseMediaDriveFolderId } from "../worker/media-drive.js";

const folderId = "fixture_folder_1234567890";
const sharedDriveId = "fixture_shared_drive_1234";
const secret = "SYNTHETIC_PRIVATE_TOKEN";
const config = { authType: "oauth_refresh_token", refreshToken: "SYNTHETIC_PRIVATE_REFRESH_TOKEN" };
const about = {
  user: { displayName: "Cuenta de medios", emailAddress: "medios@example.test", photoLink: "PRIVATE-PHOTO" },
  storageQuota: { limit: "10000000000000000", usage: "3000000000", usageInDrive: "2000000000", usageInDriveTrash: "1000000" },
  extra: "PRIVATE-EXTRA",
};

function folder(overrides = {}) {
  return { id: folderId, name: "Originales del evento", mimeType: "application/vnd.google-apps.folder", trashed: false,
    capabilities: { canListChildren: true, canAddChildren: false }, ...overrides };
}

function upstream(responses = [about]) {
  const calls = [];
  return {
    calls,
    async fetchImpl(input, options) {
      const url = new URL(input);
      calls.push({ url, options });
      assert.equal(url.origin, "https://www.googleapis.com");
      assert.equal(options.method, "GET");
      assert.equal(options.redirect, "manual", "authorization must never follow redirects");
      assert.equal(options.headers.authorization, `Bearer ${secret}`);
      assert.ok(options.signal instanceof AbortSignal);
      assert.equal(options.body, undefined);
      assert.ok(["/drive/v3/about", `/drive/v3/files/${folderId}`].includes(url.pathname), "no global file listing or media download");
      assert.equal(url.searchParams.has("alt"), false);
      const next = responses.shift();
      if (next instanceof Response) return next;
      if (next instanceof Error) throw next;
      return Response.json(next);
    },
  };
}

function diagnose(options = {}) {
  return getMediaDriveDiagnostic({ getConfig: () => config, getAccessToken: async (receivedConfig, { signal }) => {
    assert.equal(receivedConfig, config);
    assert.ok(signal instanceof AbortSignal);
    return secret;
  }, ...options });
}

test("folder selection accepts a Drive ID and supported Drive folder URLs without retaining URL parameters", () => {
  for (const input of [folderId, ` ${folderId} `, `https://drive.google.com/drive/folders/${folderId}`,
    `https://drive.google.com/drive/u/0/folders/${folderId}?usp=sharing`,
    `https://drive.google.com/drive/u/12/folders/${folderId}/`,
    `https://drive.google.com/open?id=${folderId}&usp=sharing`]) {
    assert.equal(parseMediaDriveFolderId(input), folderId);
  }
  for (const input of [undefined, null, "", "  "]) assert.equal(parseMediaDriveFolderId(input), "");
});

test("folder selection rejects other hosts, schemes, file links, ambiguous IDs and the global Drive root", () => {
  for (const input of [false, 123, {}, "root", "short", "a/b", `${folderId}&alt=media`,
    `http://drive.google.com/drive/folders/${folderId}`, `https://drive.google.com.evil.test/drive/folders/${folderId}`,
    `https://drive.google.com@evil.test/drive/folders/${folderId}`, `https://user:password@drive.google.com/drive/folders/${folderId}`,
    `https://drive.google.com:8443/drive/folders/${folderId}`, `https://docs.google.com/drive/folders/${folderId}`,
    `https://drive.google.com/file/d/${folderId}/view`, `https://drive.google.com/open?id=${folderId}&id=another_folder_1234`,
    `https://drive.google.com/drive/folders/${folderId}%2Fother`, `https://drive.google.com/drive/folders/root`,
    "file:///private/fixture", `https://drive.google.com\\drive\\folders\\${folderId}`]) {
    assert.throws(() => parseMediaDriveFolderId(input), error => error.code === "media_drive_invalid_folder" && error.statusCode === 400);
  }
});

test("missing or incomplete configuration never claims a validated connection or calls Google", async () => {
  for (const getConfig of [() => null, () => { throw new Error(secret); }]) {
    let calls = 0;
    const result = await diagnose({ getConfig, getAccessToken: async () => { calls += 1; }, fetchImpl: async () => { calls += 1; } });
    assert.equal(result.connection.status, "missing_configuration");
    assert.equal(result.connection.credentialsPresent, false);
    assert.equal(result.connection.validated, false);
    assert.equal(result.connection.folder, null);
    assert.equal(calls, 0);
    assert.doesNotMatch(JSON.stringify(result), new RegExp(secret));
  }
});

test("connection requires a real about response and reads only allowlisted account/quota metadata", async () => {
  const server = upstream();
  const { connection } = await diagnose(server);
  assert.equal(connection.status, "connected");
  assert.equal(connection.credentialsPresent, true);
  assert.equal(connection.validated, true);
  assert.equal(connection.authType, "oauth_refresh_token");
  assert.deepEqual(connection.account, { displayName: "Cuenta de medios", emailAddress: "medios@example.test" });
  assert.deepEqual(connection.storage, { limitBytes: "10000000000000000", usageBytes: "3000000000", usageInDriveBytes: "2000000000", usageInDriveTrashBytes: "1000000" });
  assert.equal(connection.folder, null, "selecting a folder can wait until later");
  assert.ok(Number.isFinite(Date.parse(connection.checkedAt)));
  assert.equal(server.calls.length, 1);
  assert.equal(server.calls[0].url.searchParams.get("fields"), "user(displayName,emailAddress),storageQuota(limit,usage,usageInDrive,usageInDriveTrash)");
  assert.doesNotMatch(JSON.stringify(connection), /SYNTHETIC_PRIVATE|PRIVATE-PHOTO|PRIVATE-EXTRA|photoLink|refreshToken/);
});

test("an omitted storage limit and unavailable byte values remain null rather than fake zero", async () => {
  const server = upstream([{ user: about.user, storageQuota: { usage: "0", usageInDrive: -1, usageInDriveTrash: "not-a-number" } }]);
  const { connection } = await diagnose(server);
  assert.equal(connection.validated, true);
  assert.deepEqual(connection.storage, { limitBytes: null, usageBytes: "0", usageInDriveBytes: null, usageInDriveTrashBytes: null });
});

test("token, provider, redirect and malformed response errors return safe unvalidated diagnostics", async () => {
  const failures = [new Error(secret), new Response(secret, { status: 401 }), new Response(secret, { status: 403 }),
    new Response(secret, { status: 500 }), new Response(secret, { status: 302, headers: { location: "https://evil.test" } }),
    new Response(secret, { headers: { "content-type": "application/json" } }), [], {}];
  for (const response of failures) {
    const server = upstream([response]);
    const { connection } = await diagnose(server);
    assert.equal(connection.status, "error");
    assert.equal(connection.credentialsPresent, true);
    assert.equal(connection.validated, false);
    assert.equal(connection.folder, null);
    assert.equal(server.calls.length, 1);
    assert.doesNotMatch(JSON.stringify(connection), /SYNTHETIC_PRIVATE|evil\.test/);
  }
  for (const getAccessToken of [async () => { throw new Error(secret); }, async () => ""]) {
    const server = upstream();
    const result = await diagnose({ ...server, getAccessToken });
    assert.equal(result.connection.status, "error");
    assert.equal(result.connection.validated, false);
    assert.equal(server.calls.length, 0);
    assert.doesNotMatch(JSON.stringify(result), /SYNTHETIC_PRIVATE/);
  }
});

test("a selected shared-drive folder is checked by ID with shared-drive support and no original URLs", async () => {
  const server = upstream([about, folder({ driveId: sharedDriveId, webViewLink: "PRIVATE-ORIGINAL-LINK", owners: ["PRIVATE-OWNER"] })]);
  const { connection } = await diagnose({ ...server, folderId: `https://drive.google.com/drive/folders/${folderId}?secret=not-returned` });
  assert.equal(connection.status, "connected");
  assert.deepEqual(connection.folder, { id: folderId, name: "Originales del evento", driveId: sharedDriveId, status: "ready", validated: true, canAddChildren: false });
  assert.equal(server.calls.length, 2);
  assert.equal(server.calls[1].url.searchParams.get("supportsAllDrives"), "true");
  assert.equal(server.calls[1].url.searchParams.get("fields"), "id,name,mimeType,trashed,driveId,capabilities(canListChildren,canAddChildren)");
  assert.doesNotMatch(JSON.stringify(connection), /PRIVATE-|https:|secret|webViewLink|owners/);
});

test("a readable folder does not require write permission, which is reported independently", async () => {
  for (const canAddChildren of [false, true]) {
    const server = upstream([about, folder({ capabilities: { canListChildren: true, canAddChildren } })]);
    const { connection } = await diagnose({ ...server, folderId });
    assert.equal(connection.folder.status, "ready");
    assert.equal(connection.folder.validated, true);
    assert.equal(connection.folder.canAddChildren, canAddChildren);
    assert.equal(connection.folder.driveId, null);
  }
});

test("folder metadata without a usable name cannot be saved as a ready folder", async () => {
  for (const name of [undefined, null, "", "   ", "\u0000\u001f\u007f\n\t", 123]) {
    const server = upstream([about, folder({ name })]);
    const { connection } = await diagnose({ ...server, folderId });
    assert.equal(connection.status, "connected");
    assert.equal(connection.validated, true);
    assert.equal(connection.folder.status, "error");
    assert.equal(connection.folder.validated, false);
    assert.equal(connection.folder.name, "");
    assert.ok(connection.folder.message);
  }
});

test("invalid, inaccessible, trashed and non-folder selections never invalidate an otherwise verified connection", async () => {
  for (const metadata of [new Response(secret, { status: 404 }), new Response(secret, { status: 403 }),
    folder({ id: "another_folder_123456" }), folder({ mimeType: "image/jpeg" }), folder({ trashed: true }), folder({ trashed: undefined }),
    folder({ capabilities: { canAddChildren: true, canListChildren: false } }), folder({ capabilities: undefined })]) {
    const server = upstream([about, metadata]);
    const { connection } = await diagnose({ ...server, folderId });
    assert.equal(connection.status, "connected");
    assert.equal(connection.validated, true);
    assert.equal(connection.folder.status, "error");
    assert.equal(connection.folder.validated, false);
    assert.doesNotMatch(JSON.stringify(connection), /SYNTHETIC_PRIVATE/);
  }
  const server = upstream();
  const { connection } = await diagnose({ ...server, folderId: `https://evil.test/${secret}` });
  assert.equal(connection.status, "connected");
  assert.equal(connection.folder.status, "error");
  assert.equal(connection.folder.id, "");
  assert.equal(server.calls.length, 1);
  assert.doesNotMatch(JSON.stringify(connection), /SYNTHETIC_PRIVATE|evil\.test/);
});

test("slow token and metadata requests are bounded and receive an aborted signal", async () => {
  let tokenSignal;
  const tokenResult = await diagnose({ timeoutMs: 5, getAccessToken: async (receivedConfig, { signal }) => {
    tokenSignal = signal;
    return new Promise(() => {});
  } });
  assert.equal(tokenResult.connection.status, "error");
  assert.equal(tokenSignal.aborted, true);

  let metadataSignal;
  const metadataResult = await diagnose({ timeoutMs: 5, fetchImpl: async (url, { signal }) => {
    metadataSignal = signal;
    return new Promise(() => {});
  } });
  assert.equal(metadataResult.connection.status, "error");
  assert.equal(metadataSignal.aborted, true);

  const server = upstream();
  let folderSignal;
  const folderResult = await diagnose({ timeoutMs: 5, folderId, fetchImpl: async (url, options) => {
    if (new URL(url).pathname.endsWith("/about")) return server.fetchImpl(url, options);
    folderSignal = options.signal;
    return new Promise(() => {});
  } });
  assert.equal(folderResult.connection.status, "connected");
  assert.equal(folderResult.connection.folder.status, "error");
  assert.equal(folderSignal.aborted, true);
});

import assert from "node:assert/strict";
import test from "node:test";
import { getParticipantPhotoDriveConfig, hasParticipantPhotoDriveConfig } from "../worker/participant-photo-drive-config.js";

const complete = {
  PARTICIPANT_PHOTO_DRIVE_OAUTH_CLIENT_ID: "separate-photo-client",
  PARTICIPANT_PHOTO_DRIVE_OAUTH_CLIENT_SECRET: "separate-photo-secret",
  PARTICIPANT_PHOTO_DRIVE_OAUTH_REFRESH_TOKEN: "separate-photo-refresh",
  PARTICIPANT_PHOTO_DRIVE_ACCOUNT_EMAIL: "ati@example.test",
};

test("only an entirely absent photo connection retains legacy routing", () => {
  const legacy = Object.freeze({ GOOGLE_DRIVE_OAUTH_CLIENT_ID: "music-client", GOOGLE_DRIVE_OAUTH_CLIENT_SECRET: "music-secret",
    GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN: "music-refresh", GMAIL_OAUTH_CLIENT_ID: "gmail-client", GMAIL_OAUTH_CLIENT_SECRET: "gmail-secret",
    PARTICIPANT_MEDIA_DRIVE_ACCOUNT_EMAIL: "music@example.test", REGISTRATION_MUSIC_DRIVE_FOLDER_ID: "music-folder" });
  assert.equal(getParticipantPhotoDriveConfig(legacy), null);
  assert.equal(hasParticipantPhotoDriveConfig(legacy), false);
  assert.equal(getParticipantPhotoDriveConfig({ ...legacy, PARTICIPANT_PHOTO_DRIVE_OAUTH_CLIENT_ID: "" }), null);
  assert.equal(legacy.GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN, "music-refresh");
});

test("photo credentials are resolved independently without a Gmail/music fallback", () => {
  const env = Object.freeze({ ...complete, PARTICIPANT_PHOTO_DRIVE_ACCOUNT_EMAIL: " Ati@Example.Test ",
    GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN: "music-refresh", GMAIL_OAUTH_REFRESH_TOKEN: "gmail-refresh" });
  assert.deepEqual(getParticipantPhotoDriveConfig(env), { authType: "oauth_refresh_token", clientId: "separate-photo-client",
    clientSecret: "separate-photo-secret", refreshToken: "separate-photo-refresh", expectedEmail: "ati@example.test" });
  assert.equal(env.GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN, "music-refresh");
});

test("every partial photo connection fails closed without exposing credential values", () => {
  for (const key of Object.keys(complete)) {
    const env = { ...complete, [key]: undefined, GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN: "must-never-be-used" };
    assert.equal(hasParticipantPhotoDriveConfig(env), true);
    assert.throws(() => getParticipantPhotoDriveConfig(env), error => {
      assert.equal(error.code, "portal_photo_drive_not_configured");
      assert.equal(error.statusCode, 503);
      assert.doesNotMatch(error.message, /separate-photo|must-never-be-used/);
      return true;
    });
  }
  assert.throws(() => getParticipantPhotoDriveConfig({ PARTICIPANT_PHOTO_DRIVE_ACCOUNT_EMAIL: "ati@example.test" }), { code: "portal_photo_drive_not_configured" });
  assert.equal(hasParticipantPhotoDriveConfig({ PARTICIPANT_PHOTO_DRIVE_ACCOUNT_EMAIL: "ati@example.test" }), true);
});

test("malformed and non-string photo settings cannot activate routing", () => {
  for (const email of ["ati", "a@@example.test", "ati @example.test", 12, "   "]) {
    assert.throws(() => getParticipantPhotoDriveConfig({ ...complete, PARTICIPANT_PHOTO_DRIVE_ACCOUNT_EMAIL: email }), { code: "portal_photo_drive_not_configured" });
  }
  for (const key of Object.keys(complete)) {
    assert.throws(() => getParticipantPhotoDriveConfig({ ...complete, [key]: true }), { code: "portal_photo_drive_not_configured" });
  }
});

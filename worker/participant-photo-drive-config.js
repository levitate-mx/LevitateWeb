const photoKeys = {
  clientId: "PARTICIPANT_PHOTO_DRIVE_OAUTH_CLIENT_ID",
  clientSecret: "PARTICIPANT_PHOTO_DRIVE_OAUTH_CLIENT_SECRET",
  refreshToken: "PARTICIPANT_PHOTO_DRIVE_OAUTH_REFRESH_TOKEN",
  expectedEmail: "PARTICIPANT_PHOTO_DRIVE_ACCOUNT_EMAIL",
};

function unavailable() {
  return Object.assign(new Error("Completa la conexión independiente de Drive para las fotografías."), {
    code: "portal_photo_drive_not_configured", statusCode: 503,
  });
}

/** This resolver deliberately never reads the existing Drive/Gmail secrets.
 * A partial new connection must fail closed rather than silently use music.
 */
export function getParticipantPhotoDriveConfig(env = {}) {
  const values = Object.fromEntries(Object.entries(photoKeys).map(([key, name]) => [key, env[name]]));
  if (!hasParticipantPhotoDriveConfig(env)) return null;
  if (Object.values(values).some(value => typeof value !== "string" || !value.trim())) throw unavailable();
  const config = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value.trim()]));
  config.expectedEmail = config.expectedEmail.toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.expectedEmail)) throw unavailable();
  return { authType: "oauth_refresh_token", ...config };
}

/** Detect a staged/partial connection without resolving it. Legacy reads must
 * remain available while a separate photo connection is being provisioned.
 */
export function hasParticipantPhotoDriveConfig(env = {}) {
  return Object.values(photoKeys).some(key => env[key] !== undefined && env[key] !== null && env[key] !== "");
}

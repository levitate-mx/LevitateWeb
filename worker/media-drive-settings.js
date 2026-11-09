const settingsKey = "photo_video";
const columns = "key, folder_id, folder_name, drive_id, updated_by, updated_at";

function serializeSettings(row) {
  return row ? {
    key: row.key,
    folderId: row.folder_id,
    folderName: row.folder_name,
    driveId: row.drive_id ?? null,
    updatedBy: row.updated_by ?? null,
    updatedAt: row.updated_at,
  } : null;
}

function invalidSettings() {
  const error = new Error("La carpeta de fotos y videos no es válida.");
  error.code = "media_drive_settings_invalid";
  error.statusCode = 400;
  return error;
}

function normalizeIdentifier(value, optional = false) {
  if (optional && (value == null || value === "")) return null;
  if (typeof value !== "string") throw invalidSettings();
  const id = value.trim();
  if (optional && !id) return null;
  if (!/^[A-Za-z0-9_-]+$/.test(id)) throw invalidSettings();
  return id;
}

// These helpers assume the caller has authenticated an administrator. The
// caller must verify the folder through Drive before saving its metadata.
// No schema preparation, OAuth values, permissions or private URLs live here.
export async function readSettings(db) {
  const row = await db.prepare(`SELECT ${columns} FROM registration_media_drive_settings WHERE key = ?`)
    .bind(settingsKey).first();
  return serializeSettings(row);
}

export async function saveSettings(db, { folderId, folderName, driveId = null, updatedBy = null } = {}) {
  const normalizedFolderId = normalizeIdentifier(folderId);
  const normalizedDriveId = normalizeIdentifier(driveId, true);
  if (typeof folderName !== "string" || !folderName.trim()) throw invalidSettings();
  if (updatedBy != null && (typeof updatedBy !== "string" || !updatedBy.trim())) throw invalidSettings();
  const row = await db.prepare(`
    INSERT INTO registration_media_drive_settings(key, folder_id, folder_name, drive_id, updated_by)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      folder_id = excluded.folder_id, folder_name = excluded.folder_name,
      drive_id = excluded.drive_id, updated_by = excluded.updated_by,
      updated_at = datetime('now')
    RETURNING ${columns}
  `).bind(settingsKey, normalizedFolderId, folderName.trim(), normalizedDriveId, updatedBy?.trim() ?? null).first();
  return serializeSettings(row);
}

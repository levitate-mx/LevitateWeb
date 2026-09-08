// These additions replace the schema preparation previously done by request handlers.
// Existing tables, columns, IDs, permissions, and nonempty access tokens are preserved.
const additions = {
  registration_academies: {
    origin_type: "TEXT NOT NULL DEFAULT 'mexico' CHECK (origin_type IN ('mexico', 'international'))",
    origin_state: "TEXT",
    origin_country: "TEXT NOT NULL DEFAULT 'México'",
  },
  registration_users: {
    role: "TEXT NOT NULL DEFAULT 'academy' CHECK (role IN ('academy', 'admin'))",
  },
  registration_participants: {
    is_international: "INTEGER NOT NULL DEFAULT 0 CHECK (is_international IN (0, 1))",
    is_releve_teacher: "INTEGER NOT NULL DEFAULT 0 CHECK (is_releve_teacher IN (0, 1))",
  },
  registration_choreographers: {
    is_releve_teacher: "INTEGER NOT NULL DEFAULT 0 CHECK (is_releve_teacher IN (0, 1))",
  },
  registration_dances: { subgenre_detail: "TEXT" },
  registration_inscription_orders: {
    buyer_phone_country_code: "TEXT",
    buyer_phone_number: "TEXT",
    buyer_phone: "TEXT",
  },
  registration_shop_orders: {
    access_token: "TEXT",
    buyer_name: "TEXT",
    buyer_email: "TEXT",
  },
  registration_music_uploads: {
    storage_provider: "TEXT NOT NULL DEFAULT 'd1' CHECK (storage_provider IN ('d1', 'google_drive'))",
    drive_file_id: "TEXT",
    drive_web_view_link: "TEXT",
    drive_web_content_link: "TEXT",
  },
};

const timestamps = {
  created_at: "TEXT NOT NULL DEFAULT (datetime('now'))",
  updated_at: "TEXT NOT NULL DEFAULT (datetime('now'))",
};
const proofColumns = {
  id: "TEXT PRIMARY KEY",
  file_name: "TEXT NOT NULL",
  content_type: "TEXT NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp', 'application/pdf'))",
  file_size: "INTEGER NOT NULL CHECK (file_size > 0 AND file_size <= 1800000)",
  data_url: "TEXT NOT NULL",
  status: "TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'accepted', 'rejected'))",
  uploaded_at: "TEXT NOT NULL DEFAULT (datetime('now'))",
  created_at: timestamps.created_at,
};

const createdTables = {
  registration_shop_orders: {
    columns: {
      id: "TEXT PRIMARY KEY",
      curp: "TEXT NOT NULL COLLATE NOCASE",
      participant_name: "TEXT NOT NULL",
      academy_id: "TEXT REFERENCES registration_academies(id) ON DELETE SET NULL",
      academy_name: "TEXT NOT NULL",
      venue: "TEXT NOT NULL CHECK (venue IN ('cdmx', 'puebla', 'edomex', 'veracruz'))",
      reference: "TEXT NOT NULL UNIQUE COLLATE NOCASE",
      access_token: "TEXT UNIQUE",
      amount: "INTEGER NOT NULL DEFAULT 0 CHECK (amount >= 0)",
      paid_amount: "INTEGER NOT NULL DEFAULT 0 CHECK (paid_amount >= 0)",
      status: "TEXT NOT NULL DEFAULT 'pending_payment' CHECK (status IN ('pending_payment', 'payment_reported', 'paid', 'rejected'))",
      payment_method: "TEXT NOT NULL DEFAULT 'bank_transfer'",
      buyer_name: "TEXT",
      buyer_email: "TEXT",
      buyer_phone_country_code: "TEXT",
      buyer_phone_number: "TEXT",
      buyer_phone: "TEXT",
      discount_code: "TEXT",
      discount_amount: "INTEGER NOT NULL DEFAULT 0 CHECK (discount_amount >= 0)",
      line_items_json: "TEXT NOT NULL DEFAULT '[]'",
      notes: "TEXT",
      paid_at: "TEXT",
      reviewed_by: "TEXT",
      reviewed_at: "TEXT",
      rejection_reason: "TEXT",
      rejection_message: "TEXT",
      ...timestamps,
    },
  },
  registration_inscription_payment_proofs: {
    columns: {
      ...proofColumns,
      order_id: "TEXT NOT NULL REFERENCES registration_inscription_orders(id) ON DELETE CASCADE",
    },
  },
  registration_shop_payment_proofs: {
    columns: {
      ...proofColumns,
      order_id: "TEXT NOT NULL REFERENCES registration_shop_orders(id) ON DELETE CASCADE",
    },
  },
  registration_music_uploads: {
    columns: {
      id: "TEXT PRIMARY KEY",
      academy_id: "TEXT NOT NULL REFERENCES registration_academies(id) ON DELETE CASCADE",
      dance_id: "TEXT NOT NULL REFERENCES registration_dances(id) ON DELETE CASCADE",
      file_name: "TEXT NOT NULL",
      content_type: "TEXT NOT NULL CHECK (content_type IN ('audio/mpeg', 'audio/mp3'))",
      file_size: "INTEGER NOT NULL CHECK (file_size > 0 AND file_size <= 12000000)",
      data_url: "TEXT NOT NULL",
      ...additions.registration_music_uploads,
      uploaded_by_user_id: "TEXT REFERENCES registration_users(id) ON DELETE SET NULL",
      uploaded_at: "TEXT NOT NULL DEFAULT (datetime('now'))",
      ...timestamps,
    },
    constraints: ["UNIQUE (dance_id)"],
  },
};

// Prerequisites cannot be repaired by this deliberately additive migration.
// A fresh database must first receive db/registration_d1_schema.sql.
const prerequisites = {
  registration_academies: ["id", "name", "contact_name", "email", "phone", "created_at", "updated_at"],
  registration_users: ["id", "academy_id", "name", "username", "email", "password_hash", "status", "email_confirmed_at", "created_at", "updated_at"],
  registration_participants: ["id", "academy_id", "full_name", "curp", "birth_date", "age", "division", "shirt_size", "created_by_user_id", "created_at", "updated_at"],
  registration_choreographers: ["id", "academy_id", "full_name", "email", "phone", "shirt_size", "created_by_user_id", "created_at", "updated_at"],
  registration_dances: ["id", "academy_id", "title", "genre", "subgenre", "category", "level", "venue", "created_by_user_id", "created_at", "updated_at"],
  registration_inscription_orders: ["id", "curp", "participant_name", "academy_id", "academy_name", "venue", "reference", "amount", "paid_amount", "status", "payment_method", "line_items_json", "notes", "paid_at", "reviewed_by", "reviewed_at", "rejection_reason", "rejection_message", "created_at", "updated_at"],
};

const indexes = [
  ["idx_registration_shop_orders_curp", "registration_shop_orders", "curp"],
  ["idx_registration_shop_orders_academy_id", "registration_shop_orders", "academy_id"],
  ["idx_registration_shop_orders_status", "registration_shop_orders", "status"],
  ["idx_registration_shop_orders_access_token", "registration_shop_orders", "access_token", "UNIQUE", "WHERE access_token IS NOT NULL"],
  ["idx_registration_inscription_payment_proofs_order_id", "registration_inscription_payment_proofs", "order_id"],
  ["idx_registration_shop_payment_proofs_order_id", "registration_shop_payment_proofs", "order_id"],
  ["idx_registration_music_uploads_academy_id", "registration_music_uploads", "academy_id"],
  ["idx_registration_music_uploads_dance_id", "registration_music_uploads", "dance_id"],
];

/** Adapter: read(sqlStatements) returns one array of rows per statement; write(sqlStatements) applies a batch. */
export async function planRegistrationSchema(db) {
  const tableNames = [...new Set([...Object.keys(prerequisites), ...Object.keys(createdTables)])];
  const [objects, ...columnResults] = await db.read([
    "SELECT name, type, tbl_name FROM sqlite_schema WHERE type IN ('table', 'index')",
    ...tableNames.map((name) => `PRAGMA table_info(${name})`),
  ]);
  const tables = new Set(objects.filter((row) => row.type === "table").map((row) => row.name));
  const existingIndexes = new Map(objects.filter((row) => row.type === "index").map((row) => [row.name, row.tbl_name]));
  const columns = new Map(tableNames.map((name, index) => [name, new Set(columnResults[index].map((row) => row.name))]));
  const errors = [];
  for (const [name, required] of Object.entries(prerequisites)) {
    if (!tables.has(name)) {
      errors.push(`Missing prerequisite table ${name}; initialize the registration schema first.`);
    } else {
      for (const column of required) {
        if (!columns.get(name).has(column)) errors.push(`Missing prerequisite column ${name}.${column}.`);
      }
    }
  }
  for (const [name, definition] of Object.entries(createdTables)) {
    if (!tables.has(name)) continue;
    for (const column of Object.keys(definition.columns)) {
      if (!columns.get(name).has(column) && !Object.hasOwn(additions[name] || {}, column)) {
        errors.push(`Missing prerequisite column ${name}.${column}.`);
      }
    }
  }
  for (const [name, table] of indexes) {
    if (existingIndexes.has(name) && existingIndexes.get(name) !== table) {
      errors.push(`Index ${name} belongs to an unexpected table.`);
    }
  }
  if (errors.length) throw new Error(`Registration schema preflight failed. No changes applied.\n${errors.join("\n")}`);

  const steps = [];
  for (const [name, definition] of Object.entries(createdTables)) {
    if (tables.has(name)) continue;
    const entries = Object.entries(definition.columns).map(([column, sql]) => `${column} ${sql}`);
    entries.push(...(definition.constraints || []));
    steps.push({ description: `Create ${name}`, sql: `CREATE TABLE IF NOT EXISTS ${name} (\n  ${entries.join(",\n  ")}\n)` });
  }
  for (const [name, required] of Object.entries(additions)) {
    if (!tables.has(name)) continue; // New table definitions already include these columns.
    for (const [column, definition] of Object.entries(required)) {
      if (!columns.get(name).has(column)) {
        steps.push({ description: `Add ${name}.${column}`, sql: `ALTER TABLE ${name} ADD COLUMN ${column} ${definition}` });
      }
    }
  }

  if (tables.has("registration_shop_orders")) {
    const hasToken = columns.get("registration_shop_orders").has("access_token");
    const [missing, duplicates] = await db.read([
      `SELECT COUNT(*) AS count FROM registration_shop_orders${hasToken ? " WHERE access_token IS NULL OR access_token = ''" : ""}`,
      hasToken
        ? "SELECT COUNT(*) AS count FROM (SELECT access_token FROM registration_shop_orders WHERE access_token IS NOT NULL AND access_token <> '' GROUP BY access_token HAVING COUNT(*) > 1)"
        : "SELECT 0 AS count",
    ]);
    if (Number(duplicates[0].count) > 0) {
      throw new Error("Registration schema preflight failed: duplicate nonempty shop access tokens. No changes applied.");
    }
    if (Number(missing[0].count) > 0) {
      steps.push({
        description: "Fill missing shop access tokens (preserve existing tokens)",
        sql: "UPDATE registration_shop_orders SET access_token = lower(hex(randomblob(16))) WHERE access_token IS NULL OR access_token = ''",
      });
    }
  }
  for (const [name, table, column, unique = "", where = ""] of indexes) {
    if (!existingIndexes.has(name)) {
      steps.push({ description: `Create ${name}`, sql: `CREATE ${unique ? `${unique} ` : ""}INDEX IF NOT EXISTS ${name} ON ${table}(${column})${where ? ` ${where}` : ""}` });
    }
  }
  return { steps, legacyAcademyVenue: columns.get("registration_academies").has("venue") };
}

export async function prepareRegistrationSchema(db, { apply = false } = {}) {
  const plan = await planRegistrationSchema(db);
  if (!apply || plan.steps.length === 0) return { ...plan, applied: 0 };
  await db.write(plan.steps.map((step) => step.sql));
  const verified = await planRegistrationSchema(db);
  if (verified.steps.length) throw new Error("Registration schema verification failed after preparation; do not deploy.");
  return { ...verified, applied: plan.steps.length };
}

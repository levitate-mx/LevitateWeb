import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { neon } from "@neondatabase/serverless";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

loadEnvFile(path.join(root, ".env.local"));
loadEnvFile(path.join(root, ".env"));

const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!databaseUrl) {
  console.error("Missing DATABASE_URL or POSTGRES_URL");
  process.exit(1);
}

const sql = neon(databaseUrl);
const schema = fs.readFileSync(path.join(root, "db", "codi_schema.sql"), "utf8");

for (const statement of splitSqlStatements(schema)) {
  await sql.query(statement);
}

console.log("CoDi database schema is ready.");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const [key, ...valueParts] = trimmed.split("=");
    const value = valueParts.join("=").replace(/^['"]|['"]$/g, "");
    process.env[key.trim()] ||= value.trim();
  }
}

function splitSqlStatements(sqlText) {
  return sqlText
    .split(/;\s*(?:\n|$)/)
    .map((statement) => statement.trim())
    .filter(Boolean);
}

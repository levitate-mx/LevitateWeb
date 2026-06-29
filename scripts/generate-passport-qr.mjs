import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import QRCode from "qrcode";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const defaultStations = ["bienvenida", "backstage", "photo-spot", "sponsor-zone", "feedback"];
const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const args = parseArgs(process.argv.slice(2));
const eventSlug = String(args.event || "levitate-cdmx-2026");
const eventId = String(args.eventId || `event-${eventSlug}`);
const count = Number(args.count || 25);
const prefix = String(args.prefix || "COL").toUpperCase();
const siteUrl = normalizeSiteUrl(String(args.site || process.env.PUBLIC_SITE_URL || "https://atilevitate.com"));
const stations = String(args.stations || defaultStations.join(","))
  .split(",")
  .map((station) => station.trim())
  .filter(Boolean);
const outputDir = path.resolve(root, String(args.out || path.join("generated", "passports", eventSlug)));

if (!Number.isInteger(count) || count < 1) {
  throw new Error("--count debe ser un entero mayor a 0");
}

await fs.mkdir(path.join(outputDir, "passports"), { recursive: true });
await fs.mkdir(path.join(outputDir, "stations"), { recursive: true });

const usedCodes = new Set();
const passportRows = [];

while (passportRows.length < count) {
  const code = `${prefix}-${randomCode(4)}`;

  if (usedCodes.has(code)) {
    continue;
  }

  usedCodes.add(code);

  const token = randomToken();
  const claimUrl = `${siteUrl}/passport/claim?token=${encodeURIComponent(token)}`;
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const svgName = `${code.toLowerCase()}.svg`;
  const svg = await QRCode.toString(claimUrl, qrOptions());

  await fs.writeFile(path.join(outputDir, "passports", svgName), svg, "utf8");

  passportRows.push({
    id: `passport-${eventSlug}-${code.toLowerCase()}`,
    code,
    token,
    claimUrl,
    tokenHash,
    qrSvg: `passports/${svgName}`,
  });
}

const stationRows = [];

for (const stationSlug of stations) {
  const stationUrl = `${siteUrl}/e/${eventSlug}/station/${stationSlug}`;
  const svgName = `${stationSlug}.svg`;
  const svg = await QRCode.toString(stationUrl, qrOptions());

  await fs.writeFile(path.join(outputDir, "stations", svgName), svg, "utf8");
  stationRows.push({
    stationSlug,
    stationUrl,
    qrSvg: `stations/${svgName}`,
  });
}

await fs.writeFile(
  path.join(outputDir, "passports.csv"),
  toCsv([
    ["code", "claim_token", "claim_url", "claim_token_hash", "qr_svg"],
    ...passportRows.map((row) => [row.code, row.token, row.claimUrl, row.tokenHash, row.qrSvg]),
  ]),
  "utf8",
);

await fs.writeFile(
  path.join(outputDir, "stations.csv"),
  toCsv([
    ["station_slug", "station_url", "qr_svg"],
    ...stationRows.map((row) => [row.stationSlug, row.stationUrl, row.qrSvg]),
  ]),
  "utf8",
);

await fs.writeFile(path.join(outputDir, "passports.sql"), buildPassportSql(passportRows, eventId), "utf8");

console.log(`Generados ${passportRows.length} pasaportes en ${path.relative(root, outputDir)}`);
console.log(`URL base: ${siteUrl}`);
console.log(`SQL D1: ${path.relative(root, path.join(outputDir, "passports.sql"))}`);

function parseArgs(rawArgs) {
  const parsed = {};

  for (let index = 0; index < rawArgs.length; index += 1) {
    const item = rawArgs[index];

    if (!item.startsWith("--")) {
      continue;
    }

    const [rawKey, inlineValue] = item.slice(2).split("=");
    const nextValue = inlineValue ?? rawArgs[index + 1];
    parsed[rawKey] = nextValue;

    if (inlineValue === undefined) {
      index += 1;
    }
  }

  return parsed;
}

function normalizeSiteUrl(value) {
  return value.replace(/\/+$/, "");
}

function randomCode(size) {
  let code = "";

  while (code.length < size) {
    code += alphabet[crypto.randomInt(0, alphabet.length)];
  }

  return code;
}

function randomToken() {
  return crypto.randomBytes(24).toString("base64url");
}

function qrOptions() {
  return {
    type: "svg",
    margin: 1,
    color: {
      dark: "#050505",
      light: "#fffaf4",
    },
  };
}

function buildPassportSql(rows, targetEventId) {
  const values = rows
    .map(
      (row) =>
        `  ('${sqlString(row.id)}', '${sqlString(targetEventId)}', '${sqlString(row.code)}', '${sqlString(row.tokenHash)}', 'available')`,
    )
    .join(",\n");

  return `INSERT INTO passports (id, event_id, code, claim_token_hash, status)\nVALUES\n${values}\nON CONFLICT (code) DO NOTHING;\n`;
}

function toCsv(rows) {
  return `${rows.map((row) => row.map(csvCell).join(",")).join("\n")}\n`;
}

function csvCell(value) {
  const text = String(value ?? "");

  if (!/[",\n\r]/.test(text)) {
    return text;
  }

  return `"${text.replace(/"/g, '""')}"`;
}

function sqlString(value) {
  return String(value).replace(/'/g, "''");
}

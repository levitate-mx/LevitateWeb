import { execFile } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs, promisify } from "node:util";
import { planRegistrationSchema, prepareRegistrationSchema } from "./lib/registration-schema.mjs";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const execFileAsync = promisify(execFile);

export function createWranglerDatabase({ remote, database = "levitate-passport", persistTo, runCommand = execFileAsync }) {
  const args = [
    resolve(projectRoot, "node_modules/wrangler/bin/wrangler.js"),
    "d1", "execute", database,
    "--config", resolve(projectRoot, "wrangler.jsonc"),
    remote ? "--remote" : "--local", "--json",
  ];
  if (persistTo) args.push("--persist-to", resolve(persistTo));
  const sqlScript = (statements) => `${statements.map((sql) => sql.trim().replace(/;+$/, "")).join(";\n")};`;
  async function invoke(extraArgs) {
    let stdout;
    try {
      ({ stdout } = await runCommand(process.execPath, [...args, ...extraArgs], {
        cwd: projectRoot,
        maxBuffer: 8 * 1024 * 1024,
        env: { ...process.env, CI: "true" },
      }));
    } catch (error) {
      // execFile's message includes its full command, potentially including SQL.
      // Prefer Wrangler's structured API error and never print command arguments.
      let details = "";
      for (const output of [error.stdout, error.stderr]) {
        try {
          const problem = JSON.parse(String(output)).error;
          const parts = typeof problem === "string" ? [problem]
            : [problem?.text || problem?.message, ...(problem?.notes || []).map((note) => note.text)];
          details = parts.filter((part) => typeof part === "string").join(" ").slice(0, 1200);
          if (details) break;
        } catch { /* Non-JSON subprocess output is deliberately omitted. */ }
      }
      throw new Error(`Registration schema command failed${details ? `: ${details}` : ". Wrangler returned no structured error details."}`);
    }
    try {
      return JSON.parse(stdout);
    } catch {
      throw new Error("Unexpected D1 response; schema preparation stopped.");
    }
  }
  async function execute(statements) {
    const result = await invoke(["--command", sqlScript(statements)]);
    if (!Array.isArray(result) || result.length !== statements.length || result.some((item) => item.success !== true)) {
      throw new Error("Unexpected D1 response; schema preparation stopped.");
    }
    return result.map((item) => item.results || []);
  }
  async function write(statements) {
    if (!remote || !statements.some((sql) => /^\s*CREATE\s+TRIGGER\b/i.test(sql))) return execute(statements);
    // Remote --command uses D1's query parser; its trigger bodies can be split
    // at internal semicolons. The SQL importer preserves complete trigger DDL.
    const directory = await mkdtemp(join(tmpdir(), "levitate-registration-schema-"));
    try {
      const file = join(directory, "migration.sql");
      await writeFile(file, sqlScript(statements), { mode: 0o600 });
      const result = await invoke(["--file", file, "--yes"]);
      // File imports return one aggregate result, not one per SQL statement.
      // prepareRegistrationSchema separately verifies every object afterward.
      if (!Array.isArray(result) || result.length !== 1 || result[0]?.success !== true) {
        throw new Error("Unexpected D1 import response; schema preparation stopped.");
      }
      return result.map((item) => item.results || []);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
  return { read: execute, write };
}

export async function main(argv = process.argv.slice(2)) {
  const { values } = parseArgs({
    args: argv,
    options: {
      local: { type: "boolean" }, remote: { type: "boolean" },
      check: { type: "boolean" }, apply: { type: "boolean" },
      database: { type: "string", default: "levitate-passport" },
      "persist-to": { type: "string" }, help: { type: "boolean", short: "h" },
    },
  });
  if (values.help) {
    console.log("Usage: node scripts/prepare-registration-db.mjs (--local | --remote) (--check | --apply) [--database name] [--persist-to local-directory]");
    console.log("--check reads schema metadata and reports pending work; exit 1 means preparation is required. --apply adds only missing runtime schema and backfills missing shop tokens. Initialize a new database with db/registration_d1_schema.sql first.");
    return 0;
  }
  if (Boolean(values.local) === Boolean(values.remote) || Boolean(values.check) === Boolean(values.apply)) {
    throw new Error("Choose exactly one target (--local or --remote) and one mode (--check or --apply).");
  }
  if (values["persist-to"] && !values.local) throw new Error("--persist-to is supported only with --local.");
  const db = createWranglerDatabase({ remote: values.remote, database: values.database, persistTo: values["persist-to"] });
  const plan = await planRegistrationSchema(db);
  console.log(`Registration schema: ${values.database} (${values.remote ? "remote" : "local"}).`);
  if (plan.legacyAcademyVenue) console.log("Legacy academy venue column detected; it will be preserved.");
  if (!plan.steps.length) {
    console.log("Schema is ready. No changes required.");
    return 0;
  }
  for (const step of plan.steps) console.log(`- ${step.description}`);
  if (values.check) {
    console.error("Schema preparation is required before deploying this Worker. Run the same command with --apply instead of --check.");
    return 1;
  }
  // Re-plan immediately before writing so a previously printed plan is never blindly replayed.
  const result = await prepareRegistrationSchema(db, { apply: true });
  console.log(`Schema is ready. Applied ${result.applied} preparation steps and verified the result.`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().then((code) => { process.exitCode = code; }).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

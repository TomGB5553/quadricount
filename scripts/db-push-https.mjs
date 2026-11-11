#!/usr/bin/env node
// Apply pending migrations over HTTPS (Supabase Management API) instead of a
// direct Postgres connection. Use it on networks that block ports 5432/6543
// (e.g. the school wifi), where `supabase db push` hangs on
// "Initialising login role..." and then times out.
//
//   node scripts/db-push-https.mjs           # list pending migrations
//   node scripts/db-push-https.mjs --apply   # apply them, in order
//   node scripts/db-push-https.mjs --mark-applied 20261104100000
//       # record one as applied without running it (it was run by hand)
//
// Token: SUPABASE_ACCESS_TOKEN env var, else the one `supabase login` stored
// in the macOS keychain.
import { readdirSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const REF = readFileSync(join(ROOT, "supabase/.temp/project-ref"), "utf8").trim();
const DIR = join(ROOT, "supabase/migrations");
const apply = process.argv.includes("--apply");

function token() {
  if (process.env.SUPABASE_ACCESS_TOKEN) return process.env.SUPABASE_ACCESS_TOKEN;
  try {
    let raw = execFileSync(
      "security",
      ["find-generic-password", "-s", "Supabase CLI", "-a", "supabase", "-w"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    ).trim();
    if (raw.startsWith("go-keyring-base64:")) {
      raw = Buffer.from(raw.slice(18), "base64").toString("utf8");
    }
    return raw;
  } catch {
    console.error("No token: run `npx supabase login` or set SUPABASE_ACCESS_TOKEN.");
    process.exit(1);
  }
}
const TOKEN = token();

async function query(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${body}`);
  return JSON.parse(body);
}

const lit = (s) => `'${s.replace(/'/g, "''")}'`;

const applied = new Set(
  (await query("select version from supabase_migrations.schema_migrations")).map((r) => r.version),
);
const pending = readdirSync(DIR)
  .filter((f) => /^\d+_.*\.sql$/.test(f))
  .sort()
  .map((f) => ({ file: f, version: f.split("_")[0], name: f.replace(/^\d+_|\.sql$/g, "") }))
  .filter((m) => !applied.has(m.version));

// --mark-applied <version>: record a migration that was already run by hand
// (e.g. pasted into the SQL editor) without running it again.
const markIdx = process.argv.indexOf("--mark-applied");
if (markIdx !== -1) {
  const m = pending.find((p) => p.version === process.argv[markIdx + 1]);
  if (!m) {
    console.error("Not a pending migration version: " + process.argv[markIdx + 1]);
    process.exit(1);
  }
  const sql = readFileSync(join(DIR, m.file), "utf8");
  await query(
    `insert into supabase_migrations.schema_migrations (version, name, statements) ` +
      `values (${lit(m.version)}, ${lit(m.name)}, array[${lit(sql)}])`,
  );
  console.log("Marked as applied (not run): " + m.file);
  process.exit(0);
}

if (!pending.length) {
  console.log("Database is up to date.");
  process.exit(0);
}
console.log("Pending:\n" + pending.map((m) => "  " + m.file).join("\n"));
if (!apply) {
  console.log("\nRun with --apply to apply them.");
  process.exit(0);
}

for (const m of pending) {
  const sql = readFileSync(join(DIR, m.file), "utf8");
  // One request = one transaction: the migration and its history row land together.
  await query(
    `begin;\n${sql}\n;\ninsert into supabase_migrations.schema_migrations (version, name, statements) ` +
      `values (${lit(m.version)}, ${lit(m.name)}, array[${lit(sql)}]);\ncommit;`,
  );
  console.log("Applied " + m.file);
}

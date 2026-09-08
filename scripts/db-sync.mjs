/**
 * Applies the SQL patches in prisma/sql/ as part of a production deploy, so a
 * schema change reaches the database together with the code that needs it.
 *
 * This exists because `expense_payers` shipped in code before it existed in the
 * database, which made every page that reads expenses fail to render with
 * Prisma error P2021.
 *
 * It applies patch files rather than running `prisma db push`. `db push` makes
 * the database *match* the schema, so on a database holding anything the schema
 * no longer describes it insists on dropping it — the production database has
 * a `users.auth_provider` column and a `rate_limit_attempts` table that nothing
 * in this repo references, so every `db push` there fails on data loss. Patches
 * only ever add, and never touch what they do not name.
 *
 * Each file must be idempotent: it is re-applied on every deploy. Guard with
 * `IF NOT EXISTS`, or a `DO $$ ... END $$` block that checks a catalog first.
 * Files apply in filename order, so name them with a leading date.
 *
 * Deliberately narrow:
 *
 *  - Only Vercel production deploys apply patches. Preview deploys share the
 *    production database, so patching from them would let an unmerged branch
 *    reshape it. Pass --force to apply from a local checkout.
 *  - Without database credentials it warns and skips rather than failing, so it
 *    can never turn a deploy that used to succeed into a failed one.
 *  - A patch that errors fails the build, rather than shipping code whose
 *    tables are missing.
 *
 * Set SKIP_DB_SYNC=1 to opt out entirely.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

const SQL_DIR = path.join(process.cwd(), "prisma", "sql");
const SCHEMA = path.join("prisma", "schema.prisma");
const force = process.argv.includes("--force");

function skip(reason) {
  console.log(`[db-sync] Skipped: ${reason}.`);
  process.exit(0);
}

if (process.env.SKIP_DB_SYNC === "1") skip("SKIP_DB_SYNC=1");

if (!force && process.env.VERCEL_ENV !== "production") {
  skip(
    process.env.VERCEL_ENV
      ? `Vercel ${process.env.VERCEL_ENV} deploy, which shares the production database`
      : "not a Vercel production deploy — run `npm run db:apply` to apply patches by hand"
  );
}

const missing = ["DATABASE_URL", "DIRECT_URL"].filter((name) => !process.env[name]);
if (missing.length > 0) {
  console.warn(
    `[db-sync] WARNING: ${missing.join(" and ")} not set, so no schema patches were ` +
      "applied. If this deploy adds a table or column, pages that use it will fail " +
      "to render until you apply prisma/sql/ by hand."
  );
  skip("no database credentials");
}

if (!existsSync(SQL_DIR)) skip(`no ${SQL_DIR} directory`);

const patches = readdirSync(SQL_DIR)
  .filter((name) => name.endsWith(".sql"))
  .sort();
if (patches.length === 0) skip("no .sql patches to apply");

const prismaBin = path.join(
  process.cwd(),
  "node_modules",
  ".bin",
  process.platform === "win32" ? "prisma.cmd" : "prisma"
);
if (!existsSync(prismaBin)) {
  console.warn(`[db-sync] WARNING: ${prismaBin} not found, so no patches were applied.`);
  skip("prisma CLI not installed");
}

console.log(`[db-sync] Applying ${patches.length} schema patch(es) from prisma/sql/...`);
for (const name of patches) {
  process.stdout.write(`[db-sync]   ${name} ... `);
  const result = spawnSync(
    prismaBin,
    ["db", "execute", "--file", path.join(SQL_DIR, name), "--schema", SCHEMA],
    { encoding: "utf8" }
  );

  if (result.error) {
    console.error(`failed\n[db-sync] Could not run prisma: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error("failed");
    if (result.stdout) console.error(result.stdout.trim());
    if (result.stderr) console.error(result.stderr.trim());
    process.exit(result.status ?? 1);
  }
  console.log("ok");
}
console.log("[db-sync] Done.");

/**
 * Applies the Prisma schema to the database as part of a production deploy, so
 * a schema change reaches the database together with the code that needs it.
 *
 * This exists because `expense_payers` shipped in code before it existed in the
 * database, which made every page that reads expenses fail to render with
 * Prisma error P2021.
 *
 * Deliberately narrow:
 *
 *  - Only Vercel production deploys sync. Preview deploys share the production
 *    database, so pushing from them would let an unmerged branch reshape it.
 *    Local and CI builds do nothing; run `npm run db:push` by hand instead.
 *  - Without database credentials it warns and skips rather than failing, so
 *    this can never turn a deploy that used to succeed into a failed one.
 *  - `prisma db push` runs without `--accept-data-loss`, so a schema that would
 *    drop a column or table fails the build instead of destroying data.
 *
 * Set SKIP_DB_SYNC=1 to opt out entirely.
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

function skip(reason) {
  console.log(`[db-sync] Skipped: ${reason}.`);
  process.exit(0);
}

if (process.env.SKIP_DB_SYNC === "1") skip("SKIP_DB_SYNC=1");

if (process.env.VERCEL_ENV !== "production") {
  skip(
    process.env.VERCEL_ENV
      ? `Vercel ${process.env.VERCEL_ENV} deploy, which shares the production database`
      : "not a Vercel production deploy — run `npm run db:push` to sync by hand"
  );
}

const missing = ["DATABASE_URL", "DIRECT_URL"].filter((name) => !process.env[name]);
if (missing.length > 0) {
  console.warn(
    `[db-sync] WARNING: ${missing.join(" and ")} not set at build time, so the ` +
      "database schema was not synced. If this deploy adds a table or column, " +
      "pages that use it will fail to render until you apply the schema by hand."
  );
  skip("no database credentials");
}

const prismaBin = path.join(
  process.cwd(),
  "node_modules",
  ".bin",
  process.platform === "win32" ? "prisma.cmd" : "prisma"
);
if (!existsSync(prismaBin)) {
  console.warn(`[db-sync] WARNING: ${prismaBin} not found, so the schema was not synced.`);
  skip("prisma CLI not installed");
}

console.log("[db-sync] Syncing the database with prisma/schema.prisma...");
const result = spawnSync(prismaBin, ["db", "push", "--skip-generate"], { stdio: "inherit" });

if (result.error) {
  console.error(`[db-sync] Could not run prisma: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);

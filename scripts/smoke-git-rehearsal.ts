/**
 * One-shot: inject canary commit to MONITORED_REPO, then revert.
 * Usage: npx tsx scripts/smoke-git-rehearsal.ts
 * Requires .env.local: GITHUB_TOKEN, optional MONITORED_REPO / BRIDGE_REHEARSAL_*
 */
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

import {
  injectRehearsalCanary,
  revertRehearsalCanary,
} from "../lib/git-rehearsal";
import { getMonitoredRepo } from "../lib/monitored-repo";

async function main() {
  if (!process.env.GITHUB_TOKEN?.trim()) {
    console.error("GITHUB_TOKEN missing (.env.local)");
    process.exit(1);
  }
  console.log("repo:", getMonitoredRepo());
  const inj = await injectRehearsalCanary();
  console.log("inject OK", inj.path, inj.sha.slice(0, 7));
  const rev = await revertRehearsalCanary();
  console.log(
    "revert OK",
    rev.noop ? "noop (no file)" : rev.sha?.slice(0, 7) ?? "no sha"
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

/**
 * Canonical GitHub `owner/repo` for webhooks, demo trigger, and UI when env is unset.
 * Override with `MONITORED_REPO` (server) / `NEXT_PUBLIC_MONITORED_REPO` (client display).
 */
export const DEFAULT_MONITORED_REPO = "richard7ao/meridian-core-banking";

export function getMonitoredRepo(): string {
  return process.env.MONITORED_REPO ?? DEFAULT_MONITORED_REPO;
}

"use step";

import {
  detectExternalFetch,
  detectAuthPath,
  detectSecretShapes,
  detectCriticalPath,
  detectNewDependency,
  detectNewEndpoint,
  type DetectResult,
  type DepDetectResult,
} from "../../lib/signals/structural";
import { detectTemporal } from "../../lib/signals/temporal";
import { CRITICAL_PATHS } from "../../lib/critical-paths";
import type { IngestResult } from "./ingest";

type SignalHit = DetectResult & { file: string };
type DepSignalHit = DepDetectResult & { file: string };

type SignalResult = {
  structural: {
    external_fetch: SignalHit[];
    auth_path: SignalHit[];
    secret_shapes: SignalHit[];
    critical_path: SignalHit[];
    new_dependency: DepSignalHit[];
    new_endpoint: SignalHit[];
    [key: string]: unknown;
  };
  behavioral: Record<string, unknown>;
  temporal: Record<string, unknown>;
};

export async function extractSignals(
  ingest: IngestResult
): Promise<SignalResult> {
  const external_fetch: SignalHit[] = [];
  const auth_path: SignalHit[] = [];
  const secret_shapes: SignalHit[] = [];
  const critical_path: SignalHit[] = [];
  const new_dependency: DepSignalHit[] = [];
  const new_endpoint: SignalHit[] = [];

  for (const file of ingest.files) {
    const fp = file.path;
    const ef = detectExternalFetch(file);
    if (ef.matched) external_fetch.push({ ...ef, file: fp });
    const ap = detectAuthPath(file);
    if (ap.matched) auth_path.push({ ...ap, file: fp });
    const ss = detectSecretShapes(file);
    if (ss.matched) secret_shapes.push({ ...ss, file: fp });
    const cp = detectCriticalPath(file, CRITICAL_PATHS);
    if (cp.matched) critical_path.push({ ...cp, file: fp });
    const nd = detectNewDependency(file);
    if (nd.matched) new_dependency.push({ ...nd, file: fp });
    const ne = detectNewEndpoint(file);
    if (ne.matched) new_endpoint.push({ ...ne, file: fp });
  }

  const temporal = await detectTemporal({ pushed_at: ingest.pushed_at });

  return {
    structural: {
      external_fetch,
      auth_path,
      secret_shapes,
      critical_path,
      new_dependency,
      new_endpoint,
    },
    behavioral: {},
    temporal: {
      off_hours: temporal.off_hours,
      weekend: temporal.weekend,
      rapid_succession: temporal.rapid_succession,
      severity: temporal.severity,
    },
  };
}

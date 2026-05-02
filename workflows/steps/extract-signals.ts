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

function collectHits<T extends { matched: boolean }>(
  files: IngestResult["files"],
  detect: (file: IngestResult["files"][0]) => T
): (T & { file: string })[] {
  const hits: (T & { file: string })[] = [];
  for (const file of files) {
    const result = detect(file);
    if (result.matched) {
      hits.push({ ...result, file: file.path });
    }
  }
  return hits;
}

export async function extractSignals(
  ingest: IngestResult
): Promise<SignalResult> {
  return {
    structural: {
      external_fetch: collectHits(ingest.files, (f) => detectExternalFetch(f)),
      auth_path: collectHits(ingest.files, (f) => detectAuthPath(f)),
      secret_shapes: collectHits(ingest.files, (f) => detectSecretShapes(f)),
      critical_path: collectHits(ingest.files, (f) =>
        detectCriticalPath(f, CRITICAL_PATHS)
      ),
      new_dependency: collectHits(ingest.files, (f) => detectNewDependency(f)),
      new_endpoint: collectHits(ingest.files, (f) => detectNewEndpoint(f)),
    },
    behavioral: {},
    temporal: {},
  };
}

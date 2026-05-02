"use step";

import {
  detectExternalFetch,
  type DetectResult,
} from "../../lib/signals/structural";
import type { IngestResult } from "./ingest";

type SignalHit = DetectResult & { file: string };

type SignalResult = {
  structural: {
    external_fetch: SignalHit[];
    [key: string]: unknown;
  };
  behavioral: Record<string, unknown>;
  temporal: Record<string, unknown>;
};

export async function extractSignals(
  ingest: IngestResult
): Promise<SignalResult> {
  const externalFetchHits: SignalHit[] = [];

  for (const file of ingest.files) {
    const result = detectExternalFetch(file);
    if (result.matched) {
      externalFetchHits.push({ ...result, file: file.path });
    }
  }

  return {
    structural: {
      external_fetch: externalFetchHits,
    },
    behavioral: {},
    temporal: {},
  };
}

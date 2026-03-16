import type { DataFastTracking } from '../foundation/types.js';

/**
 * Extracts DataFast tracking IDs from Creem metadata.
 */
export function readTrackingFromMetadata(
  metadata: Record<string, unknown> | null | undefined
): DataFastTracking {
  return {
    visitorId: (metadata?.datafast_visitor_id as string) ?? undefined,
    sessionId: (metadata?.datafast_session_id as string) ?? undefined,
  };
}

/**
 * Merges DataFast tracking IDs into Creem metadata.
 */
export function mergeTrackingIntoMetadata(
  metadata: Record<string, unknown> | null | undefined,
  tracking: DataFastTracking,
  options: { captureSessionId: boolean; preferTracking: boolean }
): Record<string, unknown> {
  const result = { ...(metadata ?? {}) };

  if (tracking.visitorId && (options.preferTracking || !result.datafast_visitor_id)) {
    result.datafast_visitor_id = tracking.visitorId;
  }

  if (
    options.captureSessionId &&
    tracking.sessionId &&
    (options.preferTracking || !result.datafast_session_id)
  ) {
    result.datafast_session_id = tracking.sessionId;
  }

  return result;
}

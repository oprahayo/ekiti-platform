import type { Pool, PoolClient } from 'pg';
import { reconcileCandidates, validateCoordinates } from '../geo/resolve.ts';
import type { CandidateInput } from '../geo/types.ts';

/** Server entry point for a citizen-confirmed incident position. */
export async function resolveIncidentLocation(db: Pool | PoolClient, latitude: number, longitude: number) {
  validateCoordinates(latitude, longitude);
  const { rows } = await db.query<{ evidence: CandidateInput }>(
    'SELECT geo.location_candidates($1, $2) AS evidence', [latitude, longitude],
  );
  const evidence = rows[0]!.evidence;
  return {
    stateBoundaryStatus: evidence.stateBoundaryStatus,
    stateOnBoundary: evidence.stateOnBoundary,
    ...reconcileCandidates(evidence),
  };
}

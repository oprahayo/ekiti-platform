import type { AreaMatch, CandidateInput, LevelResolution, Resolution } from './types.ts';

function level(matches: AreaMatch[], outside: boolean): LevelResolution {
  const unique = [...new Map(matches.map((match) => [match.id, match])).values()];
  return {
    status: outside ? 'outside_scope' : unique.length === 0 ? 'unmapped' : unique.length === 1 ? 'matched' : 'ambiguous',
    match: !outside && unique.length === 1 ? unique[0]! : null,
    candidates: outside ? [] : unique,
  };
}

/**
 * Reconciles DB-provided candidates. Does NOT perform point-in-polygon and does not
 * infer a location from a place name.
 */
export function reconcileCandidates(input: CandidateInput): Resolution {
  const outside = input.stateBoundaryStatus === 'outside';
  const lga = level(input.lgas, outside);
  const ward = level(input.wards, outside);
  const conflict = Boolean(lga.match && ward.match && ward.match.parentId && ward.match.parentId !== lga.match.id);
  const consistent = Boolean(lga.match && ward.match && ward.match.parentId === lga.match.id);

  const onBoundary = input.stateOnBoundary || lga.match?.onBoundary || ward.match?.onBoundary;
  return {
    lga,
    ward,
    consistency: conflict ? 'conflict' : consistent ? 'consistent' : 'unverified',
    requiresConfirmation: !consistent || Boolean(onBoundary) || input.stateBoundaryStatus !== 'inside',
  };
}

export function validateCoordinates(latitude: number, longitude: number): void {
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw new RangeError('latitude must be a finite number between -90 and 90');
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new RangeError('longitude must be a finite number between -180 and 180');
  }
}

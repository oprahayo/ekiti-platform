/** Deterministic outputs from audited geographic evidence, never from a guessed name. */
export type AreaLevel = 'state' | 'lga' | 'ward';
export type MatchStatus = 'matched' | 'unmapped' | 'ambiguous' | 'outside_scope';
export type Consistency = 'consistent' | 'conflict' | 'unverified';

export interface AreaMatch {
  id: string;
  name: string;
  parentId?: string;
  sourceId: string;
  sourceIds?: string[];
  sources?: { id: string; recordId: string | null }[];
  onBoundary?: boolean;
}

export interface LevelResolution {
  status: MatchStatus;
  match: AreaMatch | null;
  candidates: AreaMatch[];
}

export interface Resolution {
  lga: LevelResolution;
  ward: LevelResolution;
  consistency: Consistency;
  requiresConfirmation: boolean;
}

/** Server-provided spatial candidates from VERIFIED boundaries only. */
export interface CandidateInput {
  stateBoundaryStatus: 'inside' | 'outside' | 'unknown';
  stateOnBoundary?: boolean;
  lgas: AreaMatch[];
  wards: AreaMatch[];
}

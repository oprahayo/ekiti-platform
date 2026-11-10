import type { VerifiedAdminIdentity } from './admin-auth.ts';

/** Staff membership must come from an independently restricted SERVER registry. */
export type AdminRole =
  | 'platform_admin' | 'case_manager' | 'moderator'
  | 'directory_reviewer' | 'government_officer' | 'auditor';
export type AdminCapability =
  | 'case.read' | 'case.assign' | 'case.note' | 'case.resolve' | 'case.route'
  | 'moderation.read' | 'moderation.decide'
  | 'office.accept' | 'office.view' | 'office.respond'
  | 'audit.read' | 'staff.manage';
export interface StaffMembership {
  userId: string;
  role: AdminRole;
  active: boolean;
  expiresAt: number | null;
  allowedLgaIds: readonly string[];
  verifiedOfficeId: string | null;
}
export type AdminTarget =
  | { kind: 'case'; lgaId: string }
  | { kind: 'moderation'; lgaId: string | null }
  | { kind: 'office'; officeId: string; verifiedOffice: boolean; referralPending: boolean; deliveryRecorded: boolean }
  | { kind: 'platform' };

const grant: Record<AdminRole, readonly AdminCapability[]> = {
  platform_admin: ['case.read','case.assign','case.note','case.resolve','case.route',
    'moderation.read','moderation.decide','audit.read','staff.manage'],
  case_manager: ['case.read','case.assign','case.note','case.resolve','case.route'],
  moderator: ['case.read','case.note','moderation.read','moderation.decide'],
  directory_reviewer: ['moderation.read','moderation.decide'],
  auditor: ['audit.read'],
  government_officer: ['office.accept','office.view','office.respond'],
};
export interface AccessRequest {
  identity: VerifiedAdminIdentity | null;
  membership: StaffMembership | null;
  capability: AdminCapability;
  target: AdminTarget;
  nowSeconds: number;
}

/**
 * Pure default-deny authorization contract. Only a server which has ALREADY
 * cryptographically verified identity and independently fetched membership may
 * call this. Not an HTTP endpoint or a client-side security boundary.
 */
export function authorizeAdmin(request: AccessRequest): boolean {
  const { identity, membership, capability, target, nowSeconds } = request;
  if (!identity || !membership || !membership.active ||
    identity.assurance !== 'aal2' || identity.expiresAt <= nowSeconds ||
    (membership.expiresAt !== null && membership.expiresAt <= nowSeconds) ||
    membership.userId !== identity.subject ||
    !grant[membership.role]?.includes(capability)) return false;

  // Platform administrators cannot impersonate officers or synthesize
  // authenticated agency reads, receipts or responses.
  if (capability.startsWith('office.')) {
    return membership.role === 'government_officer' &&
      target.kind === 'office' && target.verifiedOffice &&
      !!membership.verifiedOfficeId && target.officeId === membership.verifiedOfficeId &&
      (capability === 'office.accept' ? target.referralPending : target.deliveryRecorded);
  }
  if (capability.startsWith('case.')) {
    return target.kind === 'case' && !!target.lgaId &&
      (membership.role === 'platform_admin' || membership.allowedLgaIds.includes(target.lgaId));
  }
  if (capability.startsWith('moderation.')) {
    return target.kind === 'moderation' &&
      (membership.role === 'platform_admin' ||
        (!!target.lgaId && membership.allowedLgaIds.includes(target.lgaId)));
  }
  if (capability === 'audit.read' || capability === 'staff.manage') {
    return target.kind === 'platform';
  }
  return false;
}

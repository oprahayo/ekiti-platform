/**
 * Sprint 05: reviewable, fail-closed operational prerequisites for the
 * proposed private reporting gateway. Configuration flags are evidence
 * placeholders, NOT proof that a legal/privacy review has taken place.
 *
 * Nothing in this module enables intake. The Worker defaults to 404.
 */
export interface RateLimitBinding {
  limit(options:{key:string}):Promise<{success:boolean}>;
}

export interface IntakeReleaseConfig {
  REPORTING_ENABLED?:string;
  REPORTING_BOUND_ORIGIN?:string;
  REPORTING_OPERATOR_ID?:string;
  REPORTING_RELEASE_APPROVAL_ID?:string;
  REPORTING_RETENTION_JOB_VERIFIED?:string;
  REPORTING_HYPERDRIVE?:{connectionString:string};
  REPORTING_LIMIT?:RateLimitBinding;
  REPORTING_TRACK_LIMIT?:RateLimitBinding;
  REPORTING_POLICY_VERSION?:string;
  REPORTING_RETENTION_DAYS?:string;
}

export type IntakeReleaseStatus =
  | {ready:false;reason:'disabled'|'approval_or_configuration_missing'}
  | {ready:true;origin:string;policyVersion:string;retentionDays:number};

/** No broad truthy parsing: booleans must be the exact reviewed 'true'. */
export function assessIntakeRelease(env:IntakeReleaseConfig):IntakeReleaseStatus {
  if(env.REPORTING_ENABLED!=='true') return {ready:false,reason:'disabled'};
  const origin=env.REPORTING_BOUND_ORIGIN;
  let approvedOrigin='';
  try {
    if(typeof origin!=='string') throw Error('Missing bound origin');
    const parsed=new URL(origin);
    if(parsed.protocol!=='https:' || parsed.origin!==origin ||
      parsed.username || parsed.password || parsed.pathname!=='/' ||
      parsed.search || parsed.hash) throw Error('Invalid bound origin');
    approvedOrigin=parsed.origin;
  } catch {return {ready:false,reason:'approval_or_configuration_missing'};}
  const retention=Number(env.REPORTING_RETENTION_DAYS);
  if(!env.REPORTING_OPERATOR_ID?.trim() ||
    !env.REPORTING_RELEASE_APPROVAL_ID?.trim() ||
    env.REPORTING_RETENTION_JOB_VERIFIED!=='true' ||
    !env.REPORTING_HYPERDRIVE?.connectionString?.trim() ||
    !env.REPORTING_LIMIT || !env.REPORTING_TRACK_LIMIT ||
    env.REPORTING_LIMIT===env.REPORTING_TRACK_LIMIT ||
    !env.REPORTING_POLICY_VERSION?.trim() ||
    !Number.isInteger(retention) || retention<1 || retention>365)
    return {ready:false,reason:'approval_or_configuration_missing'};
  return {ready:true,origin:approvedOrigin,
    policyVersion:env.REPORTING_POLICY_VERSION,retentionDays:retention};
}

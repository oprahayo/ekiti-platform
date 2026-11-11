import * as React from 'react';
import {caseTimelineEnabled} from './case-timeline.ts';
import {
  authenticateSession, authorizedRpc, configuredAuth, readTabSession, refreshSession,
  requestEmailCode, requestSmsCode, verifySmsCode, phoneOtpEnabled, privateHistoryEnabled, caseLinkEnabled,
  saveTabSession, signOutSession, verifyEmailCode,
  type CitizenSession,
} from './auth-api.ts';

interface AuthState {
  available: boolean;
  restoring: boolean;
  account: { id: string; email: string; phone?:string } | null;
  phoneAvailable:boolean;
  reportHistoryAvailable:boolean;
  caseLinksAvailable:boolean;
  caseTimelineAvailable:boolean;
  requestCode(email: string): Promise<void>;
  verifyCode(email: string, code: string): Promise<void>;
  requestPhoneCode(phone:string):Promise<void>;
  verifyPhoneCode(phone:string,code:string):Promise<void>;
  signOut(): Promise<void>;
  rpc<T>(name: 'civic_submit_review'|'civic_request_claim'|'civic_my_reviews'|'civic_my_claims' |
    'civic_link_private_report'|'civic_my_private_reports'|'civic_unlink_private_report'|
    'civic_request_case_link'|'civic_redeem_case_link'|
    'civic_my_case_timeline'|'civic_set_case_notice_preference'|'civic_request_case_review',
    body: Record<string,unknown>): Promise<T>;
}
const AuthContext = React.createContext<AuthState | null>(null);
const config = configuredAuth();

export function CitizenAuthProvider({ children }: { children: React.ReactNode }) {
  const [session,setSession] = React.useState<CitizenSession | null>(null);
  const [restoring,setRestoring] = React.useState(Boolean(config && readTabSession()));

  React.useEffect(() => {
    if (!config) return;
    const cached = readTabSession();
    if (!cached) { setRestoring(false); return; }
    let cancelled = false;
    void authenticateSession(config,cached).then(value => {
      if (cancelled) return;
      saveTabSession(value);
      setSession(value);
    }).catch(() => {
      if (cancelled) return;
      saveTabSession(null); setSession(null);
    }).finally(() => { if (!cancelled) setRestoring(false); });
    return () => { cancelled = true; };
  }, []);

  const requestCode = async (email: string) => {
    if (!config) throw new Error('Citizen sign-in has not been activated.');
    await requestEmailCode(config,email);
  };
  const verifyCode = async (email: string,code: string) => {
    if (!config) throw new Error('Citizen sign-in has not been activated.');
    const value = await verifyEmailCode(config,email,code);
    saveTabSession(value); setSession(value);
  };
  const requestPhoneCode=async(phone:string)=>{
    if(!config||!phoneOtpEnabled())throw new Error('Phone verification is not active.');
    await requestSmsCode(config,phone);
  };
  const verifyPhoneCode=async(phone:string,code:string)=>{
    if(!config||!phoneOtpEnabled())throw new Error('Phone verification is not active.');
    const value=await verifySmsCode(config,phone,code);
    saveTabSession(value);setSession(value);
  };
  const signOut = async () => {
    const old = session;
    saveTabSession(null); setSession(null);
    if (config && old) await signOutSession(config,old);
  };
  const rpc: AuthState['rpc'] = async (name,body) => {
    if (!config || !session) throw new Error('Sign in to send this request.');
    if(name.startsWith('civic_')&&name.includes('private_report')&&!privateHistoryEnabled())
      throw new Error('Linked private reports have not been activated.');
    if((name==='civic_request_case_link'||name==='civic_redeem_case_link')&&!caseLinkEnabled())
      throw new Error('Private case message links are not active.');
    if((name==='civic_my_case_timeline'||name==='civic_set_case_notice_preference'||
       name==='civic_request_case_review')&&
       (!privateHistoryEnabled()||!caseTimelineEnabled()))
      throw new Error('Private case timeline is not active.');
    try {
      // The direct, authenticated PostgREST RPC verifies its own JWT and role.
      const result = await authorizedRpc<unknown>(config,session,name,body);
      const updated = readTabSession();
      if (updated?.identity.id === session.identity.id &&
          updated.access_token !== session.access_token) setSession(updated);
      return result as never;
    } catch (error) {
      if (error instanceof Error && /session.*authorized|Session verification failed/.test(error.message)) {
        saveTabSession(null);setSession(null);
      }
      throw error;
    }
  };
  const value: AuthState = {
    available: Boolean(config),restoring,account: session?.identity ?? null,
    phoneAvailable:phoneOtpEnabled(),reportHistoryAvailable:privateHistoryEnabled(),
    caseLinksAvailable:caseLinkEnabled(),
    caseTimelineAvailable:privateHistoryEnabled()&&caseTimelineEnabled(),
    requestCode,verifyCode,requestPhoneCode,verifyPhoneCode,signOut,rpc,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useCitizenAuth() {
  const state = React.useContext(AuthContext);
  if (!state) throw new Error('CitizenAuthProvider required');
  return state;
}

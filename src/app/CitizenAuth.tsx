import * as React from 'react';
import {
  authenticateSession, authorizedRpc, configuredAuth, readTabSession, refreshSession,
  requestEmailCode, saveTabSession, signOutSession, verifyEmailCode,
  type CitizenSession,
} from './auth-api.ts';

interface AuthState {
  available: boolean;
  restoring: boolean;
  account: { id: string; email: string } | null;
  requestCode(email: string): Promise<void>;
  verifyCode(email: string, code: string): Promise<void>;
  signOut(): Promise<void>;
  rpc<T>(name: 'civic_submit_review'|'civic_request_claim'|'civic_my_reviews'|'civic_my_claims',
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
  const signOut = async () => {
    const old = session;
    saveTabSession(null); setSession(null);
    if (config && old) await signOutSession(config,old);
  };
  const rpc: AuthState['rpc'] = async (name,body) => {
    if (!config || !session) throw new Error('Sign in to send this request.');
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
    requestCode,verifyCode,signOut,rpc,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useCitizenAuth() {
  const state = React.useContext(AuthContext);
  if (!state) throw new Error('CitizenAuthProvider required');
  return state;
}

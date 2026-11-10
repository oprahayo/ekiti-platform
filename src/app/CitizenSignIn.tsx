import * as React from 'react';
import InfoDialog from './InfoDialog.tsx';
import { useCitizenAuth } from './CitizenAuth.tsx';

export default function CitizenSignIn({ onClose }: { onClose: () => void }) {
  const auth = useCitizenAuth();
  const [email,setEmail] = React.useState('');
  const [code,setCode] = React.useState('');
  const [sent,setSent] = React.useState(false);
  const [busy,setBusy] = React.useState(false);
  const [notice,setNotice] = React.useState('');
  const perform = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);setNotice('');
    try { await action(); } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Authentication is temporarily unavailable.');
    } finally { setBusy(false); }
  };
  return <InfoDialog title="Sign in & Citizen Profile" onClose={onClose}>
    <div className="about-dialog-copy citizen-signin-dialog">
      {auth.restoring ? <p role="status">Checking your saved session…</p> :
      auth.account ? <>
        <p role="status">Signed in with a verified email address.</p>
        <p><strong>{auth.account.email}</strong></p>
        <p className="note">Email verification is not proof of residency or business ownership. Reviews and claims still require moderation.</p>
        <button type="button" className="quiet-action" disabled={busy} onClick={() =>
          void perform(async () => { await auth.signOut(); setNotice('Signed out of this browser tab.'); })}>
          Sign out
        </button>
      </> : !auth.available ? <>
        <p>Guest browsing works today, without creating an account or sharing your personal details.</p>
        <p>Verified citizen sign-in is not active. We will not collect a password, phone number or identity document in an unconnected form.</p>
        <p className="privacy-notice">Email sign-in requires an approved Supabase Auth configuration, an email-code template, and a reviewed privacy policy.</p>
        <button type="button" className="quiet-action" onClick={onClose}>Continue as guest</button>
      </> : <>
        <p>Sign in using a one-time email code. No password, national ID or photo is needed.</p>
        <p className="note">You can browse and prepare review drafts as a guest. Your email will be sent only when you request a code.</p>
        <form onSubmit={event => { event.preventDefault(); void perform(async () => {
          await auth.requestCode(email);setSent(true);setNotice('If this address can receive email, check your inbox for a sign-in code.');
        }); }}>
          <label htmlFor="citizen-email">Email address</label>
          <input id="citizen-email" type="email" required autoComplete="email" maxLength={254}
            value={email} onChange={event => setEmail(event.target.value)} disabled={busy || sent}
            placeholder="you@example.com" />
          {!sent && <button type="submit" className="primary-action" disabled={busy}>Email me a sign-in code</button>}
        </form>
        {sent && <form onSubmit={event => { event.preventDefault(); void perform(async () => {
          await auth.verifyCode(email,code);
          setNotice('Email confirmed. You are signed in, but claims and reviews require moderation.');
        }); }}>
          <label htmlFor="citizen-otp">One-time email code</label>
          <input id="citizen-otp" inputMode="numeric" autoComplete="one-time-code" required
            minLength={6} maxLength={8} pattern="[0-9]{6,8}"
            value={code} onChange={event => setCode(event.target.value.replace(/[^0-9]/g,''))}
            placeholder="123456" />
          <button type="submit" className="primary-action" disabled={busy}>Verify email and sign in</button>
          <button type="button" className="text-link" disabled={busy} onClick={() => {
            setSent(false);setCode('');setNotice('');
          }}>Use another email address</button>
        </form>}
      </>}
      {notice && <p role="status" className="note">{notice}</p>}
      <p className="metadata">Your session is kept in this browser tab. This platform is independent and not a government identity service.</p>
    </div>
  </InfoDialog>;
}

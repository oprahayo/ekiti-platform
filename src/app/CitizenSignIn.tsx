import * as React from 'react';
import InfoDialog from './InfoDialog.tsx';
import { useCitizenAuth } from './CitizenAuth.tsx';

/**
 * Optional verified account entry. This does not enable real reporting or
 * treat OTP as legal identity/KYC verification.
 */
export default function CitizenSignIn({ onClose }: { onClose: () => void }) {
  const auth=useCitizenAuth();
  const [channel,setChannel]=React.useState<'email'|'phone'>('email');
  const [email,setEmail]=React.useState('');
  const [phone,setPhone]=React.useState('');
  const [code,setCode]=React.useState('');
  const [sent,setSent]=React.useState(false);
  const [busy,setBusy]=React.useState(false);
  const [notice,setNotice]=React.useState('');
  const perform=async(action:()=>Promise<void>)=>{
    if(busy)return;
    setBusy(true);setNotice('');
    try{await action();}
    catch(e){setNotice(e instanceof Error?e.message:'Authentication is temporarily unavailable.');}
    finally{setBusy(false);}
  };
  const changeChannel=(value:'email'|'phone')=>{
    if(busy)return;
    setChannel(value);setCode('');setSent(false);setNotice('');
  };
  const maskedAccount=auth.account?.email||auth.account?.phone||'Verified account';
  return <InfoDialog title="Sign in & Citizen Profile" onClose={onClose}>
    <div className="about-dialog-copy citizen-signin-dialog">
      {auth.restoring?<p role="status">Checking your saved session…</p>:
      auth.account?<>
        <p role="status">Signed in with a verified {auth.account.email?'email address':'phone number'}.</p>
        <p><strong>{maskedAccount}</strong></p>
        <p className="note">A verified email or phone is not proof of Ekiti residency, business ownership
          or legal identity. Private reports cannot be linked without their original receipt secret.</p>
        <button type="button" className="quiet-action" disabled={busy}
          onClick={()=>void perform(async()=>{
            await auth.signOut();setCode('');setNotice('Signed out of this browser tab.');
          })}>Sign out</button>
      </>:!auth.available?<>
        <p>Guest browsing works today, without creating an account or sharing your personal details.</p>
        <p>Verified citizen sign-in is not active. We will not collect a password, phone number or identity document in an unconnected form.</p>
        <p className="privacy-notice">Email sign-in requires an approved Supabase Auth configuration,
          an email-code template, and a reviewed privacy policy.</p>
        <button type="button" className="quiet-action" onClick={onClose}>Continue as guest</button>
      </>:<>
        <p>Use a one-time code to sign in, create an optional account, or regain access to
          an account using the same verified contact. No password or national ID is needed.</p>
        <p className="note">Guest browsing and private local drafts remain available.
          Only an explicit request sends your address or number to the approved Supabase Auth service.
          This will not recover an unlinked report receipt.</p>
        {auth.phoneAvailable&&<div className="citizen-auth-channel" role="group" aria-label="Verification method">
          <button type="button" aria-pressed={channel==='email'}
            onClick={()=>changeChannel('email')}>Email code</button>
          <button type="button" aria-pressed={channel==='phone'}
            onClick={()=>changeChannel('phone')}>SMS code</button>
        </div>}
        <form onSubmit={event=>{event.preventDefault();void perform(async()=>{
          if(channel==='phone'){
            await auth.requestPhoneCode(phone);
          }else await auth.requestCode(email);
          setSent(true);
          setNotice('If this contact can receive messages, check for a one-time code.');
        });}}>
          {channel==='email'?<>
            <label htmlFor="citizen-email">Email address</label>
            <input id="citizen-email" type="email" required autoComplete="email"
              maxLength={254} value={email} disabled={busy||sent}
              onChange={event=>setEmail(event.target.value)} placeholder="you@example.com"/>
          </>:<>
            <label htmlFor="citizen-phone">Mobile number including country code</label>
            <input id="citizen-phone" type="tel" required autoComplete="tel" inputMode="tel"
              maxLength={16} value={phone} disabled={busy||sent}
              pattern="\\+[1-9][0-9]{7,14}" onChange={event=>setPhone(event.target.value)}
              placeholder="+2348012345678"/>
            <p className="note">SMS sign-in is optional and must be explicitly enabled with an approved
              delivery provider and privacy policy. Message charges may apply.</p>
          </>}
          {!sent&&<button type="submit" className="primary-action" disabled={busy}>
            {channel==='phone'?'Text me a sign-in code':'Email me a sign-in code'}
          </button>}
        </form>
        {sent&&<form onSubmit={event=>{event.preventDefault();void perform(async()=>{
          if(channel==='phone')await auth.verifyPhoneCode(phone,code);
          else await auth.verifyCode(email,code);
          setCode('');
          setNotice('Your account is verified. Reporting and report linking still require separate approval.');
        });}}>
          <label htmlFor="citizen-otp">One-time {channel==='phone'?'SMS':'email'} code</label>
          <input id="citizen-otp" inputMode="numeric" autoComplete="one-time-code"
            required minLength={6} maxLength={8} pattern="[0-9]{6,8}"
            value={code} disabled={busy} onChange={event=>setCode(event.target.value.replace(/[^0-9]/g,''))}
            placeholder="123456"/>
          <button type="submit" className="primary-action" disabled={busy}>Verify and sign in</button>
          <button type="button" className="text-link" disabled={busy}
            onClick={()=>{setSent(false);setCode('');setNotice('');}}>Use another contact or request a new code</button>
        </form>}
        <p className="note">If you lose access to this device, verify the same email or phone on a new device.
          This restores only the same authenticated account and previously linked reports;
          unlinked receipt secrets cannot be reissued.</p>
      </>}
      {notice&&<p role="status" className="note">{notice}</p>}
      <p className="metadata">Your account session is kept in this browser tab.
        This independent platform is not a government identity service.</p>
    </div>
  </InfoDialog>;
}

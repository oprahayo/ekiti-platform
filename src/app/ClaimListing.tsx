import * as React from 'react';
import InfoDialog from './InfoDialog.tsx';
import CitizenSignIn from './CitizenSignIn.tsx';
import { useCitizenAuth } from './CitizenAuth.tsx';

export default function ClaimListing({ id, name, onClose }: { id: string; name: string; onClose: () => void }) {
  const auth = useCitizenAuth();
  const [description,setDescription] = React.useState('');
  const [authOpen,setAuthOpen] = React.useState(false);
  const [busy,setBusy] = React.useState(false);
  const [submitted,setSubmitted] = React.useState(false);
  const [message,setMessage] = React.useState('');
  const submit = async () => {
    if (busy) return;
    if (description.trim().length < 30 || description.trim().length > 700) {
      setMessage('Please describe your connection to the business in 30–700 characters.');return;
    }
    setBusy(true);setMessage('');
    try {
      await auth.rpc<string>('civic_request_claim',{_place_id:id,_statement:description.trim()});
      setSubmitted(true);
      setMessage('Claim request received for review. It does not transfer ownership or make you a verified owner.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Claim request could not be sent.');
    } finally { setBusy(false); }
  };
  return <>
    <InfoDialog title="Claim this listing" onClose={onClose}>
      <div className="about-dialog-copy">
        <p><strong>{name}</strong></p>
        <p>The listing may have been imported from a public source. A claim is only a request to begin ownership verification, not immediate control of business details.</p>
        {!auth.available ? <p className="privacy-notice">Claims are not accepting data on this deployment. An approved email sign-in and private moderation system must be activated first.</p> :
         !auth.account ? <>
           <p className="privacy-notice">Sign in using your email to start a moderated claim request. No ID documents are collected here.</p>
           <button type="button" className="quiet-action" onClick={() => setAuthOpen(true)}>Sign in to request a claim</button>
         </> : submitted ? <p className="privacy-notice" role="status">{message}</p> :
         <form onSubmit={event => { event.preventDefault();void submit(); }}>
           <p className="note">Signed in as {auth.account.email}. This verifies your email, not business ownership.</p>
           <label htmlFor="claim-explanation">How are you connected to this business?</label>
           <textarea id="claim-explanation" required minLength={30} maxLength={700} rows={4}
             value={description} onChange={event => setDescription(event.target.value)}
             placeholder="I manage this business and can provide evidence to a moderator through an approved process…" />
           <div className="field-bottom"><span>No documents or GPS collected</span><span>{description.length} / 700</span></div>
           <p className="note">Your explanation is stored privately and shown only to authorized reviewers; never publish sensitive ID numbers or passwords here.</p>
           <button type="submit" disabled={busy} className="primary-action">Request ownership review</button>
         </form>}
        {message && !submitted && <p role="status" className="note">{message}</p>}
      </div>
    </InfoDialog>
    {authOpen && <CitizenSignIn onClose={() => setAuthOpen(false)} />}
  </>;
}

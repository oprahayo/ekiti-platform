import * as React from 'react';
import { Link } from 'react-router';
import { eraseLocalReportDrafts } from './report-safeguarding.ts';

/**
 * Accurate description of today's *preview*. Never present this as an approved
 * legal privacy notice for an intake service that is not operational.
 */
export default function ReportPrivacy() {
  const [eraseStatus,setEraseStatus] = React.useState<'idle'|'cleared'|'failed'>('idle');
  function erase() {
    if (!window.confirm('Delete saved report drafts from this browser? This cannot be undone.')) return;
    try {
      const result = eraseLocalReportDrafts(window.sessionStorage, window.localStorage);
      setEraseStatus(result.ok ? 'cleared' : 'failed');
    } catch {
      setEraseStatus('failed');
    }
  }
  return <main className="page preview-privacy-page" id="main">
    <header className="page-heading">
      <p className="eyebrow">Reporting preview</p>
      <h1>Privacy and safety</h1>
      <p className="help-text">What the current draft tool does — and what it does not do.</p>
    </header>
    <section className="preview-privacy-section">
      <h2>Who operates this?</h2>
      <p>Ekiti Civic is an independent civic project, not a government agency or emergency service.
        Its responsible legal operator, privacy contact and processing policy are not yet verified or approved for live report collection.
        The preview cannot accept a report or notify any office.</p>
    </section>
    <section className="preview-privacy-section">
      <h2>What stays in your browser?</h2>
      <p>The guided report asks for a description, category and Ekiti local government area, with an optional community.
        These answers are held in the open tab. Only if you explicitly choose to save, they are copied into
        this browser tab's session storage. A saved guided draft can be reopened for up to 24 hours;
        expired copies are removed when the reporting page is opened again, not by a background deletion service.</p>
      <p>Contact details and media are not included in that saved guided draft. Recordings and selected evidence
        are only held in the current page's memory and are lost on reload. An audio/video recording is not
        continuously secured on a server. Older text-draft tools may also have left local copies on this browser.</p>
      <p>Browser storage is not a secure vault. Someone with access to this browser or device may be able to see
        a saved draft. Do not include names, home addresses, minors' faces, identifying allegations or details
        that might expose you or another person to danger.</p>
    </section>
    <section className="preview-privacy-section">
      <h2>Incident location versus device position</h2>
      <p>Choosing an LGA manually does not request device location. The current location used for
        Explore is never automatically copied into a report. On the incident-location step, you can
        optionally check coordinates you know, or request device location only when physically at
        the incident. The browser asks permission on that action, not when the page opens.</p>
      <p>When you select Check, the coordinates are sent to this project's first-party
        <code>/api/resolve</code> endpoint to compare with verified Ekiti boundaries.
        The response can be outside Ekiti, uncertain, incomplete or inconsistent;
        the tool will not silently assign an LGA. You must confirm a suggested area yourself.
        Raw coordinates and any matched ward are not included in saved report drafts,
        and this check does not create or submit a report.</p>
      <p>Precise location checks are unavailable in sensitive-report preview mode.
        Browser and network infrastructure may still process a location request transiently;
        avoid sending exact household or vulnerable-person locations.</p>
    </section>
    <section className="preview-privacy-section">
      <h2>Optional nearby directory search</h2>
      <p>Explore includes a separate Find nearby places by distance action. Only after you press it
        will the browser ask for your current device location and, if permission is granted,
        send the coordinate pair in a short-lived request body to the first-party
        <code>/api/places/nearby</code> endpoint. A separate Near me control only filters by
        verified Ekiti LGA; it is not a true distance ranking.</p>
      <p>When authorized and available, nearby results are limited to source-reviewed,
        published listings with reviewed coordinates inside the verified LGA polygon.
        Approximate distances are straight-line only. The app does not store your raw
        position in report drafts, persistent browser storage or returned directory
        results. Network providers and server infrastructure may still process
        connection details, so no claim of complete anonymity is made.
        This service is disabled until its geographic-query migration is reviewed
        and activated independently.</p>
    </section>
    <section className="preview-privacy-section">
      <h2>Optional citizen account and private report links</h2>
      <p>Guest browsing and unsent drafts never require registration. A separately enabled
        Supabase Auth sign-in can verify an email using a one-time code. SMS sign-in
        is only available if an approved delivery provider and an independent phone-OTP
        release flag are configured. A verified contact is not proof of legal identity,
        Ekiti residency or ownership of a report. The same verified contact can recover
        its account on another device after a new OTP; email and phone accounts are not
        automatically merged.</p>
      <p>Account tokens are presently held in tab-scoped sessionStorage, readable by
        scripts on this origin. They are removed on local sign-out; short-lived access
        tokens can remain valid until expiry. Browsing as a guest is safer for residents
        concerned about sharing contact information.</p>
      <p>Private report history is a separate, currently disabled feature. If approved,
        a report can be linked to an account only by presenting the specific report's
        server-issued UUID and 256-bit receipt secret after sign-in and confirming the
        link. The platform must never infer ownership from matching contact, location,
        internet address or device. Only sanitized platform timeline labels and receipt
        references may appear in My Reports, not descriptions, contact details, evidence
        or government acknowledgement claims. Unlinking removes the account relationship,
        not the report itself. The report and its link remain subject to independent
        retention and deletion controls.</p>
    </section>
    <section className="preview-privacy-section">
      <h2>One-time email/SMS case links</h2>
      <p>A separate, currently disabled case-link feature would allow an already
        email/phone-verified account holder to request a one-time private
        link for a submitted report only after supplying its original secret
        receipt and consenting to delivery to their existing verified contact.
        The app cannot verify an arbitrary contact or infer that knowing a
        phone number gives ownership of another person's report.</p>
      <p>If separately approved, delivery attempts would use a short-lived
        256-bit random ticket, retained in the database only as a digest.
        The ticket is transmitted to the configured message provider and appears
        in the link's URL fragment; fragments can still appear in browser
        history, screenshots, copied links and message-provider logs until
        cleared. The app immediately removes it from the address on opening
        the link, then requests verified account sign-in and a deliberate
        redemption click before any private case association. Tickets expire
        after 10 minutes and are consumed once.</p>
      <p>The delivery queue distinguishes queued, in-progress and
        provider-accepted messages. <strong>Provider acceptance does not prove
        the message reached the recipient.</strong> A retry generates a
        different ticket, so an older message's link may stop working.
        No emergency dispatch, government office delivery, or public case
        acknowledgement follows from sending or opening a link. Currently
        <strong> no actual email or SMS provider is connected</strong>,
        and no case message is being delivered.</p>
    </section>
    <section className="preview-privacy-section">
      <h2>Delete saved local drafts</h2>
      <p>Delete saved guided and legacy text drafts from this browser. This does not delete downloaded copies,
        content you have shared elsewhere, data held by another device or active text still on a different open tab.
        This control is not a future server-side data-erasure request.</p>
      <button type="button" className="quiet-action" onClick={erase}>Delete saved report drafts in this browser</button>
      {eraseStatus==='cleared' && <p role="status" className="preview-privacy-result">
        Saved report draft keys were cleared from this browser's local and session storage.</p>}
      {eraseStatus==='failed' && <p role="alert" className="guided-error">
        Some browser storage could not be cleared. Check browser permissions or manually clear site data.</p>}
    </section>
    <section className="preview-privacy-section">
      <h2>Reporting threats or harm</h2>
      <p>For an immediate threat, contact real local emergency services. The app cannot dispatch police,
        medical aid or a safeguarding specialist. For reports involving children, vulnerable people or
        fear of retaliation, avoid personally identifying details and use the privacy choices in the report
        flow. Sensitive-media capture is disabled in this preview when those choices are selected.</p>
    </section>
    <section className="preview-privacy-section">
      <h2>Before any live report collection</h2>
      <p>The responsible operator must approve and publish an accurate privacy notice, legal basis, contacts,
        retention and deletion schedule (including backups), security and access controls, moderator procedures,
        rights handling and response to harmful or threatening reports. These are <strong>pending decisions</strong>;
        this page is not a claim that such procedures already operate.</p>
    </section>
    <p className="guided-independent-note">No report reference, government acknowledgement, case status or
      public case publication is generated in the current preview.</p>
    <Link className="text-link" to="/report">Return to report</Link>
  </main>;
}

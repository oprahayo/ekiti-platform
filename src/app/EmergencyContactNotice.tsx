import * as React from 'react';
import {EKITI_EMERGENCY_CONTACT} from './ekiti-emergency-contacts.ts';

export default function EmergencyContactNotice() {
  const contact=EKITI_EMERGENCY_CONTACT;
  return <aside className="ekiti-emergency-contact" role="alert" aria-label="Emergency contact guidance">
    <strong>Emergency? Call for help first.</strong>
    <p>If you are in Ekiti State and someone is in immediate danger,
      call Nigeria's emergency line. This website does not dispatch responders.</p>
    <a className="ekiti-emergency-call" href={'tel:'+contact.number}>
      Call {contact.number}
    </a>
    <p>If you cannot reach emergency services, you may still continue preparing a report
      here, but an online report is <strong>not an emergency call or guaranteed response.</strong>
      {' '}No report from this preview is currently sent to a ministry.</p>
    <p className="ekiti-emergency-contact-source">
      <a href={contact.source} rel="noopener noreferrer" target="_blank">Ekiti State emergency guidance</a>
      {' · '}<a href={contact.secondarySource} rel="noopener noreferrer" target="_blank">NCC 112 information</a>
    </p>
  </aside>;
}

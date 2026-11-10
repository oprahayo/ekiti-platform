import * as React from 'react';

interface Props {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

/** Native modal preserves focus trapping, Escape handling and screen-reader isolation. */
export default function InfoDialog({ title, onClose, children }: Props) {
  const dialog = React.useRef<HTMLDialogElement>(null);
  const close = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    node.showModal();
    close.current?.focus();
    return () => { if (node.open) node.close(); };
  }, []);
  return <dialog className="civic-dialog" ref={dialog} onClose={onClose}
    onCancel={event => { event.preventDefault(); onClose(); }}
    aria-labelledby="civic-dialog-title">
    <div className="civic-dialog-body">
      <div className="civic-dialog-head">
        <h2 id="civic-dialog-title">{title}</h2>
        <button ref={close} type="button" className="icon-control" aria-label="Close dialog" onClick={onClose}>×</button>
      </div>
      {children}
    </div>
  </dialog>;
}

export function AboutContent() {
  return <div className="about-dialog-copy">
    <p><strong>Ekiti Civic</strong> is an independent, citizen-focused information and service platform for Ekiti State, including its Yellow Pages directory.</p>
    <p>Ask questions in English or Yoruba, explore sourced local listings, and prepare civic reports through conversation.</p>
    <ul>
      <li>Source-linked answers and carefully reviewed information</li>
      <li>Business listings with clear source and owner-claim status</li>
      <li>Private report drafting without a government-affiliation claim</li>
      <li>Ratings and reviews planned with moderation and genuine identity safeguards</li>
    </ul>
    <p className="privacy-notice"><strong>Independent civic project · Not a government service.</strong> We do not submit a report to an agency unless a real secure reporting integration is launched.</p>
    <h3>Contact & support</h3>
    <p>Use <a href="mailto:inekitikete@gmail.com">inekitikete@gmail.com</a> to contact the project. This address is taken from the supplied design reference and requires owner confirmation before public launch.</p>
    <p className="metadata">UI preview · Authentication, submissions and listing claims are not yet active.</p>
  </div>;
}

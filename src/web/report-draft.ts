interface DraftLocation {
  lga: string;
  ward: string;
  place: string;
  evidence: string;
}

export function enableDraftDownload(readLocation: () => DraftLocation) {
  const form = document.querySelector<HTMLFormElement>('#draft-form')!;
  const kind = document.querySelector<HTMLSelectElement>('#draft-kind')!;
  const description = document.querySelector<HTMLTextAreaElement>('#draft-description')!;
  const status = document.querySelector<HTMLElement>('#draft-status')!;

  form.addEventListener('input', () => {
    description.setCustomValidity('');
    status.textContent = '';
  });
  form.addEventListener('reset', () => {
    description.setCustomValidity('');
    status.textContent = 'Report fields cleared.';
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const text = description.value.trim();
    if (!text) {
      description.setCustomValidity('Describe what happened before downloading.');
      description.reportValidity();
      return;
    }

    const location = readLocation();
    const contents = [
      'Ekiti civic report draft · Unsubmitted',
      '',
      kind.value,
      text,
      '',
      'Local government area: ' + location.lga,
      'Electoral ward (manual): ' + location.ward,
      'Town or landmark: ' + location.place,
      location.evidence,
    ].join('\n');
    const url = URL.createObjectURL(
      new Blob([contents + '\n'], { type: 'text/plain;charset=utf-8' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = 'ekiti-report-draft.txt';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    status.textContent = 'Draft download requested. You can edit it here and download a new copy.';
  });
}

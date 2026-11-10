import './style.css';
import { selectedLocation } from './location-picker.ts';
import { enableDraftDownload } from './report-draft.ts';

enableDraftDownload(selectedLocation);

// Navigating from a homepage action opens the otherwise-collapsed private draft.
const draft = document.querySelector<HTMLDetailsElement>('.draft');
document.querySelectorAll<HTMLAnchorElement>('[data-open-draft]').forEach((link) => {
  link.addEventListener('click', () => {
    if (draft) draft.open = true;
  });
});
